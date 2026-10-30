# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/). Versi mengikuti SemVer:
MAJOR.MINOR.PATCH — MINOR untuk fitur baru yang backward-compatible, PATCH untuk perbaikan bug.
Scope saat ini: `apps/api` (backend Express). `apps/web` dan `apps/mobile` belum diperbarui untuk
mengkonsumsi perubahan v0.2.x — lihat "Known follow-ups" di bawah.

## [Unreleased]

Scope: `apps/mobile` (Flutter, build number ke `1.0.0+3`), `apps/web` (`0.2.0` → `0.3.0`), `apps/api`
(`0.3.0` → `0.4.0`), root `0.3.0` → `0.4.0`.

### Added
- **Layar monitoring CCTV read-only di mobile.** Tab baru "CCTV" (`apps/mobile/lib/screens/cctv_screen.dart`,
  route `/cctv`) menampilkan daftar kamera dari `GET /cctv-feeds` (badge status, nama, lokasi, wilayah,
  tanggal terdaftar) via `cctvFeedsProvider` (Riverpod `FutureProvider.autoDispose`). Layar ini sengaja
  tidak punya tombol tambah, edit, hapus, atau toggle status apa pun — mengelola feed CCTV (tambah/kurangi)
  tetap eksklusif di web dashboard untuk admin, sesuai permintaan eksplisit pengguna. Model baru
  `apps/mobile/lib/models/cctv_feed.dart` sengaja tidak menyertakan `urlStream`/`ownerId` karena mobile
  tidak merender video dan tidak butuh metadata kepemilikan. Tidak ada perubahan backend — endpoint
  `GET /cctv-feeds` sudah terbuka untuk semua role yang login (`requireAuth` saja, tanpa pembatasan role).
  Lihat `vault/03-Decisions/2026-10-30 - Monitoring CCTV Read-Only di Mobile.md`.

### Changed
- **Registrasi publik sekarang Masyarakat-only di semua klien.** `apps/mobile/lib/screens/auth/register_screen.dart`
  kehilangan dropdown "Peran" dan field "Wilayah tugas" — form hanya nama/email/password, selalu
  mendaftar sebagai Masyarakat. Halaman registrasi publik di web (`apps/web/src/app/(auth)/register/page.tsx`)
  **dihapus total**; dashboard web khusus petugas yang akunnya diprovisioning operator, bukan tempat
  pendaftaran publik. `POST /auth/register` (`apps/api/src/routes/auth.ts`, `apps/api/src/services/auth.ts`)
  tidak lagi menerima field `role` dari client sama sekali — selalu membuat akun `MASYARAKAT` dengan
  `isVerified: true`, berlaku untuk semua klien (termasuk panggilan API langsung), menutup celah
  privilege-escalation lewat body request. Akun petugas (Aparat/Keamanan Swasta/Instansi Hukum/Admin)
  tetap diprovisioning lewat `apps/api/prisma/seed.ts` (lihat `ACCOUNT.md`), bukan lewat alur
  self-register + approval admin seperti sebelumnya. Lihat
  `vault/03-Decisions/2026-10-30 - Registrasi Publik Masyarakat-Only, Akun Petugas Lewat Provisioning Operator.md`.

## [0.3.0] - 2026-10-30

Scope: `apps/web` (dashboard) & `apps/mobile` (Flutter). `apps/web` version dinaikkan ke `0.2.0`,
`apps/mobile` build number ke `1.0.0+2`.

### Added
- **Dukungan preset merk kamera di form "Tambah Feed" CCTV.** `apps/web/src/app/(dashboard)/cctv/page.tsx`
  menambahkan daftar `CAMERA_PRESETS` (TP-Link Tapo C200 & seri Tapo lain, Hikvision, Dahua, Ezviz,
  Imou, Xiaomi/Mi Home, generik ONVIF/RTSP, manual) yang otomatis mengisi template URL RTSP dan
  menampilkan catatan cara mengaktifkan RTSP per merk. Backend (`apps/api/src/routes/cctv.ts`,
  `services/detection-engine/app/services/cctv_stream.py`) tidak berubah — sudah generik berbasis
  RTSP/OpenCV `VideoCapture`, jadi semua merk di atas (termasuk Tapo C200) sudah didukung begitu
  URL stream-nya benar.

