"""Per-feed background capture loop: grab frame -> detect -> search Qdrant -> callback Express on match."""

import asyncio
import base64
import logging
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

import cv2
import httpx

from app.config import settings
from app.core.face import extract_embeddings
from app.services.settings_sync import get_match_threshold, get_report_threshold
from app.services.qdrant_client import search_face
from app.services.storage import upload_snapshot

logger = logging.getLogger("cctv_stream")

# check_feed() and the detection workers (_process_frame) both run blocking cv2/CPU work via
# loop.run_in_executor(None, ...), which defaults to one shared pool across the whole process.
# With cctv_worker_count workers per active feed all doing face embedding + Qdrant search on that
# same default pool, a one-shot "Cek Koneksi" call can sit queued behind them for its whole
# timeout budget and report a false "RTSP negotiation timed out" even though the camera answered
# in milliseconds. Giving the one-shot check its own pool keeps it responsive regardless of how
# busy detection is. Sized generously (not just cctv_worker_count-sized) because a single
# unreachable/misconfigured feed's cv2.VideoCapture() open call keeps its worker thread blocked
# for its own OS-level connect timeout even after our asyncio-level `timeout` gives up waiting on
# it — a handful of simultaneously-broken feeds shouldn't be able to starve checks for the
# cameras that *are* fine.
_check_executor = ThreadPoolExecutor(max_workers=16, thread_name_prefix="cctv-check")

# Detection's own CPU-bound work (downscale, blur check, CLAHE+embedding, Qdrant search) used to
# run on asyncio's shared default executor — the same pool every other run_in_executor(None, ...)
# call in this process uses. With cctv_worker_count workers per feed, across several feeds, all
# doing that work concurrently, the default pool's thread count (CPU count by default) becomes a
# bottleneck shared with unrelated blocking calls elsewhere in the process. A dedicated pool, sized
# to comfortably cover every feed's workers, keeps detection throughput isolated from anything else
# that happens to use run_in_executor(None, ...).
_detection_executor = ThreadPoolExecutor(max_workers=32, thread_name_prefix="cctv-detect")

# Live frames are detected at this resolution cap (longest side, px) regardless of the camera's
# native resolution (e.g. 1920x1080) — face embedding accuracy doesn't need full-res input, and
# running CLAHE+ArcFace on a smaller image is the single biggest lever on per-frame latency.
# Evidence snapshots (upload_snapshot) still use the original full-res frame; only the detection
# path downscales.
_DETECTION_MAX_DIM = 960

# Laplacian-variance threshold below which a frame is treated as too blurry/motion-smeared to
# trust a face match from (fast pan, focus hunting, compression artifacts on a bad link) — skipped
# entirely rather than risking a confident-looking match on a blurred face. Conservative on purpose
# so a normally-sharp feed essentially never trips it; tune per-camera later if needed.
_BLUR_VARIANCE_THRESHOLD = 25.0

# Consecutive capture ticks a (feed, buronan) match must persist at >= report threshold before
# it's treated as "reportable" at all (webhook/evidence/notification) — a single-frame blip (motion
# blur ghosting, a near-duplicate stranger, a transient Qdrant near-match) no longer creates a
# database row by itself.
_VOTES_REQUIRED = 2

# Per-(feed, buronan) consecutive-match streak, reset the moment a tick doesn't see that pair.
_vote_counts: dict[tuple[str, str], int] = {}

# Rule-based loitering/dwell-time flag: a face bbox persisting at roughly the same position across
# capture ticks for at least this long is flagged "lingering" on the live-detection response — no
# ML involved, no auto-escalation, purely informational (see vault/04-Research/2026-10-31 -
# Rencana Kecerdasan Buatan Tambahan). An officer decides whether that's worth acting on.
_LOITER_SECONDS = 60.0
# Two bbox centers (normalized 0..1 of frame width/height) within this distance are treated as
# "the same person, roughly still in the same spot" between ticks — generous enough to tolerate
# normal fidgeting/shifting, not so generous it conflates two different people standing nearby.
_LOITER_CENTROID_TOLERANCE = 0.1
# A dwell entry survives this many seconds without being matched to any face in a tick before
# it's dropped (brief occlusion/missed tick shouldn't reset the whole dwell timer).
_LOITER_MAX_GAP_SECONDS = 6.0

# Per-feed list of active dwell entries: [{"cx", "cy", "first_seen", "last_seen"}, ...].
_dwell_tracking: dict[str, list[dict]] = {}


