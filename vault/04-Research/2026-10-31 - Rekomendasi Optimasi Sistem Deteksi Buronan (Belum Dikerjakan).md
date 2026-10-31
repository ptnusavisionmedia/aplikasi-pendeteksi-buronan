---
tags: [research, recommendation, detection, deferred]
date: 2026-10-31
status: belum-dikerjakan
---

# Rekomendasi Optimasi Sistem Deteksi Buronan

> **Catatan status:** Ini murni rekomendasi/riset, **belum diimplementasikan**. User secara eksplisit meminta item ini "nanti dulu dikerjakan" saat permintaan revisi 2026-10-31 — lihat [[2026-10-31 - Kontrol PTZ via ONVIF dan Deteksi Multi-Worker]] untuk 7 item lain dari permintaan yang sama yang SUDAH dikerjakan. Dokumen ini hanya analisis & opsi untuk didiskusikan kapan user siap melanjutkan.

## Konteks

Permintaan asli: *"Optimasikan untuk deteksi buronan tolong buatkan sistem dan rekomendasikan saya terkait sistem tersebut."* Ini lebih luas dari perbaikan bug multi-worker yang sudah dikerjakan ([[2026-10-31 - Kontrol PTZ via ONVIF dan Deteksi Multi-Worker]]) — fokusnya ke arsitektur deteksi secara menyeluruh: akurasi, latensi, skalabilitas lintas banyak kamera, dan keandalan jangka panjang.

## Kondisi saat ini (ringkas)

- Setiap feed CCTV punya proses capture sendiri (`_capture_loop` per feed) dengan N worker konkuren (`cctv_worker_count`, default 3) yang mengambil frame terbaru dari frame-grabber dan memprosesnya satu per satu secara in-process (embedding wajah + similarity search ke Qdrant).
- Semua feed aktif berjalan di satu proses FastAPI/asyncio yang sama (`services/detection-engine`) — tidak ada pemisahan proses/worker pool antar kamera.
- Tidak ada antrean kerja (job queue) terpusat; beban kerja terikat langsung ke siklus hidup tiap feed.
- Confidence threshold & tingkatan kepercayaan (confidence tiers) sudah ada, tapi belum ada mekanisme feedback loop otomatis dari hasil verifikasi petugas (`CONFIRMED_BY_OFFICER` / rejected) untuk memperbaiki akurasi model dari waktu ke waktu.

## Area yang disarankan untuk dioptimasi

### 1. Skalabilitas lintas kamera
**Masalah:** Semakin banyak CCTV aktif, semakin berat 1 proses detection-engine (CPU untuk decode RTSP + GPU/CPU untuk inference wajah), karena semuanya berbagi satu event loop & GIL Python.

**Opsi:**
- **Worker pool terpisah per-N-feed** (mis. `multiprocessing` atau proses terpisah per grup kamera) — menghindari 1 feed yang berat (banyak wajah terdeteksi sekaligus) memperlambat feed lain.
- **Job queue terpusat (Redis/RQ atau Celery, Redis sudah ada di infra project ini)** — capture loop tiap feed hanya mendorong frame terbaru ke antrean, worker pool terpisah (bisa discale independen, bahkan multi-mesin) menarik & memproses. Ini pola yang lebih matang untuk skala besar dan memudahkan horizontal scaling kalau jumlah kamera bertambah signifikan.
- **cctv_worker_count per-feed, bukan global** — kamera di lokasi ramai (banyak wajah) dapat alokasi worker lebih banyak daripada kamera di lokasi sepi.

### 2. Akurasi & false positive/negative
**Masalah:** User melaporkan deteksi "masih sering bug" (kemungkinan termasuk false match, atau bbox yang baru saja diperbaiki). Confidence tiers membantu, tapi tidak ada loop belajar dari koreksi petugas.

**Opsi:**
- **Feedback loop otomatis:** setiap kali petugas menolak/mengoreksi hasil match (`CONFIRMED_BY_OFFICER` vs ditolak), catat sebagai data pelatihan/kalibrasi ulang threshold confidence per kondisi (pencahayaan, sudut kamera, dsb).
- **Multi-frame voting** sebelum menaikkan status ke `CONFIRMED`/eskalasi — alih-alih percaya 1 frame dengan confidence tinggi, tunggu beberapa frame berurutan dengan match konsisten ke buronan yang sama (mengurangi false positive dari motion blur atau pantulan).
- **Preprocessing kualitas frame** (deteksi blur/pencahayaan buruk) sebelum masuk ke face embedding, supaya tidak membuang waktu komputasi pada frame yang kualitasnya terlalu rendah untuk dipercaya.

