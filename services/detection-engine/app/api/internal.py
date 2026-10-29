import uuid

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.core.face import LowQualityFaceError, NoFaceDetectedError, extract_embedding
from app.services.cctv_stream import start_feed, stop_feed
from app.services.qdrant_client import search_face, upsert_face


def require_internal_api_key(x_internal_api_key: str = Header(...)) -> None:
    if x_internal_api_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")


router = APIRouter(prefix="/internal", dependencies=[Depends(require_internal_api_key)])


async def _fetch_image(image_url: str) -> bytes:
    async with httpx.AsyncClient() as client:
        resp = await client.get(image_url, timeout=10.0)
        resp.raise_for_status()
        return resp.content


class EnrollRequest(BaseModel):
    buronanId: str
    fotoUrl: str


class EnrollResponse(BaseModel):
    qdrantPointId: str


@router.post("/enroll", response_model=EnrollResponse)
async def enroll(body: EnrollRequest):
    image_bytes = await _fetch_image(body.fotoUrl)
    try:
        embedding = extract_embedding(image_bytes)
    except NoFaceDetectedError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LowQualityFaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    point_id = str(uuid.uuid4())
    upsert_face(point_id, embedding.tolist(), body.buronanId)
    return EnrollResponse(qdrantPointId=point_id)


class DetectRequest(BaseModel):
    imageUrl: str


class DetectCandidate(BaseModel):
    buronanId: str
    confidence: float


class DetectResponse(BaseModel):
    candidates: list[DetectCandidate]


@router.post("/detect", response_model=DetectResponse)
async def detect(body: DetectRequest):
    image_bytes = await _fetch_image(body.imageUrl)
    try:
        embedding = extract_embedding(image_bytes)
    except NoFaceDetectedError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LowQualityFaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    results = search_face(embedding.tolist(), limit=5)
    candidates = [
        DetectCandidate(buronanId=r.payload["buronan_id"], confidence=r.score) for r in results
    ]
    return DetectResponse(candidates=candidates)


class CctvFeedStartRequest(BaseModel):
    rtspUrl: str


@router.post("/cctv-feeds/{feed_id}/start")
async def cctv_start(feed_id: str, body: CctvFeedStartRequest):
    await start_feed(feed_id, body.rtspUrl)
    return {"ok": True}


@router.post("/cctv-feeds/{feed_id}/stop")
async def cctv_stop(feed_id: str):
    await stop_feed(feed_id)
    return {"ok": True}


@router.get("/health")
async def health():
    return {"ok": True}