def _update_dwell_tracking(feed_id: str, matches: list[dict], now: float) -> None:
    """Matches this tick's face bboxes against tracked dwell entries by nearest centroid,
    extends/creates entries, drops stale ones, and sets `loiter_seconds` on each match whose
    tracked presence has crossed _LOITER_SECONDS."""
    entries = _dwell_tracking.setdefault(feed_id, [])
    entries[:] = [e for e in entries if now - e["last_seen"] <= _LOITER_MAX_GAP_SECONDS]

    for match in matches:
        x1, y1, x2, y2 = match["bbox"]
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

        best_entry, best_dist = None, _LOITER_CENTROID_TOLERANCE
        for entry in entries:
            dist = ((entry["cx"] - cx) ** 2 + (entry["cy"] - cy) ** 2) ** 0.5
            if dist <= best_dist:
                best_entry, best_dist = entry, dist

        if best_entry is None:
            best_entry = {"cx": cx, "cy": cy, "first_seen": now, "last_seen": now}
            entries.append(best_entry)
        else:
            best_entry["cx"], best_entry["cy"], best_entry["last_seen"] = cx, cy, now

        dwell = now - best_entry["first_seen"]
        match["loiter_seconds"] = dwell if dwell >= _LOITER_SECONDS else None


_running_tasks: dict[str, asyncio.Task] = {}
_grabbers: dict[str, "_FrameGrabber"] = {}

# Latest faces seen per feed (up to MAX_DETECTED_FACES), for the live bbox overlay (Mode Fokus) —
# independent of whether any of them was confident enough to get written to the database. Cleared
# whenever a capture tick sees no face, so the overlay disappears instead of showing a stale box.
_latest_detection: dict[str, list[dict]] = {}

# Capture timestamp of the frame currently reflected in _latest_detection, per feed. With several
# workers processing frames concurrently, an older frame can finish its (slower) pipeline after a
# newer one already updated _latest_detection — this stops that older result from clobbering the
# newer one.
_latest_detection_frame_ts: dict[str, float] = {}

# Last time a given (feed, buronan) pair was reported to the webhook below match_threshold, so one
# lingering face doesn't write a new LOW_CONFIDENCE/PENDING_CONFIRMATION row every capture tick.
_last_reported_at: dict[tuple[str, str], float] = {}


def get_latest_detections(feed_id: str) -> list[dict] | None:
    detections = _latest_detection.get(feed_id)
    if detections is None:
        return None
    now = time.time()
    return [{**d, "age_seconds": now - d["seen_at"]} for d in detections]


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
    _latest_detection_frame_ts.pop(feed_id, None)
    for key in [k for k in _vote_counts if k[0] == feed_id]:
        del _vote_counts[key]
    _dwell_tracking.pop(feed_id, None)


def _preflight_error(rtsp_url: str, timeout: float = 4.0) -> str | None:
    """Raw TCP connect test before handing the URL to OpenCV/ffmpeg.

    cv2.VideoCapture collapses every network-layer failure (bad hostname, closed port,
    unreachable LAN) into the same generic open-timeout, which leaves the operator with
    no idea which of those it actually is. A plain socket connect distinguishes them
    cheaply and fast, so "Cek Koneksi" can say something actionable. Returns None when
    the TCP handshake succeeds (caller should proceed to the real RTSP check via OpenCV).
    """
    parsed = urlsplit(rtsp_url)
    host = parsed.hostname
    port = parsed.port or 554
    if not host:
        return "URL RTSP tidak valid — periksa formatnya (contoh: rtsp://user:pass@192.168.1.10:554/stream1)"

    try:
        with socket.create_connection((host, port), timeout=timeout):
            return None
    except socket.gaierror:
        return f"Host/IP '{host}' tidak ditemukan — periksa kembali alamat IP atau domain kamera"
    except ConnectionRefusedError:
        return f"Kamera menolak koneksi di port {port} — port RTSP salah, atau layanan streaming di kamera sedang mati"
    except (TimeoutError, OSError):
        return (
            f"Kamera di {host}:{port} tidak merespons — kemungkinan kamera mati, "
            "beda jaringan (LAN) dengan server ini, atau diblokir firewall/VPN"
        )


