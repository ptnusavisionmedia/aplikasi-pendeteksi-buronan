# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/). Versi mengikuti SemVer:
MAJOR.MINOR.PATCH — MINOR untuk fitur baru yang backward-compatible, PATCH untuk perbaikan bug.
Scope saat ini: `apps/api` (backend Express). `apps/web` dan `apps/mobile` belum diperbarui untuk
mengkonsumsi perubahan v0.2.x — lihat "Known follow-ups" di bawah.

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
