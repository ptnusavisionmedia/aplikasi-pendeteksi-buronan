import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/notification.dart';
import '../state/auth_provider.dart';

final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/notifications');
  return (response.data as List).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    if (!auth.isAuthenticated) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 40, color: AppColors.muted),
              const SizedBox(height: 12),
              const Text('Masuk untuk melihat notifikasi deteksi', textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => context.push('/login'), child: const Text('Masuk')),
            ],
          ),
        ),
      );
    }

    final notificationsAsync = ref.watch(notificationsProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async => ref.refresh(notificationsProvider),
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Hai, ${auth.user?.nama.split(' ').first ?? ''} 👋',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                    const SizedBox(height: 2),
                    Text('Wilayah: ${auth.user?.wilayahScope ?? '-'}',
                        style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                    const SizedBox(height: 16),
                    if (auth.user?.canEscalate ?? false)
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => context.push('/manual-check'),
                          icon: const Icon(Icons.upload_outlined, size: 18),
                          label: const Text('Periksa Foto Manual'),
                        ),
                      ),
                    const SizedBox(height: 16),
                    const Text('Notifikasi Deteksi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
            notificationsAsync.when(
              data: (items) {
                if (items.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('Belum ada notifikasi.', style: TextStyle(color: AppColors.muted)),
                    ),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  sliver: SliverList.separated(
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
                  ),
                );
              },
              loading: () => const SliverToBoxAdapter(
                child: Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
              ),
              error: (err, _) => SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Gagal memuat notifikasi: ${apiErrorMessage(err)}', style: const TextStyle(color: AppColors.coral)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