### 3. Infrastruktur/teknologi
**Rekomendasi konkret yang bisa dipertimbangkan:**
- **GPU inference** (kalau belum) — kalau deteksi wajah saat ini berjalan di CPU, pindah ke GPU (via ONNX Runtime GPU / TensorRT) akan signifikan menurunkan latensi per-frame, memungkinkan `cctv_worker_count` lebih tinggi tanpa menambah beban CPU host.
- **Model deteksi wajah yang lebih ringan untuk tahap awal** (mis. deteksi wajah cepat dulu dengan model kecil, baru jalankan embedding yang lebih berat hanya kalau wajah terdeteksi) — mengurangi kerja sia-sia pada frame yang kosong (tidak ada wajah sama sekali), yang kemungkinan adalah mayoritas frame dari kamera pengawasan.
- **Message broker untuk decoupling capture dari inference** (lihat opsi job queue di atas) — Redis sudah menjadi bagian infra (`docker-compose`), jadi menambahkan RQ/Celery di atasnya adalah langkah inkremental, bukan infrastruktur baru dari nol.

## Pertanyaan terbuka — dijawab user (2026-10-31)
1. **Target jumlah CCTV aktif:** di atas 10, maksimal di bawah 30 kamera untuk sekarang.
2. **Hardware:** CPU-only — belum ada rencana GPU.
3. **Feedback loop dari koreksi petugas:** **penting banget**, prioritas tinggi.

### Implikasi dari jawaban di atas
- **10-30 kamera, CPU-only** berarti skalabilitas lintas kamera (opsi di bagian 1) tidak bisa mengandalkan GPU untuk menyerap beban — pilihan realistisnya ada di sisi arsitektur: job queue terpusat (Redis sudah ada di infra) atau `cctv_worker_count` yang bisa diatur per-feed, supaya beban terdistribusi dengan terkendali alih-alih satu proses FastAPI/asyncio yang sama menangani decode RTSP + inference untuk 10-30 kamera sekaligus.
- Temuan baru dari sesi perbaikan bug 2026-10-31 (lihat bagian "Temuan terkait" di bawah) memperkuat urgensi ini: pada skala kecil (1-4 feed) saja, worker pool bersama (shared default executor Python) sudah terbukti bisa membuat satu permintaan health-check tersendat karena worker thread lain sedang sibuk — pada 10-30 kamera aktif, risiko ini jauh lebih nyata tanpa pemisahan worker pool / job queue yang lebih matang.
- **Feedback loop dari koreksi petugas** sekarang jadi prioritas #1 untuk dibahas lebih detail (data apa yang perlu dicatat dari aksi "Confirm"/"Reject" petugas, bagaimana itu dipakai untuk kalibrasi threshold) sebelum mulai ke scaling horizontal — sesuai urutan prioritas user.

## Temuan terkait dari sesi perbaikan bug "video CCTV sering berhenti" (2026-10-31)

Saat memperbaiki laporan user bahwa video CCTV "sering bug, video berhenti", ditemukan dua bug nyata yang relevan untuk pekerjaan item 8 ini (sudah diperbaiki, bukan bagian dari rekomendasi — dicatat di sini karena membuktikan konkret risiko yang dibahas di atas):

1. **Satu feed dengan URL rusak bisa meracuni status seluruh feed lain.** MediaMTX memvalidasi seluruh konfigurasi path-nya setiap kali ada path yang ditambah/diubah, bukan hanya path yang sedang disentuh — jadi satu CCTV feed dengan URL stream yang belum diisi lengkap (placeholder `{host}` dsb.) membuat SEMUA pendaftaran/pembaruan path feed lain ikut gagal, termasuk kamera yang benar-benar berfungsi. Sudah diperbaiki dengan validasi URL di endpoint create/update feed, dan validasi defensif di `ensureLivePath` itu sendiri supaya feed lama yang sudah terlanjur rusak tidak bisa lagi menyentuh MediaMTX sama sekali.
2. **Executor Python bersama bisa membuat health-check "berbohong" soal status kamera.** Health-check periodik (dipanggil tiap 30 detik dari halaman daftar CCTV) dan worker deteksi (face embedding, Qdrant search) sama-sama memakai thread pool default Python (`loop.run_in_executor(None, ...)`). Saat worker deteksi sibuk, atau saat beberapa feed yang tidak terjangkau sama-sama dicek bersamaan (tiap `cv2.VideoCapture()` yang gagal connect menahan satu thread sampai OS-level timeout-nya sendiri selesai, lebih lama dari timeout logis 12 detik yang kita set), health-check bisa melaporkan "timeout" untuk kamera yang sebenarnya baik-baik saja. Sudah dimitigasi dengan memberi health-check thread pool-nya sendiri (terpisah dari worker deteksi), tapi ini adalah bukti nyata dari masalah yang sudah diprediksi di bagian "Skalabilitas lintas kamera" di atas — pada 10-30 kamera aktif, pemisahan kerja seperti ini (atau job queue penuh) akan makin dibutuhkan, bukan cuma untuk health-check tapi juga untuk jalur deteksi utama.

## Status
Belum dikerjakan — pertanyaan terbuka sudah dijawab user di atas (target 10-30 kamera, CPU-only, feedback loop jadi prioritas). Menunggu arahan user kapan mulai implementasi dan urutan pengerjaannya (feedback loop dulu, atau sejalan dengan persiapan job queue untuk skala 10-30 kamera).
