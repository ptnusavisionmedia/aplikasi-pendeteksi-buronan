---
tags: [guide, tips, troubleshooting]
---

# Tips & Trik Pemakaian Aplikasi

> [[../Home|⬅ Kembali ke Home]]

Kumpulan tips praktis hasil pengalaman langsung memakai & menjalankan aplikasi ini (bukan teori) — pelengkap [[Panduan Setup Development]] (cara install/jalankan stack) dan [[Cara Kerja Aplikasi]] (alur kode end-to-end).

## 1. Role & Login

- 5 role: `ADMIN`, `APARAT`, `KEAMANAN_SWASTA`, `INSTANSI_HUKUM`, `MASYARAKAT`. Hanya `MASYARAKAT` yang bisa daftar sendiri lewat form publik — role lain **hanya** dibuat lewat provisioning operator/seed script (lihat [[../03-Decisions/2026-10-30 - Registrasi Publik Masyarakat-Only, Akun Petugas Lewat Provisioning Operator|Decision Record]]). Kalau butuh akun petugas baru untuk testing, jangan coba daftar dari form — minta admin jalankan seed/provisioning.
- `APARAT` & `INSTANSI_HUKUM` **wajib 2FA (TOTP)** saat login. Simpan `twoFactorSecret` yang di-generate saat register untuk di-scan ulang ke Google Authenticator/Authy kalau perlu re-setup.
- Salah password 5x beruntun → akun terkunci 15 menit (lockout disimpan di Redis). Kalau lagi testing berulang dan kena lockout, flush key `login:lockout:<email>` di Redis, atau tunggu 15 menit.
- Notifikasi deteksi hanya dikirim ke user dengan `wilayahScope` yang cocok dengan lokasi CCTV — kalau user testing tidak terima notifikasi, cek dulu apakah `wilayahScope`-nya memang mencakup wilayah feed tersebut.

## 2. Setup CCTV — RTSP asli vs Webcam (dev/testing)

- **CCTV asli**: isi field "URL Stream" dengan URL RTSP kamera (pilih preset merk di form Tambah Feed supaya template `rtsp://{user}:{pass}@{ip}:554/...` otomatis terisi — lihat daftar merk yang didukung di `apps/web/src/app/(dashboard)/cctv/page.tsx`). Semua merk yang ada di preset sudah ONVIF/RTSP standar, tidak perlu SDK vendor.
- **Webcam laptop sebagai pengganti CCTV** (untuk demo/testing tanpa kamera fisik): pipeline (MediaMTX + detection-engine) **hanya menerima RTSP**, jadi webcam perlu "disulap" jadi sumber RTSP dulu lewat `ffmpeg`:
  1. Pastikan MediaMTX jalan (`docker compose -f infra/docker-compose.yml ps` → `mediamtx` harus `Up`, port 8554/8888/8889/9997).
  2. Cek nama device webcam dulu — **jangan asumsikan** namanya "Integrated Camera"/"HD Webcam", tiap laptop beda:
     ```bash
     ffmpeg -list_devices true -f dshow -i dummy
     ```
  3. Cek juga resolusi & fps yang didukung device (banyak webcam cuma punya fps fix, mis. 30, bukan 15/24/dst — kalau dipaksa fps yang tidak ada di daftar, ffmpeg langsung error "Could not set video options"):
     ```bash
     ffmpeg -f dshow -list_options true -i video="<nama device>"
     ```
  4. Publish ke MediaMTX — **gunakan `-rtsp_transport tcp`** (lebih stabil untuk localhost; tanpa ini pernah putus sendiri dengan error "Failed reading RTSP data: End of file") dan resolusi/fps **sesuai yang didukung device** (resolusi native tinggi, mis. 1920x1080, sering gagal diencode real-time dengan `preset ultrafast` di CPU biasa → buffer penuh → frame drop parah; turunkan ke 640x480 kalau speed-nya < 1.0x di log ffmpeg):
     ```bash
     ffmpeg -f dshow -video_size 640x480 -framerate 30 -i video="<nama device>" \
       -vcodec libx264 -preset ultrafast -tune zerolatency -g 30 \
       -rtsp_transport tcp -f rtsp rtsp://localhost:8554/webcam-dev
     ```
     Biarkan terminal ini **tetap terbuka** selama webcam dipakai — tutup terminal = stream mati seketika.
  5. Daftarkan sebagai CCTV Feed biasa di dashboard web (`/cctv` → Tambah Feed CCTV): merk pilih **"Lainnya"**, URL Stream = `rtsp://localhost:8554/webcam-dev`, PTZ **tidak dicentang** (webcam tidak support ONVIF). Setelah disimpan, treat seperti CCTV sungguhan — Cek Koneksi, Mode Fokus, semuanya jalan sama.
  - Catatan: field `sourceType: DEV_SIMULATION` sudah ada di skema database (untuk mode "webcam langsung lewat browser via `getUserMedia`", lihat [[../01-Product/PRD-v2|PRD v2]] FR-24) tapi **UI web/mobile untuk itu belum dibangun**. Trik ffmpeg-ke-RTSP di atas adalah cara paling praktis sekarang karena reuse 100% pipeline CCTV yang sudah jadi.

