---
tags: [tech-spec, architecture]
status: final-v1
---

# Tech Spec: Aplikasi Pendeteksi Buronan

> [[../Home|⬅ Kembali ke Home]] · Berdasarkan [[../01-Product/PRD|PRD]]. Stack: Next.js (Web) + Flutter (Mobile), Express + FastAPI, PostgreSQL + Qdrant, Vercel (web) + lokal (backend).

---

## Bagian 1: Tech Stack & Arsitektur

### Tech Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Web | Next.js | 15.x |
| Frontend Mobile | Flutter | 3.24.x |
| Language (Web/API) | TypeScript | 5.x |
| Language (Mobile) | Dart | 3.5.x |
| Styling Web | Tailwind CSS | 4.x |
| Styling Mobile | Flutter Material 3 widgets | - |
| State Management (Web) | Zustand + TanStack Query | latest |
| State Management (Mobile) | Riverpod | 2.x |
| HTTP Client (Mobile) | Dio | 5.x |
| Backend (Main API) | Node.js + Express | Node 20 LTS / Express 4.x |
| Backend (Detection Engine) | Python + FastAPI | Python 3.12 / FastAPI 0.115+ |
| Face Recognition | InsightFace (ArcFace) + OpenCV | latest |
| Database (Relational) | PostgreSQL | 16.x |
| Vector Database | Qdrant | 1.x |
| ORM/Driver | Prisma (Express) + SQLAlchemy (FastAPI) | latest |
| Auth | JWT + TOTP 2FA | - |
| Queue (notifikasi async) | Redis + BullMQ | 7.x / latest |
| Object Storage (evidence) | MinIO (S3-compatible, lokal) | latest |
| Hosting Web | Vercel | - |
| Hosting Backend (dev/pilot) | Komputer lokal via Docker Compose → migrasi ke cloud/VPS (data residency Indonesia) saat produksi | - |

### Arsitektur Sistem
```
[CCTV Feed RTSP] ──► [FastAPI Detection Engine] ──► [Qdrant: similarity search]
                            │  (ekstraksi frame,                │
                            │   face embedding)      match ≥ threshold?
                            ▼                                   ▼
                     [PostgreSQL: log]                [Redis/BullMQ: event match]
                                                                 │
                                                                 ▼
[Next.js Web] ◄──REST──► [Express API] ◄──REST (internal)──► [FastAPI]
[Flutter Mobile] ◄──┘   (auth, RBAC, CRUD buronan/laporan,     │
                               notifikasi, eskalasi, audit log)     ▼
                                     │                      [MinIO: evidence]
                                     ▼
                              [PostgreSQL: data utama]
```
- Upload manual (FR-10) & laporan masyarakat (FR-16): Web/Mobile → Express → forward ke FastAPI untuk deteksi → hasil balik ke Express → disimpan & direspon ke client.
- CCTV real-time (FR-08–09): FastAPI jalan sebagai service independen yang terus memproses frame & langsung query Qdrant; saat match ditemukan, publish event ke Redis supaya Express bisa proses notifikasi/eskalasi secara async (tidak membottleneck pipeline deteksi — sesuai NFR performa).

### Struktur Folder (monorepo, pnpm workspaces)
```
apps/
  web/                    # Next.js — dashboard admin/instansi/kepolisian
  mobile/                 # Flutter — app petugas lapangan & masyarakat
    lib/
      core/               # network client (Dio), constants, theme
      features/           # auth, buronan, deteksi, notifikasi, laporan (per-feature)
      shared/              # widget reusable
      main.dart
    pubspec.yaml
  api/                    # Express — main backend (auth, CRUD, notifikasi, eskalasi)
    src/
      routes/
      controllers/
      services/
      middleware/         # RBAC, auth, rate limit
      jobs/               # BullMQ workers (notifikasi)
      prisma/
services/
  detection-engine/       # FastAPI — core face recognition
    app/
      api/                # endpoint: /detect, /enroll, /search
      core/               # face detection + embedding (InsightFace/OpenCV)
      models/
      services/           # Qdrant client wrapper
packages/
  shared-types/           # TypeScript types dipakai web + api (mobile pakai model Dart sendiri, mengikuti kontrak Bagian 3)
infra/
  docker-compose.yml      # Postgres, Qdrant, Redis, MinIO (local dev)
```

