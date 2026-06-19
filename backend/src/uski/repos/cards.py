"""Card persistence seam (scoped to a deck)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Protocol

from uski.core.supabase import get_supabase_client
from uski.schemas.flashcard import CardCreate, CardOut

_TABLE = "card"


class CardRepo(Protocol):
    def list_for_deck(self, deck_id: str) -> list[CardOut]: ...
    def get(self, card_id: str) -> CardOut | None: ...
    def create(self, deck_id: str, data: dict) -> CardOut: ...
    def update(self, card_id: str, patch: dict) -> CardOut: ...
    def delete(self, card_id: str) -> None: ...


class SupabaseCardRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def list_for_deck(self, deck_id: str) -> list[CardOut]:
        res = (
            self._db.table(_TABLE).select("*").eq("deck_id", deck_id).order("position").execute()
        )
        return [CardOut(**row) for row in res.data]

    def get(self, card_id: str) -> CardOut | None:
        res = self._db.table(_TABLE).select("*").eq("id", card_id).execute()
        return CardOut(**res.data[0]) if res.data else None

    def create(self, deck_id: str, data: dict) -> CardOut:
        res = self._db.table(_TABLE).insert({"deck_id": deck_id, **data}).execute()
        return CardOut(**res.data[0])

    def update(self, card_id: str, patch: dict) -> CardOut:
        res = self._db.table(_TABLE).update(patch).eq("id", card_id).execute()
        return CardOut(**res.data[0])

    def delete(self, card_id: str) -> None:
        self._db.table(_TABLE).delete().eq("id", card_id).execute()


class InMemoryCardRepo:
    def __init__(self) -> None:
        self._rows: dict[str, CardOut] = {}

    def list_for_deck(self, deck_id: str) -> list[CardOut]:
        items = [c for c in self._rows.values() if c.deck_id == deck_id]
        return sorted(items, key=lambda c: c.position)

    def get(self, card_id: str) -> CardOut | None:
        return self._rows.get(card_id)

    def create(self, deck_id: str, data: dict) -> CardOut:
        now = datetime.now(timezone.utc)
        card = CardOut(id=str(uuid.uuid4()), deck_id=deck_id, created_at=now, updated_at=now, **data)
        self._rows[card.id] = card
        return card

    def update(self, card_id: str, patch: dict) -> CardOut:
        cur = self._rows[card_id]
        upd = cur.model_copy(update={**patch, "updated_at": datetime.now(timezone.utc)})
        self._rows[card_id] = upd
        return upd

    def delete(self, card_id: str) -> None:
        self._rows.pop(card_id, None)
