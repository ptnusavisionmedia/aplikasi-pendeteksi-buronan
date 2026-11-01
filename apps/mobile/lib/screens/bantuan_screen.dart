import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../widgets/back_button.dart';

class _FaqItem {
  final String question;
  final String answer;
  const _FaqItem(this.question, this.answer);
}

const _faqs = [
  _FaqItem(
    'Bagaimana cara melaporkan buronan yang saya lihat?',
    'Buka menu "Lapor" dari Home, ambil foto, isi lokasi, lalu kirim. Laporan bisa dikirim anonim.',
  ),
  _FaqItem(
    'Bagaimana cara mengecek status laporan saya?',
    'Simpan nomor tiket yang muncul setelah mengirim laporan, lalu cek lewat menu "Lihat Laporan" di Home.',
  ),
  _FaqItem(
    'Apa itu Berita Acara?',
    'Berita Acara adalah laporan resmi kejadian yang ditulis dan diterbitkan petugas berwenang, bisa dibaca semua pengguna aplikasi.',
  ),
  _FaqItem(
    'Mengapa saya tidak bisa menambah/mengedit data CCTV atau buronan?',
    'Pengelolaan data CCTV dan buronan hanya bisa dilakukan petugas lewat dashboard web, untuk menjaga akurasi dan akuntabilitas data.',
  ),
  _FaqItem(
    'Bagaimana jika saya melihat kesalahan identifikasi?',
    'Hubungi instansi terkait lewat kanal resmi yang tertera pada detail deteksi, atau laporkan lewat menu "Lapor".',
  ),
];

/// Bantuan/FAQ statis — tidak perlu panggilan API, cukup info ringkas untuk pengguna awam.
class BantuanScreen extends StatelessWidget {
  const BantuanScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: const Text('Bantuan')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Pertanyaan Umum', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 12),
            ..._faqs.map((faq) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: BentoCell(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(faq.question, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                        const SizedBox(height: 6),
                        Text(faq.answer, style: const TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.4)),
                      ],
                    ),
                  ),
                )),
          ],
        ),
      ),
    );
  }
}
