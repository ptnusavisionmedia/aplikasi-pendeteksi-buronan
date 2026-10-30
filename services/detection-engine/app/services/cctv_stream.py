"""Per-feed background capture loop: grab frame -> detect -> search Qdrant -> callback Express on match."""

import asyncio
import base64
import logging
import threading
import time

import cv2
import httpx

from app.config import settings
from app.core.face import LowQualityFaceError, NoFaceDetectedError, extract_embedding
from app.services.qdrant_client import search_face
from app.services.storage import upload_snapshot

logger = logging.getLogger("cctv_stream")

_running_tasks: dict[str, asyncio.Task] = {}
_grabbers: dict[str, "_FrameGrabber"] = {}

# Latest face seen per feed, for the live bbox overlay (Mode Fokus) — independent of whether it
# was confident enough to get written to the database. Cleared whenever a capture tick sees no
# face, so the overlay disappears instead of showing a stale box.
_latest_detection: dict[str, dict] = {}

# Last time a given (feed, buronan) pair was reported to the webhook below match_threshold, so one
# lingering face doesn't write a new LOW_CONFIDENCE/PENDING_CONFIRMATION row every capture tick.
_last_reported_at: dict[tuple[str, str], float] = {}


def get_latest_detection(feed_id: str) -> dict | None:
    detection = _latest_detection.get(feed_id)
    if detection is None:
        return None
    return {**detection, "age_seconds": time.time() - detection["seen_at"]}


async def start_feed(feed_id: str, rtsp_url: str) -> None:
    if feed_id in _running_tasks:
        return
    grabber = _FrameGrabber(rtsp_url)
    grabber.start()
    _grabbers[feed_id] = grabber
    _running_tasks[feed_id] = asyncio.create_task(_capture_loop(feed_id, grabber))


async def stop_feed(feed_id: str) -> None:
    task = _running_tasks.pop(feed_id, None)
    if task:
        task.cancel()
    grabber = _grabbers.pop(feed_id, None)
    if grabber:
        grabber.stop()
    _latest_detection.pop(feed_id, None)


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


class _FrameGrabber:
    """Continuously pulls frames from the RTSP stream on a dedicated thread, keeping
    only the most recent one.

    cv2.VideoCapture buffers decoded frames internally. If we only call .read() once
    every cctv_capture_interval_seconds (the detection cadence), the buffer fills up
    faster than we drain it and every read returns an increasingly stale, queued-up
    frame instead of the live picture — the bbox overlay then looks "stuck" on
    wherever the subject was several seconds ago. Draining continuously here and
    handing _capture_loop only the latest frame keeps detection on the live frame.
    """

    def __init__(self, rtsp_url: str) -> None:
        self._rtsp_url = rtsp_url
        self._lock = threading.Lock()
        self._latest_frame = None
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        self._thread.join(timeout=5)

    def take_latest_frame(self):
        """Returns the most recent frame and clears it, so a slow detection tick
        never reprocesses the same frame twice."""
        with self._lock:
            frame, self._latest_frame = self._latest_frame, None
        return frame

    def _run(self) -> None:
        capture: cv2.VideoCapture | None = None
        while not self._stop_event.is_set():
            if capture is None:
                capture = cv2.VideoCapture(self._rtsp_url)
                if not capture.isOpened():
                    capture.release()
                    capture = None
                    self._stop_event.wait(settings.cctv_capture_interval_seconds)
                    continue

            ok, frame = capture.read()
            if not ok:
                capture.release()
                capture = None
                self._stop_event.wait(1.0)
                continue

            with self._lock:
                self._latest_frame = frame

        if capture is not None:
            capture.release()


async def _capture_loop(feed_id: str, grabber: "_FrameGrabber") -> None:
    try:
        while True:
            frame = grabber.take_latest_frame()
            if frame is not None:
                await _process_frame(feed_id, frame)
            await asyncio.sleep(settings.cctv_capture_interval_seconds)
    except asyncio.CancelledError:
        pass


async def _process_frame(feed_id: str, frame) -> None:
    loop = asyncio.get_running_loop()
    ok, jpeg = await loop.run_in_executor(None, cv2.imencode, ".jpg", frame)
    if not ok:
        return
    jpeg_bytes = jpeg.tobytes()
    frame_height, frame_width = frame.shape[:2]

    try:
        face = await loop.run_in_executor(None, extract_embedding, jpeg_bytes)
    except (NoFaceDetectedError, LowQualityFaceError):
        _latest_detection.pop(feed_id, None)
        return

    results = await loop.run_in_executor(None, search_face, face.embedding.tolist(), 1)
    best = results[0] if results else None
    score = best.score if best else 0.0
    buronan_id = best.payload["buronan_id"] if best else None

    x1, y1, x2, y2 = face.bbox
    # Live overlay (Mode Fokus): every face gets a box, regardless of match confidence — the
    # green/yellow/red tiering happens client-side purely from this score.
    _latest_detection[feed_id] = {
        "bbox": [x1 / frame_width, y1 / frame_height, x2 / frame_width, y2 / frame_height],
        "confidence": float(score),
        "buronan_id": buronan_id,
        "seen_at": time.time(),
    }

    if best is None or score < settings.cctv_report_threshold:
        return  # not similar enough to any buronan on file to be worth a database row

    # A confirmed-tier match (>= apps/api's 0.9 cutoff) always reports immediately; anything
    # between the report floor and that cutoff is throttled so one lingering face doesn't spam
    # LOW_CONFIDENCE/PENDING_CONFIRMATION rows every single capture tick.
    report_key = (feed_id, buronan_id)
    now = time.time()
    if score < settings.match_threshold:
        last = _last_reported_at.get(report_key)
        if last is not None and now - last < settings.cctv_report_cooldown_seconds:
            return
    _last_reported_at[report_key] = now

    snapshot_url = await loop.run_in_executor(None, upload_snapshot, jpeg_bytes)

    async with httpx.AsyncClient() as client:
        await client.post(
            settings.express_webhook_url,
            headers={"X-Internal-Api-Key": settings.internal_api_key},
            json={
                "cctvFeedId": feed_id,
                "buronanId": buronan_id,
                "confidence": score,
                "snapshotUrl": snapshot_url,
            },
            timeout=10.0,
        )
