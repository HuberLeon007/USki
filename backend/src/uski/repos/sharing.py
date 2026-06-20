"""Sharing persistence: shares, invites, access log, notifications, user lookup.

All adapters come in a Supabase (runtime) and in-memory (test) flavor and expose
small interfaces. The permission seam consumes ShareRepo to resolve access.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Protocol

from uski.core.supabase import get_supabase_client


# ── shares ───────────────────────────────────────────────────
class ShareRepo(Protocol):
    def list_for_deck(self, deck_id: str) -> list[dict]: ...
    def list_for_grantee(self, grantee_id: str) -> list[dict]: ...
    def grant(self, deck_id: str, grantee_id: str, permission: str, granted_by: str) -> dict: ...
    def revoke(self, deck_id: str, grantee_id: str) -> None: ...


class SupabaseShareRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def list_for_deck(self, deck_id):
        return self._db.table("deck_share").select("*").eq("deck_id", deck_id).execute().data

    def list_for_grantee(self, grantee_id):
        return self._db.table("deck_share").select("*").eq("grantee_id", grantee_id).execute().data

    def grant(self, deck_id, grantee_id, permission, granted_by):
        row = {"deck_id": deck_id, "grantee_id": grantee_id,
               "permission": permission, "granted_by": granted_by}
        res = self._db.table("deck_share").upsert(row, on_conflict="deck_id,grantee_id").execute()
        return res.data[0]

    def revoke(self, deck_id, grantee_id):
        self._db.table("deck_share").delete().eq("deck_id", deck_id).eq("grantee_id", grantee_id).execute()


class InMemoryShareRepo:
    def __init__(self):
        self._rows: dict[tuple[str, str], dict] = {}

    def list_for_deck(self, deck_id):
        return [r for (d, _), r in self._rows.items() if d == deck_id]

    def list_for_grantee(self, grantee_id):
        return [r for (_, g), r in self._rows.items() if g == grantee_id]

    def grant(self, deck_id, grantee_id, permission, granted_by):
        row = {"deck_id": deck_id, "grantee_id": grantee_id, "permission": permission,
               "granted_by": granted_by, "created_at": datetime.now(timezone.utc).isoformat()}
        self._rows[(deck_id, grantee_id)] = row
        return row

    def revoke(self, deck_id, grantee_id):
        self._rows.pop((deck_id, grantee_id), None)


# ── invites ──────────────────────────────────────────────────
class InviteRepo(Protocol):
    def create(self, deck_id: str, permission: str, created_by: str) -> dict: ...
    def get_by_code(self, code: str) -> dict | None: ...
    def mark_redeemed(self, code: str, user_id: str) -> None: ...


class SupabaseInviteRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def create(self, deck_id, permission, created_by):
        row = {"deck_id": deck_id, "code": secrets.token_urlsafe(8),
               "permission": permission, "created_by": created_by}
        return self._db.table("deck_invite").insert(row).execute().data[0]

    def get_by_code(self, code):
        res = self._db.table("deck_invite").select("*").eq("code", code).execute()
        return res.data[0] if res.data else None

    def mark_redeemed(self, code, user_id):
        self._db.table("deck_invite").update(
            {"redeemed_by": user_id, "redeemed_at": datetime.now(timezone.utc).isoformat()}
        ).eq("code", code).execute()


class InMemoryInviteRepo:
    def __init__(self):
        self._rows: dict[str, dict] = {}

    def create(self, deck_id, permission, created_by):
        code = secrets.token_urlsafe(8)
        row = {"id": str(uuid.uuid4()), "deck_id": deck_id, "code": code,
               "permission": permission, "created_by": created_by,
               "redeemed_by": None, "redeemed_at": None}
        self._rows[code] = row
        return row

    def get_by_code(self, code):
        return self._rows.get(code)

    def mark_redeemed(self, code, user_id):
        row = self._rows.get(code)
        if row is not None:
            row["redeemed_by"] = user_id
            row["redeemed_at"] = datetime.now(timezone.utc).isoformat()


# ── access log (audit) ───────────────────────────────────────
class AuditRepo(Protocol):
    def record(self, deck_id: str, actor_id: str | None, event_type: str, detail: dict) -> None: ...
    def list_for_deck(self, deck_id: str) -> list[dict]: ...


class SupabaseAuditRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def record(self, deck_id, actor_id, event_type, detail):
        self._db.table("deck_access_log").insert(
            {"deck_id": deck_id, "actor_id": actor_id, "event_type": event_type, "detail": detail}
        ).execute()

    def list_for_deck(self, deck_id):
        return (
            self._db.table("deck_access_log").select("*").eq("deck_id", deck_id)
            .order("created_at", desc=True).limit(100).execute().data
        )


class InMemoryAuditRepo:
    def __init__(self):
        self._rows: list[dict] = []

    def record(self, deck_id, actor_id, event_type, detail):
        self._rows.append({"id": str(uuid.uuid4()), "deck_id": deck_id, "actor_id": actor_id,
                           "event_type": event_type, "detail": detail,
                           "created_at": datetime.now(timezone.utc).isoformat()})

    def list_for_deck(self, deck_id):
        return [r for r in self._rows if r["deck_id"] == deck_id]


# ── notifications ────────────────────────────────────────────
class NotificationRepo(Protocol):
    def create(self, user_id: str, deck_id: str | None, kind: str, message: str) -> dict: ...
    def list_unseen(self, user_id: str) -> list[dict]: ...
    def mark_seen(self, user_id: str, ids: list[str]) -> None: ...


class SupabaseNotificationRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def create(self, user_id, deck_id, kind, message):
        row = {"user_id": user_id, "deck_id": deck_id, "kind": kind, "message": message}
        return self._db.table("permission_notification").insert(row).execute().data[0]

    def list_unseen(self, user_id):
        return (
            self._db.table("permission_notification").select("*")
            .eq("user_id", user_id).eq("seen", False)
            .order("created_at", desc=True).execute().data
        )

    def mark_seen(self, user_id, ids):
        if ids:
            self._db.table("permission_notification").update({"seen": True}) \
                .eq("user_id", user_id).in_("id", ids).execute()


class InMemoryNotificationRepo:
    def __init__(self):
        self._rows: dict[str, dict] = {}

    def create(self, user_id, deck_id, kind, message):
        nid = str(uuid.uuid4())
        row = {"id": nid, "user_id": user_id, "deck_id": deck_id, "kind": kind,
               "message": message, "seen": False,
               "created_at": datetime.now(timezone.utc).isoformat()}
        self._rows[nid] = row
        return row

    def list_unseen(self, user_id):
        return [r for r in self._rows.values() if r["user_id"] == user_id and not r["seen"]]

    def mark_seen(self, user_id, ids):
        for i in ids:
            r = self._rows.get(i)
            if r and r["user_id"] == user_id:
                r["seen"] = True


# ── user lookup (friend finding by username#discriminator) ───
class UserRepo(Protocol):
    def find_by_handle(self, username: str, discriminator: str) -> str | None: ...
    def get_handle(self, user_id: str) -> str | None: ...


class SupabaseUserRepo:
    def __init__(self) -> None:
        self._db = get_supabase_client()

    def find_by_handle(self, username, discriminator):
        res = (
            self._db.table("user").select("id")
            .eq("username", username).eq("discriminator", discriminator).execute()
        )
        return res.data[0]["id"] if res.data else None

    def get_handle(self, user_id):
        res = self._db.table("user").select("username,discriminator").eq("id", user_id).execute()
        if not res.data:
            return None
        r = res.data[0]
        return f"{r['username']}#{r['discriminator']}" if r.get("username") else None


class InMemoryUserRepo:
    def __init__(self, handles: dict[tuple[str, str], str] | None = None):
        self._h = handles or {}

    def find_by_handle(self, username, discriminator):
        return self._h.get((username, discriminator))

    def get_handle(self, user_id):
        for (u, d), uid in self._h.items():
            if uid == user_id:
                return f"{u}#{d}"
        return None
