"""Image metadata persistence (dedup + quota).

Keyed by (owner_id, sha256). The binary lives in Storage; this table tracks the
path + byte size so the backend can dedup identical uploads and enforce the
per-user storage quota.
"""

from __future__ import annotations

from typing import Protocol

from uski.core.supabase import get_supabase_client

_TABLE = "image"


class ImageRepo(Protocol):
    def get(self, owner_id: str, sha256: str) -> dict | None: ...
    def total_bytes(self, owner_id: str) -> int: ...
    def create(self, owner_id: str, sha256: str, path: str, nbytes: int, w: int, h: int) -> dict: ...
    def list_for_owner(self, owner_id: str) -> list[dict]: ...
    def delete(self, owner_id: str, sha256: str) -> None: ...


class SupabaseImageRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def get(self, owner_id, sha256):
        res = self._db.table(_TABLE).select("*").eq("owner_id", owner_id).eq("sha256", sha256).execute()
        return res.data[0] if res.data else None

    def total_bytes(self, owner_id):
        res = self._db.table(_TABLE).select("bytes").eq("owner_id", owner_id).execute()
        return sum(r["bytes"] for r in res.data)

    def create(self, owner_id, sha256, path, nbytes, w, h):
        row = {"owner_id": owner_id, "sha256": sha256, "path": path,
               "bytes": nbytes, "width": w, "height": h}
        return self._db.table(_TABLE).upsert(row, on_conflict="owner_id,sha256").execute().data[0]

    def list_for_owner(self, owner_id):
        res = self._db.table(_TABLE).select("*").eq("owner_id", owner_id).execute()
        return res.data

    def delete(self, owner_id, sha256):
        self._db.table(_TABLE).delete().eq("owner_id", owner_id).eq("sha256", sha256).execute()


class InMemoryImageRepo:
    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], dict] = {}

    def get(self, owner_id, sha256):
        return self._rows.get((owner_id, sha256))

    def total_bytes(self, owner_id):
        return sum(r["bytes"] for (o, _), r in self._rows.items() if o == owner_id)

    def create(self, owner_id, sha256, path, nbytes, w, h):
        row = {"owner_id": owner_id, "sha256": sha256, "path": path,
               "bytes": nbytes, "width": w, "height": h}
        self._rows[(owner_id, sha256)] = row
        return row

    def list_for_owner(self, owner_id):
        return [r for (o, _), r in self._rows.items() if o == owner_id]

    def delete(self, owner_id, sha256):
        self._rows.pop((owner_id, sha256), None)
