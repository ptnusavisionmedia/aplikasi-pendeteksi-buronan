import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/buronan.dart';
import '../state/auth_provider.dart';
import '../widgets/back_button.dart';
import '../widgets/retry_image.dart';

/// Read-only: mobile hanya menampilkan daftar DPO untuk kewaspadaan masyarakat. Tambah/edit/hapus
/// data buronan tetap eksklusif dashboard web (sama seperti CCTV, lihat cctv_screen.dart).
final buronanListProvider = FutureProvider.autoDispose<List<Buronan>>((ref) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/buronan', queryParameters: {'status': 'DPO_AKTIF', 'limit': 50});
  final items = response.data['items'] as List;
  return items.map((e) => Buronan.fromJson(e as Map<String, dynamic>)).toList();
});

const _ancamanTone = {
  'Tinggi': (AppColors.coralSoft, AppColors.coral),
  'Sedang': (AppColors.amberSoft, AppColors.amber),
  'Rendah': (AppColors.canvas, AppColors.muted),
};

class BuronanScreen extends ConsumerStatefulWidget {
  const BuronanScreen({super.key});

  @override
  ConsumerState<BuronanScreen> createState() => _BuronanScreenState();
}

class _BuronanScreenState extends ConsumerState<BuronanScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    if (!auth.isAuthenticated) {
      return Scaffold(
        appBar: AppBar(leading: const AppBackButton(), title: const Text('Daftar Buronan')),
        body: const Center(child: Text('Masuk untuk melihat daftar buronan')),
      );
    }

    final itemsAsync = ref.watch(buronanListProvider);

    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: const Text('Daftar Buronan')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.refresh(buronanListProvider),
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
                    decoration: const InputDecoration(
                      hintText: 'Cari nama atau nomor kasus...',
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
                              i.nama.toLowerCase().contains(_query) || i.nomorKasus.toLowerCase().contains(_query))
                          .toList();
                  if (filtered.isEmpty) {
                    return const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('Tidak ada buronan DPO aktif.', style: TextStyle(color: AppColors.muted)),
                      ),
                    );
                  }
                  return SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                    sliver: SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 0.72,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => _BuronanCard(item: filtered[index]),
                        childCount: filtered.length,
                      ),
                    ),
                  );
                },
                loading: () => const SliverToBoxAdapter(
                  child: Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
                ),
                error: (err, _) => SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('Gagal memuat daftar buronan: ${apiErrorMessage(err)}', style: const TextStyle(color: AppColors.coral)),
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

class _BuronanCard extends StatelessWidget {
  final Buronan item;

  const _BuronanCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final tone = _ancamanTone[item.tingkatAncaman] ?? (AppColors.canvas, AppColors.muted);
    return BentoCell(
      padding: const EdgeInsets.all(10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: item.fotoUtamaUrl != null
                  ? RetryImage(url: item.fotoUtamaUrl!, width: double.infinity, fit: BoxFit.cover)
                  : Container(
                      color: AppColors.canvas,
                      child: const Icon(Icons.person_search_outlined, color: AppColors.muted, size: 28),
                    ),
            ),
          ),
          const SizedBox(height: 8),
          Text(item.nama, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text('#${item.nomorKasus}', style: const TextStyle(color: AppColors.muted, fontSize: 10.5), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: tone.$1, borderRadius: BorderRadius.circular(20)),
            child: Text('Ancaman ${item.tingkatAncaman}', style: TextStyle(color: tone.$2, fontWeight: FontWeight.w700, fontSize: 9.5)),
          ),
        ],
      ),
    );
  }
}
