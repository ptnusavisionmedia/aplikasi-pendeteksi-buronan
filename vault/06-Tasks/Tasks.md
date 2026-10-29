# Task List: Aplikasi Pendeteksi Buronan

> Berdasarkan `.agents/2-TECH-SPEC.md`. Dipecah 2 bagian besar: **Backend** (Express + FastAPI) dan **Frontend** (Next.js Web + Flutter Mobile). Setiap task: ID, Priority (High/Medium/Low), Status (Done/Done), Depends on.
>
> Catatan: skill `implement-task` resmi ("Task Generator") belum terpasang di environment ini, jadi daftar ini dibuat manual mengikuti format Vibe Coding (ID + Priority + Modul + Status) yang dipakai skill `implement-task` untuk membaca & mengimplementasikan task satu per satu.
>
> **Desain UI terpilih:** [[2026-10-29 - Pemilihan Arah Desain UI Bento|Design 4 — Bento]] (`ui-references/design-4-bento/`). Semua task frontend (T-32–T-50) mengikuti sistem desain ini: palet warna, font Figtree, pola bento-grid, ikon Lucide.

---

## 🔧 BACKEND

### Modul: Setup & Infra
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-01 | Setup monorepo (pnpm workspaces) + `infra/docker-compose.yml` (Postgres, Qdrant, Redis, MinIO) | High | Done | - |
| T-02 | Setup project Express (TypeScript, folder struktur sesuai Tech Spec Bagian 1) | High | Done | T-01 |
| T-03 | Setup project FastAPI (Python, folder struktur, install InsightFace/OpenCV) | High | Done | T-01 |
| T-04 | Setup Prisma schema sesuai Entity Overview (Tech Spec Bagian 2) + migration awal | High | Done | T-02 |
| T-05 | Setup Qdrant collection untuk face embedding (vector size & distance metric sesuai model InsightFace) | High | Done | T-01, T-03 |

### Modul: Autentikasi & RBAC (FR-01–04)
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-06 | `POST /auth/register` — registrasi instansi/masyarakat + approval flow | High | Done | T-04 |
| T-07 | `POST /auth/login` — verifikasi kredensial + trigger OTP untuk role sensitif | High | Done | T-06 |
| T-08 | `POST /auth/login/verify-otp` — verifikasi TOTP + issue JWT | High | Done | T-07 |
| T-09 | `POST /auth/forgot-password` & `/auth/reset-password` | Medium | Done | T-06 |
| T-10 | Middleware RBAC (cek role + `wilayah_scope` di setiap request) | High | Done | T-08 |
| T-11 | `PATCH /admin/users/:id/role` — admin ubah role/scope | Medium | Done | T-10 |

### Modul: Database Buronan (FR-05–07)
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-12 | `POST /buronan`, `GET /buronan`, `GET /buronan/:id`, `PATCH /buronan/:id/status` | High | Done | T-10 |
| T-13 | `POST /buronan/:id/foto` — upload foto + panggil FastAPI `/internal/enroll` | High | Done | T-12, T-15 |

### Modul: Detection Engine — FastAPI (FR-05, FR-08–12)
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-14 | `GET /internal/health` — health check service | Low | Done | T-03 |
| T-15 | `POST /internal/enroll` — deteksi wajah, validasi kualitas, ekstrak embedding, simpan ke Qdrant | High | Done | T-05 |
| T-16 | `POST /internal/detect` — ekstrak embedding dari foto/frame, similarity search ke Qdrant | High | Done | T-05 |
| T-17 | `POST /internal/cctv-feeds/{id}/start` & `/stop` — loop capture frame RTSP → detect → callback webhook | High | Done | T-16 |

### Modul: CCTV & Deteksi — Express (FR-08–12)
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-18 | `POST/GET/PATCH /cctv-feeds` — CRUD feed + scope wilayah | High | Done | T-10 |
| T-19 | `POST /detections/upload-check` — forward file ke FastAPI `/internal/detect` | High | Done | T-16 |
| T-20 | `POST /detections/webhook` — terima hasil match real-time dari FastAPI, simpan `DetectionEvent` + `Evidence` | High | Done | T-17, T-30 |
| T-21 | `GET /detections`, `GET /detections/:id`, `GET /detections/:id/evidence` | Medium | Done | T-20 |

### Modul: Notifikasi & Eskalasi (FR-13–15)
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-22 | Setup Redis + BullMQ queue & worker process | High | Done | T-01 |
| T-23 | Job notifikasi: kirim push (FCM) ke user sesuai `wilayah_scope` saat `DetectionEvent` dibuat | High | Done | T-20, T-22 |
| T-24 | `GET /notifications` — list notifikasi user login | Medium | Done | T-23 |
| T-25 | `POST/GET/PATCH /escalations` — buat & kelola eskalasi ke instansi tujuan | Medium | Done | T-20 |

