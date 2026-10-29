---
tags: [guide, dev-setup]
---

# Panduan Setup Development

Cara menjalankan seluruh stack (Postgres, Qdrant, Redis, MinIO, Express API, FastAPI Detection Engine, Next.js Web) di komputer lokal.

## 1. Prasyarat

| Tool | Versi | Catatan |
|------|-------|---------|
| Node.js | 20 LTS+ | untuk Express API & Next.js |
| pnpm | 12.x | package manager monorepo (`packageManager` di `package.json` root) |
| Docker Desktop | terbaru | untuk Postgres, Qdrant, Redis, MinIO |
| Python | **3.12** | **bukan** versi terbaru di sistem — lihat catatan di bawah |
| Microsoft C++ Build Tools | — | wajib di Windows untuk compile `insightface` (ekstensi Cython) |

> **Catatan Python 3.12:** Jika komputer sudah punya Python versi lebih baru (3.13+), tetap install Python 3.12 khusus untuk `services/detection-engine` — `onnxruntime` (dependency InsightFace) sering belum punya wheel untuk versi Python yang sangat baru. Buat virtualenv terpisah dengan `py -3.12 -m venv .venv` di folder tersebut.

## 2. Install dependency

```bash
# dari root repo
pnpm install

# approve build scripts pnpm v10+ jika diminta
pnpm approve-builds --all
```

```bash
# detection engine (Python, venv terpisah, Python 3.12)
cd services/detection-engine
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

## 3. Jalankan infrastruktur (Docker)

```bash
pnpm infra:up
# sama dengan: docker compose -f infra/docker-compose.yml up -d
```

Service yang jalan (lihat `infra/docker-compose.yml`):

| Service | Image | Port host |
|---------|-------|-----------|
| Postgres | `postgres:16-alpine` | 5432 |
| Qdrant | `qdrant/qdrant:latest` | 6333, 6334 |
| Redis | `redis:7-alpine` | 6379 |
| MinIO (pengganti) | `adobe/s3mock:latest` | 9000 (S3 API), 9001 |

> **Kenapa `adobe/s3mock` bukan `minio/minio`?** Image resmi MinIO di Docker Hub & quay.io sekarang butuh login (`pull access denied`). S3Mock adalah test double S3-API-compatible yang tetap kompatibel dengan SDK `minio` npm/python yang dipakai di kode — tidak ada perubahan kode. **Produksi** harus pakai MinIO self-hosted asli (install dari https://min.io/download) atau bucket S3-compatible terkelola.

Cek semua container `Up`:
```bash
docker compose -f infra/docker-compose.yml ps
```

## 4. Setup environment variables

Copy `.env.example` → `.env` di setiap service dan sesuaikan jika perlu:

```bash
cp apps/api/.env.example apps/api/.env
cp services/detection-engine/.env.example services/detection-engine/.env
```

Untuk web, buat `apps/web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4001
```

Variabel penting di `apps/api/.env`:
- `PORT` — default 4000, tapi di environment ini dipakai **4001** karena ada proses lama yang nyangkut di 4000 (lihat Troubleshooting). Sesuaikan jika port 4000 kosong di komputer Anda.
- `DETECTION_ENGINE_URL` — harus menunjuk ke port FastAPI (default 8000).
- `DETECTION_ENGINE_API_KEY` — harus **identik** dengan `INTERNAL_API_KEY` di `services/detection-engine/.env`.

Variabel penting di `services/detection-engine/.env`:
- `EXPRESS_WEBHOOK_URL` — harus menunjuk ke `http://localhost:<PORT-API>/detections/webhook` (sesuaikan port jika API tidak di 4001).

## 5. Migrasi database

```bash
cd apps/api
npx prisma migrate dev --name init --schema=prisma/schema.prisma
```

## 6. Jalankan semua service (4 terminal terpisah)

```bash
# Terminal 1 — Express API
cd apps/api && npx tsx src/server.ts

# Terminal 2 — FastAPI Detection Engine
cd services/detection-engine && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000

# Terminal 3 — Next.js Web
cd apps/web && npx next dev --port 3000

# Terminal 4 (opsional) — Flutter Mobile
cd apps/mobile && flutter run
```

## 7. Smoke test cepat

```bash
curl http://localhost:4001/health
# {"ok":true}

curl -X POST http://localhost:4001/auth/register -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Secret123!","nama":"Test User","role":"MASYARAKAT"}'

curl -X POST http://localhost:4001/auth/login -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Secret123!"}'
```

## 8. Troubleshooting (ditemukan selama development di Windows)

- **`ERR_PNPM_IGNORED_BUILDS`** — jalankan `pnpm approve-builds --all`, ini akan menulis ulang `pnpm-workspace.yaml` dengan konfigurasi `allowBuilds` yang benar.
- **`EPERM: operation not permitted, rename ...query_engine-windows.dll.node.tmp...`** saat `prisma generate`/`migrate` — biasanya ada proses Node lama (`tsx src/server.ts`) yang masih memegang file tersebut. Matikan proses itu (`taskkill //PID <pid> //F` di Git Bash), atau jika tidak bisa (`Access is denied`), ganti `PORT` di `.env` lalu lanjut — DLL yang sudah ada biasanya tetap valid.
- **`onnxruntime` tidak ada distribusi untuk versi Python yang dipakai** — gunakan Python 3.12 (lihat bagian Prasyarat).
- **`Microsoft Visual C++ 14.0 or greater is required`** saat install `insightface` — install "Microsoft C++ Build Tools" (workload *Desktop development with C++*), lalu buka terminal baru sebelum install ulang (variabel environment MSVC butuh sesi baru).
- **MinIO image gagal di-pull (`pull access denied`)** — ini bukan masalah di komputer Anda, image resmi MinIO memang sudah digated. Gunakan `adobe/s3mock` seperti di `docker-compose.yml` bawaan repo ini.
