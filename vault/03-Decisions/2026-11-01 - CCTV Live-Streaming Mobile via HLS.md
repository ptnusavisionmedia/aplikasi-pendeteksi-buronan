---
tags: [decision, mobile, cctv]
date: 2026-11-01
status: accepted
---

# CCTV Live-Streaming Mobile via HLS

- **Tanggal:** 2026-11-01
- **Status:** accepted
- **Konteks terkait:** [[2026-10-30 - Monitoring CCTV Read-Only di Mobile]] (diperluas, bukan dibatalkan), [[2026-10-30 - Cek Koneksi CCTV dan Live Streaming via MediaMTX]], [[2026-11-01 - Redesign Home Mobile, Navigasi Icon-Only Tanpa Bottom Bar]]. Bagian ketiga/terakhir dari tiga permintaan besar pengguna.

## Konteks
Pengguna minta mobile bisa melihat CCTV aktif secara live streaming, diakses lewat ikon navigasi CCTV di Home yang sudah dibuat di redesign sebelumnya. Keputusan [[2026-10-30 - Monitoring CCTV Read-Only di Mobile]] sebelumnya secara eksplisit mengecualikan pemutaran video ("mobile tidak merender video stream, hanya status") — keputusan itu perlu diperluas, bukan dilanggar diam-diam, karena permintaan baru ini eksplisit dari pengguna dan tetap menjaga batas aslinya: tidak ada kontrol tambah/edit/hapus/toggle status di mobile, hanya kemampuan **melihat** stream dari feed yang sudah ACTIVE.

## Opsi yang Dipertimbangkan
1. **WHEP/WebRTC** (seperti Mode Fokus web, latensi rendah) — ditolak untuk mobile: butuh `flutter_webrtc` (dependensi berat, perlu native plugin setup Android/iOS tambahan) untuk keuntungan latensi yang kurang penting bagi masyarakat (bukan petugas yang butuh respons real-time presisi tinggi).
2. **HLS via `video_player`** (dipilih) — `video_player` adalah plugin resmi Flutter, memutar HLS native lewat ExoPlayer (Android) / AVPlayer (iOS) tanpa dependensi tambahan, konsisten dengan fallback HLS yang sudah ada di web (`live-feed-video.tsx`). Trade-off: latensi beberapa detik lebih tinggi dari WHEP — diterima karena use-case mobile adalah monitoring awam, bukan Mode Fokus petugas.

## Keputusan
- Endpoint backend **tidak berubah** — `POST /cctv-feeds/:id/live` (`apps/api/src/routes/cctv.ts`) sudah `requireAuth` tanpa pembatasan role, mengembalikan `{hlsUrl, whepUrl}` lewat MediaMTX relay yang sama dipakai Mode Fokus web. Mobile hanya memakai `hlsUrl`.
- `apps/mobile/pubspec.yaml`: tambah `video_player: ^2.9.5`. Build number `1.0.0+3` → `1.0.0+4`.
- Layar baru `apps/mobile/lib/screens/cctv_live_screen.dart` (route `/cctv/:id/live`): full-screen player gelap dengan badge "LIVE", status connecting/error (dengan tombol "Coba Lagi"), `AspectRatio` mengikuti rasio video asli.
- `apps/mobile/lib/screens/cctv_screen.dart`: kartu feed berstatus ACTIVE sekarang bisa diketuk ("Ketuk untuk lihat live", ikon play) menuju layar live; feed non-aktif tetap statis seperti sebelumnya (tidak ada perubahan untuk feed INACTIVE).
- `apps/mobile/lib/models/cctv_feed.dart`: komentar dok diperbarui — model list tetap tidak menyertakan `urlStream` (URL live datang dari endpoint `/live` terpisah, bukan dari payload list), tapi klaim "mobile tidak pernah memutar video" dihapus karena sudah tidak akurat.
- Mengelola feed (tambah/edit/hapus/toggle status/PTZ) **tetap** eksklusif dashboard web — tidak ada perubahan pada batas itu.

## Konsekuensi
- `MEDIAMTX_HLS_BASE_URL` default `http://localhost:8888` hanya bisa dijangkau di mesin yang sama/jaringan yang sama seperti `API_BASE_URL` — build untuk perangkat fisik perlu override lewat env/konfigurasi jaringan yang sama seperti pola `--dart-define=API_BASE_URL=...` yang sudah ada, belum ada mekanisme override terpisah untuk base URL MediaMTX dari sisi mobile (saat ini URL penuh datang langsung dari respons API, jadi otomatis ikut host API — cukup untuk kebutuhan sekarang).
- **Keterbatasan verifikasi di sesi ini**: diuji end-to-end lewat `flutter run -d web-server` di browser pane (Chromium) — rute, auth, pemanggilan `POST /cctv-feeds/:id/live` (200 OK, `hlsUrl` diterima), dan inisialisasi `VideoPlayerController` semua terkonfirmasi bekerja. Namun **frame video tidak tampil secara visual** di pengujian ini karena Chrome desktop tidak mendukung pemutaran HLS (`.m3u8`) native lewat tag `<video>` — ini keterbatasan lingkungan pengujian (tidak ada emulator Android/perangkat iOS di mesin ini), bukan indikasi bug. Android (ExoPlayer) dan iOS (AVPlayer), target platform sebenarnya, mendukung HLS native dan seharusnya menampilkan video dengan benar — perlu diverifikasi ulang di perangkat/emulator sungguhan saat tersedia.
- `flutter analyze` bersih setelah seluruh perubahan.
