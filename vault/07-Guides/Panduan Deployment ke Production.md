---
tags: [guide, deployment, production, devops]
---

# Panduan Deployment ke Production

Ringkasan praktis + tahapan konkret untuk membawa Sigap Buronan dari `docker-compose up` di laptop ke sistem yang bisa diakses banyak orang (publik/instansi) secara aman dan stabil. Target arsitektur mengikuti keputusan yang sudah ada di [[Tech Spec#Bagian 5 Keamanan, Performa, & Deployment|Tech Spec §5]]: **Web → Vercel**, **Mobile → Play Store/App Store**, **Backend (Express + FastAPI) + Postgres + Qdrant + Redis + MinIO → VPS/cloud dengan data residency Indonesia**.

## Kondisi Saat Ini vs Yang Dibutuhkan

| Komponen | Sekarang (dev) | Production |
|---|---|---|
| `apps/web` | `next dev` lokal | Vercel (build otomatis dari git) |
| `apps/api` | `tsx watch` di laptop, port 4001 lewat tether/LAN | Container di VPS, di belakang Nginx + TLS |
| `services/detection-engine` | `uvicorn` lokal, port 8000 | Container di VPS (CPU cukup — `onnxruntime` biasa, bukan GPU) |
| Postgres/Redis/Qdrant/MinIO | Docker Compose lokal (`infra/docker-compose.yml`) | Sama persis, tapi jalan di VPS dengan volume persisten + backup |
| `apps/mobile` | `flutter run` ke HP lewat USB tether, `--dart-define=API_BASE_URL=http://10.x.x.x:4001` | APK/AAB ter-signed, `API_BASE_URL` menunjuk domain publik HTTPS |
| **Belum ada** | — | **Dockerfile untuk `apps/api` dan `services/detection-engine`** (belum pernah dibuat — ini pekerjaan pertama yang harus selesai sebelum langkah lain) |

---

## Tahapan

### 1. Siapkan Dockerfile untuk `apps/api` dan `services/detection-engine`
Belum ada sama sekali di repo ini — semua masih jalan via `tsx watch`/`uvicorn` langsung. Ini blocker pertama.
- `apps/api/Dockerfile`: multi-stage (`pnpm install` → `pnpm build` → runtime image `node:20-alpine` kecil, cuma copy `dist/` + `node_modules` production + `prisma/`). Jalankan `npx prisma migrate deploy` (bukan `migrate dev`) sebagai bagian dari container start/entrypoint, bukan interaktif.
- `services/detection-engine/Dockerfile`: `python:3.11-slim`, install `requirements.txt`, perhatikan `insightface`/`onnxruntime` butuh beberapa system lib (`libgl1`, `libglib2.0-0`) — tanpa ini import `cv2`/`insightface` gagal di image minimal.
- Tambahkan `.dockerignore` di masing-masing (`node_modules`, `.env`, `*.log` — folder `services/detection-engine` sekarang penuh file log lokal yang jangan ikut ter-bundle).

### 2. Pilih & siapkan VPS
- Provider dengan data center Indonesia (sesuai NFR data residency di PRD): Alibaba Cloud (Jakarta), Biznet Gio, IDCloudHost, atau DigitalOcean Singapore kalau syarat residency bisa dilonggarkan untuk pilot.
- Spek minimum realistis untuk pilot (beberapa CCTV + puluhan pengguna): 4 vCPU / 8GB RAM. Detection engine (face recognition CPU) dan Postgres+Qdrant sama-sama rakus memori — jangan taruh di instance 2GB, akan OOM saat ada beberapa kamera aktif bersamaan.
- Install Docker + Docker Compose di VPS, salin `infra/docker-compose.yml` + `.env` production ke sana (lewat `scp`/git clone private repo, **jangan** commit `.env` berisi secret production ke git).

### 3. Ganti komponen "dev-only" dengan yang production-grade
- **MinIO**: `infra/docker-compose.yml` sekarang pakai `adobe/s3mock` (test double, permissive, tanpa auth sungguhan) — sesuai komentar di file itu sendiri, **wajib** diganti sebelum production: instal MinIO asli dari https://min.io/download (bukan image Docker Hub yang butuh login) atau pakai S3-compatible terkelola (AWS S3, Wasabi, Cloudflare R2 — tapi perhatikan data residency untuk foto wajah/bukti).
- **Database password**: `buronan_dev_password` yang hardcoded di `docker-compose.yml` harus diganti jadi secret kuat lewat `.env` (jangan commit).
- **JWT_SECRET** & **DETECTION_ENGINE_API_KEY**: `.env.example` di `apps/api` eksplisit bilang `"change-this-in-production"` — generate secret acak panjang (`openssl rand -hex 32`), simpan di secret manager VPS (atau minimal `.env` dengan permission file ketat `chmod 600`), bukan di git.
- **Redis/Postgres/Qdrant**: jangan expose port-nya ke internet (`5432`, `6379`, `6333`) — di `docker-compose.yml` production, hilangkan baris `ports:` untuk service-service ini (biarkan cuma reachable lewat Docker internal network antar container), kecuali memang butuh akses DB dari luar untuk admin (pakai SSH tunnel kalau perlu, bukan port terbuka).

### 4. Reverse proxy + HTTPS
- Pasang Nginx (atau Caddy — lebih simpel karena auto-HTTPS tanpa setup manual Let's Encrypt) di depan `apps/api` (port 4001 → domain `api.domainanda.com`) dan `services/detection-engine` (**jangan** expose port 8000 langsung ke publik — detection-engine cuma boleh diakses dari `apps/api` lewat jaringan internal, bukan endpoint publik sama sekali, karena tidak punya auth layer sendiri).
- TLS via Let's Encrypt (gratis, auto-renew lewat `certbot` atau bawaan Caddy).
- MediaMTX (RTSP→HLS) butuh perhatian khusus: port `8888` (HLS) dan `8889` (WHEP) perlu reachable dari web/mobile client untuk live-view CCTV, tapi port `8554` (RTSP) **tidak perlu** publik — itu cuma untuk koneksi dari kamera ke MediaMTX di jaringan lokal/VPN kamera, bukan dari browser pengguna.

### 5. Migrasi database
- `npx prisma migrate deploy` (bukan `migrate dev`) di container production — `migrate deploy` tidak interaktif dan tidak pernah membuat migration baru, cuma menerapkan yang sudah ada di `apps/api/prisma/migrations/`.
- Jalankan ini sebagai langkah terpisah sebelum container API start melayani traffic (entrypoint script atau CI/CD step), bukan `prisma db push` (itu untuk dev, bisa kehilangan data di production kalau skema berubah drastis).
- Seed data production **beda** dari `prisma/seed.ts` yang sekarang (isinya akun dummy dengan password `TestPassword123!` hardcoded — itu hanya untuk dev/testing, jangan pernah dijalankan di production).

### 6. Deploy web (Vercel)
- Connect repo GitHub ke Vercel, set root directory `apps/web`.
- Environment variable `NEXT_PUBLIC_API_BASE_URL` (atau nama env yang dipakai `apps/web/src/lib/api-client.ts`) diarahkan ke `https://api.domainanda.com`.
- Vercel otomatis HTTPS + CDN + auto-deploy tiap push ke `main` — bagian ini paling sedikit kerja manualnya.

### 7. Build & distribusi mobile
- `flutter build appbundle --dart-define=API_BASE_URL=https://api.domainanda.com` untuk Android (AAB, bukan APK, untuk submit ke Play Store).
- Signing: generate keystore (`keytool -genkey`), simpan di luar git, konfigurasi `android/key.properties` — **jangan** commit keystore atau password-nya.
- Submit ke Google Play Console (review beberapa hari) dan/atau distribusi internal dulu via Firebase App Distribution kalau mau pilot terbatas sebelum publish publik.
- iOS butuh Apple Developer Program (berbayar) + build dari macOS (`flutter build ipa`) — kalau tidak ada Mac, bisa pakai Codemagic/Bitrise (CI cloud yang punya runner macOS).

### 8. CI/CD
- GitHub Actions sederhana: pada push ke `main` — jalankan `flutter analyze` + `npx tsc --noEmit` (api & web) sebagai gate sebelum deploy, lalu build+push image Docker API/detection-engine ke registry (GitHub Container Registry gratis untuk repo privat), lalu SSH ke VPS untuk `docker compose pull && docker compose up -d`.
- Web otomatis lewat integrasi Vercel-GitHub, tidak perlu workflow tambahan.

### 9. Monitoring, backup, dan observability
- Backup Postgres: `pg_dump` terjadwal (cron) ke storage terpisah (S3/MinIO lain, atau provider snapshot VPS) — data buronan/deteksi/evidence itu data sensitif dan penting, jangan andalkan satu VPS tanpa backup.
- Qdrant juga perlu backup volume-nya (embedding wajah) — kalau hilang, semua foto buronan harus di-enroll ulang.
- Setup log aggregation minimal: `docker compose logs` saja tidak cukup untuk production — pertimbangkan Grafana Loki (self-hosted, cocok untuk data residency) atau minimal rotate log file supaya disk VPS tidak penuh (sudah terlihat gejalanya: folder `services/detection-engine` lokal penuh file `*.log` dari development, jangan ulangi kebiasaan ini di VPS).
- Uptime monitoring sederhana: UptimeRobot/BetterStack (gratis untuk basic) ping endpoint `GET /health` tiap beberapa menit, alert ke email/Telegram kalau API/detection-engine down.

---

## Tips & Trik

1. **Jangan taruh detection-engine di internet terbuka.** Endpoint FastAPI (`/internal/...`) tidak punya rate-limit/auth user-facing — hanya boleh dipanggil oleh `apps/api` lewat jaringan internal Docker atau VPN, bukan port publik.
2. **Pisahkan environment dev/staging/production dengan jelas** — PRD v2 sudah menyebut ini eksplisit (FR-24/25: kamera simulasi webcam tidak boleh pernah memicu notifikasi nyata). Pastikan `.env` production tidak pernah dipakai bareng flag dev-simulation (`CCTVFeedSourceType.DEV_SIMULATION`), dan sebaliknya.
3. **Uji beban sebelum rilis publik luas.** Dengan Redis+BullMQ untuk notifikasi dan deteksi wajah berbasis CPU, lakukan load test sederhana (berapa kamera aktif bersamaan yang sanggup ditangani 1 VPS) sebelum menambah banyak CCTV sekaligus — baru scale instance kalau perlu, jangan asumsi linear.
4. **Pertimbangkan GPU kalau jumlah CCTV bertambah banyak.** `onnxruntime` CPU cukup untuk pilot (beberapa kamera), tapi kalau target "diakses banyak orang" juga berarti banyak kamera aktif real-time bersamaan, deteksi wajah di CPU bisa jadi bottleneck — `onnxruntime-gpu` + VPS dengan GPU (lebih mahal) adalah upgrade path yang sudah tersedia tanpa ubah arsitektur.
5. **Rotasi secret secara berkala**, terutama `JWT_SECRET` dan `DETECTION_ENGINE_API_KEY` — keduanya masih nilai placeholder di `.env.example`, pastikan semua instance development lama tidak diam-diam memakai nilai yang sama dengan production.
6. **Rate-limit endpoint publik** (terutama `POST /berita-acara`, `POST /buronan`, auth login) — belum terlihat middleware rate-limiting di `apps/api`; untuk aplikasi yang diakses publik luas, ini penting supaya tidak gampang di-brute-force atau di-spam.
7. **CORS**: pastikan `apps/api` hanya mengizinkan origin domain Anda (web Vercel + app scheme mobile), bukan wildcard `*`, begitu publik.
8. **Soft-launch / rollout bertahap**: sesuai semangat PRD (human-in-the-loop, pilot dulu) — jangan langsung buka pendaftaran massal; mulai dari satu wilayah/instansi, pantau beban & akurasi deteksi, baru perluas.
9. **Dokumentasikan runbook incident** (apa yang dilakukan kalau API down, DB penuh, dsb.) — untuk aplikasi keamanan publik, downtime berarti CCTV monitoring berhenti, jadi penting ada SOP cepat, bukan cuma andalan ingatan.
10. **Catat keputusan infrastruktur signifikan** (provider VPS yang dipilih, strategi backup, dsb.) sebagai decision record baru di `vault/03-Decisions/` begitu benar-benar dieksekusi, supaya keputusan hosting ini tidak hilang konteksnya seperti yang hampir terjadi pada sistem notifikasi sebelumnya.

---

## Urutan Eksekusi yang Disarankan (ringkas)
1. Buat Dockerfile `apps/api` + `services/detection-engine`, test `docker compose build` lokal dulu.
2. Sewa VPS (region Indonesia), install Docker, copy `infra/docker-compose.yml` + `.env` production (secret baru, bukan nilai dev).
3. Ganti MinIO (S3Mock → MinIO asli/S3-compatible), lepas port DB/Redis/Qdrant dari publik.
4. Pasang Nginx/Caddy + TLS, arahkan domain `api.domainanda.com`.
5. `prisma migrate deploy` di VPS, verifikasi API hidup & bisa diakses lewat domain.
6. Deploy `apps/web` ke Vercel, set `API_BASE_URL` ke domain VPS.
7. Build mobile dengan `API_BASE_URL` production, uji end-to-end dari HP asli ke internet publik (bukan lagi tethering lokal).
8. Setup backup Postgres+Qdrant terjadwal + monitoring uptime.
9. Soft-launch terbatas → pantau → baru perluas akses.
