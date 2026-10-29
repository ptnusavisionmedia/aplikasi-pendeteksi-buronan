from fastapi import FastAPI

from app.api.internal import router as internal_router
from app.services.qdrant_client import ensure_collection
from app.services.storage import ensure_bucket

app = FastAPI(title="Buronan Detection Engine", docs_url=None, redoc_url=None)
app.include_router(internal_router)


@app.on_event("startup")
async def on_startup() -> None:
    ensure_collection()
    ensure_bucket()
