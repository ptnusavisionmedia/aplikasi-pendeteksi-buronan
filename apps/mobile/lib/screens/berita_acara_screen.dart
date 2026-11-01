import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/berita_acara.dart';
import '../widgets/retry_image.dart';

final beritaAcaraListProvider = FutureProvider.autoDispose<List<BeritaAcara>>((ref) async {
  final dio = ref.read(dioProvider);
  // status=TERBIT eksplisit: mobile selalu menampilkan feed publik, terlepas dari role
  // pengguna yang sedang login (staf yang login tetap tidak perlu melihat draf di sini).
  final response = await dio.get('/berita-acara', queryParameters: {'status': 'TERBIT', 'limit': 50});
  final items = response.data['items'] as List;
  return items.map((e) => BeritaAcara.fromJson(e as Map<String, dynamic>)).toList();
});

/// Daftar lengkap berita acara resmi — ditulis petugas lewat CMS dashboard web, hanya yang
/// berstatus Terbit yang sampai ke sini (lihat GET /berita-acara di apps/api).
class BeritaAcaraScreen extends ConsumerStatefulWidget {
  const BeritaAcaraScreen({super.key});

  @override
  ConsumerState<BeritaAcaraScreen> createState() => _BeritaAcaraScreenState();
}

class _BeritaAcaraScreenState extends ConsumerState<BeritaAcaraScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final itemsAsync = ref.watch(beritaAcaraListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Berita Acara')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.refresh(beritaAcaraListProvider),
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
                    decoration: const InputDecoration(
                      hintText: 'Cari berita acara...',
                      prefixIcon: Icon(Icons.search, size: 20),
                    ),
                  ),
                ),
              ),
              itemsAsync.when(
                data: (items) {
                  final filtered = _query.isEmpty
                      ? items
                      : items
                          .where((i) =>
                              i.judul.toLowerCase().contains(_query) || i.ringkasan.toLowerCase().contains(_query))
                          .toList();
                  if (filtered.isEmpty) {
                    return const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('Belum ada berita acara.', style: TextStyle(color: AppColors.muted)),
                      ),
                    );
                  }
                  return SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                    sliver: SliverList.separated(
                      itemCount: filtered.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 10),
                      itemBuilder: (context, index) => _BeritaCard(item: filtered[index]),
                    ),
                  );
                },
                loading: () => const SliverToBoxAdapter(
                  child: Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
                ),
                error: (err, _) => SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('Gagal memuat berita acara: ${apiErrorMessage(err)}', style: const TextStyle(color: AppColors.coral)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BeritaCard extends StatelessWidget {
  final BeritaAcara item;

  const _BeritaCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/berita-acara/${item.id}', extra: item),
      borderRadius: BorderRadius.circular(16),
      child: BentoCell(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (item.fotoUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: RetryImage(url: item.fotoUrl!, width: 56, height: 56),
              )
            else
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.newspaper_outlined, color: AppColors.muted),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.judul, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 3),
                  Text(item.ringkasan, style: const TextStyle(color: AppColors.muted, fontSize: 11.5), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('dd MMM yyyy').format(item.publishedAt ?? item.createdAt),
                    style: const TextStyle(color: AppColors.muted, fontSize: 10.5),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
