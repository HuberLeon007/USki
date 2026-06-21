"""Cross-device sign-in (QR / device-link) store.

A device shows a QR for a short-lived ``code``; an already-signed-in device
approves it and attaches a minted session; the first device polls until it can
claim that session. Requests expire after a few minutes and are single-use
(claimed once, then deleted).

Pure policy (`is_expired`) is separated from the DB operations so the expiry
rule is testable without a database.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from uski.core.supabase import get_supabase_client

_TABLE = "login_request"
TTL = timedelta(minutes=5)


def new_code() -> str:
    return secrets.token_urlsafe(18)


def is_expired(created_at: str | None, now: datetime | None = None) -> bool:
    """True if a request created at ``created_at`` (ISO) is past its TTL."""
    if not created_at:
        return True
    now = now or datetime.now(timezone.utc)
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return True
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return now - created > TTL


def start() -> str:
    """Create a pending login request and return its code."""
    code = new_code()
    get_supabase_client().table(_TABLE).insert({"code": code, "status": "pending"}).execute()
    return code


def get(code: str) -> dict | None:
    res = get_supabase_client().table(_TABLE).select("*").eq("code", code).execute()
    return res.data[0] if res.data else None


def approve(code: str, user_id: str, email: str, access_token: str, refresh_token: str, needs_username: bool) -> bool:
    """Attach a minted session to a pending, unexpired request. Returns success."""
    row = get(code)
    if not row or row["status"] != "pending" or is_expired(row.get("created_at")):
        return False
    get_supabase_client().table(_TABLE).update(
        {
            "status": "approved",
            "user_id": user_id,
            "email": email,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "needs_username": needs_username,
            "approved_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("code", code).execute()
    return True


def claim(code: str) -> dict | None:
    """Poll result. Returns one of:
    - {"status": "expired"} / {"status": "pending"} / {"status": "not_found"}
    - {"status": "approved", "session": {...}} once, then the request is deleted.
    """
    row = get(code)
    if not row:
        return {"status": "not_found"}
    if row["status"] == "approved":
        session = {
            "access_token": row["access_token"],
            "refresh_token": row["refresh_token"],
            "user_id": row["user_id"],
            "email": row.get("email"),
            "needs_username": bool(row.get("needs_username")),
        }
        get_supabase_client().table(_TABLE).delete().eq("code", code).execute()
        return {"status": "approved", "session": session}
    if is_expired(row.get("created_at")):
        get_supabase_client().table(_TABLE).delete().eq("code", code).execute()
        return {"status": "expired"}
    return {"status": "pending"}
