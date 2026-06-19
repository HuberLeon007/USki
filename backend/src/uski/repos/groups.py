"""Deck-group (folder) persistence seam, scoped to an owner."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Protocol

from uski.core.supabase import get_supabase_client
from uski.schemas.deck import DeckGroupCreate, DeckGroupOut

_TABLE = "deck_group"


class GroupRepo(Protocol):
    def list_for(self, owner_id: str) -> list[DeckGroupOut]: ...
    def get(self, group_id: str) -> DeckGroupOut | None: ...
    def create(self, owner_id: str, data: DeckGroupCreate) -> DeckGroupOut: ...
    def update(self, group_id: str, patch: dict) -> DeckGroupOut: ...
    def delete(self, group_id: str) -> None: ...


class SupabaseGroupRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def list_for(self, owner_id: str) -> list[DeckGroupOut]:
        res = (
            self._db.table(_TABLE).select("*").eq("owner_id", owner_id).order("position").execute()
        )
        return [DeckGroupOut(**r) for r in res.data]

    def get(self, group_id: str) -> DeckGroupOut | None:
        res = self._db.table(_TABLE).select("*").eq("id", group_id).execute()
        return DeckGroupOut(**res.data[0]) if res.data else None

    def create(self, owner_id: str, data: DeckGroupCreate) -> DeckGroupOut:
        res = self._db.table(_TABLE).insert({"owner_id": owner_id, **data.model_dump()}).execute()
        return DeckGroupOut(**res.data[0])

    def update(self, group_id: str, patch: dict) -> DeckGroupOut:
        res = self._db.table(_TABLE).update(patch).eq("id", group_id).execute()
        return DeckGroupOut(**res.data[0])

    def delete(self, group_id: str) -> None:
        self._db.table(_TABLE).delete().eq("id", group_id).execute()


class InMemoryGroupRepo:
    def __init__(self) -> None:
        self._rows: dict[str, DeckGroupOut] = {}

    def list_for(self, owner_id: str) -> list[DeckGroupOut]:
        return sorted(
            [g for g in self._rows.values() if g.owner_id == owner_id],
            key=lambda g: g.position,
        )

    def get(self, group_id: str) -> DeckGroupOut | None:
        return self._rows.get(group_id)

    def create(self, owner_id: str, data: DeckGroupCreate) -> DeckGroupOut:
        g = DeckGroupOut(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            created_at=datetime.now(timezone.utc),
            **data.model_dump(),
        )
        self._rows[g.id] = g
        return g

    def update(self, group_id: str, patch: dict) -> DeckGroupOut:
        cur = self._rows[group_id]
        upd = cur.model_copy(update=patch)
        self._rows[group_id] = upd
        return upd

    def delete(self, group_id: str) -> None:
        self._rows.pop(group_id, None)
