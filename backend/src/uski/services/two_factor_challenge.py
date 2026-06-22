"""Short-lived TOTP login challenges.

After the first factor (email OTP or social) succeeds for a TOTP-protected
account, the minted session is parked here and only released once a valid TOTP
code is presented. Challenges are single-use and expire after a few minutes.

The expiry rule (`is_expired`) is pure and testable; the rest is a thin adapter
over the service-role Supabase client.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from uski.core.supabase import get_supabase_client

_TABLE = "two_factor_challenge"
TTL = timedelta(minutes=5)


def is_expired(created_at: str | None, now: datetime | None = None) -> bool:
    """True if a challenge created at ``created_at`` (ISO) is past its TTL."""
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


def create(user_id: str, email: str | None, access_token: str, refresh_token: str, needs_username: bool) -> str:
    """Park a pending session and return the challenge id the client echoes back."""
    res = (
        get_supabase_client()
        .table(_TABLE)
        .insert(
            {
                "user_id": user_id,
                "email": email,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "needs_username": needs_username,
            }
        )
        .execute()
    )
    return res.data[0]["id"]


def peek(challenge_id: str) -> dict | None:
    """Fetch a challenge without consuming it (so a wrong code can be retried)."""
    res = get_supabase_client().table(_TABLE).select("*").eq("id", challenge_id).execute()
    return res.data[0] if res.data else None


def delete(challenge_id: str) -> None:
    """Consume a challenge (called once the TOTP code verifies)."""
    get_supabase_client().table(_TABLE).delete().eq("id", challenge_id).execute()
