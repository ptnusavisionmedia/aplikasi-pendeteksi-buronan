---
tags: [template, decision]
date: 2026-10-31
status: accepted
---

# Perbaikan CCTV Multi-Wajah, Low-Light, dan UX Dashboard

- **Tanggal:** 2026-10-31
- **Status:** accepted
- **Konteks terkait:** [[PRD]], [[2026-10-31 - Kontrol PTZ via ONVIF dan Deteksi Multi-Worker]], [[2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]]

## Konteks
User melaporkan 9 "minus" setelah sesi perbaikan bug CCTV freeze sebelumnya. Item 1-8 diminta dikerjakan langsung (urutan sesuai permintaan user, bukan diprioritaskan ulang); item 9 (kecerdasan buatan tambahan) sengaja ditunda untuk didiskusikan — dicatat terpisah di [[2026-10-31 - Rencana Kecerdasan Buatan Tambahan (Kalibrasi Akurasi + Deteksi Anomali)]].

1. Frame deteksi hanya menampilkan 1 kotak meski ada 2+ orang di kamera — minta deteksi multi-wajah, maksimal 5 orang.
2. Kemiripan wajah kurang peka di kondisi gelap — minta ditingkatkan dari sisi pencahayaan/pewarnaan.
3. Card CCTV di `/cctv` kadang stuck di "menghubungkan" dan tidak pernah selesai.
4. Tombol-tombol Mode Fokus (kontrol PTZ) menghalangi sebagian area video — minta bisa dipindah/diatur agar tidak menghalangi.
5. Gambar (foto buronan/evidence) sering gagal dimuat.
6. Beberapa chart dashboard offset, terutama di bagian bawah.
7. Minta halaman Pengaturan agar lebih mudah mengatur sistem.
8. Search bar di sidebar baru dekoratif, belum berfungsi sebagai pencarian.

## Opsi yang Dipertimbangkan

### Item 1 — Deteksi multi-wajah
1. **Proses semua wajah di setiap frame tanpa batas** — paling akurat tapi beban Qdrant search + face embedding naik linear terhadap jumlah wajah, berisiko pada kamera di lokasi ramai.
2. **Batasi ke N wajah terbesar per frame (dipilih: N=5)** — tetap menjawab kasus nyata aplikasi ini (beberapa orang di depan kamera tetap, bukan kerumunan masif), sambil membatasi beban komputasi maksimum per frame secara predictable.

### Item 2 — Sensitivitas low-light
1. **Ganti model deteksi wajah ke varian yang lebih tahan cahaya rendah** — paling akurat tapi mengganti `buffalo_l` (sudah divalidasi akurat, confidence 0.9999 pada test sebelumnya) berisiko regresi di kondisi normal, dan belum tentu ada model CPU-ringan yang jelas lebih baik.
2. **Preprocessing pencahayaan sebelum deteksi (CLAHE + gamma correction), model tetap sama** — murni transformasi gambar berbasis OpenCV (sudah jadi dependency), tanpa model baru, tanpa beban GPU, hanya menambah 1-2 operasi matriks ringan per frame.

### Item 3 — CCTV stuck
1. **Tambah polling ulang otomatis di frontend kalau macet terlalu lama** — menyembunyikan gejala, bukan akar masalah.
2. **Telusuri rantai request dan tambahkan timeout eksplisit di setiap layer yang sebelumnya tidak punya batas waktu** — ditemukan `ensureLivePath` (fetch ke MediaMTX), `callDetectionEngine` (fetch ke detection-engine), dan `apiClient` (axios di web) semuanya TANPA timeout; kalau salah satu hop lambat/wedged, seluruh rantai menggantung tanpa pernah reject, membuat UI macet selamanya di "Menghubungkan...".

### Item 7 — Pengaturan
1. **Simpan pengaturan di file config / env var saja** — perlu redeploy tiap ubah, tidak sesuai permintaan "lebih mudah untuk mengsetting".
2. **Tabel `SystemSetting` di Postgres + halaman Pengaturan (ADMIN-only edit) + detection-engine polling berkala** — threshold bisa diubah tanpa restart service manapun; detection-engine (Python, tidak kontak langsung ke Postgres) sync via endpoint `/settings/internal` tiap 15 detik, fallback ke default statis kalau apps/api tidak terjangkau.

