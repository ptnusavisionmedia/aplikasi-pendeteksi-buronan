from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    internal_api_key: str = "change-this-internal-key"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "buronan_faces"
    express_webhook_url: str = "http://localhost:4000/detections/webhook"
    evidence_public_base_url: str = "http://localhost:9000/evidence"
    embedding_size: int = 512
    match_threshold: float = 0.85
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "buronan"
    minio_secret_key: str = "buronan_dev_password"
    minio_bucket: str = "evidence"
    minio_use_ssl: bool = False
    cctv_capture_interval_seconds: float = 2.0

    class Config:
        env_file = ".env"


settings = Settings()
