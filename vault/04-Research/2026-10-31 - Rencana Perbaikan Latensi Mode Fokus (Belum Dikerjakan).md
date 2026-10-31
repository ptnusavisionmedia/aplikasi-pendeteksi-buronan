---
tags: [research, recommendation, latency, cctv, deferred]
date: 2026-10-31
status: belum-dikerjakan
---

# Rencana Perbaikan Latensi Mode Fokus

> **Catatan status:** User secara eksplisit meminta ini **hanya rencana dulu, belum dieksekusi** — "jangan dieksekusi dulu saya ingin lihat" (revisi 2026-10-31, bersamaan dengan permintaan kamera jangan mirror, yang sudah dikerjakan — lihat [[../03-Decisions/2026-10-31 - Perbaikan CCTV Multi-Wajah, Low-Light, dan UX Dashboard]]). Dokumen ini murni analisis akar masalah + opsi, untuk didiskusikan dan disetujui user sebelum ada kode yang diubah.

## Konteks

Keluhan user: *"untuk kendala dalam mode fokus ini sering terlambat jadi tolong buatkan rencana untuk membangun sistem ini menjadi baik."* "Terlambat" (laggy/delayed) di Mode Fokus bisa berarti dua hal yang berbeda akar masalahnya — penting dipisahkan dulu sebelum menentukan perbaikan:

1. **Video terasa delay dari kenyataan** (apa yang terlihat di layar beberapa detik di belakang kondisi nyata).
2. **Kotak deteksi (bbox) terasa telat/tersendat** mengikuti wajah di video, atau kontrol PTZ terasa lambat merespons.

Kedua kemungkinan ini punya penyebab teknis yang sepenuhnya berbeda (jalur video vs jalur deteksi vs jalur kontrol), jadi rencana ini membedah ketiganya secara terpisah.

## Arsitektur saat ini (ringkas, sebagai konteks temuan di bawah)

```
Kamera (RTSP) ──┬──► MediaMTX (relay, on-demand pull) ──► HLS segments ──► hls.js (web) ──► <video>
                │                                              ▲
                │                                     live-detection poll (1200ms, lihat Pengaturan)
                └──► detection-engine _FrameGrabber (thread terpisah, selalu ambil frame terbaru)
                           │
                           ▼
                     N worker konkuren (cctv_worker_count, default 3)
                     per worker: CLAHE+gamma → extract_embeddings (CPU) → Qdrant search per wajah
                           │
                           ▼
                     _latest_detection (overlay bbox) + webhook ke apps/api kalau match
```

Video (jalur atas) dan deteksi (jalur bawah) berjalan independen — keduanya dipoll/diputar terpisah oleh browser, lalu digabung secara visual di Mode Fokus. Artinya delay di satu jalur tidak otomatis berarti delay di jalur lain, tapi operator melihat keduanya sebagai satu pengalaman "video".

## Temuan — sumber-sumber latensi per lapisan

### A. Jalur video (RTSP → MediaMTX → HLS → hls.js)
- **HLS inheren punya buffer**, bukan protokol streaming nyaris-instan seperti WebRTC. `infra/mediamtx.yml` tidak mengoverride setting HLS apa pun, jadi pakai default MediaMTX (LL-HLS/low-latency HLS dengan segmen+part — terlihat dari query `_HLS_msn`/`_HLS_part` di request HLS saat ini). Di atas itu, `cctv/live/[id]/page.tsx` mengatur `new Hls({ liveSyncDurationCount: 3 })` — hls.js sengaja tertinggal ~3 target-duration segmen di belakang live edge supaya pemutaran tidak sering stall. Ini **trade-off yang disengaja** (stabilitas vs latensi), bukan bug, tapi berarti ada baseline beberapa detik delay yang memang melekat pada pendekatan HLS, sebelum faktor lain ditambahkan.
- **MediaMTX juga sudah dipakai WebRTC** (`webrtc: yes` di `infra/mediamtx.yml`, port 8889) tapi Mode Fokus saat ini **hanya memakai jalur HLS**, tidak memakai WebRTC sama sekali — padahal WebRTC secara desain punya latensi sub-detik (bukan berbasis segmen), jauh lebih rendah dari HLS manapun settingnya. Ini kemungkinan **area perbaikan dengan dampak terbesar** untuk keluhan "video delay".
- Kamera menyambung lewat WiFi (bukan kabel), dan encoding dilakukan di kamera itu sendiri (bukan di server) — ada batas latensi dari sisi kamera yang di luar kendali aplikasi ini, tapi ini biasanya kontribusinya kecil (puluhan-ratusan ms) dibanding faktor HLS buffer di atas (detik).