### Changed
- **Penyempurnaan visual dashboard web**, melanjutkan perubahan yang sudah berjalan sebelum sesi ini
  (font Figtree → **Poppins**, aksen glassmorphism pada sidebar & header di
  `apps/web/src/app/(dashboard)/layout.tsx`): `bento-cell` sekarang punya `box-shadow` + hover-lift,
  dan kartu statistik/feed memakai badge ikon bertinta (`.icon-badge`) agar lebih hidup. Lihat
  `vault/03-Decisions/2026-10-30 - Migrasi Font Poppins dan Preset Multi-Merk CCTV.md`.
- **Aksen warna diganti dari emerald (`#0c6b4f`) ke biru (`#1d5fd1`)** atas permintaan pengguna
  ("lebih enak dilihat"). Diterapkan lewat token tema (`--color-primary*` di `globals.css`) sehingga
  seluruh pemakaian `bg-primary`/`text-primary`/`.glass-primary`/blob latar ikut berubah tanpa
  menyentuh komponen satu per satu.
- **Layout halaman Overview (`/dashboard`) ditata ulang**: kartu "Total Deteksi Tercatat" sekarang
  jadi banner hero penuh di baris paling atas (bukan kotak 2×2 di tengah grid), diikuti baris 4 kartu
  statistik ringkas, lalu panel detail (Deteksi Terbaru + Eskalasi/Status Anda) di bawahnya — alurnya
  jadi ringkasan → detail dari atas ke bawah.
- **`apps/mobile` (Flutter) disinkronkan dengan tema web baru** di `lib/core/theme.dart`: font
  Figtree → **Poppins** (file TTF di `assets/fonts/` diganti, bobot 400/500/600/700/800 sama seperti
  sebelumnya; `Figtree-*.ttf` lama dihapus karena tidak terpakai lagi) dan `AppColors.primary*`
  diganti emerald → biru (`#1D5FD1`) mengikuti token `--color-primary` di web. `BentoCell` dan warna
  sekunder (coral/amber) tidak berubah. Diverifikasi via `flutter analyze` (bersih) dan
  `flutter run -d web-server`: alur Lapor → Login → Home berjalan normal dengan tampilan baru.

### Fixed
- **Bug: seluruh font web dashboard diam-diam fallback ke serif browser (Times New Roman), bukan
  Poppins.** `apps/web/src/app/layout.tsx` menaruh `poppins.variable` (yang berisi custom property
  `--font-poppins`) pada elemen `<body>`, sementara `globals.css` mereferensikan `var(--font-poppins)`
  di dalam `--font-sans` yang didefinisikan pada `:root`/`<html>` — custom property anak (`<body>`)
  tidak mengalir ke induknya (`<html>`), jadi `--font-poppins` tidak pernah terlihat di titik
  `--font-sans` dihitung, membuat seluruh rantai font jadi *guaranteed-invalid* dan browser diam-diam
  memakai default serif-nya. Perbaikan: pindahkan `poppins.variable` ke elemen `<html>`. Bug ini sudah
  ada sejak font Figtree (pola yang sama), ditemukan saat menguji perubahan font Poppins di sesi ini.
- **Bug: utility Tailwind (`bg-primary`, `text-white`, dll) kalah total saat dipasangkan dengan kelas
  kustom (`.bento-cell`, dsb) dari `globals.css`.** Kelas kustom ditulis sebagai CSS polos di luar
  `@layer`, dan menurut spesifikasi cascade layers, style di luar layer SELALU menang atas style di
  dalam layer manapun — terlepas dari urutan penulisan atau spesifisitas. Tailwind v4 membungkus semua
  utility-nya dalam `@layer theme, base, components, utilities;`, jadi `.bento-cell { background: ... }`
  (tanpa layer) selalu mengalahkan `.bg-primary { background-color: ... }` (dalam layer `utilities`)
  pada elemen yang sama — kartu "Total Deteksi Tercatat" di dashboard jadi putih kosong tanpa teks
  terlihat (teks putih di atas latar putih). Perbaikan: bungkus seluruh kelas kustom di `globals.css`
  dalam `@layer base`/`@layer components` sesuai konvensi Tailwind v4.

