---
tags: [decision, mobile, cctv]
date: 2026-11-08
status: accepted
---

# CCTV Live Mobile - Bounding Box dan Kartu Live

- **Tanggal:** 2026-11-08
- **Status:** accepted
- **Konteks terkait:** [[2026-11-01 - CCTV Live-Streaming Mobile via HLS]] (diperluas, bukan dibatalkan), [[2026-10-30 - Monitoring CCTV Read-Only di Mobile]]

## Konteks
Setelah live streaming mobile (HLS) berjalan, pengguna bertanya kenapa kotak deteksi wajah (bounding box) yang tampil di Mode Fokus web tidak muncul di layar live mobile. Jawabannya: itu memang belum diimplementasikan — `cctv_live_screen.dart` versi sebelumnya hanya memutar video + badge "LIVE" + watchdog anti-macet, tanpa pernah memanggil `GET /cctv-feeds/:id/live-detection`. Pengguna lalu minta ini ditambahkan, sekaligus daftar CCTV mobile diubah dari baris teks sederhana menjadi kartu dengan thumbnail live + tombol "Mode Fokus", mengikuti pola yang sudah ada di dashboard web (`apps/web/src/components/live-feed-video.tsx` + `apps/web/src/app/(dashboard)/cctv/page.tsx`).

## Opsi yang Dipertimbangkan
1. **Overlay kotak di kartu list DAN Mode Fokus, satu widget dipakai bersama** (dipilih) — mencerminkan split `LiveFeedVideo`/`useLiveDetection` di web. Satu `LiveFeedPlayer` dipakai dua tempat supaya keduanya membaca stream & deteksi dengan cara yang sama persis, tidak ada duplikasi logika polling/stall-watchdog.
2. **Kotak hanya di Mode Fokus, kartu list tetap teks biasa** — ditolak: pengguna eksplisit minta kartu dengan live thumbnail, bukan hanya Mode Fokus.
3. **Video kartu pakai `BoxFit.cover` (crop penuh) seperti web** — ditolak untuk versi ini: cover-fit butuh matematika transform tambahan (crop offset) supaya kotak deteksi tetap presisi di atas video yang di-crop. Dipilih letterbox (`AspectRatio` kontain, sama seperti Mode Fokus) supaya posisi kotak = fraksi bbox dikali ukuran stage secara langsung, tanpa transform tambahan — trade-off: kartu kamera dengan rasio bukan 16:9 akan terlihat ada bilah hitam di kartu, bukan memenuhi penuh area kartu.

## Keputusan
- `apps/mobile/lib/widgets/live_feed_player.dart` (baru): widget `LiveFeedPlayer` (video HLS + stall watchdog, dipindah dari `_HlsPlayer` lama di `cctv_live_screen.dart` + overlay kotak deteksi + badge LIVE + state connecting/error dengan tombol "Coba Lagi"). Parameter `compact` mengecilkan ukuran teks/ikon untuk konteks kartu list.
- `apps/mobile/lib/models/detected_face.dart` (baru): `DetectedFace` (bbox/confidence/ageSeconds, mirror `apps/web/src/lib/use-live-detection.ts`) + `tierColorFor()` (mirror `apps/web/src/lib/detection-tier.ts`: hijau < reportThreshold, amber reportThreshold–matchThreshold, coral ≥ matchThreshold).
- `apps/mobile/lib/models/live_detection_settings.dart` + `apps/mobile/lib/state/cctv_live_provider.dart` (baru): `GET /settings` untuk threshold & `liveDetectionPollIntervalMs` yang sama dipakai admin di Pengaturan web, dengan fallback default backend kalau gagal dimuat.
- `apps/mobile/lib/models/cctv_feed.dart`: tambah field `mirror` (sebelumnya sengaja dibuang karena dianggap "web-only video correction" — ternyata juga dibutuhkan mobile supaya video+kotak deteksi tetap sinkron saat kamera mengirim gambar terbalik, lihat Tapo C200 - Rumah yang `mirror: true`).
- `apps/mobile/lib/screens/cctv_live_screen.dart`: disederhanakan jadi pembungkus `LiveFeedPlayer(showDetection: true)` + legenda warna tier di bawah video (padanan legenda di Mode Fokus web). Menerima `CctvFeed` utuh (bukan lagi `feedId`+`feedNama` terpisah) supaya `mirror` ikut terbawa dari layar daftar tanpa fetch ulang.
- `apps/mobile/lib/screens/cctv_screen.dart`: `_CctvCard` diubah dari baris teks jadi kartu (header ikon+badge status, nama/lokasi, thumbnail live 170px dengan kotak deteksi untuk feed ACTIVE, tombol "Mode Fokus" di bawah). Feed non-ACTIVE tetap tanpa video (konsisten dengan sebelumnya).
- `apps/mobile/lib/core/router.dart`: route `/cctv/:id/live` menerima `extra` bertipe `CctvFeed` (bukan `String` nama saja).
- Tidak ada perubahan di `apps/api` — endpoint `GET /cctv-feeds/:id/live-detection` dan `GET /settings` sudah ada dan `requireAuth` tanpa pembatasan role, jadi tidak perlu endpoint baru.
- Kontrol kelola (tambah/edit/hapus/toggle status/PTZ/Cek-Koneksi-manual) **tetap** eksklusif dashboard web — tidak ada perubahan pada batas itu.

## Konsekuensi
- Satu feed ACTIVE sekarang memicu DUA polling independen saat layar CCTV dibuka: satu untuk kartunya di daftar (`showDetection: true` di setiap `_CctvCard`), dan satu lagi untuk Mode Fokus kalau dibuka bersamaan. Ini sama dengan pola web (kartu list sudah polling `live-detection` sendiri-sendiri per `LiveFeedVideo`), jadi bukan regresi baru — tapi berarti N kamera ACTIVE di layar daftar = N video HLS + N polling deteksi berjalan bersamaan di satu layar HP, lebih berat dari sebelumnya (yang hanya 1 video saat Mode Fokus dibuka). Belum diuji dampak baterai/data untuk jumlah kamera besar (>5) — layak dipantau kalau jumlah CCTV terdaftar bertambah banyak.
- Kartu live letterbox (bukan cover-crop) berarti tampilan kartu CCTV mobile tidak akan sepenuhnya identik secara visual dengan grid card web (yang cover-crop penuh) untuk kamera dengan rasio non-16:9 — trade-off sadar demi kesederhanaan & presisi kotak deteksi, lihat Opsi 3 di atas.

## Perbaikan pasca-verifikasi on-device
Saat verifikasi langsung di HP, Mode Fokus (`cctv_live_screen.dart`) ternyata merender video sangat kecil (~120px lebar) alih-alih memenuhi layar, walau kartu di daftar sudah benar. Sebab: `Column` pembungkus `Expanded(LiveFeedPlayer)` + `_TierLegend` punya `crossAxisAlignment` default (`center`, bukan `stretch`), jadi `Expanded` hanya mengontrol tinggi — lebar `Stack` di dalam `LiveFeedPlayer` menyusut mengikuti ukuran intrinsik satu-satunya child non-`Positioned`-nya (badge "LIVE"), bukan memenuhi lebar layar. Diperbaiki dengan menambah `crossAxisAlignment: CrossAxisAlignment.stretch` pada `Column` tersebut. Dikonfirmasi ulang di HP (Tapo C200, kamera `mirror: true`): video kini penuh layar, letterbox atas/bawah sesuai rasio asli, dan watermark/timestamp kamera ikut terbalik mengikuti transform mirror (tanda video+overlay tetap sinkron).