### B. Jalur deteksi (bbox overlay di Mode Fokus)
- `extract_embeddings()` (termasuk `_normalize_lighting` CLAHE+gamma yang baru ditambahkan hari ini untuk kondisi gelap) berjalan di **shared default executor Python** (`loop.run_in_executor(None, ...)`) — sama seperti `search_face` per wajah. Dengan `cctv_worker_count=3` default dan sekarang bisa sampai `MAX_DETECTED_FACES=5` wajah per frame (tiap wajah = 1 pencarian Qdrant terpisah via executor), beban pada pool bersama ini naik signifikan dibanding sebelum revisi multi-wajah hari ini.
- **Frame diproses di resolusi penuh** — badge "1920x1080 · 25fps" di kartu CCTV menunjukkan kamera mengirim Full HD, dan tidak ada downscaling sebelum `extract_embeddings()`/CLAHE dijalankan. CLAHE di LAB color space pada frame 1920x1080 bukan operasi murah; ini pekerjaan CPU baru (ditambahkan untuk perbaikan low-light hari ini) yang ikut menambah waktu per frame.
- Catatan terkait dari riset sebelumnya ([[2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]]): pool executor bersama sudah terbukti jadi sumber keterlambatan nyata di kasus lain (health-check "Cek Koneksi" sempat salah lapor timeout gara-gara pool yang sama sibuk oleh worker deteksi) — pola masalah yang sama relevan di sini: makin berat kerja tiap worker deteksi (multi-wajah + CLAHE), makin besar risiko satu feed yang ramai wajah memperlambat pemrosesan feed lain yang berbagi proses `detection-engine` yang sama.
- Overlay bbox di web di-poll tiap `liveDetectionPollIntervalMs` (default 1200ms, bisa diatur di Pengaturan) — independen dari kecepatan video. Kalau proses deteksi di backend lebih lambat dari interval poll ini, operator akan melihat bbox "nyangkut" di posisi lama sampai siklus proses berikutnya selesai — efeknya terasa seperti "lag" meski videonya sendiri lancar.

### C. Jalur kontrol PTZ
- Setiap klik/tahan tombol panah di Mode Fokus memicu request HTTP (web → apps/api) yang lalu membuka koneksi ONVIF baru ke kamera (`connect()` di `ptz-client.ts` — tidak ada koneksi ONVIF yang di-reuse, setiap `ptzMove`/`ptzStop` connect dari awal). Untuk kamera yang jauh/WiFi lemah, overhead connect ONVIF per perintah ini bisa terasa sebagai "kamera lambat merespons" — terpisah sepenuhnya dari latensi video/deteksi di atas.

## Opsi perbaikan (per area, dengan trade-off)

### A. Video delay
1. **Pindah Mode Fokus dari HLS ke WebRTC** (MediaMTX sudah menyediakan endpoint WebRTC, tinggal dipakai) — potensi penurunan latensi paling besar (dari ~detik ke sub-detik). Trade-off: WebRTC butuh negosiasi ICE/STUN, sedikit lebih rumit di sisi klien (ganti dari `<video>+hls.js` ke `RTCPeerConnection`), dan perlu diuji perilakunya di jaringan dengan NAT/firewall yang lebih ketat daripada LAN dev saat ini.
2. **Turunkan `liveSyncDurationCount` hls.js** (mis. dari 3 ke 1-2) — perbaikan cepat, risiko rendah, tapi mengurangi bantalan terhadap jitter jaringan (lebih rentan buffering/stall kalau koneksi tidak stabil). Tetap pakai HLS, jadi latensi dasarnya tidak banyak berubah (masih hitungan detik, bukan sub-detik).
3. **Status quo** — cukup kalau setelah pengukuran nyata delay-nya ternyata sudah dalam batas wajar dan yang dirasakan user sebenarnya lebih ke bbox/PTZ (area B/C di bawah), bukan video itu sendiri.

