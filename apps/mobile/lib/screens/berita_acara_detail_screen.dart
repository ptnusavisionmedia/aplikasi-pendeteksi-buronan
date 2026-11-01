import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/berita_acara.dart';
import '../widgets/retry_image.dart';

final beritaAcaraDetailProvider =
    FutureProvider.autoDispose.family<BeritaAcara, String>((ref, id) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/berita-acara/$id');
  return BeritaAcara.fromJson(response.data as Map<String, dynamic>);
});

class BeritaAcaraDetailScreen extends ConsumerWidget {
  final String id;
  /// Item berita yang sudah dimuat lebih dulu di daftar (kalau dinavigasi dari sana) — dipakai
  /// sebagai tampilan awal supaya tidak ada jeda blank sebelum GET /berita-acara/:id selesai.
  final BeritaAcara? preloaded;

  const BeritaAcaraDetailScreen({super.key, required this.id, this.preloaded});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(beritaAcaraDetailProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Berita Acara')),
      body: detailAsync.when(
        data: (item) => _DetailBody(item: item),
        loading: () => preloaded != null
            ? _DetailBody(item: preloaded!)
            : const Center(child: CircularProgressIndicator()),
        error: (err, _) => preloaded != null
            ? _DetailBody(item: preloaded!)
            : Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Gagal memuat berita: ${apiErrorMessage(err)}', style: const TextStyle(color: AppColors.coral)),
                ),
              ),
      ),
    );
  }
}

class _DetailBody extends StatelessWidget {
  final BeritaAcara item;

  const _DetailBody({required this.item});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (item.fotoUrl != null)
              RetryImage(url: item.fotoUrl!, height: 200, fit: BoxFit.cover),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.judul, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 19)),
                  const SizedBox(height: 6),
                  Text(
                    '${item.penulisNama ?? 'Petugas'} · ${DateFormat('HH:mm, dd MMM yyyy').format(item.publishedAt ?? item.createdAt)}',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                  const SizedBox(height: 16),
                  MarkdownBody(
                    data: item.isi,
                    selectable: true,
                    styleSheet: MarkdownStyleSheet(
                      p: const TextStyle(fontSize: 14, height: 1.6),
                      h1: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
                      h2: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                      h3: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                      blockquoteDecoration: BoxDecoration(
                        color: AppColors.canvas,
                        border: const Border(left: BorderSide(color: AppColors.primary, width: 3)),
                      ),
                      img: const TextStyle(fontSize: 14),
                      a: const TextStyle(color: AppColors.primary, decoration: TextDecoration.underline),
                    ),
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
