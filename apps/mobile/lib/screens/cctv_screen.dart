import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/cctv_feed.dart';
import '../state/auth_provider.dart';

/// Read-only: mobile only ever GETs /cctv-feeds. Adding, editing or
/// deactivating a feed stays admin-only on the web dashboard.
final cctvFeedsProvider = FutureProvider.autoDispose<List<CctvFeed>>((ref) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/cctv-feeds');
  return (response.data as List).map((e) => CctvFeed.fromJson(e as Map<String, dynamic>)).toList();
});

class CctvScreen extends ConsumerWidget {
  const CctvScreen({super.key});

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
              const Text('Masuk untuk memantau CCTV', textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => context.push('/login'), child: const Text('Masuk')),
            ],
          ),
        ),
      );
    }

    final feedsAsync = ref.watch(cctvFeedsProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async => ref.refresh(cctvFeedsProvider),
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('CCTV', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                    const SizedBox(height: 2),
                    Text(
                      feedsAsync.maybeWhen(
                        data: (items) => '${items.length} kamera terpantau · pantau saja, tambah/kelola dari dashboard web',
                        orElse: () => 'Pantau status kamera terdaftar',
                      ),
                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
            feedsAsync.when(
              data: (items) {
                if (items.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('Belum ada kamera CCTV terdaftar.', style: TextStyle(color: AppColors.muted)),
                    ),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  sliver: SliverList.separated(
                    itemCount: items.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 10),
                    itemBuilder: (context, index) => _CctvCard(feed: items[index]),
                  ),
                );
              },
              loading: () => const SliverToBoxAdapter(
                child: Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
              ),
              error: (err, _) => SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Gagal memuat daftar CCTV: ${apiErrorMessage(err)}', style: const TextStyle(color: AppColors.coral)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CctvCard extends StatelessWidget {
  final CctvFeed feed;

  const _CctvCard({required this.feed});

  @override
  Widget build(BuildContext context) {
    final isActive = feed.status == 'ACTIVE';
    final badgeBg = isActive ? AppColors.primarySoft : AppColors.canvas;
    final badgeText = isActive ? AppColors.primaryInk : AppColors.muted;

    return BentoCell(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.videocam_outlined, color: AppColors.ink, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(feed.nama, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5), overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text('${feed.lokasi} · ${feed.wilayah}',
                    style: const TextStyle(color: AppColors.muted, fontSize: 11.5), overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text('Terdaftar ${DateFormat('dd MMM yyyy').format(feed.createdAt)}',
                    style: const TextStyle(color: AppColors.muted, fontSize: 10.5)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(20)),
            child: Text(feed.status, style: TextStyle(color: badgeText, fontWeight: FontWeight.w700, fontSize: 10.5)),
          ),
        ],
      ),
    );
  }
}
