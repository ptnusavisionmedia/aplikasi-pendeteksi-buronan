import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/detected_face.dart';
import '../models/live_detection_settings.dart';
import '../state/cctv_live_provider.dart';

// Posisi pemutaran dicek tiap interval ini; kalau tidak maju sama sekali dua kali berturut-turut
// (~_stallWatchdogInterval * 2) padahal video sedang play, dianggap macet/ketinggalan jauh dari
// live edge dan controller dibuat ulang dari awal — lihat cctv_live_screen.dart (versi lama)
// untuk latar belakang lengkap kenapa ini perlu.
const _stallWatchdogInterval = Duration(seconds: 5);

// Kotak deteksi yang lebih tua dari ini dianggap basi (loop kamera kemungkinan berhenti) dan
// disembunyikan, alih-alih dibiarkan "membeku" di layar selamanya — sama seperti
// apps/web/src/lib/use-live-detection.ts STALE_DETECTION_SECONDS.
const _staleDetectionSeconds = 8;

/// Live HLS player + overlay kotak deteksi wajah, dipakai bersama oleh kartu CCTV (thumbnail)
/// dan Mode Fokus (layar penuh) — supaya keduanya membaca stream & deteksi dengan cara yang
/// persis sama, mencerminkan split LiveFeedVideo/useLiveDetection di web. Lihat
/// vault/03-Decisions/2026-11-08 - CCTV Live Mobile - Bounding Box dan Kartu Live.md.
///
/// Video selalu dirender letterboxed (AspectRatio sesuai rasio asli stream, bukan di-crop
/// "cover") — ini membuat matematika posisi kotak deteksi sama persis antara kartu kecil dan
/// Mode Fokus, dengan trade-off tampilan kartu tidak memenuhi penuh area 16:9-nya untuk kamera
/// yang rasionya berbeda.
class LiveFeedPlayer extends ConsumerStatefulWidget {
  final String feedId;
  final bool mirror;
  final bool showDetection;
  final bool compact;

  const LiveFeedPlayer({
    super.key,
    required this.feedId,
    this.mirror = false,
    this.showDetection = false,
    this.compact = false,
  });

  @override
  ConsumerState<LiveFeedPlayer> createState() => _LiveFeedPlayerState();
}

class _LiveFeedPlayerState extends ConsumerState<LiveFeedPlayer> {
  VideoPlayerController? _controller;
  String? _error;
  Timer? _watchdog;
  Timer? _detectionTimer;
  Duration? _lastPosition;
  List<DetectedFace> _faces = [];

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final dio = ref.read(dioProvider);
      final response = await dio.post('/cctv-feeds/${widget.feedId}/live');
      final hlsUrl = response.data['hlsUrl'] as String;

