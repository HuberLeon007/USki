"""Retrieval-augmented generation over card content (no uploads).

`retrieve_context` embeds the question and pulls the most similar card chunks for
the user's deck. `build_system_prompt` grounds the assistant in that context.
"""

from __future__ import annotations

from uski.repos.chunks import ChunkRepo
from uski.services.embeddings import Embedder

_BASE = (
    "You are Sero, the friendly study assistant for USki. Reply in English by default, "
    "keep it short and precise, in plain text (no markdown, no bold). "
    "Use the following context from the user's flashcards when it is relevant. "
    "If the context is not enough, say so honestly."
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


def retrieve_context_all(
    question: str,
    owner_id: str,
    deck_ids: list[str],
    *,
    embedder: Embedder,
    chunk_repo: ChunkRepo,
    k_per_deck: int = 2,
    cap: int = 8,
) -> list[str]:
    """Cross-deck retrieval: pull the most relevant chunks from each of the
    user's decks and merge, capped. Used when the user asks without having a
    specific deck open (e.g. from the dashboard)."""
    if not deck_ids:
        return []
    vec = embedder.embed([question])[0]
    out: list[str] = []
    for did in deck_ids:
        for content in chunk_repo.search(owner_id, did, vec, k_per_deck):
            out.append(content)
            if len(out) >= cap:
                return out
    return out


def build_system_prompt(contexts: list[str], deck_name: str | None = None) -> str:
    base = _BASE
    if deck_name:
        base += (
            f' The user is currently studying the deck "{deck_name}". '
            f'When they say "this deck", "the current deck" or "the one I have open", '
            f'they mean "{deck_name}". You may state what the deck is about based on its '
            f'title and the context below.'
        )
    if not contexts:
        return base
    joined = "\n---\n".join(contexts)
    return f"{base}\n\nContext from this deck:\n{joined}"
