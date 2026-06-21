"""Device / session tracking for the Security settings.

Records one row per login (keyed by a hash of the refresh token) with the
device, IP and best-effort geolocation, and exposes list / revoke operations.

The interesting, decision-carrying logic is pure and lives at the top
(`session_key_for`, `device_from_user_agent`, `is_private_ip`, `geolocate`),
so it is exhaustively testable without a database or network. The DB operations
below are a thin adapter over the service-role Supabase client.
"""

from __future__ import annotations

import hashlib
import ipaddress
from dataclasses import dataclass

import requests
from loguru import logger

from uski.core.supabase import get_supabase_client

_TABLE = "user_session"


# ── pure helpers (the testable seam) ─────────────────────────
def session_key_for(refresh_token: str) -> str:
    """Stable per-login key: a SHA-256 hex digest of the refresh token.

    The same value can be computed on the client from its own refresh token,
    which is how the current device is identified without ever sending the raw
    token to these endpoints.
    """
    return hashlib.sha256((refresh_token or "").encode("utf-8")).hexdigest()


def device_from_user_agent(ua: str | None) -> str:
    """Human-friendly "Browser on OS" label parsed from a User-Agent string.

    Deliberately tiny and dependency-free: it recognises the common browsers and
    platforms and degrades to "Unknown device" rather than guessing.
    """
    if not ua:
        return "Unknown device"
    s = ua.lower()

    if "edg/" in s or "edga" in s or "edgios" in s:
        browser = "Edge"
    elif "opr/" in s or "opera" in s:
        browser = "Opera"
    elif "firefox" in s or "fxios" in s:
        browser = "Firefox"
    elif "chrome" in s or "crios" in s or "chromium" in s:
        browser = "Chrome"
    elif "safari" in s:
        browser = "Safari"
    else:
        browser = "Browser"

    if "windows" in s:
        os_name = "Windows"
    elif "iphone" in s or "ipad" in s or "ios" in s:
        os_name = "iOS"
    elif "mac os" in s or "macintosh" in s:
        os_name = "macOS"
    elif "android" in s:
        os_name = "Android"
    elif "linux" in s:
        os_name = "Linux"
    else:
        os_name = "Unknown OS"

    return f"{browser} on {os_name}"


def is_private_ip(ip: str | None) -> bool:
    """True for loopback / private / unspecified addresses (no useful geo)."""
    if not ip:
        return True
    try:
        addr = ipaddress.ip_address(ip.strip())
    except ValueError:
        return True
    return addr.is_private or addr.is_loopback or addr.is_unspecified or addr.is_reserved


@dataclass(frozen=True)
class Geo:
    city: str | None
    country: str | None
    lat: float | None
    lon: float | None


def geolocate(ip: str | None) -> Geo | None:
    """Best-effort IP geolocation; returns None for private/local IPs.

    Uses the free ip-api.com endpoint with a short timeout. Any failure (no
    network, rate limit, unexpected payload) degrades to None so login is never
    blocked or slowed meaningfully. In dev the client IP is loopback, so this
    returns None and the UI shows a "local network" placeholder.
    """
    if is_private_ip(ip):
        return None
    try:
        resp = requests.get(
            f"http://ip-api.com/json/{ip}?fields=status,city,country,lat,lon",
            timeout=2.5,
        )
        data = resp.json()
        if data.get("status") != "success":
            return None
        return Geo(
            city=data.get("city"),
            country=data.get("country"),
            lat=data.get("lat"),
            lon=data.get("lon"),
        )
    except Exception as exc:  # noqa: BLE001 - geo is best-effort, never fatal
        logger.debug("geolocate failed for {}: {}", ip, exc)
        return None


# ── DB operations (thin adapter over service-role client) ────
def record_login(user_id: str, refresh_token: str, ip: str | None, user_agent: str | None) -> None:
    """Upsert the session row for this login (idempotent per refresh token)."""
    geo = geolocate(ip)
    row = {
        "user_id": user_id,
        "session_key": session_key_for(refresh_token),
        "device": device_from_user_agent(user_agent),
        "user_agent": user_agent,
        "ip": None if is_private_ip(ip) else ip,
        "city": geo.city if geo else None,
        "country": geo.country if geo else None,
        "lat": geo.lat if geo else None,
        "lon": geo.lon if geo else None,
        "last_seen_at": "now()",
    }
    try:
        db = get_supabase_client()
        db.table(_TABLE).upsert(row, on_conflict="user_id,session_key").execute()
    except Exception as exc:  # noqa: BLE001 - session tracking must never block login
        logger.warning("record_login failed for {}: {}", user_id, exc)


def list_sessions(user_id: str) -> list[dict]:
    """All sessions for the user, most recent first."""
    db = get_supabase_client()
    res = (
        db.table(_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .order("last_seen_at", desc=True)
        .execute()
    )
    return res.data or []


def revoke_session(user_id: str, session_id: str) -> bool:
    """Delete one of the user's own sessions. Returns True if a row was removed."""
    db = get_supabase_client()
    res = (
        db.table(_TABLE)
        .delete()
        .eq("user_id", user_id)
        .eq("id", session_id)
        .execute()
    )
    return bool(res.data)


def revoke_other_sessions(user_id: str, current_key: str) -> int:
    """Delete every session for the user except the one matching current_key.

    Returns the number of sessions removed.
    """
    db = get_supabase_client()
    res = (
        db.table(_TABLE)
        .delete()
        .eq("user_id", user_id)
        .neq("session_key", current_key)
        .execute()
    )
    return len(res.data or [])
