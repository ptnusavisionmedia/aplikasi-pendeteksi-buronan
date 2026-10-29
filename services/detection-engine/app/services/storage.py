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
    return object_name