### Justifikasi
- **Next.js (Web):** dashboard admin/instansi butuh SSR & data-heavy views; ekosistem React matang.
- **Flutter (Mobile):** satu codebase untuk Android & iOS dengan performa native (compiled, bukan JS bridge) — penting untuk akses kamera/lokasi real-time saat petugas lapangan upload foto/video & masyarakat melapor; ekosistem matang untuk kebutuhan ini (Riverpod, Dio, firebase_messaging untuk push notification).
- **Express (Main API):** sesuai permintaan user, dipakai untuk semua CRUD/business logic & auth — ekosistem matang, mudah integrasi BullMQ.
- **FastAPI (Detection Engine):** sesuai permintaan user, dipakai khusus untuk core face recognition — library CV/AI terbaik (InsightFace, OpenCV) ada di ekosistem Python, jadi dipisah sebagai microservice bukan ditumpuk di Express.
- **PostgreSQL:** data relasional kompleks (user, buronan, laporan, audit log) dengan relasi jelas & butuh ACID (mis. audit log immutable).
- **Qdrant:** dipilih sebagai jawaban atas "paling cepat untuk pencarian wajah" — vector DB khusus dengan HNSW index, lebih cepat dibanding pgvector untuk ANN search skala besar, dan tetap mudah dijalankan lokal via Docker (cocok dengan keputusan hosting backend lokal).
- **Redis + BullMQ:** queue async supaya proses notifikasi (FR-13) tidak membottleneck pipeline deteksi real-time.
- **MinIO:** S3-compatible, bisa jalan lokal sekarang, tinggal diarahkan ke S3-compatible cloud saat migrasi produksi.
- **Vercel (Web) + Lokal (Backend):** sesuai keputusan user — mulai dari lokal untuk development/pilot; saat scale ke produksi, backend perlu pindah ke cloud/VPS dengan data residency Indonesia (sesuai NFR keamanan di PRD).

---

## Bagian 2: Database Design

### Ringkasan Database
| Item | Detail |
|------|--------|
| Database utama | PostgreSQL 16 (relasional) |
| Vector DB | Qdrant (khusus embedding wajah, referensi lewat `qdrant_point_id`) |
| ORM | Prisma (dari Express) |
| Tools Migrasi | Prisma Migrate |

### Entity Overview
| Entity | Key Fields | Relasi |
|--------|-----------|--------|
| **User** | id, email, password_hash, role (ADMIN/APARAT/KEAMANAN_SWASTA/INSTANSI_HUKUM/MASYARAKAT), instansi_id, wilayah_scope, two_factor_secret | → Instansi (N:1), → Report/Escalation/AuditLog (1:N) |
| **Instansi** | id, nama, jenis, wilayah, status_verifikasi | → User (1:N) |
| **Buronan** | id, nama, nik, nomor_kasus, tingkat_ancaman, status (DPO_AKTIF/TERTANGKAP/DICABUT), instansi_penerbit_id | → FotoBuronan (1:N) |
| **FotoBuronan** | id, buronan_id, url_foto, qdrant_point_id, is_primary | ← Buronan |
| **CCTVFeed** | id, nama, lokasi, url_stream (RTSP), owner_id, wilayah, status | ← Instansi/User (pemilik) |
| **DetectionEvent** | id, cctv_feed_id (nullable), report_id (nullable), buronan_id (nullable), confidence_score, status (confirmed/low-confidence), detected_at | → CCTVFeed, → Buronan, → Evidence (1:1) |
| **Evidence** | id, detection_event_id, file_url (MinIO), metadata, retention_until, chain_of_custody_log | ← DetectionEvent |
| **Notification** | id, user_id, detection_event_id, channel (push/sms/email), status, sent_at | → User, → DetectionEvent |
| **Escalation** | id, detection_event_id, dibuat_oleh (user_id), instansi_tujuan_id, catatan, status | → DetectionEvent, → User, → Instansi |
| **Report** (laporan masyarakat) | id, pelapor_id (nullable/anonim), foto_url, lokasi, deskripsi, status, verified_by, verified_at | → User (pelapor), → DetectionEvent |
| **AuditLog** | id, user_id, action, entity_type, entity_id, detail, created_at (immutable, append-only) | → User |

