import io
import uuid

from minio import Minio

from app.config import settings

client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_use_ssl,
)


def ensure_bucket() -> None:
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)


def upload_snapshot(jpeg_bytes: bytes) -> str:
    object_name = f"{uuid.uuid4()}.jpg"
    client.put_object(
        settings.minio_bucket,
        object_name,
        io.BytesIO(jpeg_bytes),
        length=len(jpeg_bytes),
        content_type="image/jpeg",
    )
    # Dev bucket is publicly readable (s3mock default), so a direct URL works without signing,
    # matching apps/api/src/services/storage.ts's uploadEvidenceFile().
    scheme = "https" if settings.minio_use_ssl else "http"
    return f"{scheme}://{settings.minio_endpoint}/{settings.minio_bucket}/{object_name}"
