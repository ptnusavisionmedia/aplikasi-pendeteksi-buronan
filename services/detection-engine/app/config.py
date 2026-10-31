from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    internal_api_key: str = "change-this-internal-key"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "buronan_faces"
    express_webhook_url: str = "http://localhost:4000/detections/webhook"
    evidence_public_base_url: str = "http://localhost:9000/evidence"
    embedding_size: int = 512
    # Kept as a courtesy default for any code that still reads it; the live CCTV loop uses
    # cctv_report_threshold below instead. apps/api owns the authoritative 0.9 "confirmed match"
    # cutoff (CONFIDENCE_THRESHOLD in detections.ts) that decides evidence/notification.
    match_threshold: float = 0.9
    # Floor above which a live CCTV match is worth writing to the database at all (yellow tier
    # and up). Below this, the face is still shown live via the bbox overlay but never persisted,
    # so an ordinary passerby every 2s doesn't flood detection_events with near-zero-similarity rows.
    cctv_report_threshold: float = 0.5
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "buronan"
    minio_secret_key: str = "buronan_dev_password"
    minio_bucket: str = "evidence"
    minio_use_ssl: bool = False
    cctv_capture_interval_seconds: float = 2.0
    # Number of concurrent detection workers per feed. Each worker independently pulls whatever
    # frame is freshest and processes it, so with N>1 several frames are mid-pipeline (encode ->
    # embed -> Qdrant search) at once instead of one at a time. Combined with the frame grabber
    # always discarding stale frames, this is what lets a feed catch back up to the live edge of
    # the stream after a slow tick, instead of chewing through a backlog in capture order.
    cctv_worker_count: int = 3
    # Once a feed has reported a sub-0.9 (not-yet-auto-captured) match for a given buronan, wait
    # this long before writing another row for the same buronan — avoids one lingering face
    # generating a new LOW_CONFIDENCE/PENDING_CONFIRMATION row every single capture tick. A >=0.9
    # match always reports immediately regardless of this cooldown.
    cctv_report_cooldown_seconds: float = 20.0

    class Config:
        env_file = ".env"


settings = Settings()
