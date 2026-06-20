"""Deck persistence seam.

Interface (everything a caller must know): list/get/create/update/delete decks
scoped to an owner. Errors surface as exceptions from the underlying client.
`get` returns None when the deck does not exist. Ordering of `list_for` is by
creation time ascending.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Protocol

from uski.core.supabase import get_supabase_client
from uski.schemas.deck import DeckCreate, DeckOut, DeckUpdate

_TABLE = "deck"


class DeckRepo(Protocol):
    def list_for(self, owner_id: str) -> list[DeckOut]: ...
    def get(self, deck_id: str) -> DeckOut | None: ...
    def find_by_title(self, owner_id: str, title: str) -> DeckOut | None: ...
    def create(self, owner_id: str, data: DeckCreate) -> DeckOut: ...
    def update(self, deck_id: str, patch: dict) -> DeckOut: ...
    def delete(self, deck_id: str) -> None: ...


class SupabaseDeckRepo:
    """Service-role Supabase adapter (runtime)."""

    def __init__(self) -> None:
        self._db = get_supabase_client()

    def list_for(self, owner_id: str) -> list[DeckOut]:
        res = (
            self._db.table(_TABLE)
            .select("*")
            .eq("owner_id", owner_id)
            .order("created_at")
            .execute()
        )
        return [DeckOut(**row) for row in res.data]

    def get(self, deck_id: str) -> DeckOut | None:
        res = self._db.table(_TABLE).select("*").eq("id", deck_id).execute()
        return DeckOut(**res.data[0]) if res.data else None

    def find_by_title(self, owner_id: str, title: str) -> DeckOut | None:
        res = (
            self._db.table(_TABLE).select("*")
            .eq("owner_id", owner_id).eq("title", title).limit(1).execute()
        )
        return DeckOut(**res.data[0]) if res.data else None

    def create(self, owner_id: str, data: DeckCreate) -> DeckOut:
        payload = {"owner_id": owner_id, **data.model_dump()}
        res = self._db.table(_TABLE).insert(payload).execute()
        return DeckOut(**res.data[0])

    def update(self, deck_id: str, patch: dict) -> DeckOut:
        res = self._db.table(_TABLE).update(patch).eq("id", deck_id).execute()
        return DeckOut(**res.data[0])

    def delete(self, deck_id: str) -> None:
        self._db.table(_TABLE).delete().eq("id", deck_id).execute()


class InMemoryDeckRepo:
    """Side-effect-free fake for tests. Same interface as the real adapter."""

    def __init__(self) -> None:
        self._rows: dict[str, DeckOut] = {}

    def list_for(self, owner_id: str) -> list[DeckOut]:
        return [d for d in self._rows.values() if d.owner_id == owner_id]

    def get(self, deck_id: str) -> DeckOut | None:
        return self._rows.get(deck_id)

    def find_by_title(self, owner_id: str, title: str) -> DeckOut | None:
        for d in self._rows.values():
            if d.owner_id == owner_id and d.title == title:
                return d
        return None

    def create(self, owner_id: str, data: DeckCreate) -> DeckOut:
        now = datetime.now(timezone.utc)
        deck = DeckOut(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            created_at=now,
            updated_at=now,
            **data.model_dump(),
        )
        self._rows[deck.id] = deck
        return deck

    def update(self, deck_id: str, patch: dict) -> DeckOut:
        current = self._rows[deck_id]
        updated = current.model_copy(update={**patch, "updated_at": datetime.now(timezone.utc)})
        self._rows[deck_id] = updated
        return updated

    def delete(self, deck_id: str) -> None:
        self._rows.pop(deck_id, None)
