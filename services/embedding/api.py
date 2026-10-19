"""Authenticated E5 endpoint. Startup warms the model before readiness."""
from __future__ import annotations

import os
import secrets
from contextlib import asynccontextmanager
from threading import Lock

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool

from model import DIMENSIONS, Encoder, MODEL_VERSION


class EmbedInput(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    kind: str
    modelVersion: str

    @field_validator("text")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value.strip()


def create_app(encoder_factory=Encoder) -> FastAPI:
    slot = Lock()

    @asynccontextmanager
    async def lifespan(app):
        token = os.environ.get("EMBEDDING_SERVICE_TOKEN", "")
        if len(token) < 32:
            raise RuntimeError("EMBEDDING_SERVICE_TOKEN must contain at least 32 characters")
        app.state.token = token
        app.state.encoder = None
        if os.environ.get("EMBEDDING_WARMUP", "1") == "1":
            app.state.encoder = await run_in_threadpool(encoder_factory)
            await run_in_threadpool(app.state.encoder.encode, ["Sầu riêng Ri6"], "query")
        yield
        app.state.encoder = None

    app = FastAPI(title="LogStar embedding inference", docs_url=None,
                  redoc_url=None, openapi_url=None, lifespan=lifespan)

    def authorize(authorization: str | None = Header(default=None)):
        if not secrets.compare_digest((authorization or "").encode(),
                                      f"Bearer {app.state.token}".encode()):
            raise HTTPException(status_code=401, detail="Unauthorized")

    @app.get("/health/live")
    def live():
        return {"status": "alive"}

    @app.get("/health/ready", dependencies=[Depends(authorize)])
    def ready():
        if app.state.encoder is None:
            raise HTTPException(status_code=503, detail="Model not ready")
        return {"status": "ready", "modelVersion": MODEL_VERSION, "dimensions": DIMENSIONS}

    @app.post("/embed", dependencies=[Depends(authorize)])
    def embed(payload: EmbedInput) -> dict:
        if payload.modelVersion != MODEL_VERSION or payload.kind != "query":
            raise HTTPException(status_code=400, detail="Unsupported model or input kind")
        if not slot.acquire(blocking=False):
            raise HTTPException(status_code=429, detail="Inference busy", headers={"Retry-After": "1"})
        try:
            if app.state.encoder is None:
                app.state.encoder = encoder_factory()
            vector = app.state.encoder.encode([payload.text], "query")[0]
            return {"modelVersion": MODEL_VERSION, "vector": vector}
        except Exception:
            raise HTTPException(status_code=503, detail="Embedding unavailable") from None
        finally:
            slot.release()

    return app


app = create_app()
