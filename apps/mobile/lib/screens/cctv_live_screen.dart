import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../widgets/back_button.dart';

/// POST /cctv-feeds/:id/live — memastikan MediaMTX sudah menarik stream kamera lalu
/// mengembalikan URL pemutaran. Mobile memakai HLS saja (ExoPlayer/AVPlayer di Android/iOS
/// memutarnya native lewat video_player) — WHEP/WebRTC latensi-rendah tetap eksklusif Mode
/// Fokus web untuk petugas, lihat vault/03-Decisions/2026-11-01 - CCTV Live-Streaming Mobile.
final liveStreamUrlProvider = FutureProvider.autoDispose.family<String, String>((ref, feedId) async {
  final dio = ref.read(dioProvider);
  final response = await dio.post('/cctv-feeds/$feedId/live');
  return response.data['hlsUrl'] as String;
});

class CctvLiveScreen extends ConsumerWidget {
  final String feedId;
  final String feedNama;

  const CctvLiveScreen({super.key, required this.feedId, required this.feedNama});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hlsUrlAsync = ref.watch(liveStreamUrlProvider(feedId));

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: const AppBackButton(fallbackRoute: '/cctv'),
        title: Text(feedNama),
      ),
      body: Center(
        child: hlsUrlAsync.when(
          data: (hlsUrl) => _HlsPlayer(hlsUrl: hlsUrl),
          loading: () => const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Colors.white),
              SizedBox(height: 12),
              Text('Menyiapkan live stream...', style: TextStyle(color: Colors.white70, fontSize: 12.5)),
            ],
          ),
          error: (err, _) => Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.videocam_off_outlined, color: Colors.white54, size: 36),
                const SizedBox(height: 12),
                Text(
                  apiErrorMessage(err, 'Gagal memuat live stream'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: () => ref.invalidate(liveStreamUrlProvider(feedId)),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white38)),
                  child: const Text('Coba Lagi'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HlsPlayer extends StatefulWidget {
  final String hlsUrl;

  const _HlsPlayer({required this.hlsUrl});

  @override
  State<_HlsPlayer> createState() => _HlsPlayerState();
}

// Posisi pemutaran dicek tiap interval ini; kalau tidak maju sama sekali dua kali berturut-turut
// (~_stallWatchdogInterval * 2) padahal video sedang play, dianggap macet/ketinggalan jauh dari
// live edge dan controller dibuat ulang dari awal — ini perbaikan utama untuk keluhan "stream
// sering ketinggalan dan tidak realtime": sebelumnya tidak ada pemulihan otomatis sama sekali
// saat koneksi HLS macet, jadi video tetap menampilkan frame lama tanpa batas waktu.
const _stallWatchdogInterval = Duration(seconds: 5);

class _HlsPlayerState extends State<_HlsPlayer> {
  VideoPlayerController? _controller;
  String? _error;
  Timer? _watchdog;
  Duration? _lastPosition;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    // Live stream — TIDAK pernah di-loop. `setLooping(true)` sebelumnya di sini adalah bug:
    // begitu pemutar mencapai ujung window segmen yang sudah di-buffer, ia melompat balik ke awal
    // alih-alih menunggu segmen baru, sehingga video terlihat "ketinggalan"/memutar ulang konten
    // lama padahal kameranya live.
    final controller = VideoPlayerController.networkUrl(Uri.parse(widget.hlsUrl));
    _controller = controller;
    try {
      await controller.initialize();
      await controller.play();
      if (mounted) {
        _lastPosition = controller.value.position;
        _watchdog?.cancel();
        _watchdog = Timer.periodic(_stallWatchdogInterval, (_) => _checkStall());
        setState(() {});
      }
    } catch (err) {
      if (mounted) setState(() => _error = 'Gagal memutar video — kamera mungkin sedang tidak tersedia.');
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
    final old = _controller;
    _controller = null;
    await old?.dispose();
    if (mounted) await _init();
  }

  @override
  void dispose() {
    _watchdog?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 12.5)),
      );
    }

    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      return const CircularProgressIndicator(color: Colors.white);
    }

    return AspectRatio(
      aspectRatio: controller.value.aspectRatio,
      child: Stack(
        alignment: Alignment.bottomRight,
        children: [
          VideoPlayer(controller),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.circle, color: AppColors.coral, size: 8),
                  SizedBox(width: 5),
                  Text('LIVE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 10.5)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
