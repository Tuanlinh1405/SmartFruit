"""Private HTTP inference service; expose only behind authenticated backend access."""
from __future__ import annotations

import os
from functools import lru_cache

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from model import Encoder, MODEL_VERSION

app = FastAPI(title="LogStar embedding inference", docs_url=None, redoc_url=None)


class EmbedInput(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    kind: str
    modelVersion: str


@lru_cache(maxsize=1)
def get_encoder() -> Encoder:
    return Encoder()


@app.post("/embed")
def embed(payload: EmbedInput, authorization: str | None = Header(default=None)) -> dict:
    token = os.environ.get("EMBEDDING_SERVICE_TOKEN")
    if not token or authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if payload.modelVersion != MODEL_VERSION or payload.kind != "query":
        raise HTTPException(status_code=400, detail="Unsupported model or input kind")
    return {"modelVersion": MODEL_VERSION, "vector": get_encoder().encode([payload.text], "query")[0]}
