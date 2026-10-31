---
tags: [research, recommendation, ai, deferred]
date: 2026-10-31
status: perlu-didiskusikan
---

# Rencana Kecerdasan Buatan Tambahan — Kalibrasi Akurasi & Deteksi Anomali

> **Catatan status:** Item ini (nomor 9 dari daftar revisi 2026-10-31) secara eksplisit diminta user untuk **didiskusikan dulu**, bukan langsung dikerjakan — lihat [[2026-10-31 - Perbaikan CCTV Multi-Wajah, Low-Light, dan UX Dashboard]] untuk 8 item lain dari permintaan yang sama yang SUDAH dikerjakan. Dokumen ini adalah bahan diskusi, bukan keputusan final.

## Konteks

Permintaan user: *"perlu penambahan kecerdasan buatan yang dapat di-build di sini agar lebih pintar lagi, tetapi tidak terlalu membebani juga agar dapat berjalan dengan mulus."* Saat ditanya arah mana yang paling diinginkan, user memilih **dua arah sekaligus**:
1. Kalibrasi akurasi & feedback loop dari koreksi petugas.
2. Deteksi anomali perilaku.

Ini juga menjawab [[2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]] yang sudah menandai feedback loop sebagai prioritas #1 (dijawab user: "penting banget"), dan konteks hardware yang sudah dikonfirmasi: **10-30 kamera, CPU-only, tidak ada rencana GPU**.

## Arah 1 — Kalibrasi Akurasi & Feedback Loop

### Masalah
Threshold confidence (`detectionReportThreshold`, `detectionMatchThreshold` — sekarang bisa diubah lewat halaman Pengaturan, lihat [[2026-10-31 - Perbaikan CCTV Multi-Wajah, Low-Light, dan UX Dashboard]]) saat ini **statis**: satu angka berlaku sama untuk semua kamera, semua kondisi pencahayaan, semua waktu. Tapi kualitas kecocokan nyata-nya bervariasi — kamera di lorong gelap vs kamera di area terang, siang vs malam — dan sistem tidak belajar apa pun dari keputusan petugas (CONFIRMED_BY_OFFICER vs REJECTED_FALSE_POSITIVE) yang sudah tercatat di `DetectionEvent.status`.

### Opsi
1. **Kalibrasi threshold per-kamera, berbasis statistik murni (bukan model ML baru).** Hitung rolling false-positive rate per kamera dari `DetectionEvent` yang sudah dikonfirmasi/ditolak petugas (endpoint `/cctv-feeds/:id/accuracy` sudah ada, lihat `apps/api/src/routes/cctv.ts:224`) — kalau kamera tertentu konsisten menghasilkan banyak REJECTED_FALSE_POSITIVE di confidence tertentu, naikkan ambang laporan untuk kamera itu secara otomatis; kalau konsisten akurat, turunkan sedikit supaya tidak melewatkan kecocokan asli. Murni agregasi + aritmetika sederhana (rata-rata bergerak), **tidak ada inferensi model tambahan** — beban komputasi hampir nol, aman untuk CPU-only.
2. **Kalibrasi berbasis model (mis. regresi logistik kecil / Platt scaling)** di atas confidence mentah dari ArcFace, dilatih ulang berkala dari histori confirm/reject. Lebih presisi dari pendekatan statistik murni, tapi butuh pipeline retraining terpisah (job berkala, bukan real-time) dan penyimpanan dataset berlabel — kompleksitas implementasi jauh lebih tinggi untuk manfaat marginal di skala data yang masih kecil (puluhan-ratusan event per kamera).
3. **Status quo (threshold manual via Pengaturan saja, tanpa auto-kalibrasi).** Sudah cukup untuk kebutuhan sekarang, tapi tidak "belajar" dari koreksi petugas seperti yang diminta user.

### Rekomendasi
**Opsi 1** sebagai langkah pertama — murah secara komputasi (cocok untuk CPU-only, 10-30 kamera), memakai data yang sudah ada (tidak perlu instrumentasi baru), dan langsung menjawab prioritas #1 dari rekomendasi sebelumnya. Opsi 2 bisa dipertimbangkan nanti kalau volume data confirm/reject sudah cukup besar untuk melatih model yang berarti (realistis: ratusan-ribuan event terlabel, bukan puluhan).

