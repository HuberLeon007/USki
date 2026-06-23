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
import re
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
    """Human-friendly device label parsed from a User-Agent string.

    Returns the most specific label the UA allows:
    - a named device model when present ("iPhone", "iPad", or an Android model),
      formatted as "Browser on OS (Model)";
    - otherwise "Browser on OS";
    - degrading to "Unknown device" when there is no UA at all.

    Deliberately tiny and dependency-free so it stays exhaustively testable.
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

    model = _device_model(ua)
    return f"{browser} on {os_name} ({model})" if model else f"{browser} on {os_name}"


def _device_model(ua: str) -> str | None:
    """Best-effort device model from a User-Agent, or None when not exposed.

    Desktop UAs (Windows/macOS/Linux) carry no friendly machine name, so this
    returns None and the caller falls back to "Browser on OS".
    """
    s = ua.lower()
    if "ipad" in s:
        return "iPad"
    if "iphone" in s:
        return "iPhone"
    if "android" in s:
        # Android UAs look like: "...; <Model> Build/..." — grab the segment
        # before "Build/" on the model-carrying clause.
        m = re.search(r";\s*([^;]+?)\s+build/", ua, flags=re.IGNORECASE)
        if m:
            model = m.group(1).strip()
            # Skip generic/non-model tokens.
            if model and model.lower() not in {"wv", "k"}:
                return model
        return None
    return None


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


def location_label(geo: "Geo | None", ip: str | None) -> str:
    """Human label for where a login came from (for emails / UI)."""
    if geo and geo.city and geo.country:
        return f"{geo.city}, {geo.country}"
    if geo and geo.country:
        return geo.country
    if is_private_ip(ip):
        return "Local network"
    return "Unknown location"


def geolocate(ip: str | None) -> Geo | None:
    """Best-effort IP geolocation; returns None for private/local IPs.

    Uses the free **HTTPS** ipwho.is endpoint with a short timeout. Any failure
    (no network, rate limit, unexpected payload) degrades to None so login is
    never blocked or slowed meaningfully. In dev the client IP is loopback, so
    this returns None and the UI shows a "local network" placeholder.
    """
    if is_private_ip(ip):
        return None
    try:
        resp = requests.get(
            f"https://ipwho.is/{ip}",
            params={"fields": "success,city,country,latitude,longitude"},
            timeout=2.5,
        )
        data = resp.json()
        if not data.get("success"):
            return None
        return Geo(
            city=data.get("city"),
            country=data.get("country"),
            lat=data.get("latitude"),
            lon=data.get("longitude"),
        )
    except Exception as exc:  # noqa: BLE001 - geo is best-effort, never fatal
        logger.debug("geolocate failed for {}: {}", ip, exc)
        return None


# ── DB operations (thin adapter over service-role client) ────
def record_login(
    user_id: str,
    refresh_token: str,
    ip: str | None,
    user_agent: str | None,
    geo: "Geo | None | object" = ...,
) -> None:
    """Upsert the session row for this login (idempotent per refresh token).

    Pass a precomputed ``geo`` to avoid a second geolocation lookup when the
    caller already resolved it (e.g. to also build a login-alert email).
    """
    if geo is ...:
        geo = geolocate(ip)
    geo_obj = geo if isinstance(geo, Geo) else None
    row = {
        "user_id": user_id,
        "session_key": session_key_for(refresh_token),
        "device": device_from_user_agent(user_agent),
        "user_agent": user_agent,
        "ip": None if is_private_ip(ip) else ip,
        "city": geo_obj.city if geo_obj else None,
        "country": geo_obj.country if geo_obj else None,
        "lat": geo_obj.lat if geo_obj else None,
        "lon": geo_obj.lon if geo_obj else None,
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