## Keputusan
- **Item 1:** Deteksi multi-wajah diterapkan di `extract_embeddings()` (baru, di samping `extract_embedding()` singular yang tetap dipakai untuk enrollment foto statis) — maksimal `MAX_DETECTED_FACES = 5` wajah terbesar per frame, masing-masing dicari ke Qdrant secara paralel (`asyncio.gather`). `_latest_detection` per feed berubah dari dict tunggal menjadi list, begitu juga response `live-detection` (FastAPI `faces: list[DetectedFace]`) dan rendering bbox di Mode Fokus (map, bukan single box).
- **Item 2:** CLAHE pada channel L (LAB color space) + gamma correction kondisional (hanya kalau mean luma < 90) diterapkan di `_normalize_lighting()`, dipanggil sebelum `get_face_app().get(...)` baik di enrollment maupun live detection. Evidence snapshot yang disimpan ke MinIO tetap memakai bytes asli (tidak diproses) — hanya salinan yang dikirim ke model deteksi yang dinormalisasi, supaya foto bukti tetap representasi asli dari kamera.
- **Item 3:** Timeout eksplisit ditambahkan di 3 layer: `ensureLivePath` (8s via `AbortSignal.timeout`), `callDetectionEngine` (20s, sedikit di atas timeout internal `check_feed()` 12s), dan `apiClient` axios (30s, backstop terakhir + pesan error yang jelas untuk `ECONNABORTED`/network error).
- **Item 4:** Panel kontrol PTZ di Mode Fokus sekarang draggable (pointer events, posisi tersimpan per-kamera di `localStorage`), dengan margin "safe frame" 12px dari tepi stage, re-clamp otomatis saat window resize.
- **Item 5:** Dua perbaikan terpisah — (a) root cause nyata: container MinIO (`adobe/s3mock`) tidak persisten secara default, ditemukan SEMUA foto hilang setelah restart container di tengah sesi testing; diperbaiki dengan `COM_ADOBE_TESTING_S3MOCK_STORE_RETAIN_FILES_ON_EXIT=true` + volume `minio_data:/s3mockroot`, diverifikasi langsung (upload → restart container → objek tetap ada). (b) Resiliensi frontend: komponen `<RetryImage>` baru (retry dengan backoff + fallback placeholder jelas, bukan ikon broken-image browser) dipakai di semua tempat yang me-render foto dari storage (buronan, deteksi, laporan, snapshot PTZ) — gambar lokal (preview upload) sengaja tidak diubah karena tidak melalui jaringan.
- **Item 6:** Root cause: card "Distribusi Status Deteksi" (`row-span-1`, ~108px) merender donut chart dengan box fix 108px — lebih tinggi dari ruang yang tersisa setelah padding+header (~49px), jadi chart meluber keluar card persis seperti yang dilaporkan ("bagian bawah"). Diperbaiki dengan menyamakan card ini (dan "Eskalasi" di sebelahnya) ke `row-span-2`, bukan mengecilkan chart secara paksa ke ukuran yang terlalu sempit untuk tetap terbaca.
- **Item 7:** Model `SystemSetting` (singleton row) + route `apps/api/src/routes/settings.ts` (`GET /settings` semua role, `PATCH /settings` ADMIN-only, `GET /settings/internal` untuk detection-engine) + halaman `/pengaturan`. Interval auto-check CCTV dan poll Mode Fokus (sebelumnya hardcode 30000ms/1200ms) sekarang dibaca dari settings ini.
- **Item 8:** Endpoint `GET /search?q=` (apps/api) mencari lintas Buronan (nama/nomor kasus), CCTV feed (nama/lokasi, dengan wilayah-scoping sama seperti list CCTV biasa), dan Deteksi (nama buronan yang cocok) — masing-masing dibatasi 5 hasil. Komponen `<GlobalSearch>` baru menggantikan kotak pencarian dekoratif di sidebar header, dengan debounce 250ms dan dropdown hasil yang bisa diklik langsung ke halaman terkait.

## Konsekuensi
- `cctv_report_threshold`/`match_threshold` di `app/config.py` (detection-engine) sekarang hanya dipakai sebagai default awal sebelum sync pertama berhasil — nilai yang benar-benar dipakai saat runtime ada di `app/services/settings_sync.py` (`get_report_threshold()`/`get_match_threshold()`). Siapa pun yang menyentuh logic threshold di masa depan harus sadar nilai live-nya bukan lagi `settings.xxx` langsung.
- `cctv_worker_count` **belum** dibuat dinamis (tetap env-only) — mengubahnya butuh restart detection-engine, karena worker count ditentukan saat `start_feed()` dipanggil, bukan dibaca ulang tiap frame. Didokumentasikan di [[2026-10-31 - Rencana Kecerdasan Buatan Tambahan (Kalibrasi Akurasi + Deteksi Anomali)]] sebagai salah satu area yang relevan untuk pekerjaan skalabilitas berikutnya.
- MinIO sekarang menyimpan data di Docker volume `minio_data` — volume lama (`infra_minio_data`, dari konfigurasi sebelum perbaikan ini) sudah tidak dipakai dan berisi data kosong/usang, aman dihapus manual kalau ingin bersih-bersih disk.
- Mengaktifkan multi-wajah (item 1) menaikkan beban Qdrant search per frame (dari 1 ke hingga 5 pencarian paralel) pada kamera yang sering menangkap banyak orang sekaligus — relevan untuk pembahasan skalabilitas 10-30 kamera di [[2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]].
