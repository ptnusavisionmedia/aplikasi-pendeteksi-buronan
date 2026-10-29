from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, PointStruct, VectorParams

from app.config import settings

client = QdrantClient(url=settings.qdrant_url)


def ensure_collection() -> None:
    collections = {c.name for c in client.get_collections().collections}
    if settings.qdrant_collection in collections:
        return

    client.create_collection(
        collection_name=settings.qdrant_collection,
        vectors_config=VectorParams(size=settings.embedding_size, distance=Distance.COSINE),
    )


def upsert_face(point_id: str, embedding: list[float], buronan_id: str) -> None:
    client.upsert(
        collection_name=settings.qdrant_collection,
        points=[PointStruct(id=point_id, vector=embedding, payload={"buronan_id": buronan_id})],
    )


def search_face(embedding: list[float], limit: int = 5):
    return client.search(
        collection_name=settings.qdrant_collection,
        query_vector=embedding,
        limit=limit,
        with_payload=True,
    )