async def check_feed(rtsp_url: str, timeout: float = 12.0) -> dict:
    """One-shot connectivity test: open the stream, read a single frame, release.

    Separate from the long-running capture loop in _capture_loop — this is meant
    to answer "is this URL reachable right now" for the dashboard's "Cek Koneksi"
    button, not to start detection. Bounded by `timeout` because cv2.VideoCapture
    on a bad RTSP URL (wrong host, closed port) can hang far longer than a human
    waiting on a button click should.
    """
    loop = asyncio.get_running_loop()

    preflight_error = await loop.run_in_executor(_check_executor, _preflight_error, rtsp_url)
    if preflight_error:
        return {"ok": False, "error": preflight_error}

    try:
        capture = await asyncio.wait_for(
            loop.run_in_executor(_check_executor, cv2.VideoCapture, rtsp_url), timeout=timeout
        )
    except asyncio.TimeoutError:
        return {
            "ok": False,
            "error": (
                "Waktu habis saat negosiasi stream RTSP — jaringan ke kamera tersambung, tapi kamera "
                "tidak kunjung membalas. Kemungkinan ada koneksi RTSP lain yang masih memegang stream "
                "ini (mis. Mode Fokus atau aplikasi lain), atau kamera sedang sibuk. Coba lagi sesaat lagi."
            ),
        }

    try:
        opened = await loop.run_in_executor(_check_executor, capture.isOpened)
        if not opened:
            return {
                "ok": False,
                "error": (
                    "Jaringan ke kamera berhasil tersambung, tapi stream RTSP ditolak — periksa kembali "
                    "username, password, atau path URL-nya (contoh: /stream1)"
                ),
            }

        try:
            ok, frame = await asyncio.wait_for(loop.run_in_executor(_check_executor, capture.read), timeout=timeout)
        except asyncio.TimeoutError:
            return {
                "ok": False,
                "error": (
                    "Stream berhasil dibuka tapi tidak kunjung mengirim data — koneksi ke kamera ini sedang "
                    "terganggu. Coba tutup Mode Fokus/aplikasi lain yang mungkin sedang menonton kamera "
                    "yang sama, lalu cek koneksi lagi."
                ),
            }

        if not ok or frame is None:
            return {
                "ok": False,
                "error": "Stream terbuka tapi gagal membaca frame — coba cek koneksi lagi, atau restart kamera",
            }

        height, width = frame.shape[:2]
        fps = await loop.run_in_executor(_check_executor, capture.get, cv2.CAP_PROP_FPS)
        encode_ok, jpeg = await loop.run_in_executor(_check_executor, cv2.imencode, ".jpg", frame)
        snapshot_base64 = base64.b64encode(jpeg.tobytes()).decode("ascii") if encode_ok else None

        return {
            "ok": True,
            "width": int(width),
            "height": int(height),
            "fps": float(fps) if fps else None,
            "snapshotBase64": snapshot_base64,
        }
    finally:
        await loop.run_in_executor(_check_executor, capture.release)


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
        self._latest_frame_ts = 0.0
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        self._thread.join(timeout=5)

    def take_latest_frame(self):
        """Returns (frame, captured_at) for the most recent frame and clears it, so the
        same frame is never claimed by two workers. Returns (None, 0.0) when nothing new
        has arrived since the last call."""
        with self._lock:
            frame, ts = self._latest_frame, self._latest_frame_ts
            self._latest_frame = None
        return frame, ts

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
                self._latest_frame_ts = time.time()

        if capture is not None:
            capture.release()


async def _capture_loop(feed_id: str, grabber: "_FrameGrabber") -> None:
    """Runs cctv_worker_count workers concurrently against the same grabber.

    Each worker just grabs whatever frame is currently freshest and processes it, with no
    fixed cadence of its own — when one worker is mid-pipeline on an older frame, another
    worker is already free to pick up whatever arrived since. Combined with the grabber
    discarding frames nobody claimed in time, this is what lets detection catch back up to
    the live edge of the stream after a slow tick, instead of working through a backlog in
    capture order.
    """
    worker_count = max(1, settings.cctv_worker_count)
    try:
        await asyncio.gather(*(_detection_worker(feed_id, grabber) for _ in range(worker_count)))
    except asyncio.CancelledError:
        pass


async def _detection_worker(feed_id: str, grabber: "_FrameGrabber") -> None:
    idle_poll_seconds = min(0.5, settings.cctv_capture_interval_seconds)
    while True:
        frame, captured_at = grabber.take_latest_frame()
        if frame is None:
            await asyncio.sleep(idle_poll_seconds)
            continue
        await _process_frame(feed_id, frame, captured_at)


def _downscale_for_detection(frame):
    """Shrinks `frame` so its longest side is at most _DETECTION_MAX_DIM, preserving aspect
    ratio (so bbox coordinates normalized against the downscaled image's own width/height still
    land in the same 0..1 fraction of the original frame). Returns the frame unchanged if it's
    already at or below the cap."""
    height, width = frame.shape[:2]
    longest = max(height, width)
    if longest <= _DETECTION_MAX_DIM:
        return frame
    scale = _DETECTION_MAX_DIM / longest
    return cv2.resize(frame, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)


def _is_too_blurry(frame) -> bool:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < _BLUR_VARIANCE_THRESHOLD


def _encode_full_res(frame) -> bytes:
    ok, jpeg = cv2.imencode(".jpg", frame)
    if not ok:
        raise RuntimeError("Gagal encode frame CCTV ke JPEG untuk evidence")
    return jpeg.tobytes()


def _prepare_detection_frame(frame):
    """Runs on the detection executor: downscale -> blur check -> JPEG-encode the downscaled
    frame, all in one executor hop instead of three. Returns None when the frame is too blurry
    to bother detecting on."""
    small = _downscale_for_detection(frame)
    if _is_too_blurry(small):
        return None
    ok, jpeg = cv2.imencode(".jpg", small)
    if not ok:
        return None
    height, width = small.shape[:2]
    return jpeg.tobytes(), width, height