## [0.2.1] - 2026-10-30

### Fixed
- **Bug: daftar deteksi produksi (`GET /detections`) menyembunyikan semua event tanpa CCTV feed.**
  Ditemukan saat testing filter baru untuk FR-25 (isolasi feed simulasi webcam). Filter awal
  memakai shorthand relasi Prisma `cctvFeed: { sourceType: { not: "DEV_SIMULATION" } }` pada
  relasi opsional — Prisma menerjemahkan ini jadi `is: {...}`, yang mensyaratkan ada baris relasi
  yang *cocok*. Event dari laporan masyarakat & upload manual (`cctvFeedId` null, tidak punya
  relasi CCTV sama sekali) ikut tersaring hilang, padahal seharusnya hanya event dari feed
  `DEV_SIMULATION` yang disembunyikan. Diperbaiki dengan `OR: [{ cctvFeedId: null }, { cctvFeed: { sourceType: { not: "DEV_SIMULATION" } } }]`.
  File: `apps/api/src/routes/detections.ts`.

## [0.2.0] - 2026-10-30

Implementasi [PRD v2](vault/01-Product/PRD-v2.md): penyempurnaan anti-salah-identifikasi dan mode
simulasi webcam untuk development, mengikuti keputusan di
`vault/03-Decisions/2026-10-30 - Lingkup PRD v2 Akurasi dan Webcam Dev.md`.

### Added
- **FR-19 — Verifikasi berlapis sebelum eskalasi.** `DetectionEvent` punya status baru
  `PENDING_CONFIRMATION` → `CONFIRMED_BY_OFFICER` / `REJECTED_FALSE_POSITIVE`. Endpoint baru
  `PATCH /detections/:id/confirm` dan `PATCH /detections/:id/reject` (role Aparat/Keamanan
  Swasta/Admin). `POST /escalations` sekarang menolak (422) eskalasi yang belum berstatus
  `CONFIRMED_BY_OFFICER` — tidak lagi cukup hanya punya evidence. Notifikasi internal (FR-13)
  tetap terkirim cepat seperti sebelumnya; yang digerbang hanya eskalasi ke kepolisian.
- **FR-20 — Liveness/anti-spoofing gate.** `assessLiveness()` (`apps/api/src/services/liveness.ts`)
  dan field `isLive` pada `DetectionEvent`/webhook. Webhook dari detection engine
  (`POST /detections/webhook`) kini menolak frame yang terindikasi spoof (foto-dari-foto/recapture)
  sebelum membuat evidence/notifikasi — dicatat sebagai `SPOOF_ATTEMPT_DETECTED` di audit log.
  Kontrak backward-compatible: jika engine belum mengirim sinyal liveness, frame tetap diproses
  seperti sebelumnya (lihat "Known follow-ups").
- **FR-21 — Quality gate & multi-angle wajib saat enrollment buronan.**
  `validatePhotoQuality()` / `isEnrollmentComplete()` (`apps/api/src/services/photo-quality.ts`).
  `POST /buronan/:id/foto` sekarang mewajibkan `angle` (FRONTAL/SAMPING_KIRI/SAMPING_KANAN) +
  `width`/`height`, menolak (422) foto di bawah resolusi minimum (480x480px), dan menandai
  `Buronan.enrollmentComplete = true` otomatis setelah ≥2 angle berbeda terdaftar.
- **FR-22 — Metrik akurasi per kamera.** `computeCameraAccuracy()`
  (`apps/api/src/services/camera-accuracy.ts`) + endpoint `GET /cctv-feeds/:id/accuracy`,
  menghitung false-positive rate berjalan dari keputusan confirm/reject (FR-19) dan menandai
  kamera `flagged: true` jika FP rate > 10% dengan sampel cukup (≥5 match ditinjau).
