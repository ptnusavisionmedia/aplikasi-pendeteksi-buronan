---
tags: [template, decision]
date: 2026-11-01
status: accepted
---

# Unifikasi Ambang Deteksi, Optimasi Streaming, dan Fitur AI Advisory

- **Tanggal:** 2026-11-01
- **Status:** accepted
- **Konteks terkait:** [[../04-Research/2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)|Rekomendasi Optimasi Sistem Deteksi Buronan]], [[../04-Research/2026-10-31 - Rencana Perbaikan Latensi Mode Fokus (Belum Dikerjakan)|Rencana Perbaikan Latensi Mode Fokus]], [[../04-Research/2026-10-31 - Rencana Kecerdasan Buatan Tambahan (Kalibrasi Akurasi + Deteksi Anomali)|Rencana Kecerdasan Buatan Tambahan]], [[2026-10-31 - Koreksi Mirror Kamera dan Live Thumbnail CCTV]]

## Konteks

Permintaan user (2026-11-01, sesi lanjutan dari revisi mirror/live-thumbnail hari sebelumnya):

> "ok sekarang tolong kalau semisal persentasi kemiripan diatas 70% maka tangkap gambar dan simpan ya, lalu untuk realtime pada video streamnya juga optimalkan juga ya serta penerapan fitur [tiga dokumen riset yang sebelumnya sengaja ditunda], jadi kerjakan kemudian testing hard di akhir yaa"

Ini mengeksekusi tiga dokumen riset yang pada revisi sebelumnya sengaja hanya didokumentasikan tanpa dikerjakan ([[../04-Research/2026-10-31 - Rencana Perbaikan Latensi Mode Fokus (Belum Dikerjakan)]] secara eksplisit diminta "jangan dieksekusi dulu"), plus satu permintaan baru: ambang tangkap-gambar otomatis diturunkan dari 90% ke 70%.

Investigasi awal menemukan **ambang kecocokan sebenarnya sudah ada dua tempat berbeda yang tidak sinkron**: `SystemSetting.detectionMatchThreshold` (dapat diedit admin lewat Pengaturan, tapi hanya dipakai detection-engine Python untuk keputusan bbox overlay) vs. `CONFIDENCE_THRESHOLD = 0.9` hardcoded terpisah di `apps/api/src/routes/detections.ts` yang **sebenarnya mengontrol kapan evidence/notifikasi dibuat**. Mengubah permintaan "turunkan ke 70%" jadi kesempatan sekaligus memperbaiki inkonsistensi ini, bukan cuma mengubah satu angka.

## Opsi yang Dipertimbangkan

### Ambang deteksi
1. **Ubah hanya angka `CONFIDENCE_THRESHOLD` di detections.ts ke 0.7** — tidak dipilih: tetap meninggalkan dua sumber kebenaran yang bisa drift lagi di masa depan, dan field "Ambang terkonfirmasi" di Pengaturan akan terus terlihat seperti mengontrol sesuatu yang sebenarnya tidak.
2. **Unifikasi: hapus konstanta hardcoded, baca `SystemSetting.detectionMatchThreshold` di semua 3 titik pakai di detections.ts** — dipilih: satu sumber kebenaran, field Pengaturan yang sudah ada jadi benar-benar fungsional untuk capture threshold juga, bukan hanya overlay.

### Optimasi video real-time (Mode Fokus)
Mengikuti opsi yang sudah dianalisis di [[../04-Research/2026-10-31 - Rencana Perbaikan Latensi Mode Fokus (Belum Dikerjakan)]]:
1. **WebRTC/WHEP sebagai jalur utama, HLS sebagai fallback otomatis** — dipilih untuk Layer A (video). MediaMTX sudah expose WHEP di port 8889 (dikonfirmasi lewat `curl OPTIONS` sebelum implementasi). Alternatif "hanya tuning HLS buffer" ditolak karena HLS secara arsitektural tidak bisa mencapai latensi sub-detik yang dikeluhkan user.
2. **Downscale frame + executor pool terpisah untuk jalur deteksi** (Layer B) — dipilih, mengikuti rekomendasi di [[../04-Research/2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]].
3. **Cache koneksi ONVIF per kamera** (Layer C, PTZ) — dipilih, karena setiap `ptzMove`/`ptzStop`/`ptzSnapshot` sebelumnya membuka handshake SOAP baru dari nol.

