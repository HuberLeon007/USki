"""Per-(card, user) FSRS schedule persistence seam."""

from __future__ import annotations

from typing import Protocol

from uski.core.supabase import get_supabase_client

_TABLE = "card_schedule"


class ScheduleRepo(Protocol):
    def get_map(self, user_id: str, card_ids: list[str]) -> dict[str, dict]:
        """card_id -> {'fsrs': dict, 'due': iso str}. Missing cards absent."""
        ...

    def upsert(self, card_id: str, user_id: str, fsrs: dict, due: str) -> None: ...


class SupabaseScheduleRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def get_map(self, user_id: str, card_ids: list[str]) -> dict[str, dict]:
        if not card_ids:
            return {}
        res = (
            self._db.table(_TABLE)
            .select("card_id, fsrs, due")
            .eq("user_id", user_id)
            .in_("card_id", card_ids)
            .execute()
        )
        return {r["card_id"]: {"fsrs": r["fsrs"], "due": r["due"]} for r in res.data}

    def upsert(self, card_id: str, user_id: str, fsrs: dict, due: str) -> None:
        self._db.table(_TABLE).upsert(
            {"card_id": card_id, "user_id": user_id, "fsrs": fsrs, "due": due},
            on_conflict="card_id,user_id",
        ).execute()


class InMemoryScheduleRepo:
    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], dict] = {}

    def get_map(self, user_id: str, card_ids: list[str]) -> dict[str, dict]:
        out = {}
        for cid in card_ids:
            row = self._rows.get((cid, user_id))
            if row:
                out[cid] = row
        return out

    def upsert(self, card_id: str, user_id: str, fsrs: dict, due: str) -> None:
        self._rows[(card_id, user_id)] = {"fsrs": fsrs, "due": due}
