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

## Pertanyaan terbuka untuk didiskusikan dengan user sebelum implementasi
1. Berapa target jumlah CCTV aktif bersamaan dalam 6-12 bulan ke depan? (menentukan apakah job queue terpusat sudah perlu sekarang atau bisa ditunda)
2. Apakah ada anggaran/hardware untuk GPU inference, atau optimasi harus tetap CPU-only?
3. Apakah feedback loop dari koreksi petugas cukup penting untuk diprioritaskan lebih dulu dibanding scaling horizontal?

## Status
Belum dikerjakan — menunggu arahan user untuk memilih prioritas di antara opsi-opsi di atas sebelum implementasi dimulai.
