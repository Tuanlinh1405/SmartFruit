"""One pinned multilingual E5 encoder shared by inference and background jobs."""
from __future__ import annotations

import math
import os
from typing import Any

MODEL_ID = "intfloat/multilingual-e5-base"
MODEL_REVISION = "d13f1b27baf31030b7fd040960d60d909913633f"
MODEL_VERSION = "multilingual-e5-base-v1"
DIMENSIONS = 768


def validate_vectors(values, count: int) -> list[list[float]]:
    vectors = [[float(value) for value in row] for row in values]
    if len(vectors) != count or any(
        len(vector) != DIMENSIONS or not all(math.isfinite(value) for value in vector)
        or math.sqrt(sum(value * value for value in vector)) < 1e-12
        for vector in vectors
    ):
        raise ValueError("model returned invalid vectors")
    norms = [math.sqrt(sum(value * value for value in vector)) for vector in vectors]
    return [[value / norm for value in vector] for vector, norm in zip(vectors, norms)]


class Encoder:
    def __init__(self, model: Any | None = None) -> None:
        if model is None:
            from sentence_transformers import SentenceTransformer

            model = SentenceTransformer(MODEL_ID, revision=MODEL_REVISION,
                                        device=os.environ.get("EMBEDDING_DEVICE", "cpu"),
                                        trust_remote_code=False)
            model.max_seq_length = 512
        self.model = model

    def encode(self, texts: list[str], kind: str) -> list[list[float]]:
        if kind not in ("query", "passage"):
            raise ValueError("kind must be query or passage")
        if not texts or any(not isinstance(text, str) or not text.strip() for text in texts):
            raise ValueError("texts must contain non-empty strings")
        values = self.model.encode(
            [f"{kind}: {text.strip()}" for text in texts],
            batch_size=16,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return validate_vectors(values, len(texts))
