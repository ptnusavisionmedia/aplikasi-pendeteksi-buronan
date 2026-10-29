import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/detection.dart';
import '../state/auth_provider.dart';

class _Instansi {
  final String id;
  final String nama;
  final String wilayah;

  _Instansi({required this.id, required this.nama, required this.wilayah});

  factory _Instansi.fromJson(Map<String, dynamic> json) =>
      _Instansi(id: json['id'] as String, nama: json['nama'] as String, wilayah: json['wilayah'] as String);
}

final detectionDetailProvider =
    FutureProvider.autoDispose.family<DetectionEvent, String>((ref, id) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/detections/$id');
  return DetectionEvent.fromJson(response.data as Map<String, dynamic>);
});

final instansiListProvider = FutureProvider.autoDispose<List<_Instansi>>((ref) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/instansi');
  return (response.data as List).map((e) => _Instansi.fromJson(e as Map<String, dynamic>)).toList();
});

class DetectionDetailScreen extends ConsumerStatefulWidget {
  final String id;

  const DetectionDetailScreen({super.key, required this.id});

  @override
  ConsumerState<DetectionDetailScreen> createState() => _DetectionDetailScreenState();
}

class _DetectionDetailScreenState extends ConsumerState<DetectionDetailScreen> {
  String? _selectedInstansiId;
  bool _escalating = false;
  String? _escalationError;
  String? _escalationSuccess;

  Future<void> _escalate() async {
    if (_selectedInstansiId == null) return;
    setState(() {
      _escalating = true;
      _escalationError = null;
    });
    final dio = ref.read(dioProvider);
    try {
      await dio.post('/escalations', data: {
        'detectionEventId': widget.id,
        'instansiTujuanId': _selectedInstansiId,
      });
      setState(() => _escalationSuccess = 'Eskalasi berhasil dibuat.');
    } catch (err) {
      setState(() => _escalationError = apiErrorMessage(err, 'Gagal membuat eskalasi'));
    } finally {
      if (mounted) setState(() => _escalating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(detectionDetailProvider(widget.id));
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(title: const Text('Detail Deteksi')),
      body: SafeArea(
        child: detailAsync.when(
          data: (event) {
            final confidencePct = (event.confidenceScore * 100).round();
            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: Stack(
                      children: [
                        if (event.evidence != null)
                          Image.network(event.evidence!.fileUrl, height: 180, width: double.infinity, fit: BoxFit.cover)
                        else
                          Container(
                            height: 180,
                            width: double.infinity,
                            color: AppColors.ink.withValues(alpha: 0.85),
                            alignment: Alignment.center,
                            child: const Text('Tidak ada evidence', style: TextStyle(color: Colors.white70)),
                          ),
                        Positioned(
                          top: 12,
                          left: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(color: AppColors.coral, borderRadius: BorderRadius.circular(10)),
                            child: Text('$confidencePct% Confidence',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(event.buronan?.nama ?? 'Tidak dikenali',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  Text(
                    '${event.cctvFeed?.lokasi ?? 'Upload manual'} · ${DateFormat('HH:mm, dd MMM yyyy').format(event.detectedAt)}',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: BentoCell(
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Status', style: TextStyle(color: AppColors.muted, fontSize: 11)),
                              Text(event.status, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: BentoCell(
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Evidence', style: TextStyle(color: AppColors.muted, fontSize: 11)),
                              Text(event.evidence != null ? 'Tersedia' : 'Belum ada',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (user?.canEscalate ?? false) ...[
                    const SizedBox(height: 20),
                    const Text('Buat Eskalasi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 8),
                    if (event.evidence == null)
                      const Text('Eskalasi butuh evidence; belum tersedia untuk deteksi ini.',
                          style: TextStyle(color: AppColors.coral, fontSize: 12.5))
                    else ...[
                      if (_escalationError != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(_escalationError!, style: const TextStyle(color: AppColors.coral, fontSize: 12.5)),
                        ),
                      if (_escalationSuccess != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(_escalationSuccess!, style: const TextStyle(color: AppColors.primary, fontSize: 12.5)),
                        ),
                      Consumer(builder: (context, ref, _) {
                        final instansiAsync = ref.watch(instansiListProvider);
                        return instansiAsync.when(
                          data: (list) => DropdownButtonFormField<String>(
                            initialValue: _selectedInstansiId,
                            decoration: const InputDecoration(labelText: 'Instansi tujuan'),
                            items: list
                                .map((i) => DropdownMenuItem(value: i.id, child: Text('${i.nama} · ${i.wilayah}')))
                                .toList(),
                            onChanged: (value) => setState(() => _selectedInstansiId = value),
                          ),
                          loading: () => const LinearProgressIndicator(),
                          error: (err, _) => Text('Gagal memuat instansi: ${apiErrorMessage(err)}'),
                        );
                      }),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _escalating || _selectedInstansiId == null ? null : _escalate,
                          icon: const Icon(Icons.warning_amber_rounded, size: 18),
                          label: Text(_escalating ? 'Mengirim...' : 'Kirim Eskalasi'),
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.coral),
                        ),
                      ),
                    ],
                  ],
                ],
              ),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(child: Text('Gagal memuat data: ${apiErrorMessage(err)}')),
        ),
      ),
    );
  }
}