### Yang perlu didiskusikan sebelum implementasi
- Seberapa agresif auto-adjustment boleh bergerak dari baseline (mis. dibatasi ±0.1 dari default) supaya admin tidak kehilangan kendali penuh atas threshold yang sudah mereka atur manual di Pengaturan.
- Apakah auto-kalibrasi berjalan diam-diam, atau admin harus melihat & menyetujui perubahan tiap kamera (mis. badan notifikasi "Threshold kamera X disarankan naik ke 0.65 berdasarkan 12 REJECTED_FALSE_POSITIVE minggu ini").

## Arah 2 — Deteksi Anomali Perilaku

### Masalah
Sistem saat ini murni mencocokkan identitas wajah — tidak ada sinyal dari *perilaku* (mis. seseorang berkeliaran lama di satu titik, gerakan tergesa-gesa, pola yang tidak biasa untuk lokasi/jam tersebut). Ini valid sebagai fitur tambahan, tapi **jauh lebih berat secara komputasi** dibanding Arah 1.

### Opsi
1. **Deteksi berbasis aturan sederhana (rule-based), bukan model ML** — mis. "wajah yang sama terdeteksi di frame yang sama selama >N menit tanpa berpindah" (loitering), dihitung dari histori `_latest_detection` yang sudah ada per feed. Beban komputasi minim (hanya pelacakan waktu/posisi bbox antar frame, tidak ada model baru), tapi cakupan "anomali" yang bisa dideteksi sangat terbatas.
2. **Tracking + analisis lintasan (object tracking, mis. ByteTrack/DeepSORT) di atas bbox yang sudah dihasilkan InsightFace** — mendeteksi pola gerak (mondar-mandir, mendekati kamera lalu menghindar, dll). Lebih mampu dari opsi 1, tapi menambah satu tahap inferensi per frame per orang di CPU yang sama yang sudah menjalankan face detection+embedding — pada 10-30 kamera aktif ini bisa jadi beban CPU signifikan tanpa GPU, berisiko memperlambat deteksi wajah utama (prioritas yang lebih kritis).
3. **Model perilaku penuh (action recognition / pose estimation, mis. OpenPose, ST-GCN)** — paling mampu, tapi juga paling berat; hampir pasti butuh GPU untuk berjalan real-time di 10-30 kamera. Bertentangan langsung dengan batasan "tidak terlalu membebani" dan hardware CPU-only yang sudah dikonfirmasi.

### Rekomendasi
**Opsi 1 (rule-based loitering/dwell-time)** sebagai satu-satunya opsi yang realistis untuk hardware saat ini (CPU-only, 10-30 kamera) tanpa mengorbankan performa deteksi wajah utama. Opsi 2 dan 3 sebaiknya ditunda sampai ada kepastian soal GPU — bertentangan dengan batasan eksplisit user ("tidak terlalu membebani ... berjalan dengan mulus").

### Yang perlu didiskusikan sebelum implementasi
- Definisi konkret "anomali" yang dianggap berguna untuk kasus pakai aplikasi ini (loitering di dekat buronan yang baru terdeteksi? di area tertentu saja, atau semua kamera?) — supaya tidak membangun fitur generik yang tidak dipakai.
- Apakah anomali perilaku memicu eskalasi otomatis (seperti match wajah confidence tinggi), atau hanya flag informasional di dashboard.

## Implikasi untuk Produk
Kedua arah ini menambah kompleksitas sistem deteksi yang sudah dioptimasi di [[2026-10-31 - Kontrol PTZ via ONVIF dan Deteksi Multi-Worker]] dan [[2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]]. Mengingat batasan CPU-only, rekomendasi tegas: **mulai dari Arah 1 Opsi 1 dan Arah 2 Opsi 1** (keduanya murni statistik/aturan, hampir tanpa beban komputasi tambahan) sebelum mempertimbangkan opsi berbasis model yang lebih berat — sejalan dengan prinsip yang sudah disepakati di [[2026-10-30 - Lingkup PRD v2 Akurasi dan Webcam Dev]] soal menjaga sistem tetap ringan untuk skala 10-30 kamera.

## Status
Menunggu arahan user: mulai dari skop minimal (Arah 1 Opsi 1 + Arah 2 Opsi 1) sesuai rekomendasi di atas, atau ada arah lain yang ingin didiskusikan lebih dulu.
