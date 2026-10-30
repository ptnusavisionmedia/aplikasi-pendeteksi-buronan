"""Face detection + embedding extraction, backed by InsightFace (ArcFace)."""

from typing import NamedTuple

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from app.config import settings

_face_app: FaceAnalysis | None = None

MIN_FACE_WIDTH_PX = 80


def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


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

    faces = get_face_app().get(image)
    if not faces:
        raise NoFaceDetectedError("Tidak ada wajah terdeteksi pada foto")

    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    width = face.bbox[2] - face.bbox[0]
    if width < MIN_FACE_WIDTH_PX:
        raise LowQualityFaceError("Resolusi wajah terlalu kecil, mohon unggah foto yang lebih jelas")

    embedding = face.normed_embedding.astype(np.float32)
    return FaceMatch(embedding=embedding, bbox=tuple(float(v) for v in face.bbox))
