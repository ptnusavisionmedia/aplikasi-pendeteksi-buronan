import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/notification.dart';
import '../widgets/back_button.dart';

final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/notifications');
  return (response.data as List).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
});

/// Dipindahkan dari blok inline di Home (dulu "Notifikasi Deteksi") ke layar tersendiri yang
/// dibuka lewat ikon lonceng di header Home — Home sendiri sekarang menampilkan feed berita acara.
class NotifikasiScreen extends ConsumerWidget {
  const NotifikasiScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: const Text('Notifikasi Deteksi')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.refresh(notificationsProvider),
          child: notificationsAsync.when(
            data: (items) {
              if (items.isEmpty) {
                return ListView(
                  children: const [
                    Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('Belum ada notifikasi.', style: TextStyle(color: AppColors.muted)),
                    ),
                  ],
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (context, index) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final n = items[index];
                  final event = n.detectionEvent;
                  final confidencePct = event != null ? (event.confidenceScore * 100).round() : null;
                  final isHighConfidence = confidencePct != null && confidencePct >= 85;
                  final tone = isHighConfidence ? AppColors.coralSoft : AppColors.amberSoft;
                  final toneText = isHighConfidence ? AppColors.coral : AppColors.amber;
                  return InkWell(
                    onTap: () => context.push('/detection/${n.detectionEventId}'),
                    borderRadius: BorderRadius.circular(16),
                    child: BentoCell(
                      color: tone,
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                            child: Icon(Icons.face_retouching_natural, color: toneText, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Match — ${event?.buronan?.nama ?? 'Deteksi'}',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  '${event?.cctvFeed?.lokasi ?? '-'} · ${DateFormat('HH:mm, dd MMM').format(n.createdAt)}',
                                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          if (confidencePct != null)
                            Text('$confidencePct%', style: TextStyle(fontWeight: FontWeight.w700, color: toneText, fontSize: 11)),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Gagal memuat notifikasi: ${apiErrorMessage(err)}', style: const TextStyle(color: AppColors.coral)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