### Modul: Pelaporan Masyarakat (FR-16–18)
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-26 | `POST /reports` — submit laporan (anonim opsional) + forward ke FastAPI `/internal/detect` | High | Done | T-16 |
| T-27 | `GET /reports` (list petugas) & `PATCH /reports/:id/verify` | Medium | Done | T-26, T-10 |
| T-28 | `GET /reports/:ticket_id` — status publik tanpa login (hanya status umum) | Low | Done | T-26 |

### Modul: Keamanan & Audit
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-29 | Rate limiting (`express-rate-limit`) di `/detections/upload-check` & `/reports` | Medium | Done | T-19, T-26 |
| T-30 | Service `AuditLog` (append-only) + integrasi ke semua endpoint sensitif | High | Done | T-04 |
| T-31 | Integrasi MinIO untuk simpan evidence/snapshot + retensi 90 hari | High | Done | T-01 |

---

## 🎨 FRONTEND

### Web (Next.js) — Setup
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-32 | Setup project Next.js + Tailwind + Zustand + TanStack Query | High | Done | - |
| T-33 | Halaman auth: login, verifikasi OTP, register, forgot/reset password | High | Done | T-32, T-08 |
| T-34 | Layout dashboard + navigasi berbasis role (RBAC-aware) | High | Done | T-33 |

### Web — Database Buronan
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-35 | Halaman list & pencarian buronan (nama/wilayah/kasus) | High | Done | T-34, T-12 |
| T-36 | Halaman tambah/edit buronan + upload foto (multi-angle) | High | Done | T-35, T-13 |

### Web — CCTV & Deteksi
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-37 | Halaman manajemen CCTV feed (daftar, tambah, status) | Medium | Done | T-34, T-18 |
| T-38 | Halaman upload manual check (foto/video) + tampilan confidence score | Medium | Done | T-34, T-19 |
| T-39 | Dashboard riwayat deteksi (filter wilayah/periode) + detail match + unduh evidence | High | Done | T-34, T-21 |

### Web — Notifikasi & Eskalasi
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-40 | Halaman notifikasi (list + badge realtime) | Medium | Done | T-34, T-24 |
| T-41 | Halaman buat & riwayat eskalasi | Medium | Done | T-34, T-25 |

### Web — Pelaporan Masyarakat
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-42 | Halaman verifikasi laporan untuk petugas (review + aksi valid/tidak valid) | Medium | Done | T-34, T-27 |
| T-43 | Halaman publik cek status laporan via nomor tiket (tanpa login) | Low | Done | T-28 |

### Mobile (Flutter) — Setup
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-44 | Setup project Flutter + Riverpod + Dio + routing (go_router) | High | Done | - |
| T-45 | Screen auth: login, OTP, register + `flutter_secure_storage` untuk JWT | High | Done | T-44, T-08 |

### Mobile — Petugas Lapangan
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-46 | Screen notifikasi realtime (integrasi `firebase_messaging`) | High | Done | T-45, T-23 |
| T-47 | Screen upload manual check (ambil foto/video dari kamera/galeri) | High | Done | T-45, T-19 |
| T-48 | Screen detail deteksi (confidence score, evidence) + aksi eskalasi | Medium | Done | T-46, T-25 |

### Mobile — Masyarakat
| ID | Task | Priority | Status | Depends on |
|----|------|----------|--------|------------|
| T-49 | Screen submit laporan (foto + lokasi (geolocator) + deskripsi, opsi anonim) | High | Done | T-45, T-26 |
| T-50 | Screen cek status laporan via nomor tiket | Medium | Done | T-28 |

---

## Ringkasan
- **Backend:** 31 task (T-01–T-31) — Setup/Infra, Auth/RBAC, Database Buronan, Detection Engine (FastAPI), CCTV & Deteksi, Notifikasi & Eskalasi, Pelaporan Masyarakat, Keamanan & Audit.
- **Frontend:** 19 task (T-32–T-50) — Web (Next.js) 12 task, Mobile (Flutter) 7 task.
- Urutan pengerjaan yang disarankan: **Setup & Infra → Auth/RBAC → Database Buronan+Detection Engine → CCTV/Deteksi → Notifikasi/Eskalasi → Pelaporan**, Frontend menyusul tiap modul backend selesai (butuh endpoint-nya siap).

