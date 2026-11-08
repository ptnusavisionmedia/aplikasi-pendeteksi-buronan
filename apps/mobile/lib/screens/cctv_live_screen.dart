import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/cctv_feed.dart';
import '../widgets/back_button.dart';
import '../widgets/live_feed_player.dart';

/// Mode Fokus mobile: layar penuh satu kamera, read-only (tidak ada PTZ/kontrol kelola — itu
/// tetap eksklusif dashboard web, lihat vault/03-Decisions/2026-10-30 - Monitoring CCTV
/// Read-Only di Mobile.md). Sejak vault/03-Decisions/2026-11-08 - CCTV Live Mobile - Bounding
/// Box dan Kartu Live.md, layar ini juga menampilkan kotak deteksi wajah live, sama seperti
/// Mode Fokus di web (apps/web/src/app/(dashboard)/cctv/live/[id]/page.tsx) — hanya tanpa panel
/// PTZ yang mengambang.
class CctvLiveScreen extends StatelessWidget {
  final CctvFeed feed;

  const CctvLiveScreen({super.key, required this.feed});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: const AppBackButton(fallbackRoute: '/cctv'),
        title: Text(feed.nama),
      ),
      body: SafeArea(
        child: Column(
          // Column tidak stretch cross-axis secara default (center) — tanpa ini, Expanded hanya
          // mengontrol tinggi; lebar Stack di dalam LiveFeedPlayer akan menyusut mengikuti ukuran
          // intrinsik badge LIVE (satu-satunya child non-Positioned di Stack-nya), bukan memenuhi
          // layar. Ditemukan lewat verifikasi on-device: video Mode Fokus tampil sangat kecil.
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: LiveFeedPlayer(feedId: feed.id, mirror: feed.mirror, showDetection: true),
            ),
            const _TierLegend(),
          ],
        ),
      ),
    );
  }
}

/// Keterangan warna kotak deteksi — sama seperti legenda yang ditampilkan dashboard web di Mode
/// Fokus, supaya petugas yang terbiasa dengan web tidak bingung melihat warna di mobile.
class _TierLegend extends StatelessWidget {
  const _TierLegend();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Wrap(
        spacing: 14,
        runSpacing: 6,
        alignment: WrapAlignment.center,
        children: const [
          _LegendDot(color: AppColors.safe, label: '< 50% — rendah'),
          _LegendDot(color: AppColors.amber, label: '50–70% — mirip'),
          _LegendDot(color: AppColors.coral, label: '≥ 70% — otomatis tersimpan ke database'),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11)),
      ],
    );
  }
}