### Fitur AI tambahan
Mengikuti [[../04-Research/2026-10-31 - Rencana Kecerdasan Buatan Tambahan (Kalibrasi Akurasi + Deteksi Anomali)]] — kedua arah **sengaja dibuat advisory/informational-only**, tidak auto-apply/auto-escalate, karena ini aplikasi keselamatan publik di mana ambang deteksi & eskalasi harus tetap keputusan manusia.

## Keputusan

### 1. Unifikasi ambang deteksi
- `SystemSetting.detectionMatchThreshold` default diturunkan dari `0.9` → `0.7` (migrasi Prisma + baris singleton existing di-update).
- `apps/api/src/routes/detections.ts`: konstanta `CONFIDENCE_THRESHOLD` dihapus, diganti `getConfidenceThreshold()` yang membaca `SystemSetting` lewat `getOrCreateSettings()` (sekarang di-export dari `settings.ts`) — dipakai di ketiga titik (`upload-check`, `dev-simulate`, `webhook`).
- Mode Fokus (`apps/web/.../cctv/live/[id]/page.tsx`): `tierFor()` dan teks legend sekarang menerima `reportThreshold`/`matchThreshold` dari `/settings`, bukan hardcode 0.5/0.9 — **diverifikasi langsung di browser**: legend berubah jadi "50–70% — mirip" / "≥ 70% — otomatis tersimpan ke database" setelah perubahan.

### 2. Optimasi video real-time
- **WHEP (WebRTC) sebagai jalur utama** di Mode Fokus (`mediamtx-client.ts` tambah `liveWhepUrl()`, route `/cctv-feeds/:id/live` kembalikan `whepUrl` juga), dengan fallback otomatis ke HLS jika WHEP gagal — termasuk watchdog: jika sinyal WHEP berhasil tapi video tidak pernah benar-benar mengalir dalam 5 detik (`video` elemen tidak pernah fire event `playing`), dianggap gagal dan fallback ke HLS, bukan dibiarkan macet di layar hitam.
  - **Bug yang ditemukan & diperbaiki saat verifikasi langsung:** WHEP non-trickle butuh SDP offer sudah membawa seluruh kandidat ICE sebelum dikirim — kode awal mengirim offer segera setelah `setLocalDescription()` tanpa menunggu `iceGatheringState === "complete"`, sehingga sinyal "berhasil" tapi video tidak pernah tampil (track `live` tapi `muted` selamanya). Diperbaiki dengan menunggu ICE gathering selesai (timeout 3 detik) sebelum POST.
  - **Juga ditambahkan STUN server** (`stun:stun.l.google.com:19302`) di konfigurasi `RTCPeerConnection` — tanpa ini, Chrome hanya menghasilkan kandidat `host` dengan nama mDNS (`*.local`) yang tidak bisa di-resolve MediaMTX; dengan STUN, Chrome juga menghasilkan kandidat `srflx` dengan IP asli. Setelah kedua perbaikan ini, **video live terverifikasi benar-benar real-time di browser** (timestamp overlay kamera bergerak sinkron dengan gerakan di frame).
- HLS fallback-nya sendiri juga dituning (`liveSyncDurationCount: 2`, turun dari 3) untuk kasus WHEP tidak tersedia.
- Deteksi live (`cctv_stream.py`): frame di-downscale ke maksimum 960px sisi terpanjang sebelum CLAHE+embedding (snapshot evidence tetap pakai frame resolusi penuh), dan seluruh kerja CPU-bound deteksi (downscale, blur-check, embedding, pencarian Qdrant) dipindah ke `ThreadPoolExecutor` khusus (`_detection_executor`, 32 worker) alih-alih pool default asyncio yang dipakai bersama proses lain.
- `ptz-client.ts`: koneksi ONVIF (`Cam`) di-cache per `host:port:username` dengan TTL 10 menit, dan otomatis di-invalidasi begitu sebuah command gagal (kemungkinan koneksi basi). **Diverifikasi**: panggilan PTZ kedua ke kamera yang sama turun ke ~15ms (vs. handshake SOAP penuh sebelumnya).

### 3. Perbaikan akurasi deteksi (dari Rekomendasi Optimasi)
- **Blur/quality gate**: frame dengan Laplacian variance di bawah ambang (25.0, pada gambar yang sudah di-downscale) dilewati sepenuhnya — tidak dianggap "tidak ada wajah" (overlay tidak di-clear), hanya menunggu tick berikutnya yang lebih tajam.
- **Multi-frame voting**: pasangan (kamera, buronan) baru dianggap "reportable" (layak masuk webhook/evidence/notifikasi) setelah muncul di atas ambang laporan selama 2 tick capture berturut-turut, bukan langsung dari satu frame.
- **Sengaja ditunda**: migrasi job queue Redis/RQ penuh dari [[../04-Research/2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]] — dianggap di luar proporsi lingkup permintaan ini (perubahan arsitektur besar, bukan tuning); didokumentasikan sebagai pekerjaan lanjutan, belum dikerjakan.

