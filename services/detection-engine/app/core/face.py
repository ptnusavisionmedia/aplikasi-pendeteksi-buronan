"""Face detection + embedding extraction, backed by InsightFace (ArcFace)."""

from typing import NamedTuple

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from app.config import settings

_face_app: FaceAnalysis | None = None

MIN_FACE_WIDTH_PX = 80

# Caps how many simultaneous faces one CCTV frame reports — a crowded frame (station, market)
# can have dozens of incidental faces, and running embedding + a Qdrant search on every one of
# them per frame would scale worker cost linearly with crowd size. 5 covers the realistic case
# this app targets (a few people in frame of a fixed camera) without that blow-up.
MAX_DETECTED_FACES = 5


def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


# Below this mean-luminance (0-255), a frame is dark enough that gamma brightening kicks in on
# top of CLAHE — CCTV footage at dusk/indoors under weak lighting routinely sits in this range,
# which is exactly where face detection/embedding quality falls off a cliff.
_DARK_FRAME_LUMA_THRESHOLD = 90.0


def _normalize_lighting(image: np.ndarray) -> np.ndarray:
    """Evens out poor/uneven lighting before detection+embedding, instead of feeding InsightFace
    the raw frame as-is. Two cheap, CPU-only steps (no model change, no extra inference pass):

    1. CLAHE (contrast-limited adaptive histogram equalization) on the L channel in LAB space —
       pulls local contrast back into faces that are under-lit or back-lit relative to the rest
       of the frame, without blowing out already well-lit regions the way global histogram
       equalization would.
    2. Gamma correction, applied only when the frame's mean luminance is actually low — brightens
       genuinely dark footage (dusk, indoor CCTV under weak lighting) without over-brightening
       frames that are merely low-contrast rather than dark.

    This only ever feeds a brightened *copy* into detection/embedding — the original bytes
    (used for the stored evidence snapshot) are never touched, so evidence photos stay a
    faithful capture of what the camera actually saw.
    """
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)

    mean_luma = float(np.mean(l_channel))
    if mean_luma < _DARK_FRAME_LUMA_THRESHOLD:
        # Brighten more aggressively the darker the frame is, capped so near-black frames don't
        # get pushed into a blown-out, noisy mess.
        gamma = min(2.2, 1.0 + (_DARK_FRAME_LUMA_THRESHOLD - mean_luma) / 60.0)
        inv_gamma = 1.0 / gamma
        lut = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)], dtype=np.uint8)
        l_channel = cv2.LUT(l_channel, lut)

    enhanced = cv2.merge((l_channel, a_channel, b_channel))
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


class NoFaceDetectedError(Exception):
    pass


class LowQualityFaceError(Exception):
    pass


class FaceMatch(NamedTuple):
    """Embedding plus the pixel bounding box it was detected at, so callers that only need
    the vector (enroll/detect from a static photo) can ignore `.bbox`, while the live CCTV
    loop can use it to draw the on-screen confidence box."""

    embedding: np.ndarray
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2 in source image pixels


def extract_embedding(image_bytes: bytes) -> FaceMatch:
    """Detects the most prominent face in the image and returns its normalized embedding.

    Raises NoFaceDetectedError / LowQualityFaceError when the photo doesn't meet
    the minimum requirements for enrollment/matching (per Tech Spec Bagian 4).
    """
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise NoFaceDetectedError("File bukan gambar yang valid")

    faces = get_face_app().get(_normalize_lighting(image))
    if not faces:
        raise NoFaceDetectedError("Tidak ada wajah terdeteksi pada foto")

    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    width = face.bbox[2] - face.bbox[0]
    if width < MIN_FACE_WIDTH_PX:
        raise LowQualityFaceError("Resolusi wajah terlalu kecil, mohon unggah foto yang lebih jelas")

    embedding = face.normed_embedding.astype(np.float32)
    return FaceMatch(embedding=embedding, bbox=tuple(float(v) for v in face.bbox))


def extract_embeddings(image_bytes: bytes) -> list[FaceMatch]:
    """Live-CCTV counterpart to extract_embedding(): returns every face in the frame worth
    matching (up to MAX_DETECTED_FACES, largest first), instead of only the single most
    prominent one. Used by the capture loop so a frame with several people in it reports a
    box + match per person rather than collapsing them into one. Returns an empty list instead
    of raising when nothing qualifies — a face-less frame is the normal case for a CCTV feed,
    not an error condition the way an enrollment photo with no face is."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        return []

    faces = get_face_app().get(_normalize_lighting(image))
    if not faces:
        return []

    faces.sort(key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)

    matches = []
    for face in faces[:MAX_DETECTED_FACES]:
        width = face.bbox[2] - face.bbox[0]
        if width < MIN_FACE_WIDTH_PX:
            continue
        matches.append(
            FaceMatch(
                embedding=face.normed_embedding.astype(np.float32),
                bbox=tuple(float(v) for v in face.bbox),
            )
        )
    return matches
