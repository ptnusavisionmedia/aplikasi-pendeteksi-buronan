"""Per-feed background capture loop: grab frame -> detect -> search Qdrant -> callback Express on match."""

import asyncio
import base64
import logging

import cv2
import httpx

from app.config import settings
from app.core.face import LowQualityFaceError, NoFaceDetectedError, extract_embedding
from app.services.qdrant_client import search_face
from app.services.storage import upload_snapshot

logger = logging.getLogger("cctv_stream")

_running_tasks: dict[str, asyncio.Task] = {}


async def start_feed(feed_id: str, rtsp_url: str) -> None:
    if feed_id in _running_tasks:
        return
    _running_tasks[feed_id] = asyncio.create_task(_capture_loop(feed_id, rtsp_url))


async def stop_feed(feed_id: str) -> None:
    task = _running_tasks.pop(feed_id, None)
    if task:
        task.cancel()


async def check_feed(rtsp_url: str, timeout: float = 12.0) -> dict:
    """One-shot connectivity test: open the stream, read a single frame, release.

    Separate from the long-running capture loop in _capture_loop — this is meant
    to answer "is this URL reachable right now" for the dashboard's "Cek Koneksi"
    button, not to start detection. Bounded by `timeout` because cv2.VideoCapture
    on a bad RTSP URL (wrong host, closed port) can hang far longer than a human
    waiting on a button click should.
    """
    loop = asyncio.get_running_loop()

    try:
        capture = await asyncio.wait_for(
            loop.run_in_executor(None, cv2.VideoCapture, rtsp_url), timeout=timeout
        )
    except asyncio.TimeoutError:
        return {"ok": False, "error": "Timeout saat membuka stream"}

    try:
        opened = await loop.run_in_executor(None, capture.isOpened)
        if not opened:
            return {"ok": False, "error": "Stream tidak bisa dibuka — cek URL, kredensial, atau jaringan"}

        try:
            ok, frame = await asyncio.wait_for(loop.run_in_executor(None, capture.read), timeout=timeout)
        except asyncio.TimeoutError:
            return {"ok": False, "error": "Timeout saat membaca frame"}

        if not ok or frame is None:
            return {"ok": False, "error": "Stream terbuka tapi gagal membaca frame"}

        height, width = frame.shape[:2]
        fps = await loop.run_in_executor(None, capture.get, cv2.CAP_PROP_FPS)
        encode_ok, jpeg = await loop.run_in_executor(None, cv2.imencode, ".jpg", frame)
        snapshot_base64 = base64.b64encode(jpeg.tobytes()).decode("ascii") if encode_ok else None

        return {
            "ok": True,
            "width": int(width),
            "height": int(height),
            "fps": float(fps) if fps else None,
            "snapshotBase64": snapshot_base64,
        }
    finally:
        await loop.run_in_executor(None, capture.release)


async def _capture_loop(feed_id: str, rtsp_url: str) -> None:
    loop = asyncio.get_running_loop()
    capture = await loop.run_in_executor(None, cv2.VideoCapture, rtsp_url)

    try:
        while True:
            ok, frame = await loop.run_in_executor(None, capture.read)
            if not ok:
                logger.warning("Feed %s: gagal membaca frame, mencoba lagi...", feed_id)
                await asyncio.sleep(settings.cctv_capture_interval_seconds)
                continue

            await _process_frame(feed_id, frame)
            await asyncio.sleep(settings.cctv_capture_interval_seconds)
    except asyncio.CancelledError:
        pass
    finally:
        await loop.run_in_executor(None, capture.release)


async def _process_frame(feed_id: str, frame) -> None:
    loop = asyncio.get_running_loop()
    ok, jpeg = await loop.run_in_executor(None, cv2.imencode, ".jpg", frame)
    if not ok:
        return
    jpeg_bytes = jpeg.tobytes()

    try:
        embedding = await loop.run_in_executor(None, extract_embedding, jpeg_bytes)
    except (NoFaceDetectedError, LowQualityFaceError):
        return

    results = await loop.run_in_executor(None, search_face, embedding.tolist(), 1)
    if not results:
        return

    best = results[0]
    if best.score < settings.match_threshold:
        return

    snapshot_url = await loop.run_in_executor(None, upload_snapshot, jpeg_bytes)

    async with httpx.AsyncClient() as client:
        await client.post(
            settings.express_webhook_url,
            headers={"X-Internal-Api-Key": settings.internal_api_key},
            json={
                "cctvFeedId": feed_id,
                "buronanId": best.payload["buronan_id"],
                "confidence": best.score,
                "snapshotUrl": snapshot_url,
            },
            timeout=10.0,
        )
