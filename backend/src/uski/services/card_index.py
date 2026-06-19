"""Keeps the RAG index in sync with card content. One deep entry point per card."""

from __future__ import annotations

import nh3
from loguru import logger

from uski.repos.chunks import ChunkRepo
from uski.services.embeddings import Embedder


def _plain(html: str) -> str:
    return nh3.clean(html or "", tags=set()).strip()


def reindex_card(
    card_id: str,
    deck_id: str,
    owner_id: str,
    front_html: str,
    back_html: str,
    *,
    embedder: Embedder,
    chunk_repo: ChunkRepo,
) -> None:
    """Embed the card's text and replace its chunk. Best-effort (never raises)."""
    try:
        text = f"{_plain(front_html)}\n{_plain(back_html)}".strip()
        if not text:
            chunk_repo.delete_for_card(card_id)
            return
        vec = embedder.embed([text])[0]
        chunk_repo.replace_for_card(card_id, deck_id, owner_id, [(text, vec)])
    except Exception as exc:  # indexing must not block card writes
        logger.warning("reindex_card failed for {}: {}", card_id, exc)


def remove_card_index(card_id: str, *, chunk_repo: ChunkRepo) -> None:
    try:
        chunk_repo.delete_for_card(card_id)
    except Exception as exc:
        logger.warning("remove_card_index failed for {}: {}", card_id, exc)