### 4. Fitur AI advisory-only
- **Kalibrasi ambang per-kamera**: `computeCameraAccuracy()` (dipakai `GET /cctv-feeds/:id/accuracy`) sekarang juga menghitung rata-rata confidence dari deteksi yang DITOLAK petugas (`REJECTED_FALSE_POSITIVE`), dan jika kamera sudah di-flag (false-positive rate tinggi, sampel cukup), menghasilkan teks saran kalibrasi konkret (mis. "pertimbangkan naikkan ambang ke ~X%"). **Murni teks saran, tidak pernah mengubah `SystemSetting` otomatis.** Ditampilkan di kartu kamera `/cctv` (hanya untuk role yang bisa kelola feed).
- **Flag loitering (dwell-time)**: `cctv_stream.py` melacak posisi bbox tiap wajah antar-tick per kamera (rule-based, jarak centroid, bukan ML) — jika satu wajah bertahan di sekitar posisi yang sama ≥60 detik, field `loiterSeconds` disertakan di response `live-detection`. Ditampilkan sebagai badge "Berdiam Xs" di overlay Mode Fokus, murni informasional — **tidak memicu eskalasi otomatis apa pun**.

## Konsekuensi

- Field "Ambang terkonfirmasi" di Pengaturan sekarang benar-benar mengontrol kapan evidence/notifikasi dibuat (sebelumnya hanya kosmetik untuk overlay) — admin yang mengubahnya perlu sadar dampaknya sekarang lebih luas dari sebelumnya.
- Mode Fokus kini membuka sesi WebRTC (WHEP) per kamera selain relay HLS yang sudah ada — pada skala banyak kamera dibuka bersamaan, ini menambah beban MediaMTX (relevan dipertimbangkan bersama catatan skalabilitas di [[../04-Research/2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]]). Kartu live-thumbnail di `/cctv` tetap pakai HLS saja (tidak diubah ke WHEP) karena di sana autoplay-muted-loop sudah cukup, latensi sub-detik tidak krusial seperti di Mode Fokus.
- Multi-frame voting berarti kemunculan sekali instan (false positive sekilas) tidak lagi langsung membuat baris database, tapi juga menambah sedikit delay (satu tick capture, ~1-2 detik) sebelum kecocokan tinggi pertama kali tercatat — trade-off yang disengaja untuk mengurangi noise.
- Executor pool deteksi (`_detection_executor`, 32 thread) berjalan terpisah dari `_check_executor` (16 thread) yang sudah ada — total thread pool bertambah; tidak masalah pada skala saat ini (1 kamera di dev), perlu dipantau pada skala produksi lebih besar.
- Saran kalibrasi per-kamera baru tampil setelah kamera punya cukup riwayat tinjauan petugas (`MIN_SAMPLE_SIZE_FOR_ALERT = 5`) — di lingkungan dev/baru, field ini akan `null` untuk sementara (diverifikasi: `GET /cctv-feeds/:id/accuracy` mengembalikan `calibrationSuggestion: null` saat `totalReviewed: 0`).

### Hasil "testing hard"
- `tsc --noEmit` bersih di `apps/api` dan `apps/web`.
- Python: syntax-check bersih untuk `cctv_stream.py` dan `internal.py`.
- Verifikasi langsung di browser (login sebagai admin): live thumbnail HLS di `/cctv` tetap jalan, Mode Fokus berhasil memutar video real-time lewat WHEP (dengan dua bug diperbaiki di proses verifikasi ini, lihat bagian Keputusan #2), legend ambang dinamis terkonfirmasi berubah sesuai `SystemSetting`, mirror correction tetap bekerja bersamaan dengan WHEP.
- Endpoint API diverifikasi lewat `curl` dengan token admin asli: `GET /settings` (`detectionMatchThreshold: 0.7`), `GET /cctv-feeds/:id/live-detection` (shape baru dengan `loiterSeconds`), `GET /cctv-feeds/:id/accuracy` (shape baru dengan `calibrationSuggestion`).
- PTZ move/stop di-smoke-test lewat `curl` — kamera benar-benar bergerak, panggilan kedua ke kamera yang sama ~15ms (reuse koneksi terbukti jalan).
- Tidak ada perubahan di `apps/mobile` pada sesi ini, jadi `flutter analyze` tidak dijalankan ulang.