### Index Strategy
- **User.email** — unique, untuk login
- **Buronan.status** — filter cepat DPO aktif saat sync ke Qdrant
- **CCTVFeed.wilayah** — scope akses petugas per wilayah (RBAC)
- **DetectionEvent.(cctv_feed_id, detected_at)** — query riwayat deteksi per kamera & waktu (dashboard FR-15)
- **DetectionEvent.buronan_id** — lihat semua deteksi untuk satu buronan
- **Report.status** — filter laporan yang menunggu verifikasi (SLA FR-17)
- **AuditLog.(entity_type, entity_id)** — telusur histori per entitas

### Data Flow
1. Instansi Hukum menambah **Buronan** + **FotoBuronan** → FastAPI ekstrak embedding → disimpan ke **Qdrant**, `qdrant_point_id` disimpan balik ke `FotoBuronan` (FR-05).
2. **CCTVFeed** mengalirkan frame ke FastAPI → similarity search ke Qdrant → jika match ≥ threshold, buat **DetectionEvent** + **Evidence** (snapshot) (FR-09, FR-12).
3. DetectionEvent ter-trigger → **Notification** ke petugas sesuai wilayah (FR-13) → petugas bisa buat **Escalation** ke instansi lain (FR-14).
4. Masyarakat submit **Report** (foto+lokasi) → dicek ke Qdrant via FastAPI → jika match, `Report.detection_event_id` terisi → petugas verifikasi, update `Report.status` (FR-16–18).
5. Setiap perubahan status Buronan, Report, role User → dicatat ke **AuditLog** (immutable).

---

## Bagian 3: Interface Design (API Endpoints)

> Arsitektur: SPA/Mobile → **Express (public API)** → **FastAPI (internal-only)**. Web (Next.js) & Mobile (Flutter) hanya bicara ke Express; FastAPI tidak pernah diakses langsung dari client.

### Express — Public API (dipakai Web & Mobile)

**Auth & Akun**
| Method | Path | Description | Auth |
|--------|------|--------------|------|
| POST | /auth/register | Registrasi akun (instansi/masyarakat) — FR-01 | No |
| POST | /auth/login | Login, kirim OTP jika role sensitif — FR-02 | No |
| POST | /auth/login/verify-otp | Verifikasi 2FA, keluarkan JWT — FR-02 | No |
| POST | /auth/forgot-password | Kirim link reset — FR-04 | No |
| POST | /auth/reset-password | Set password baru — FR-04 | No |
| GET | /auth/me | Profil user yang login | Yes |
| PATCH | /admin/users/:id/role | Admin ubah role/scope — FR-03 | Yes (Admin) |

**Database Buronan**
| Method | Path | Description | Auth |
|--------|------|--------------|------|
| POST | /buronan | Tambah buronan baru (→ panggil FastAPI /internal/enroll) — FR-05 | Yes (Instansi Hukum/Admin) |
| GET | /buronan | Cari/list buronan (nama/wilayah/kasus) — FR-07 | Yes |
| GET | /buronan/:id | Detail buronan | Yes |
| PATCH | /buronan/:id/status | Update status DPO — FR-06 | Yes (Instansi Hukum/Admin) |
| POST | /buronan/:id/foto | Tambah foto buronan (→ FastAPI /internal/enroll) — FR-05 | Yes (Instansi Hukum/Admin) |

