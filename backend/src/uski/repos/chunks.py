"""RAG chunk persistence + similarity search seam.

Chunks are derived from card content. `search` returns the most similar chunk
texts for an owner+deck. Supabase adapter uses a pgvector RPC; the in-memory
fake computes cosine similarity in Python.
"""

from __future__ import annotations

import math
from typing import Protocol

from uski.core.supabase import get_supabase_client

_TABLE = "document_chunk"


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


class ChunkRepo(Protocol):
    def replace_for_card(
        self, card_id: str, deck_id: str, owner_id: str, items: list[tuple[str, list[float]]]
    ) -> None: ...
    def delete_for_card(self, card_id: str) -> None: ...
    def search(self, owner_id: str, deck_id: str, query: list[float], k: int = 5) -> list[str]: ...


class SupabaseChunkRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def replace_for_card(self, card_id, deck_id, owner_id, items):
        self._db.table(_TABLE).delete().eq("card_id", card_id).execute()
        if not items:
            return
        rows = [
            {"card_id": card_id, "deck_id": deck_id, "owner_id": owner_id,
             "content": content, "embedding": emb}
            for content, emb in items
        ]
        self._db.table(_TABLE).insert(rows).execute()

    def delete_for_card(self, card_id):
        self._db.table(_TABLE).delete().eq("card_id", card_id).execute()

    def search(self, owner_id, deck_id, query, k=5):
        res = self._db.rpc(
            "match_document_chunks",
            {"p_owner": owner_id, "p_deck": deck_id, "p_query": query, "p_k": k},
        ).execute()
        return [r["content"] for r in (res.data or [])]


class InMemoryChunkRepo:
    def __init__(self) -> None:
        self._rows: list[dict] = []

    def replace_for_card(self, card_id, deck_id, owner_id, items):
        self._rows = [r for r in self._rows if r["card_id"] != card_id]
        for content, emb in items:
            self._rows.append(
                {"card_id": card_id, "deck_id": deck_id, "owner_id": owner_id,
                 "content": content, "embedding": emb}
            )

    def delete_for_card(self, card_id):
        self._rows = [r for r in self._rows if r["card_id"] != card_id]

    def search(self, owner_id, deck_id, query, k=5):
        cands = [r for r in self._rows if r["owner_id"] == owner_id and r["deck_id"] == deck_id]
        ranked = sorted(cands, key=lambda r: cosine(query, r["embedding"]), reverse=True)
        return [r["content"] for r in ranked[:k]]
