# Detection Engine (FastAPI)

Internal-only face recognition service. Never exposed to Web/Mobile clients directly — only `apps/api` (Express) calls it, authenticated via `X-Internal-Api-Key`.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

On startup the service ensures the Qdrant collection (`QDRANT_COLLECTION`, default `buronan_faces`) and the MinIO evidence bucket exist.

## Endpoints

All under `/internal`, all requiring the `X-Internal-Api-Key` header:

- `POST /internal/enroll` — `{ buronanId, fotoUrl }` → extracts the face embedding, upserts it into Qdrant, returns `{ qdrantPointId }`.
- `POST /internal/detect` — `{ imageUrl }` → similarity search, returns `{ candidates: [{ buronanId, confidence }] }`.
- `POST /internal/cctv-feeds/{id}/start` — `{ rtspUrl }` → starts a background capture loop for that feed.
- `POST /internal/cctv-feeds/{id}/stop` — stops the capture loop.
- `GET /internal/health` — health check.

The CCTV capture loop (`app/services/cctv_stream.py`) grabs a frame every `CCTV_CAPTURE_INTERVAL_SECONDS`, and on a match ≥ `MATCH_THRESHOLD` uploads the snapshot to MinIO and calls the Express webhook (`EXPRESS_WEBHOOK_URL`) with the match.