async def _process_frame(feed_id: str, frame, captured_at: float) -> None:
    loop = asyncio.get_running_loop()

    prepared = await loop.run_in_executor(_detection_executor, _prepare_detection_frame, frame)
    if prepared is None:
        # Either too blurry to trust, or encoding failed — leave the overlay as-is (don't clear
        # it on a single bad frame) and let the next worker/tick try again.
        return
    detect_jpeg_bytes, frame_width, frame_height = prepared

    faces = await loop.run_in_executor(_detection_executor, extract_embeddings, detect_jpeg_bytes)
    if not faces:
        # Only clear the overlay if this is the newest frame processed so far for this feed —
        # otherwise a faster worker on an older, face-less frame could blank out a fresher
        # worker's still-in-flight detection.
        if captured_at >= _latest_detection_frame_ts.get(feed_id, 0.0):
            _latest_detection.pop(feed_id, None)
            _latest_detection_frame_ts[feed_id] = captured_at
        return

    # Search Qdrant for every face in the frame concurrently — each person gets independently
    # matched against the buronan database, not just the single most prominent face.
    search_results = await asyncio.gather(
        *(loop.run_in_executor(_detection_executor, search_face, face.embedding.tolist(), 1) for face in faces)
    )

    matches = []
    for face, results in zip(faces, search_results):
        best = results[0] if results else None
        x1, y1, x2, y2 = face.bbox
        matches.append(
            {
                "bbox": [x1 / frame_width, y1 / frame_height, x2 / frame_width, y2 / frame_height],
                "confidence": float(best.score) if best else 0.0,
                "buronan_id": best.payload["buronan_id"] if best else None,
            }
        )

    if captured_at < _latest_detection_frame_ts.get(feed_id, 0.0):
        # A worker on a newer frame already finished and updated the overlay; don't regress it
        # with this slower, now-stale result. The match-reporting logic below still runs, since
        # a real match is worth recording even if it's no longer the newest frame on screen.
        pass
    else:
        now = time.time()
        _update_dwell_tracking(feed_id, matches, now)
        # Live overlay (Mode Fokus): every face gets a box, regardless of match confidence — the
        # green/yellow/red tiering happens client-side purely from this score.
        _latest_detection[feed_id] = [{**m, "seen_at": now} for m in matches]
        _latest_detection_frame_ts[feed_id] = captured_at

    candidates = [m for m in matches if m["buronan_id"] is not None and m["confidence"] >= get_report_threshold()]
    if not candidates:
        # Nobody above the report floor this tick — every streak for this feed resets, since a
        # match has to persist across *consecutive* ticks to count (see _VOTES_REQUIRED below).
        for key in [k for k in _vote_counts if k[0] == feed_id]:
            del _vote_counts[key]
        return

    # Multi-frame voting: a (feed, buronan) pair only becomes reportable once it's shown up at
    # >= report threshold for _VOTES_REQUIRED consecutive ticks — a single blip (motion-blur
    # ghosting, a momentary near-duplicate stranger) no longer creates a database row by itself.
    seen_pairs = set()
    reportable = []
    for match in candidates:
        pair = (feed_id, match["buronan_id"])
        seen_pairs.add(pair)
        streak = _vote_counts[pair] = _vote_counts.get(pair, 0) + 1
        if streak >= _VOTES_REQUIRED:
            reportable.append(match)
    for key in [k for k in _vote_counts if k[0] == feed_id and k not in seen_pairs]:
        del _vote_counts[key]

    if not reportable:
        return  # seen, but not yet for enough consecutive ticks to trust

    snapshot_url: str | None = None
    now = time.time()
    async with httpx.AsyncClient() as client:
        for match in reportable:
            buronan_id = match["buronan_id"]
            score = match["confidence"]

            # A confirmed-tier match (>= apps/api's configurable cutoff) always reports
            # immediately; anything between the report floor and that cutoff is throttled so one
            # lingering face doesn't spam LOW_CONFIDENCE/PENDING_CONFIRMATION rows every tick.
            report_key = (feed_id, buronan_id)
            if score < get_match_threshold():
                last = _last_reported_at.get(report_key)
                if last is not None and now - last < settings.cctv_report_cooldown_seconds:
                    continue
            _last_reported_at[report_key] = now

            if snapshot_url is None:
                # Evidence snapshot uses the original full-resolution frame, not the downscaled
                # copy detection ran on — this is the image an officer later reviews.
                full_res_jpeg = await loop.run_in_executor(None, _encode_full_res, frame)
                snapshot_url = await loop.run_in_executor(None, upload_snapshot, full_res_jpeg)

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