## 3. Mode Fokus & Live View

- Mode Fokus (live full-screen) pakai WebRTC/WHEP dulu, fallback otomatis ke HLS kalau WHEP gagal. Kartu live di `/cctv` (thumbnail) **selalu** pakai HLS (lebih ringan untuk banyak kamera sekaligus).
- Kalau video macet/diam di satu frame > beberapa detik, sistem sudah auto-reconnect (backoff 1s→2s→4s→8s, maks 5x). Kalau tetap gagal setelah itu, baru muncul tombol **"Coba Lagi"** manual — klik itu dulu sebelum curiga ada bug.
- Toggle **"Mirror"** per kamera kalau gambar kebalik secara horizontal (koreksi CSS, bukan ubah setting fisik kamera) — umum terjadi di sebagian webcam/USB camera.

## 4. Threshold Deteksi & Noise

- Dua threshold berbeda di halaman **Pengaturan**: `detectionMatchThreshold` (default 70%) menentukan apakah `DetectionEvent` **dibuat sama sekali** dari webhook CCTV live; `detectionReportThreshold` (default 50%, dipakai jalur manual/dev) menentukan status `LOW_CONFIDENCE` vs `CONFIRMED`. Kalau daftar Deteksi kebanjiran hasil tidak relevan, **naikkan** `detectionMatchThreshold`, jangan ubah yang lain.
- Overlay bounding box real-time di Mode Fokus **tidak terpengaruh** oleh threshold ini — itu dari cache in-memory terpisah di detection-engine, jadi operator tetap lihat semua kandidat deteksi walau tidak semuanya tersimpan sebagai evidence.
- Frame blur (fokus goyang/motion blur) otomatis diskip dari deteksi (Laplacian variance gate) — kalau kamera sering out-of-focus, perbaiki fisik kameranya, bukan ubah kode.

## 5. Berita Acara (CMS)

- Isi pakai editor markdown (toolbar bold/italic/heading/quote/list/link/gambar + tab Pratinjau) — status `DRAFT` tidak tampil di endpoint publik, harus diubah ke `TERBIT` dulu agar muncul di mobile.
- Upload gambar lewat toolbar editor otomatis lewat `POST /berita-acara/media` — jangan paste base64 langsung ke markdown, ukuran file jadi besar dan render-nya lambat.

## 6. Eskalasi & Laporan

- Eskalasi ke instansi **wajib** ada `Evidence` terlampir di `DetectionEvent` — kalau tombol eskalasi gagal dengan error 422, cek dulu apakah deteksi itu punya snapshot evidence (deteksi dari upload manual tanpa foto tersimpan, atau data lama sebelum perbaikan persistensi MinIO, bisa tidak punya evidence).
- Laporan masyarakat tetap butuh verifikasi petugas sebelum dianggap valid — jangan harap notifikasi/eskalasi otomatis dari laporan yang belum diverifikasi.

