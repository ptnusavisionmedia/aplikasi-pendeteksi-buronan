---
tags: [template, decision]
date: 2026-10-31
status: accepted
---

# Kontrol PTZ via ONVIF dan Deteksi Multi-Worker

- **Tanggal:** 2026-10-31
- **Status:** accepted
- **Konteks terkait:** [[PRD]], [[2026-10-30 - Cek Koneksi CCTV dan Live Streaming via MediaMTX]], [[2026-10-30 - Migrasi Font Poppins dan Preset Multi-Merk CCTV]]

## Konteks
User meminta 7 revisi sekaligus pada sistem CCTV & deteksi:
1. Pesan error validasi CCTV yang lebih jelas (timeout vs gagal konek vs koneksi terganggu, dsb).
2. Frame deteksi buronan tidak boleh hanya diproses oleh 1 frame kerja — kalau stream tertinggal, harus otomatis mengejar ke waktu saat ini.
3. Fitur kontrol PTZ (kanan-kiri-atas-bawah + memotret) untuk CCTV yang mendukungnya, dan harus kompatibel ke semua merk kamera di sistem, bukan cuma Tapo.
4. Optimasi frame deteksi (sering bug) — kalau ada rekomendasi infrastruktur/teknologi yang lebih baik, disertakan juga.
5. CRUD penuh pada Eskalasi dan Laporan Masyarakat.
6. Sidebar Deteksi: perjelas foto — kalau ada kemiripan buronan via CCTV, bisa melihat foto buronan itu, bukan hanya card teks.
7. Tombol back saat melihat lebih dalam ke foto buronan.

(Item ke-8 dari permintaan user — optimasi sistem deteksi buronan secara menyeluruh — sengaja ditunda, dicatat terpisah sebagai rekomendasi di [[2026-10-31 - Rekomendasi Optimasi Sistem Deteksi (Belum Dikerjakan)]].)

Dokumen ini mencatat 2 keputusan arsitektur signifikan dari item 2-4 (multi-worker + catch-up) dan item 3 (PTZ).

## Opsi yang Dipertimbangkan

### A. Protokol kontrol PTZ
1. **ONVIF (SOAP, vendor-neutral)** — didukung oleh hampir semua merk kamera IP kelas menengah ke atas (Tapo, Hikvision, Dahua, dll) lewat satu antarmuka standar (`ContinuousMove`/`Stop`/`GetSnapshotUri`). Butuh kredensial ONVIF terpisah dari RTSP (biasanya sama persis) dan port ONVIF (default 80, Tapo pakai 2020).
2. **API proprietary per-merk** (mis. Tapo Cloud API, Hikvision ISAPI) — lebih "native" untuk 1 merk tapi butuh implementasi terpisah per merk, tidak scalable untuk sistem yang mendukung banyak preset kamera (lihat [[2026-10-30 - Migrasi Font Poppins dan Preset Multi-Merk CCTV]]).
3. **Kontrol lewat RTSP/CGI URL hack** — rapuh, tidak terstandarisasi, gampang rusak kalau firmware kamera update.

### B. Arsitektur loop deteksi frame
1. **Tetap 1 worker, 1 frame pada satu waktu** (kondisi sebelumnya) — simpel tapi kalau 1 frame lambat diproses (face embedding + similarity search ke Qdrant), semua frame berikutnya di belakangnya ikut delay, stream pelan-pelan "ketinggalan" dari kondisi kamera real-time.
2. **N worker konkuren membaca "frame terbaru" dari grabber yang sama** (frame-grabber "always keep latest, drop stale" + `asyncio.gather` dari N `_detection_worker`) — tiap worker selalu ambil frame paling baru yang tersedia, bukan antrean FIFO, sehingga kalau satu worker masih memproses, worker lain bisa langsung ambil frame terbaru berikutnya begitu grabber mendapat frame baru dari kamera. Efeknya throughput naik ~N kali dan stream otomatis "mengejar" waktu saat ini karena tidak ada antrean frame basi yang menumpuk.
3. **Turunkan frame rate capture** — mengurangi beban tapi mengorbankan granularitas deteksi, tidak menyelesaikan akar masalah (satu frame lambat tetap memblokir).

## Keputusan
- **PTZ: ONVIF**, diterapkan generik lewat `apps/api/src/services/ptz-client.ts` (package `onvif`), dipicu dari field `ptzSupported`/`onvifPort` baru di model `CCTVFeed` (bukan hardcode ke Tapo). Setiap preset kamera di `CAMERA_PRESETS` (`apps/web/src/app/(dashboard)/cctv/page.tsx`) mendeklarasikan port ONVIF & dukungan PTZ-nya sendiri, jadi menambah merk baru di masa depan cukup menambah entri preset tanpa kode baru, selama kamera tsb mendukung ONVIF (kebanyakan kamera IP modern mendukung).
- **Deteksi: multi-worker dengan "ambil frame terbaru"**, jumlah worker dikontrol lewat `cctv_worker_count` (default 3) di `services/detection-engine/app/config.py`. Dipilih karena langsung menjawab root cause (satu frame lambat memblokir semua frame berikutnya) tanpa mengorbankan resolusi temporal deteksi, dan tetap kompatibel dengan arsitektur frame-grabber "always latest" yang sudah ada dari perbaikan bbox-freeze sebelumnya ([[2026-10-30 - Cek Koneksi CCTV dan Live Streaming via MediaMTX]]).

## Konsekuensi
- PTZ hanya aktif untuk feed yang secara eksplisit ditandai `ptzSupported: true` saat dibuat/diedit — kamera yang tidak mendukung ONVIF (atau belum dicek) tidak akan menampilkan kontrol PTZ, mencegah percobaan kontrol ke kamera yang tidak mendukungnya.
- Worker count yang lebih tinggi menaikkan beban CPU/GPU detection-engine secara linear per kamera aktif — kalau jumlah kamera aktif bertambah banyak di masa depan, `cctv_worker_count` mungkin perlu dibuat per-feed (bukan global) atau sistem perlu auto-scaling, dibahas lebih lanjut di catatan rekomendasi item 8.
- Snapshot PTZ (`ptzSnapshot`) diambil langsung dari ONVIF snapshot endpoint kamera (bukan dari RTSP relay MediaMTX), supaya tidak menambah beban pada RTSP relay yang sudah dipakai bersama oleh live view & detection-engine.