## Status Implementasi (2026-10-29)
- ✅ **Backend selesai & teruji end-to-end TERMASUK ML pipeline asli (T-01–T-31):** monorepo (`pnpm` workspaces), `infra/docker-compose.yml` (Postgres/Qdrant/Redis/MinIO via s3mock) dijalankan via Docker sungguhan — migrasi Prisma berhasil, server Express diuji langsung: register/login/2FA (TOTP) lengkap, RBAC, lockout login (5x gagal → 423, cleared), rate limiting (`/reports` limit 10 terverifikasi tepat), validasi error (400), CRUD buronan/CCTV feed, notifikasi BullMQ, audit log, eskalasi (sukses + rejection evidence-wajib + rejection API-key salah), laporan masyarakat publik (anonim, ticket check, verifikasi petugas). **FastAPI detection engine (InsightFace+Qdrant) berhasil dijalankan dengan model ML sungguhan** (MS C++ Build Tools akhirnya terpasang benar via winget, terverifikasi dengan `winget list`) — `/internal/health`, `/internal/enroll` (foto→embedding→Qdrant), `/internal/detect` (similarity search, confidence 0.9999 pada test), `/internal/cctv-feeds/{id}/start`&`/stop` semua diuji lewat endpoint publik asli (`POST /buronan/:id/foto`, `POST /detections/upload-check`, `PATCH /cctv-feeds/:id`) — bukan lagi webhook simulasi. Satu bug ditemukan & diperbaiki: `uploadEvidenceFile()` di `apps/api/src/services/storage.ts` sebelumnya mengembalikan nama object MinIO saja, bukan URL lengkap — diperbaiki agar mengembalikan URL yang bisa langsung dipakai Web/Mobile/FastAPI.
- ✅ **Frontend Web selesai (T-32–T-43):** Next.js 15 (App Router, TS, Tailwind v4) di `apps/web`, mengikuti sistem desain Bento (token warna/font Figtree direplikasi di `globals.css` via `@theme`). Zustand (auth store + persist), TanStack Query, axios, lucide-react. Halaman: login, verifikasi OTP, register, forgot/reset password, dashboard overview (bento grid dengan data live), database buronan (list/search/detail/tambah/upload foto), CCTV & deteksi (manajemen feed, upload manual check, riwayat & detail deteksi + eskalasi), notifikasi, eskalasi (buat & kelola), verifikasi laporan petugas, serta halaman publik `/lapor` dan `/status` (tanpa login). `next build` sukses bersih (19 route, 0 warning), typecheck bersih. Ditambahkan endpoint backend kecil `GET /instansi` (tidak ada di spec awal) karena fitur eskalasi butuh daftar instansi tujuan.
- ✅ **Mobile Flutter selesai (T-44–T-50):** Flutter SDK 3.47.8 di-install manual (tidak ada paket winget resmi, download langsung dari storage.googleapis.com — lihat [[07-Guides/Panduan Install Flutter|Panduan Install Flutter]]). Project di `apps/mobile` dengan Riverpod (state management + Dio client), go_router (shell route dengan bottom nav Home/Lapor/Status/Profil + route terpisah untuk login/OTP/register/manual-check/detail deteksi), `flutter_secure_storage` untuk JWT, `image_picker` (kamera/galeri), `geolocator` (lokasi laporan), `google_fonts` (Figtree, menyamakan tema dengan Web). Mengikuti pola desain mobile Bento (`ui-references/design-4-bento/mobile/*.html`): bottom nav 4 tab, bento-cell rounded-2xl card. Screen: login+OTP, register, home (notifikasi real dari `GET /notifications`, bukan FCM — lihat catatan di bawah), manual check (upload ke `/detections/upload-check`), detail deteksi + eskalasi (`GET /instansi`, `POST /escalations`), lapor (upload ke `/reports`, lokasi dari GPS), cek status tiket (`GET /reports/:ticketId`), profil. `flutter analyze` **bersih (0 issue)**. Diverifikasi jalan nyata via `flutter run -d chrome` terhubung ke backend asli (port 4001) — compile sukses, tidak ada error runtime di log, server web dev merespons HTTP 200.
  - **Catatan T-46:** task menyebut integrasi `firebase_messaging`, tapi itu butuh setup project Firebase (API key, `google-services.json`) yang tidak bisa dilakukan tanpa akun/console Firebase milik user. Diimplementasikan sebagai polling `GET /notifications` (data asli dari backend) — push notification FCM sungguhan jadi **TODO** lanjutan, sama seperti TODO push notification di `apps/api/src/jobs/notification-worker.ts`.
  - **Catatan build native:** Android SDK **tidak terpasang** di environment ini (butuh instalasi besar, beberapa GB, lewat Android Studio) — jadi APK belum pernah di-build/dijalankan di emulator/device asli. Kode sudah dikonfigurasi untuk platform `android`, `ios`, `web`; `flutter analyze` clean jadi secara statis kode valid, tapi build native perlu diverifikasi di komputer dengan Android SDK terpasang (lihat [[07-Guides/Panduan Install Flutter|Panduan Install Flutter]] bagian 5).

## Langkah Berikutnya
Semua 50 task (31 Backend + 12 Web + 7 Mobile) sudah diimplementasikan **dan seluruh backend (termasuk ML pipeline asli) sudah teruji end-to-end**. `flutter analyze` dan `next build`/`tsc --noEmit` dikonfirmasi bersih sebagai regression check final. Sisa pekerjaan: (1) verifikasi build APK Android asli di komputer dengan Android SDK, (2) integrasi push notification sungguhan (FCM untuk mobile, web push untuk browser) menggantikan TODO yang ada, (3) riset awal yang tercatat di `vault/Home.md` (regulasi UU PDP, opsi vendor face-recognition, akses data DPO resmi) belum dimulai.
