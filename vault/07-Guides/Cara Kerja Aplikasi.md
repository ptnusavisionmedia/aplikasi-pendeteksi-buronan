---
tags: [guide, architecture, how-it-works]
---

# Cara Kerja Aplikasi — Step by Step

Peta end-to-end: komponen apa bicara ke komponen apa, dan alur kode nyata (file + fungsi) untuk setiap fitur utama. Untuk keputusan arsitektur & alasannya, lihat [[02-Tech-Spec/Tech Spec|Tech Spec]] dan [[03-Decisions/_index|Decision Log]].

## 0. Peta komponen

```
apps/web (Next.js)        apps/mobile (Flutter)
        │                         │
        └────────────┬────────────┘
                      ▼
            apps/api (Express, port 4001)
                      │
        ┌─────────────┼──────────────┬───────────────┐
        ▼             ▼              ▼                ▼
  PostgreSQL      Redis/BullMQ   MinIO/S3Mock   services/detection-engine
  (Prisma)        (queue +       (evidence       (FastAPI, port 8000,
                   login lockout)  files)          internal-only)
                                                        │
                                                        ▼
                                                     Qdrant
                                                 (face embedding search)
```

**Aturan penting:** Web & Mobile **tidak pernah** bicara langsung ke FastAPI. Semua lewat Express (`apps/api`), yang memanggil FastAPI secara internal via `X-Internal-Api-Key` (lihat `apps/api/src/services/detection-engine-client.ts`).

## 1. Registrasi & Login (2FA)

**File kunci:** `apps/api/src/routes/auth.ts`, `apps/api/src/services/auth.ts`

1. `POST /auth/register` → `registerUser()` di `services/auth.ts`. Role `MASYARAKAT` otomatis `isVerified: true`; role lain (`APARAT`, `KEAMANAN_SWASTA`, `INSTANSI_HUKUM`) perlu persetujuan admin (`PATCH /admin/users/:id/role`).
2. Kalau role termasuk `requiresTwoFactor()` (APARAT/INSTANSI_HUKUM), server generate TOTP secret (`generateOtpSecret()`) dan simpan ke `User.twoFactorSecret`.
3. `POST /auth/login` → `authenticatePassword()`. Login gagal 5x dalam window → terkunci 15 menit (counter disimpan di Redis, key `login:attempts:<email>` / `login:lockout:<email>`).
4. Kalau role butuh 2FA, response `{requiresOtp:true, pendingToken}` (JWT berumur 5 menit, `purpose:"otp_pending"`). Kalau tidak, langsung `{requiresOtp:false, token}`.
5. `POST /auth/login/verify-otp` → verifikasi kode TOTP terhadap `twoFactorSecret`, baru keluarkan JWT asli (`issueJwt()`, expiry sesuai `JWT_EXPIRES_IN`).
6. Web (`apps/web/src/store/auth-store.ts`) & Mobile menyimpan JWT — web di `localStorage` (via Zustand `persist`), mobile di `flutter_secure_storage`.

## 2. Mendaftarkan Buronan + Foto Wajah (Enroll)

**File kunci:** `apps/api/src/routes/buronan.ts`, `services/detection-engine/app/api/internal.py` (`POST /internal/enroll`)

1. ADMIN/INSTANSI_HUKUM: `POST /buronan` (data dasar) → `POST /buronan/:id/foto` (upload file via `multer`).
2. Express upload file ke MinIO/S3Mock (`uploadEvidenceFile()` di `services/storage.ts`), lalu panggil FastAPI `enrollFace()`.
3. FastAPI (`internal.py` → `/internal/enroll`): download foto, `extract_embedding()` (InsightFace, `app/core/face.py`) — tolak kalau tidak ada wajah atau wajah terlalu kecil (< 80px).
4. Embedding (512-dim) disimpan ke Qdrant (`upsert_face()`, collection `buronan_faces`, metric cosine) dengan payload `buronanId`. Qdrant mengembalikan `qdrantPointId`.
5. Express simpan `FotoBuronan` dengan `qdrantPointId` tersebut. Buronan sekarang bisa "ditemukan" lewat pencarian wajah.

## 3. Deteksi Real-time via CCTV

**File kunci:** `apps/api/src/routes/cctv.ts`, `services/detection-engine/app/services/cctv_stream.py`, `apps/api/src/routes/detections.ts` (`POST /webhook`)

1. Petugas daftarkan feed: `POST /cctv-feeds` (Express) → simpan metadata → panggil FastAPI `POST /internal/cctv-feeds/{id}/start`.
2. FastAPI jalankan `asyncio.Task` per feed (`start_feed()`) — loop `cv2.VideoCapture(rtsp_url)` ambil frame setiap `CCTV_CAPTURE_INTERVAL_SECONDS` detik (jalan di executor terpisah agar tidak blok event loop).
3. Tiap frame: `_process_frame()` → ekstrak embedding → `search_face()` di Qdrant (top-5 kandidat).
4. Kalau `best.score >= MATCH_THRESHOLD` (default 0.85): upload snapshot ke MinIO, lalu **callback** ke Express: `POST /detections/webhook` dengan header `X-Internal-Api-Key`.
5. Express (`detections.ts`): buat `DetectionEvent` (status `CONFIRMED` kalau ≥ threshold, `LOW_CONFIDENCE` kalau di bawah), buat `Evidence` (dengan `retentionUntil` 90 hari dari `evidenceRetentionDate()`), lalu `enqueueNotificationJob()` ke BullMQ.
6. Worker BullMQ (`apps/api/src/jobs/notification-worker.ts`) ambil job → cari semua `User` dengan `wilayahScope` yang cocok dengan lokasi CCTV → buat `Notification` per user → (TODO: integrasi FCM asli, saat ini hanya log `[push] -> ...`).
7. Web/Mobile polling/lihat `GET /notifications` untuk menampilkan notifikasi ke user.

