import asyncio
import os

from fastapi import FastAPI

from app.api.internal import router as internal_router
from app.services.qdrant_client import ensure_collection
from app.services.settings_sync import run_settings_sync_loop
from app.services.storage import ensure_bucket

# OpenCV's FFmpeg backend defaults to UDP for RTSP, which is unreliable across
# NAT/firewalls (observed hanging reads through Docker port mapping in dev).
# Force TCP so cv2.VideoCapture behaves the same in every environment this
# runs in, without depending on how the process happens to be launched.
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

app = FastAPI(title="Buronan Detection Engine", docs_url=None, redoc_url=None)
app.include_router(internal_router)


@app.on_event("startup")
async def on_startup() -> None:
    ensure_collection()
    ensure_bucket()
    asyncio.create_task(run_settings_sync_loop())
