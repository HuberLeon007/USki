"""Passkeys / WebAuthn: a thin, safe wrapper over the `webauthn` library plus
the small amount of storage the ceremonies need.

The cryptographic attestation / assertion verification is delegated entirely to
py_webauthn (hand-rolling it would be unsafe). This module's job is to:
- build registration / authentication options and remember their challenge,
- verify the browser's response against the stored challenge + allow-listed
  origin, and
- persist / list / delete the resulting credentials.

Discoverable (resident-key) credentials are preferred, so passkey login needs no
email up front: the authenticator returns the credential id, which we map back
to its owner.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

# WebAuthn is an optional-at-import dependency: guard the import so a backend
# started before `webauthn` is installed (e.g. a container recreate without a
# rebuild) still boots. Passkey endpoints then fail gracefully at call time
# instead of taking the whole app down on import.
try:
    import webauthn
    from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria,
        PublicKeyCredentialDescriptor,
        ResidentKeyRequirement,
        UserVerificationRequirement,
    )
    _WEBAUTHN_OK = True
except Exception:  # noqa: BLE001
    _WEBAUTHN_OK = False

from uski.core.config import settings
from uski.core.supabase import get_supabase_client

_CRED = "webauthn_credential"
_CHAL = "webauthn_challenge"


def _require_lib() -> None:
    if not _WEBAUTHN_OK:
        raise RuntimeError("webauthn library not installed")


def origin_allowed(origin: str | None) -> bool:
    return bool(origin) and origin in settings.webauthn_origins_list


# ── challenge store ──────────────────────────────────────────
def _save_challenge(handle: str, kind: str, challenge: bytes) -> None:
    get_supabase_client().table(_CHAL).upsert(
        {"handle": handle, "kind": kind, "challenge": bytes_to_base64url(challenge)},
        on_conflict="handle,kind",
    ).execute()


def _take_challenge(handle: str, kind: str) -> bytes | None:
    db = get_supabase_client()
    res = db.table(_CHAL).select("challenge").eq("handle", handle).eq("kind", kind).execute()
    if not res.data:
        return None
    db.table(_CHAL).delete().eq("handle", handle).eq("kind", kind).execute()
    return base64url_to_bytes(res.data[0]["challenge"])


# ── registration ─────────────────────────────────────────────
def registration_options(user_id: str, user_name: str) -> str:
    """Build registration options (as JSON) and remember the challenge."""
    _require_lib()
    existing = list_credentials(user_id)
    opts = webauthn.generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=user_id.encode("utf-8"),
        user_name=user_name,
        user_display_name=user_name,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(c["credential_id"]))
            for c in existing
        ],
    )
    _save_challenge(user_id, "register", opts.challenge)
    return webauthn.options_to_json(opts)


def verify_registration(user_id: str, credential_json: str, origin: str, name: str | None) -> dict:
    """Verify the attestation and persist the new credential. Returns the row."""
    challenge = _take_challenge(user_id, "register")
    if challenge is None:
        raise ValueError("No pending registration challenge")
    verification = webauthn.verify_registration_response(
        credential=credential_json,
        expected_challenge=challenge,
        expected_origin=origin,
        expected_rp_id=settings.WEBAUTHN_RP_ID,
        require_user_verification=False,
    )
    row = {
        "user_id": user_id,
        "credential_id": bytes_to_base64url(verification.credential_id),
        "public_key": bytes_to_base64url(verification.credential_public_key),
        "sign_count": verification.sign_count,
        "name": (name or "Passkey").strip()[:40] or "Passkey",
    }
    res = get_supabase_client().table(_CRED).upsert(row, on_conflict="credential_id").execute()
    return res.data[0] if res.data else row


# ── authentication (discoverable) ────────────────────────────
def authentication_options() -> tuple[str, str]:
    """Build discoverable-login options. Returns (options_json, login_handle).

    The handle is a random id the client echoes back on verify so we can look up
    the matching challenge without knowing the user yet.
    """
    _require_lib()
    handle = secrets.token_urlsafe(16)
    opts = webauthn.generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    _save_challenge(handle, "login", opts.challenge)
    return webauthn.options_to_json(opts), handle


def verify_authentication(handle: str, credential_json: str, origin: str) -> str | None:
    """Verify a login assertion. Returns the owning user_id, or None on failure."""
    challenge = _take_challenge(handle, "login")
    if challenge is None:
        return None

    import json

    parsed = json.loads(credential_json)
    cred_id = parsed.get("id") or parsed.get("rawId")
    db = get_supabase_client()
    res = db.table(_CRED).select("*").eq("credential_id", cred_id).execute()
    if not res.data:
        return None
    cred = res.data[0]

    try:
        verification = webauthn.verify_authentication_response(
            credential=credential_json,
            expected_challenge=challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=origin,
            credential_public_key=base64url_to_bytes(cred["public_key"]),
            credential_current_sign_count=cred.get("sign_count") or 0,
            require_user_verification=False,
        )
    except Exception:  # noqa: BLE001 - any failure = auth rejected
        return None

    db.table(_CRED).update(
        {"sign_count": verification.new_sign_count, "last_used_at": datetime.now(timezone.utc).isoformat()}
    ).eq("credential_id", cred_id).execute()
    return cred["user_id"]


# ── credential management ────────────────────────────────────
def list_credentials(user_id: str) -> list[dict]:
    res = (
        get_supabase_client()
        .table(_CRED)
        .select("id, name, created_at, last_used_at, credential_id")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def delete_credential(user_id: str, cred_row_id: str) -> bool:
    res = (
        get_supabase_client()
        .table(_CRED)
        .delete()
        .eq("user_id", user_id)
        .eq("id", cred_row_id)
        .execute()
    )
    return bool(res.data)