**CCTV & Deteksi**
| Method | Path | Description | Auth |
|--------|------|--------------|------|
| POST | /cctv-feeds | Daftarkan feed CCTV baru — FR-08 | Yes (Keamanan Swasta/Aparat) |
| GET | /cctv-feeds | List feed sesuai scope wilayah | Yes |
| PATCH | /cctv-feeds/:id | Update status/konfigurasi feed | Yes |
| POST | /detections/upload-check | Upload foto/video manual (→ FastAPI /internal/detect) — FR-10 | Yes |
| POST | /detections/webhook | **Internal**: terima hasil match dari FastAPI saat CCTV real-time — FR-09 | Internal only |
| GET | /detections | Dashboard riwayat deteksi (filter wilayah/periode) — FR-15 | Yes |
| GET | /detections/:id | Detail match + confidence score — FR-11 | Yes |
| GET | /detections/:id/evidence | Unduh evidence/snapshot — FR-12 | Yes (role berwenang) |

**Notifikasi & Eskalasi**
| Method | Path | Description | Auth |
|--------|------|--------------|------|
| GET | /notifications | List notifikasi untuk user login — FR-13 | Yes |
| POST | /escalations | Buat eskalasi dari detection event — FR-14 | Yes (Keamanan Swasta/Aparat) |
| GET | /escalations | Dashboard riwayat eskalasi | Yes |
| PATCH | /escalations/:id | Update status tindak lanjut | Yes (Aparat) |

**Pelaporan Masyarakat**
| Method | Path | Description | Auth |
|--------|------|--------------|------|
| POST | /reports | Submit laporan (foto+lokasi, → FastAPI /internal/detect) — FR-16 | Yes/Anonim |
| GET | /reports/:ticket_id | Cek status laporan via nomor tiket — FR-18 | No (publik, by ticket) |
| GET | /reports | List laporan untuk verifikasi petugas — FR-17 | Yes (Petugas) |
| PATCH | /reports/:id/verify | Petugas verifikasi laporan — FR-17 | Yes (Petugas) |

### FastAPI — Internal API (hanya dipanggil Express, tidak publik)
| Method | Path | Description |
|--------|------|-------------|
| POST | /internal/enroll | Ekstrak face embedding dari foto buronan, simpan ke Qdrant, return `qdrant_point_id` |
| POST | /internal/detect | Ekstrak embedding dari foto/frame yang dikirim, similarity search ke Qdrant, return kandidat match + confidence |
| POST | /internal/cctv-feeds/{id}/start | Mulai proses stream RTSP untuk 1 feed (loop capture frame → detect → callback ke Express webhook jika match) |
| POST | /internal/cctv-feeds/{id}/stop | Hentikan proses stream |
| GET | /internal/health | Health check service |

*Autentikasi internal antara Express ↔ FastAPI pakai shared secret/API key, bukan JWT user.*

---

## Bagian 4: Alur Logika & Business Rules

**Alur Login & 2FA (FR-02):**
1. User (Web/Mobile) kirim email+password ke `POST /auth/login`.
2. Express verifikasi kredensial di PostgreSQL; jika role Aparat/Instansi Hukum, generate & kirim OTP, respons "butuh OTP".
3. User submit OTP ke `POST /auth/login/verify-otp`.
4. Express verifikasi OTP (TOTP), jika valid → generate JWT (expiry 24 jam) → kembalikan ke client, tersimpan di secure storage (web: httpOnly cookie, mobile: `flutter_secure_storage`).
5. 5x gagal login → akun diblokir 15 menit (dicatat di Redis dengan TTL).