### B. Deteksi/bbox
1. **Downscale frame sebelum deteksi** (mis. resize ke ~720p sebelum CLAHE+`extract_embeddings`, bbox tetap dikonversi balik ke proporsi 0-1 relatif terhadap frame asli seperti sekarang) — mengurangi beban CPU per frame secara signifikan (CLAHE+embedding pada 720p jauh lebih murah dari 1080p), risiko rendah terhadap akurasi untuk ukuran wajah yang wajar di frame pengawasan.
2. **Pool executor terpisah untuk kerja deteksi** (serupa pola `_check_executor` yang sudah ada untuk "Cek Koneksi") — supaya kerja CLAHE+embedding+Qdrant satu feed tidak berebut thread dengan feed lain di proses `detection-engine` yang sama. Konsisten dengan arah yang sudah direkomendasikan di [[2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]] soal pemisahan kerja.
3. **Job queue terpusat (Redis/RQ)** — opsi paling matang untuk skala 10-30 kamera (sudah dibahas di dokumen Optimasi di atas), tapi kompleksitas implementasi jauh lebih tinggi; masuk akal sebagai langkah lanjutan setelah opsi 1-2 di atas terbukti belum cukup.
4. **Turunkan `liveDetectionPollIntervalMs`** lewat Pengaturan (sudah bisa diubah tanpa kode) — perbaikan termurah untuk mengurangi jeda terlihat antara deteksi backend selesai dan overlay muncul di layar, tapi tidak mengurangi waktu proses deteksi itu sendiri, dan polling lebih sering = request lebih banyak ke `apps/api`.

### C. Kontrol PTZ
1. **Cache/reuse koneksi ONVIF per feed** (bukan connect baru di setiap `ptzMove`/`ptzStop`/`ptzSnapshot`) — mengurangi overhead per perintah, terutama terasa saat operator menahan tombol panah berulang kali. Trade-off: perlu strategi timeout/cleanup supaya koneksi yang menganggur lama tidak menumpuk.
2. **Status quo** — overhead connect ONVIF biasanya ratusan ms, mungkin bukan kontributor utama kalau keluhan "lag" sebenarnya dominan di jalur video (area A).

## Rencana bertahap yang disarankan (belum dieksekusi)

**Tahap 1 — perbaikan cepat, risiko rendah** (bisa dikerjakan tanpa perubahan arsitektur):
- B1 (downscale frame sebelum deteksi)
- B2 (pool executor terpisah untuk deteksi)
- A2 (turunkan `liveSyncDurationCount`) sebagai eksperimen murah, diukur dampaknya

**Tahap 2 — perbaikan dengan dampak lebih besar, kompleksitas sedang:**
- A1 (migrasi Mode Fokus ke WebRTC) — kemungkinan ini yang paling menjawab keluhan "video delay" kalau itu akar masalah utamanya
- C1 (reuse koneksi ONVIF)

**Tahap 3 — struktural, untuk skala 10-30 kamera (menyatu dengan [[2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]]):**
- B3 (job queue Redis/RQ)

## Yang perlu dikonfirmasi user sebelum mulai eksekusi
1. **Jenis "lambat" yang paling mengganggu**: video-nya sendiri terasa delay dari kenyataan, kotak deteksinya yang nyangkut/telat, atau kontrol PTZ-nya yang lambat merespons? (Menentukan area A/B/C mana yang diprioritaskan — ini bisa dicek bareng user dengan skenario nyata: gerak di depan kamera, hitung berapa detik sampai muncul di Mode Fokus.)
2. **Kesediaan migrasi ke WebRTC (A1)** kalau video delay yang jadi masalah utama — ini perubahan paling berdampak tapi juga paling besar scope-nya di antara opsi Tahap 1/2.
3. **Urutan pengerjaan** relatif terhadap item lain yang masih tertunda ([[2026-10-31 - Rencana Kecerdasan Buatan Tambahan (Kalibrasi Akurasi + Deteksi Anomali)]] dan rekomendasi skalabilitas Optimasi) — semuanya sama-sama menyentuh `detection-engine`, jadi urutan pengerjaan memengaruhi berapa kali kode yang sama disentuh ulang.

## Status
Belum dikerjakan — murni rencana untuk ditinjau user. Item lain dari permintaan revisi 2026-10-31 yang sama (kamera jangan mirror, live video di kartu CCTV) sudah dikerjakan, lihat [[../03-Decisions/2026-10-31 - Perbaikan CCTV Multi-Wajah, Low-Light, dan UX Dashboard]].