## 4. Pemeriksaan Manual (Upload Foto)

**File kunci:** `POST /detections/upload-check` di `apps/api/src/routes/detections.ts`

1. Petugas upload foto (Web: halaman `/cctv`, tombol "Periksa Manual"; Mobile: screen upload manual check).
2. Express upload ke MinIO, forward ke FastAPI `POST /internal/detect` (bukan `/enroll` — ini cuma mencari, tidak menyimpan embedding baru).
3. FastAPI ekstrak embedding dari foto yang diupload, `search_face()` ke Qdrant, return daftar kandidat + confidence.
4. Express buat `DetectionEvent` (status `MANUAL_CHECK` atau `LOW_CONFIDENCE`, **tanpa** `cctvFeedId`), balikan `{matched, detectionEventId, candidates}` ke client untuk ditampilkan dengan warna sesuai confidence.

## 5. Eskalasi ke Instansi Lain

**File kunci:** `apps/api/src/routes/escalations.ts`, `apps/api/src/routes/instansi.ts`

1. Dari halaman detail deteksi (Web `/cctv/[id]`, Mobile screen detail), petugas (ADMIN/APARAT/KEAMANAN_SWASTA) pilih instansi tujuan (daftar dari `GET /instansi`) dan kirim `POST /escalations`.
2. Express **validasi wajib**: `DetectionEvent` harus punya `Evidence` terlampir (kalau tidak, 422) — aturan bisnis "setiap eskalasi wajib memiliki evidence".
3. Instansi tujuan (ADMIN/APARAT di instansi itu) lihat & update status via `PATCH /escalations/:id` (`PENDING` → `DITINDAKLANJUTI` → `SELESAI`).

## 6. Pelaporan Masyarakat (Anonim Opsional)

**File kunci:** `apps/api/src/routes/reports.ts`

1. Siapa saja (login atau tidak) bisa `POST /reports` dengan foto + lokasi + deskripsi + flag `anonim`. Pakai `optionalAuth` middleware — kalau ada JWT valid dan `anonim=false`, `pelaporId` terisi; kalau tidak, laporan tetap diterima tanpa identitas.
2. Express upload foto, **best-effort** panggil FastAPI `/internal/detect` (dibungkus `.catch()` — kalau gagal, laporan tetap tersimpan tanpa kandidat match).
3. Kalau ada kandidat match, otomatis buat `DetectionEvent` terkait (status `MANUAL_CHECK`) yang ditautkan ke `Report`.
4. Sistem generate `ticketId` (cuid), dibalikan ke pelapor — **inilah satu-satunya cara publik mengecek status laporan** (`GET /reports/:ticketId`, data minimal: status + tanggal, tanpa data sensitif).
5. Petugas (ADMIN/APARAT/KEAMANAN_SWASTA) lihat daftar via `GET /reports` (filter `MENUNGGU_VERIFIKASI`), lalu `PATCH /reports/:id/verify` set status `VALID`/`TIDAK_VALID`/`INVESTIGASI_LANJUTAN`.

## 7. Audit Log

**File kunci:** `apps/api/src/services/audit-log.ts`

Setiap endpoint yang mengubah data sensitif (register, login, ubah status buronan, tambah foto, buat/ubah feed CCTV, buat eskalasi, verifikasi laporan, reset password) memanggil `writeAuditLog({userId, action, entityType, entityId, detail})`. Tabel `audit_logs` **append-only** — tidak ada endpoint update/delete untuk tabel ini by design.

## 8. Keamanan per-request

Tiap request yang butuh login lewat dua middleware berurutan (`apps/api/src/middleware/`):
- `requireAuth` — cek JWT valid, isi `req.user`.
- `requireRole(...roles)` — tolak kalau role tidak sesuai.
- `requireWilayahScope(getResourceWilayah)` — tolak kalau `wilayahScope` user tidak cocok dengan resource (ADMIN selalu lolos).

Endpoint publik (tanpa login) pakai `optionalAuth` (reports) atau tanpa middleware sama sekali (`GET /reports/:ticketId`, `/health`).

## 9. Di mana mencari apa (quick reference)

| Mau tahu... | Lihat file |
|---|---|
| Semua endpoint & urutan middleware | `apps/api/src/app.ts` + masing-masing `apps/api/src/routes/*.ts` |
| Struktur tabel & relasi | `apps/api/prisma/schema.prisma` |
| Logika auth/2FA/lockout | `apps/api/src/services/auth.ts` |
| Logika face detection/embedding | `services/detection-engine/app/core/face.py` |
| Logika pencarian vector | `services/detection-engine/app/services/qdrant_client.py` |
| Loop capture CCTV | `services/detection-engine/app/services/cctv_stream.py` |
| Halaman & komponen Web | `apps/web/src/app/**`, `apps/web/src/components/form.tsx` |
| State auth Web | `apps/web/src/store/auth-store.ts` |
| Desain visual (token warna/font) | `ui-references/design-4-bento/tokens.css`, `apps/web/src/app/globals.css` |
| Daftar & status task | [[06-Tasks/Tasks|Task List]] |