**Alur Enroll Buronan Baru (FR-05):**
1. Instansi Hukum submit data buronan + foto via Web (`POST /buronan`, lalu `POST /buronan/:id/foto`).
2. Express simpan metadata ke PostgreSQL, lalu panggil `POST /internal/enroll` di FastAPI dengan foto.
3. FastAPI deteksi wajah pada foto, validasi kualitas (resolusi min, wajah frontal) — tolak jika tidak memenuhi syarat.
4. FastAPI ekstrak embedding (InsightFace/ArcFace), simpan vector ke Qdrant, return `qdrant_point_id`.
5. Express update `FotoBuronan.qdrant_point_id`, buronan siap dipakai untuk pencocokan.

**Alur Deteksi Real-Time via CCTV (FR-08, FR-09, FR-12, FR-13):**
1. Petugas daftarkan feed CCTV (`POST /cctv-feeds`) → Express simpan metadata, panggil `POST /internal/cctv-feeds/{id}/start` ke FastAPI.
2. FastAPI subscribe stream RTSP, ekstrak frame tiap interval tertentu (mis. setiap 1-2 detik tergantung load).
3. Untuk tiap frame: deteksi wajah → ekstrak embedding → similarity search ke Qdrant (ANN/HNSW).
4. Jika confidence ≥ threshold (default 85%): FastAPI simpan snapshot ke MinIO, lalu callback `POST /detections/webhook` ke Express dengan hasil match + evidence URL.
5. Express buat `DetectionEvent` + `Evidence` di PostgreSQL, publish job ke Redis/BullMQ untuk notifikasi (bukan langsung, agar pipeline deteksi tidak nunggu).
6. Worker BullMQ ambil job → kirim push notification (FCM) ke semua User dengan `wilayah_scope` yang cocok dengan lokasi kamera.
7. Jika confidence < threshold: dicatat sebagai log low-confidence saja (tanpa notifikasi), untuk audit/analisis.

**Alur Pemeriksaan Manual via Upload (FR-10, FR-11):**
1. Petugas upload foto/video via Web/Mobile (`POST /detections/upload-check`).
2. Express validasi ukuran/format file, forward ke `POST /internal/detect` di FastAPI.
3. FastAPI jalankan deteksi + similarity search yang sama seperti alur real-time, return daftar kandidat match + confidence.
4. Express simpan hasil sebagai `DetectionEvent` (status manual-check), kembalikan ke client untuk ditampilkan dengan confidence score & indikator warna.

**Alur Eskalasi ke Kepolisian (FR-14):**
1. Petugas (dari halaman detail `DetectionEvent`) klik "Eskalasi" → `POST /escalations` dengan catatan.
2. Express validasi role (Keamanan Swasta/Aparat) dan pastikan evidence terlampir.
3. Simpan `Escalation` dengan `instansi_tujuan_id` (kepolisian terdekat berdasarkan lokasi kamera), kirim notifikasi ke instansi tujuan.
4. Instansi kepolisian update status via `PATCH /escalations/:id` (ditindaklanjuti/selesai).

**Alur Pelaporan Masyarakat (FR-16, FR-17, FR-18):**
1. Masyarakat submit laporan (foto+lokasi+deskripsi, boleh anonim) via Mobile/Web (`POST /reports`).
2. Express validasi dasar (ada foto, bukan spam), forward foto ke `POST /internal/detect`.
3. Simpan `Report` berstatus `menunggu_verifikasi`, link ke `DetectionEvent` jika ada match, generate nomor tiket, kembalikan ke pelapor.
4. Petugas buka daftar laporan (`GET /reports`), review hasil match, update via `PATCH /reports/:id/verify` (valid/tidak valid/investigasi lanjutan) — target SLA ≤ 1 jam untuk match confidence tinggi.
5. Pelapor cek status kapan saja via `GET /reports/:ticket_id` (tanpa login) — hanya status umum, tanpa detail sensitif.

