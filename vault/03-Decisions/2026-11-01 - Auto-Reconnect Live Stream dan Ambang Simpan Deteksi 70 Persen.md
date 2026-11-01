---
tags: [decision, api, web, mobile, cctv, detection]
date: 2026-11-01
status: accepted
---

# Auto-Reconnect Live Stream dan Ambang Simpan Deteksi 70 Persen

- **Tanggal:** 2026-11-01
- **Status:** accepted
- **Konteks terkait:** [[2026-10-30 - Cek Koneksi CCTV dan Live Streaming via MediaMTX]], [[2026-10-31 - Kontrol PTZ via ONVIF dan Deteksi Multi-Worker]], [[2026-11-01 - Unifikasi Ambang Deteksi, Optimasi Streaming, dan Fitur AI Advisory]], [[2026-11-01 - CCTV Live-Streaming Mobile via HLS]]

## Konteks
Dua keluhan terpisah dari pengguna: (1) live stream CCTV "sering ketinggalan dan tidak realtime" — baik di Mode Fokus web, kartu live di daftar CCTV, maupun layar live mobile; (2) daftar Deteksi dibanjiri hasil "Kemiripan Rendah" di kisaran 51-63%, dengan saran eksplisit: hanya simpan deteksi di atas 70%.

## Investigasi
**Stream lag/tidak realtime** — tiga penyebab konkret ditemukan lewat audit kode, bukan dugaan:
1. **Bug di mobile**: `apps/mobile/lib/screens/cctv_live_screen.dart` memanggil `controller.setLooping(true)` pada live stream. Begitu pemutar sampai ujung window buffer, ia melompat balik ke awal alih-alih menunggu segmen baru — persis terlihat seperti "ketinggalan"/memutar ulang konten lama.
2. **Tidak ada pemulihan otomatis di web** — baik Mode Fokus (`cctv/live/[id]/page.tsx`) maupun kartu live di `/cctv` (`live-feed-video.tsx`) memakai strategi WHEP-dulu-fallback-HLS yang sudah bagus, tapi begitu koneksi putus di tengah sesi (ICE disconnect, hiccup jaringan, error HLS fatal), **tidak ada apa pun yang mendeteksi dan menyambung ulang** — video diam di frame terakhir tanpa batas waktu, dan halaman error (kalau sampai ke situ) tidak punya tombol "Coba Lagi" sama sekali.
3. Konfigurasi MediaMTX (`infra/mediamtx.yml`) untuk LL-HLS (`hlsSegmentDuration: 1s`, `hlsPartDuration: 200ms`) sudah dituning dengan baik dari perbaikan sebelumnya — bukan sumber masalah.

**Deteksi "Kemiripan Rendah" membanjiri daftar** — `POST /detections/webhook` (dipanggil detection-engine untuk tiap kecocokan live CCTV) selalu membuat `DetectionEvent`, bahkan saat `confidence` di bawah `SystemSetting.detectionMatchThreshold` (sudah 70% secara default) — hanya statusnya yang dibedakan jadi `LOW_CONFIDENCE`. Karena kamera live mengirim webhook tiap beberapa detik, ini membanjiri daftar Deteksi dengan baris yang tidak actionable.

## Keputusan
1. **Mobile**: hapus `setLooping(true)` (`apps/mobile/lib/screens/cctv_live_screen.dart`) — live stream tidak boleh loop. Tambah stall-watchdog (`Timer.periodic` 5 detik, cek posisi pemutaran tidak maju) yang membuat ulang `VideoPlayerController` dari awal kalau macet.
2. **Web**: tambah pemulihan-otomatis di `cctv/live/[id]/page.tsx` dan `live-feed-video.tsx` — `pc.connectionstatechange` dipantau untuk WHEP (reconnect kalau `failed`/`disconnected`), error fatal HLS tidak lagi langsung ke status error permanen, keduanya lewat `scheduleReconnect()` dengan backoff eksponensial (1s→2s→4s→8s, maks 5 percobaan). Setelah percobaan habis, Mode Fokus baru menampilkan status error — kini dilengkapi tombol "Coba Lagi" manual (sebelumnya tidak ada sama sekali).
3. **Ambang simpan deteksi**: `POST /detections/webhook` sekarang **tidak membuat `DetectionEvent` sama sekali** kalau `confidence < detectionMatchThreshold` (default 70%, admin-editable di Pengaturan) — bukan lagi disimpan sebagai `LOW_CONFIDENCE`. Kotak overlay di Mode Fokus **tidak terpengaruh** karena didorong dari `live-detection` cache di detection-engine (in-memory, terpisah dari tabel `DetectionEvent`), jadi operator tetap melihat semua kecocokan real-time; hanya histori/evidence/notifikasi yang dibatasi ke kecocokan yang cukup yakin. `upload-check` (periksa foto manual) dan `dev-simulate` (webcam dev) tetap memakai status `LOW_CONFIDENCE` apa adanya — itu alur manual sekali-klik, bukan sumber banjir data, dan officer perlu tahu hasil "tidak yakin" dari pemeriksaan yang mereka minta sendiri.

## Konsekuensi
- Baris `LOW_CONFIDENCE` yang sudah ada di database (dari sebelum perbaikan ini) **tidak dihapus otomatis** — perubahan ini hanya berlaku untuk deteksi baru. Tombol "Bersihkan Data" yang sudah ada di halaman Deteksi bisa dipakai kalau operator ingin membersihkan riwayat lama secara manual.
- Reconnect otomatis menambah sedikit kompleksitas (attempt counter, backoff, cleanup sesi lama sebelum reconnect) di kedua komponen player web — duplikasi logika WHEP/HLS antara `page.tsx` dan `live-feed-video.tsx` sudah ada sejak sebelumnya (tidak diperkenalkan baru di sini), jadi pola yang sama diterapkan konsisten di keduanya tanpa refactor besar ekstraksi hook.
- `tsc --noEmit` bersih (`apps/api`, `apps/web`) dan `flutter analyze` bersih setelah seluruh perubahan.