- **FR-23 — Kanal sanggahan (appeal).** Model `Appeal` baru + router
  `apps/api/src/routes/appeals.ts`: `POST /appeals` (publik, rate-limited, tanpa login — untuk
  pihak yang merasa salah terdeteksi), `GET /appeals` & `PATCH /appeals/:id/review` (staf).
  Sanggahan yang diterima otomatis menandai `DetectionEvent` terkait sebagai
  `REJECTED_FALSE_POSITIVE` (evidence tidak dihapus, tetap ada di audit trail, tapi tidak bisa
  dipakai lagi sebagai dasar tindakan).
- **FR-24 — Mode simulasi kamera (webcam dev).** `CCTVFeed.sourceType` (`PRODUCTION` |
  `DEV_SIMULATION`). `POST /cctv-feeds` menolak (403) pendaftaran feed `DEV_SIMULATION` jika
  `NODE_ENV=production`. Endpoint baru `POST /detections/dev-simulate` menjalankan deteksi pada
  frame webcam yang dikirim dari browser (`getUserMedia`), hanya untuk feed berstatus
  `DEV_SIMULATION`.
- **FR-25 — Isolasi feed simulasi dari produksi.** Match dari feed `DEV_SIMULATION` tidak pernah
  memicu `enqueueNotificationJob` (tidak ada notifikasi/eskalasi nyata) dan tidak membuat
  `Evidence`. `GET /detections` menyembunyikan event dari feed `DEV_SIMULATION` secara default
  (parameter `includeDevSimulation=true` untuk menampilkannya saat debugging).
- Env var baru: `env.nodeEnv` / `env.isProduction` (`apps/api/src/env.ts`) — dasar untuk semua
  guard dev/production di atas.
- Unit test (`node:test` via `tsx --test`, `pnpm --filter api test`) untuk tiga modul logika
  murni di atas: `liveness.test.ts`, `photo-quality.test.ts`, `camera-accuracy.test.ts` — 14 test,
  semua pass. Script `typecheck` (`tsc --noEmit`) ditambahkan untuk cek tipe seluruh API.

### Database
- Migration `20261030000000_v2_verifikasi_berlapis_dan_dev_simulasi`: enum `DetectionStatus`
  +3 value, enum baru `CCTVFeedSourceType`/`AppealStatus`/`FotoAngle`, kolom baru di `buronan`,
  `foto_buronan`, `cctv_feeds`, `detection_events`, tabel baru `appeals`.
  **Catatan:** ditulis manual (bukan hasil `prisma migrate dev`) karena tidak ada Postgres yang
  bisa diakses di environment pengembangan ini — jalankan
  `pnpm --filter api prisma:migrate deploy` lalu `prisma migrate status` saat infra (`infra:up`)
  aktif, sebelum deploy.

### Known follow-ups (belum dikerjakan di sesi ini)
- **`apps/web` & `apps/mobile`** belum diperbarui untuk memakai status/endpoint baru (tombol
  konfirmasi/tolak match, form sanggahan, UI badge "DEV/TEST", dashboard akurasi kamera). Backend
  sudah siap dipanggil; UI masih memakai alur v1.
- **Liveness model asli** belum diimplementasikan di `services/detection-engine` (Python). Kontrak
  (`isLive` di webhook) sudah siap menerima sinyal itu begitu model anti-spoofing terpasang di
  sana; sampai saat itu, gate liveness efektif selalu lolos (lihat `assessLiveness()`).
- End-to-end test (hit endpoint sungguhan lewat server + Postgres + Qdrant berjalan, seperti yang
  dilakukan untuk v1) belum bisa dijalankan di sesi ini karena tidak ada akses Docker/Postgres di
  environment ini. Yang sudah diverifikasi: `tsc --noEmit` bersih di seluruh `apps/api`, dan unit
  test murni (14/14 pass) untuk semua logika baru yang tidak butuh database.

## [0.1.0] - 2026-10-29
Rilis awal (V1): autentikasi & RBAC, database buronan (DPO), deteksi wajah real-time (CCTV &
upload), notifikasi & eskalasi, pelaporan masyarakat. Lihat [[vault/01-Product/PRD|PRD v1]] dan
`vault/Home.md` untuk detail lengkap.