### Business Rules (dari PRD)
- Threshold confidence default 85%, dapat dikonfigurasi admin; di bawah threshold tidak memicu notifikasi.
- 2FA (TOTP) wajib untuk role Aparat & Instansi Hukum; opsional untuk Masyarakat.
- 5x gagal login = blokir 15 menit; JWT expired 24 jam.
- Hanya role Instansi Hukum/Admin yang bisa menambah/mengubah data Buronan.
- Setiap eskalasi wajib memiliki evidence terlampir.
- Evidence disimpan minimal 90 hari (retensi hukum), hanya diakses role berwenang, chain of custody tercatat.
- Semua perubahan status Buronan/Report/role User dicatat ke AuditLog (immutable, tidak bisa dihapus/diedit).
- Identitas pelapor masyarakat bisa anonim, kecuali diminta proses hukum.
- Data sensitif (identitas buronan, tindakan aparat) tidak ditampilkan ke pelapor via endpoint publik — hanya status umum.

---

## Bagian 5: Keamanan, Performa, & Deployment

### Keamanan
- HTTPS wajib — otomatis di Vercel (web); backend lokal perlu reverse proxy (Nginx) + TLS kalau diakses dari luar jaringan lokal.
- JWT (expiry 24 jam) + refresh token rotation; disimpan httpOnly cookie (web) / `flutter_secure_storage` (mobile).
- 2FA (TOTP) wajib untuk role Aparat & Instansi Hukum.
- RBAC middleware di Express mengecek role + `wilayah_scope` di setiap request ke data sensitif.
- Rate limiting (`express-rate-limit`) khusus endpoint `/detections/upload-check` & `/reports` untuk cegah abuse.
- FastAPI **tidak** diexpose ke publik — hanya bisa diakses dari Express via internal network + API key.
- Encryption at rest untuk PostgreSQL & MinIO (server-side encryption untuk evidence).
- AuditLog bersifat append-only (tidak ada endpoint update/delete).
- Akses data wajah & evidence dibatasi role berwenang, sejalan dengan UU PDP.

### Performa
- Index PostgreSQL sesuai Bagian 2 untuk query dashboard/pencarian cepat.
- Qdrant dengan HNSW index untuk ANN search — target memenuhi NFR latensi deteksi < 3 detik/frame.
- FastAPI (detection engine) berjalan sebagai proses/container terpisah dari Express, supaya beban video processing tidak mengganggu response time API CRUD.
- Notifikasi diproses async via BullMQ worker (terpisah dari main Express process) — supaya pipeline deteksi tidak nunggu proses kirim notifikasi (target < 10 detik tetap tercapai di background).
- Redis caching untuk data yang sering dibaca tapi jarang berubah (list CCTV feed, dashboard stats agregat).
- Next.js: static/ISR untuk halaman non-dinamis, image optimization built-in untuk foto buronan/evidence di dashboard.

### Deployment
- **Web:** Vercel, auto-deploy dari git push ke branch main.
- **Mobile:** Build via `flutter build apk` / `flutter build ipa`, distribusi ke Play Store & App Store. Untuk hotfix tanpa submit ulang ke store, opsional pakai Shorebird (code push untuk Flutter).
- **Backend (dev/pilot saat ini):** `docker-compose up` di komputer lokal — container Postgres, Qdrant, Redis, MinIO, Express, FastAPI.
- Untuk testing dari Web (Vercel)/Mobile ke backend lokal: expose sementara via Cloudflare Tunnel/ngrok (khusus pilot/testing, **bukan** untuk produksi).
- **Migrasi produksi (langkah lanjutan, belum sekarang):** pindahkan backend+DB+Qdrant ke VPS/cloud dengan data residency Indonesia, tambahkan Nginx reverse proxy + TLS (Let's Encrypt), setup CI/CD.

### Development Setup
```bash
# Infra (Postgres, Qdrant, Redis, MinIO)
cd infra && docker-compose up -d

# Backend utama (Express)
cd apps/api && npm install && npx prisma migrate dev && npm run dev

# Detection Engine (FastAPI)
cd services/detection-engine && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Web (Next.js)
cd apps/web && npm install && npm run dev

# Mobile (Flutter)
cd apps/mobile && flutter pub get && flutter run
```

---
*Lihat [[../Home|Home]] untuk peta konten proyek lainnya.*
