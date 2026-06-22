"""Deck presence / edit-lock storage.

A presence row says "this device, signed in as this user, is currently in this
deck, optionally editing `card_id`". Rows are kept fresh by `heartbeat`; only
rows whose heartbeat is within the TTL count as active. The activeness rule
lives in the service so it stays pure and testable.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Protocol

from uski.core.supabase import get_supabase_client

_TABLE = "deck_presence"
TTL_SECONDS = 30


class PresenceRepo(Protocol):
    def heartbeat(self, deck_id: str, user_id: str, device_id: str, card_id: str | None) -> None: ...
    def list_active(self, deck_id: str, ttl_seconds: int = TTL_SECONDS) -> list[dict]: ...
    def leave(self, deck_id: str, user_id: str, device_id: str) -> None: ...


def _cutoff_iso(ttl_seconds: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(seconds=ttl_seconds)).isoformat()


class SupabasePresenceRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def heartbeat(self, deck_id, user_id, device_id, card_id):
        self._db.table(_TABLE).upsert(
            {
                "deck_id": deck_id,
                "user_id": user_id,
                "device_id": device_id,
                "card_id": card_id,
                "heartbeat_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="deck_id,user_id,device_id",
        ).execute()

    def list_active(self, deck_id, ttl_seconds: int = TTL_SECONDS):
        return (
            self._db.table(_TABLE)
            .select("*")
            .eq("deck_id", deck_id)
            .gte("heartbeat_at", _cutoff_iso(ttl_seconds))
            .execute()
            .data
            or []
        )

    def leave(self, deck_id, user_id, device_id):
        self._db.table(_TABLE).delete().eq("deck_id", deck_id).eq("user_id", user_id).eq(
            "device_id", device_id
        ).execute()


class InMemoryPresenceRepo:
    def __init__(self):
        self._rows: dict[tuple[str, str, str], dict] = {}

    def heartbeat(self, deck_id, user_id, device_id, card_id):
        self._rows[(deck_id, user_id, device_id)] = {
            "deck_id": deck_id,
            "user_id": user_id,
            "device_id": device_id,
            "card_id": card_id,
            "heartbeat_at": datetime.now(timezone.utc).isoformat(),
        }

    def list_active(self, deck_id, ttl_seconds: int = TTL_SECONDS):
        cutoff = _cutoff_iso(ttl_seconds)
        return [
            r for (d, _, _), r in self._rows.items()
            if d == deck_id and r["heartbeat_at"] >= cutoff
        ]

    def leave(self, deck_id, user_id, device_id):
        self._rows.pop((deck_id, user_id, device_id), None)
