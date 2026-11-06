import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/berita_acara.dart';
import '../state/auth_provider.dart';
import '../widgets/retry_image.dart';

final homeBeritaAcaraProvider = FutureProvider.autoDispose<List<BeritaAcara>>((ref) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/berita-acara', queryParameters: {'status': 'TERBIT', 'limit': 8});
  final items = response.data['items'] as List;
  return items.map((e) => BeritaAcara.fromJson(e as Map<String, dynamic>)).toList();
});

class _NavIcon {
  final IconData icon;
  final String label;
  final String path;
  const _NavIcon(this.icon, this.label, this.path);
}

const _navIcons = [
  _NavIcon(Icons.videocam_outlined, 'CCTV', '/cctv'),
  _NavIcon(Icons.newspaper_outlined, 'Berita', '/berita-acara'),
  _NavIcon(Icons.groups_outlined, 'Buronan', '/buronan'),
  _NavIcon(Icons.flag_outlined, 'Lapor', '/lapor'),
  _NavIcon(Icons.help_outline_rounded, 'Bantuan', '/bantuan'),
];

/// Home: pusat navigasi aplikasi lewat ikon (tidak ada bottom navigation bar — lihat
/// vault/03-Decisions untuk alasan), menampilkan feed Berita Acara publik (lihat
/// vault/03-Decisions/2026-11-01 - CMS Berita Acara...) sebagai pengganti daftar notifikasi
/// deteksi yang sekarang punya layar sendiri, dibuka lewat ikon lonceng di header.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final beritaAsync = ref.watch(homeBeritaAcaraProvider);
    final initials = auth.user?.initials ?? '?';

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.refresh(homeBeritaAcaraProvider),
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              auth.isAuthenticated ? 'Hai, ${auth.user?.nama.split(' ').first ?? ''} 👋' : 'Sigap Buronan',
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              auth.isAuthenticated ? 'Wilayah: ${auth.user?.wilayahScope ?? '-'}' : 'Masuk untuk fitur lengkap',
                              style: const TextStyle(color: AppColors.muted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      _HeaderIconButton(
                        icon: Icons.notifications_outlined,
                        onTap: () => context.push(auth.isAuthenticated ? '/notifikasi' : '/login'),
                      ),
                      const SizedBox(width: 8),
                      InkWell(
                        onTap: () => context.push(auth.isAuthenticated ? '/profil' : '/login'),
                        borderRadius: BorderRadius.circular(20),
                        child: CircleAvatar(
                          radius: 18,
                          backgroundColor: AppColors.primary,
                          child: auth.isAuthenticated
                              ? Text(initials, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12.5))
                              : const Icon(Icons.person_outline, color: Colors.white, size: 18),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    children: _navIcons
                        .map((nav) => Expanded(
                              child: InkWell(
                                onTap: () => context.push(nav.path),
                                borderRadius: BorderRadius.circular(16),
                                child: Column(
                                  children: [
                                    Container(
                                      width: 48,
                                      height: 48,
                                      decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(16)),
                                      child: Icon(nav.icon, color: AppColors.primaryInk, size: 22),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(nav.label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
                                  ],
                                ),
                              ),
                            ))
                        .toList(),
                  ),
                ),
              ),

              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => context.push('/lapor'),
                          icon: const Icon(Icons.campaign_outlined, size: 18),
                          label: const Text('Lapor Temuan'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => context.push('/status'),
                          icon: const Icon(Icons.checklist_rounded, size: 18),
                          label: const Text('Lihat Laporan'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              if (auth.isAuthenticated && (auth.user?.canEscalate ?? false))
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  sliver: SliverToBoxAdapter(
                    child: SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/manual-check'),
                        icon: const Icon(Icons.upload_outlined, size: 18),
                        label: const Text('Periksa Foto Manual'),
                      ),
                    ),
                  ),
                ),

              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Berita Acara Terbaru', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                      TextButton(
                        onPressed: () => context.push('/berita-acara'),
                        style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 0)),
                        child: const Text('Lihat semua', style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                ),
              ),
              beritaAsync.when(
                data: (items) {
                  if (items.isEmpty) {
                    return const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(16, 0, 16, 24),
                        child: Text('Belum ada berita acara.', style: TextStyle(color: AppColors.muted)),
                      ),
                    );
                  }
                  return SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    sliver: SliverList.separated(
                      itemCount: items.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 8),
                      itemBuilder: (context, index) => _BeritaRow(item: items[index]),
                    ),
                  );
                },
                loading: () => const SliverToBoxAdapter(
                  child: Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
                ),
                error: (err, _) => SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
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

class _HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _HeaderIconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(20)),
        child: Icon(icon, size: 18, color: AppColors.ink),
      ),
    );
  }
}

class _BeritaRow extends StatelessWidget {
  final BeritaAcara item;

  const _BeritaRow({required this.item});

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
                child: RetryImage(url: item.fotoUrl!, width: 52, height: 52),
              )
            else
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.newspaper_outlined, color: AppColors.muted),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.judul, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 3),
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
