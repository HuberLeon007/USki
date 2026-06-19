"""Retrieval-augmented generation over card content (no uploads).

`retrieve_context` embeds the question and pulls the most similar card chunks for
the user's deck. `build_system_prompt` grounds the assistant in that context.
"""

from __future__ import annotations

from uski.repos.chunks import ChunkRepo
from uski.services.embeddings import Embedder

_BASE = (
    "Du bist USki, ein intelligenter Lern-Assistent. Antworte kurz, praezise und auf Deutsch. "
    "Nutze den folgenden Kontext aus den Karteikarten des Nutzers, wenn er relevant ist. "
    "Wenn der Kontext nicht reicht, sage es ehrlich."
)


def retrieve_context(
    question: str,
    owner_id: str,
    deck_id: str,
    *,
    embedder: Embedder,
    chunk_repo: ChunkRepo,
    k: int = 5,
) -> list[str]:
    vec = embedder.embed([question])[0]
    return chunk_repo.search(owner_id, deck_id, vec, k)


def build_system_prompt(contexts: list[str]) -> str:
    if not contexts:
        return _BASE
    joined = "\n---\n".join(contexts)
    return f"{_BASE}\n\nKontext:\n{joined}"
