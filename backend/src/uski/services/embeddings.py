"""Embedding seam — turn text into vectors. Real adapter talks to Ollama; the
fake is deterministic for tests. Small interface: embed(list[str]) -> list[vec].
"""

from __future__ import annotations

import hashlib
from typing import Protocol

import httpx
from loguru import logger

from uski.core.config import settings

EMBED_DIM = 768
EMBED_MODEL = "nomic-embed-text"


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class OllamaEmbedder:
    """Runtime adapter: POST /api/embeddings to the local Ollama server."""

    def __init__(self, base_url: str | None = None) -> None:
        # ai_base_url_resolved ends in /v1; strip it for the native Ollama API.
        root = (base_url or settings.ai_base_url_resolved or "http://localhost:11434/v1")
        self._root = root.removesuffix("/v1").rstrip("/")

    def embed(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        with httpx.Client(timeout=30.0) as cx:
            for t in texts:
                r = cx.post(
                    f"{self._root}/api/embeddings",
                    json={"model": EMBED_MODEL, "prompt": t},
                )
                r.raise_for_status()
                out.append(r.json()["embedding"])
        return out


class FakeEmbedder:
    """Deterministic hash-based embedder for tests (no network)."""

    def embed(self, texts: list[str]) -> list[list[float]]:
        vecs = []
        for t in texts:
            h = hashlib.sha256(t.lower().encode()).digest()
            # tile the 32-byte digest into EMBED_DIM floats in [0,1)
            vecs.append([h[i % len(h)] / 255.0 for i in range(EMBED_DIM)])
        return vecs
