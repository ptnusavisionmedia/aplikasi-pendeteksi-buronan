import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/buronan.dart';
import '../widgets/back_button.dart';
import '../widgets/retry_image.dart';

/// GET /buronan/:id — seluruh foto terdaftar (bukan cuma foto utama) + riwayat deteksi. Dipakai
/// satu-satunya oleh layar ini, jadi tidak perlu family cache lintas layar seperti
/// buronanListProvider.
final buronanDetailProvider = FutureProvider.autoDispose.family<BuronanDetail, String>((ref, id) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/buronan/$id');
  return BuronanDetail.fromJson(response.data as Map<String, dynamic>);
});

const _ancamanTone = {
  'Tinggi': (AppColors.coralSoft, AppColors.coral),
  'Sedang': (AppColors.amberSoft, AppColors.amber),
  'Rendah': (AppColors.canvas, AppColors.muted),
};

/// Detail buronan mobile: foto utama besar + galeri SELURUH foto terdaftar (ketuk untuk lihat
/// penuh layar) + riwayat deteksi — paritas dengan apps/web/src/app/(dashboard)/buronan/[id]/
/// page.tsx "Foto Terdaftar" & "Riwayat Deteksi", minus kontrol kelola (tambah foto/edit
/// status/hapus) yang tetap eksklusif dashboard web.
class BuronanDetailScreen extends ConsumerWidget {
  final String id;

  const BuronanDetailScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(buronanDetailProvider(id));

    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallbackRoute: '/buronan'), title: const Text('Detail Buronan')),
      body: SafeArea(
        child: detailAsync.when(
          data: (detail) => _BuronanDetailBody(detail: detail),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Gagal memuat detail buronan: ${apiErrorMessage(err)}', style: const TextStyle(color: AppColors.coral)),
            ),
          ),
        ),
      ),
    );
  }
}

class _BuronanDetailBody extends StatelessWidget {
  final BuronanDetail detail;

  const _BuronanDetailBody({required this.detail});

  @override
  Widget build(BuildContext context) {
    final b = detail.buronan;
    final tone = _ancamanTone[b.tingkatAncaman] ?? (AppColors.canvas, AppColors.muted);
    final primaryFoto = b.fotos.firstWhere((f) => f.isPrimary, orElse: () => b.fotos.isNotEmpty ? b.fotos.first : BuronanFoto(id: '', urlFoto: '', isPrimary: false));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: primaryFoto.urlFoto.isNotEmpty
              ? RetryImage(url: primaryFoto.urlFoto, height: 220, width: double.infinity, fit: BoxFit.cover)
              : Container(
                  height: 220,
                  color: AppColors.canvas,
                  alignment: Alignment.center,
                  child: const Icon(Icons.person_search_outlined, color: AppColors.muted, size: 40),
                ),
        ),
        const SizedBox(height: 14),
        Text(b.nama, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        const SizedBox(height: 2),
        Text('Kasus #${b.nomorKasus}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
        const SizedBox(height: 10),
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: AppColors.coralSoft, borderRadius: BorderRadius.circular(20)),
              child: Text(b.status.replaceAll('_', ' '), style: const TextStyle(color: AppColors.coral, fontWeight: FontWeight.w700, fontSize: 11)),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: tone.$1, borderRadius: BorderRadius.circular(20)),
              child: Text('Ancaman ${b.tingkatAncaman}', style: TextStyle(color: tone.$2, fontWeight: FontWeight.w700, fontSize: 11)),
            ),
          ],
        ),
        if (b.createdAt != null) ...[
          const SizedBox(height: 10),
          Text('Terdaftar ${DateFormat('dd MMM yyyy').format(b.createdAt!)}', style: const TextStyle(color: AppColors.muted, fontSize: 11.5)),
        ],
        const SizedBox(height: 22),
        Text('Foto Terdaftar (${b.fotos.length})', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const SizedBox(height: 10),
        if (b.fotos.isEmpty)
          const Text('Belum ada foto wajah terdaftar.', style: TextStyle(color: AppColors.muted, fontSize: 12.5))
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1,
            ),
            itemCount: b.fotos.length,
            itemBuilder: (context, index) {
              final foto = b.fotos[index];
              return InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => _openLightbox(context, b.fotos, index),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      RetryImage(url: foto.urlFoto, fit: BoxFit.cover),
                      if (foto.isPrimary)
                        Positioned(
                          top: 4,
                          left: 4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(6)),
                            child: const Text('Utama', style: TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.w700)),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        const SizedBox(height: 22),
        const Text('Riwayat Deteksi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const SizedBox(height: 10),
        if (detail.detectionEvents.isEmpty)
          const Text('Belum ada deteksi untuk buronan ini.', style: TextStyle(color: AppColors.muted, fontSize: 12.5))
        else
          ...detail.detectionEvents.map((d) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(14)),
                child: Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.face_retouching_natural_outlined, color: AppColors.muted, size: 17),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(d.status.replaceAll('_', ' '), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
                          Text(DateFormat('HH:mm, dd MMM yyyy').format(d.detectedAt), style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                        ],
                      ),
                    ),
                    Text('${(d.confidenceScore * 100).round()}%', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5)),
                  ],
                ),
              )),
      ],
    );
  }

  void _openLightbox(BuildContext context, List<BuronanFoto> fotos, int initialIndex) {
    Navigator.of(context).push(PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black87,
      pageBuilder: (context, animation, secondaryAnimation) => _PhotoLightbox(fotos: fotos, initialIndex: initialIndex),
    ));
  }
}

/// Lightbox layar penuh dengan swipe antar-foto + pinch-to-zoom — padanan modal lightbox di
/// dashboard web (apps/web/src/app/(dashboard)/buronan/[id]/page.tsx), diperluas dengan swipe
/// karena di mobile menggeser antar-foto lebih wajar daripada tutup-buka ulang per foto.
class _PhotoLightbox extends StatefulWidget {
  final List<BuronanFoto> fotos;
  final int initialIndex;

  const _PhotoLightbox({required this.fotos, required this.initialIndex});

  @override
  State<_PhotoLightbox> createState() => _PhotoLightboxState();
}

class _PhotoLightboxState extends State<_PhotoLightbox> {
  late final PageController _controller = PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Stack(
          children: [
            PageView.builder(
              controller: _controller,
              itemCount: widget.fotos.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) => InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: Center(child: RetryImage(url: widget.fotos[i].urlFoto, fit: BoxFit.contain)),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close, color: Colors.white),
              ),
            ),
            if (widget.fotos.length > 1)
              Positioned(
                bottom: 18,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                    child: Text('${_index + 1} / ${widget.fotos.length}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