      // Live stream — TIDAK pernah di-loop, lihat catatan di versi lama cctv_live_screen.dart:
      // setLooping(true) membuat pemutar melompat balik ke awal buffer alih-alih menunggu
      // segmen baru begitu mencapai ujung window yang sudah di-buffer.
      final controller = VideoPlayerController.networkUrl(Uri.parse(hlsUrl));
      _controller = controller;
      await controller.initialize();
      await controller.play();
      if (!mounted) return;
      _lastPosition = controller.value.position;
      _watchdog?.cancel();
      _watchdog = Timer.periodic(_stallWatchdogInterval, (_) => _checkStall());
      setState(() {});
      if (widget.showDetection) _startDetectionPolling();
    } catch (err) {
      if (mounted) setState(() => _error = 'Gagal memutar video — kamera mungkin sedang tidak tersedia.');
    }
  }

  void _startDetectionPolling() {
    _detectionTimer?.cancel();
    final pollMs = ref.read(liveDetectionSettingsProvider).maybeWhen(
          data: (s) => s.pollIntervalMs,
          orElse: () => 1200,
        );
    _pollDetection();
    _detectionTimer = Timer.periodic(Duration(milliseconds: pollMs), (_) => _pollDetection());
  }

  Future<void> _pollDetection() async {
    if (!mounted) return;
    try {
      final dio = ref.read(dioProvider);
      final response = await dio.get('/cctv-feeds/${widget.feedId}/live-detection');
      if (!mounted) return;
      final active = response.data['active'] as bool? ?? false;
      final rawFaces = (response.data['faces'] as List?) ?? const [];
      final faces = active
          ? rawFaces
              .map((e) => DetectedFace.fromJson(e as Map<String, dynamic>))
              .where((f) => f.ageSeconds <= _staleDetectionSeconds)
              .toList()
          : <DetectedFace>[];
      setState(() => _faces = faces);
    } catch (_) {
      if (mounted) setState(() => _faces = []);
    }
  }

  void _checkStall() {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized || !mounted) return;
    final position = controller.value.position;
    final stalled = controller.value.isPlaying && position == _lastPosition;
    _lastPosition = position;
    if (stalled) _reconnect();
  }

  Future<void> _reconnect() async {
    _watchdog?.cancel();
    _detectionTimer?.cancel();
    final old = _controller;
    _controller = null;
    _faces = [];
    if (mounted) setState(() {});
    await old?.dispose();
    if (mounted) await _init();
  }

  Future<void> _retry() async {
    setState(() => _error = null);
    await _init();
  }

  @override
  void dispose() {
    _watchdog?.cancel();
    _detectionTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Membuat provider "hangat" selama widget ini hidup, supaya _startDetectionPolling di atas
    // bisa langsung membaca nilainya begitu video siap.
    final settings = widget.showDetection
        ? ref.watch(liveDetectionSettingsProvider).maybeWhen(
              data: (s) => s,
              orElse: () => const LiveDetectionSettings.fallback(),
            )
        : const LiveDetectionSettings.fallback();

    if (_error != null) {
      return Container(
        color: Colors.black,
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(widget.compact ? 10 : 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.videocam_off_outlined, color: Colors.white54, size: widget.compact ? 22 : 36),
                SizedBox(height: widget.compact ? 6 : 12),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: widget.compact ? 10.5 : 12.5),
                ),
                if (!widget.compact) ...[
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: _retry,
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white38)),
                    child: const Text('Coba Lagi'),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      return Container(
        color: Colors.black,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: widget.compact ? 18 : 24,
                height: widget.compact ? 18 : 24,
                child: const CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              ),
              if (!widget.compact) ...[
                const SizedBox(height: 12),
                const Text('Menyiapkan live stream...', style: TextStyle(color: Colors.white70, fontSize: 12.5)),
              ],
            ],
          ),
        ),
      );
    }

    Widget video = LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight;
        return Stack(
          fit: StackFit.expand,
          children: [
            VideoPlayer(controller),
            if (widget.showDetection)
              ..._faces.map((face) => _FaceBox(
                    face: face,
                    stageWidth: w,
                    stageHeight: h,
                    mirror: widget.mirror,
                    color: tierColorFor(face.confidence, settings.reportThreshold, settings.matchThreshold),
                  )),
          ],
        );
      },
    );

    Widget stage = Container(
      color: Colors.black,
      child: Center(
        child: AspectRatio(aspectRatio: controller.value.aspectRatio, child: video),
      ),
    );

    if (widget.mirror) {
      stage = Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()..rotateY(math.pi),
        child: stage,
      );
    }

    return Stack(
      alignment: Alignment.bottomRight,
      children: [
        Positioned.fill(child: stage),
        Padding(
          padding: EdgeInsets.all(widget.compact ? 6 : 10),
          child: Container(
            padding: EdgeInsets.symmetric(horizontal: widget.compact ? 6 : 8, vertical: widget.compact ? 3 : 4),
            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.circle, color: AppColors.coral, size: widget.compact ? 6 : 8),
                const SizedBox(width: 5),
                Text('LIVE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: widget.compact ? 9 : 10.5)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Satu kotak deteksi, diposisikan dengan koordinat piksel absolut dari fraksi `face.bbox`
/// (0..1) dikali ukuran stage — supaya tetap presisi di ukuran render berapapun (kartu kecil
/// atau Mode Fokus layar penuh).
class _FaceBox extends StatelessWidget {
  final DetectedFace face;
  final double stageWidth;
  final double stageHeight;
  final bool mirror;
  final Color color;

  const _FaceBox({
    required this.face,
    required this.stageWidth,
    required this.stageHeight,
    required this.mirror,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final x0 = face.bbox[0].clamp(0.0, 1.0);
    final y0 = face.bbox[1].clamp(0.0, 1.0);
    final x1 = face.bbox[2].clamp(0.0, 1.0);
    final y1 = face.bbox[3].clamp(0.0, 1.0);
    final left = x0 * stageWidth;
    final top = y0 * stageHeight;
    final width = math.max(0.0, (x1 - x0) * stageWidth);
    final height = math.max(0.0, (y1 - y0) * stageHeight);
    final labelTop = top - 18 < 0 ? 0.0 : top - 18;

    return Positioned(
      left: left,
      top: top,
      width: width,
      height: height,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: color, width: 2),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          Positioned(
            left: 0,
            top: labelTop - top,
            // Mirror sudah membalik seluruh stage (video + kotak) lewat Transform di parent —
            // label perlu di-balik ulang supaya teksnya tetap terbaca normal, sama seperti
            // apps/web/src/components/live-feed-video.tsx (transform: mirror ? "scaleX(-1)").
            child: Transform(
              alignment: Alignment.center,
              transform: mirror ? (Matrix4.identity()..rotateY(math.pi)) : Matrix4.identity(),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
                child: Text(
                  '${(face.confidence * 100).round()}%',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 9),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