## 7. Mobile (Flutter)

- Build APK release butuh `--dart-define=API_BASE_URL=...`. Default kalau tidak diisi adalah `http://localhost:4001` — **tidak akan jalan** di HP asli/emulator karena `localhost` di situ merujuk ke device itu sendiri, bukan komputer development. Pakai `http://10.0.2.2:4001` untuk Android emulator, atau IP LAN komputer untuk HP fisik di jaringan yang sama.
- Tombol kembali eksplisit (`AppBackButton`) sudah ada di semua layar non-Home — tidak perlu mengandalkan gesture back sistem Android yang kadang tidak konsisten antar device.
- Kalau setelah restart app, menekan ikon Profil malah lempar ke login padahal sudah pernah login — itu bug lama yang sudah diperbaiki ([[../03-Decisions/2026-11-01 - Perbaikan Sesi Mobile Tidak Terpulihkan Setelah Restart|Decision Record]]); kalau masih terjadi di build lama, update ke versi terbaru.

## 8. Build & Jalankan untuk Demo/Produksi Lokal

- **Dev mode** (hot-reload): `tsx watch src/server.ts` (API), `next dev` (Web). Cocok untuk development aktif, **bukan** untuk demo stabil (kompilasi on-demand per halaman bikin loading awal lambat).
- **Production mode** (build dulu baru jalan, lebih stabil & cepat untuk demo):
  ```bash
  # API
  cd apps/api && npm run build && node dist/server.js

  # Web
  cd apps/web && pnpm.cmd run build && pnpm.cmd run start
  ```
- Kalau mau ganti dari dev ke production mode (atau sebaliknya), **matikan proses lama dulu** — keduanya pakai port yang sama (4001, 3000), proses lama yang masih `LISTENING` akan membuat yang baru gagal start dengan `EADDRINUSE`. Cek proses yang pegang port: `netstat -ano | grep LISTENING` lalu cocokkan PID.

## 9. Gotcha Windows/PowerShell yang Sering Muncul

- **`npm`/`pnpm` di PowerShell error "running scripts is disabled"** — execution policy PowerShell default memblokir file `.ps1`. Pakai `npm.cmd`/`pnpm.cmd` (ekstensi `.cmd` eksplisit) sebagai gantinya, atau jalankan dari Git Bash/Command Prompt.
- **`ERR_PNPM_IGNORED_BUILDS`** saat `pnpm install`/`pnpm run` — jalankan `pnpm approve-builds --all` dari root repo. **Verifikasi hasilnya** di `pnpm-workspace.yaml` (`allowBuilds:`) — pastikan tiap package bernilai `true`/`false`, bukan teks placeholder yang belum diisi.
- **ffmpeg tidak dikenali setelah `winget install`** — PATH baru aktif di terminal yang dibuka *setelah* instalasi. Buka terminal baru, atau panggil lewat path lengkap `.exe`-nya sebagai workaround sementara.
- **`flutter build apk` butuh Android SDK** — jalankan `flutter doctor` dulu untuk pastikan toolchain Android ada (`[√] Android toolchain`). Kalau belum, lihat [[Panduan Install Flutter]].

## 10. PTZ & Multi-Kamera

- Kontrol PTZ (geser kamera) pakai protokol ONVIF generik — kompatibel lintas merk selama kamera support ONVIF, bukan hardcode ke satu vendor. Webcam laptop **tidak** support ini (jangan centang PTZ Supported untuk feed webcam).
- Koneksi ONVIF di-reuse per kamera (bukan buka-tutup koneksi baru tiap request) — kalau kontrol PTZ terasa lambat di percobaan pertama tapi cepat setelahnya, itu normal (koneksi awal sedang dibangun).
