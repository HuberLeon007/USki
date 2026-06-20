"""Integration tests for the dev-only Mock_Social_Login endpoint (task 4.2).

These tests exercise the backend half of the offline social-login experience
end to end and prove that a mock session is indistinguishable from an OTP
session everywhere past the seam:

  Test 1  one end-to-end mock mint returns a valid canonical AuthResponse
          (access_token, refresh_token, user_id, email, needs_username).
  Test 2  the minted access_token is accepted by the existing get_current_user
          (security.py), the same validation OTP tokens use, and resolves to the
          matching user_id.
  Test 3  a tampered/invalid JWT is rejected by get_current_user identically to
          a tampered OTP token, with no relaxation for social sessions.

Route registration note (important):
  The mock endpoint POST /api/auth/dev/mock-social is registered ONLY when
  APP_MODE == "dev" (there is no separate flag anymore). The shared pytest
  conftest boots the app under APP_MODE == "test", so the ROUTE is not
  registered during the normal test run. These tests therefore drive the
  endpoint's underlying function (`_mock_social_login`) directly instead of
  going through the FastAPI router, and they point the shared `settings`
  singleton at the live local Supabase for the duration of each test. If you
  would rather hit the route through a TestClient, you must set APP_MODE=dev
  before the app is imported so the route is registered.

Preference: these tests prefer the live local Supabase so the minted JWT is
genuine (issued by the local GoTrue, validated through the unchanged JWKS path).
If the live local Supabase cannot be reached from the host, the tests fall back
to driving validation through the app/TestClient with the shared test JWKS and
print a note saying so.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import requests
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from uski.core import config as config_module
from uski.core.security import get_current_user
from uski.schemas.auth import AuthResponse, MockSocialRequest


# ---------------------------------------------------------------------------
# Local Supabase discovery (read the repo .env so we use the real local keys).
# ---------------------------------------------------------------------------
def _load_local_supabase() -> dict | None:
    """Read SUPABASE_* from the repo-root .env. Returns None if not found."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return None
    values: dict[str, str] = {}
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        values[key.strip()] = val.strip()
    url = values.get("SUPABASE_URL")
    anon = values.get("SUPABASE_ANON_KEY")
    service = values.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and anon and service):
        return None
    return {"url": url, "anon": anon, "service": service}


def _jwks_url(base_url: str) -> str:
    return f"{base_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _live_supabase_available() -> tuple[bool, dict | None]:
    """Best-effort probe: can we reach the local Supabase JWKS endpoint?"""
    cfg = _load_local_supabase()
    if not cfg:
        return False, None
    try:
        resp = requests.get(_jwks_url(cfg["url"]), timeout=5)
        resp.raise_for_status()
        keys = resp.json().get("keys")
        return bool(keys), cfg
    except Exception:  # noqa: BLE001 - any failure means "not reachable"
        return False, cfg


LIVE_AVAILABLE, LOCAL_CFG = _live_supabase_available()


# ---------------------------------------------------------------------------
# Fixture: point the shared settings singleton at the live local Supabase and
# restore the real JWKS fetch (the conftest mocks JWKS by default). Auto-reverts
# via monkeypatch after each test.
# ---------------------------------------------------------------------------
@pytest.fixture
def live_env(monkeypatch):
    """Configure dev + live local Supabase for one test; real JWKS validation."""
    if not LIVE_AVAILABLE or LOCAL_CFG is None:
        pytest.skip("live local Supabase not reachable")

    settings = config_module.settings
    # APP_MODE=dev so allowed_issuers accepts the local 127.0.0.1 GoTrue issuer,
    # and SUPABASE_* point at the live local stack (all modules share this
    # singleton, so the Supabase clients are built against the live instance).
    monkeypatch.setattr(settings, "APP_MODE", "dev")
    monkeypatch.setattr(settings, "SUPABASE_URL", LOCAL_CFG["url"])
    monkeypatch.setattr(settings, "SUPABASE_PUBLIC_URL", LOCAL_CFG["url"])
    monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", LOCAL_CFG["anon"])
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", LOCAL_CFG["service"])

    # Override the conftest JWKS mock with a real fetch from the live local
    # Supabase, so a genuinely-minted token validates through the same path.
    jwks_url = _jwks_url(LOCAL_CFG["url"])

    def _real_fetch_jwks() -> dict:
        resp = requests.get(jwks_url, timeout=10)
        resp.raise_for_status()
        return resp.json()

    monkeypatch.setattr("uski.core.security._fetch_jwks", _real_fetch_jwks)
    return LOCAL_CFG


# ---------------------------------------------------------------------------
# Helpers driving the endpoint's underlying logic directly (route is not
# registered under APP_MODE=test, see module docstring).
# ---------------------------------------------------------------------------
def _mint_mock_social(provider: str = "github") -> AuthResponse:
    """One end-to-end offline mock mint against the live local Supabase."""
    from uski.api.auth import _mock_social_login

    return _mock_social_login(MockSocialRequest(provider=provider))


def _mint_otp_style(email: str) -> tuple[str, str, str]:
    """Mint a genuine OTP/magiclink session (the exact path OTP login uses).

    Returns (access_token, refresh_token, user_id). This is what makes Test 3's
    comparison fair: the "OTP token" and the "social token" are both issued by
    the same local GoTrue and validated by the same code, so there is no
    separate path that could relax validation for social sessions.
    """
    from uski.api.auth import _mint_local_session
    from uski.core.supabase import get_supabase_anon_client, get_supabase_client

    admin = get_supabase_client()
    anon = get_supabase_anon_client()
    try:
        admin.auth.admin.create_user({"email": email, "email_confirm": True})
    except Exception:  # noqa: BLE001 - user may already exist; that is fine
        pass
    return _mint_local_session(admin, anon, email)


def _bearer(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _tamper(token: str) -> str:
    """Corrupt a JWT so its signature no longer verifies."""
    return token + "x"


# ===========================================================================
# Test 1: one end-to-end mock mint returns a valid canonical AuthResponse.
# ===========================================================================
class TestMockMintReturnsAuthResponse:
    def test_mock_mint_returns_canonical_auth_response(self, live_env):
        result = _mint_mock_social(provider="github")

        # Canonical AuthResponse shape, shared verbatim with the OTP path.
        assert isinstance(result, AuthResponse)
        assert isinstance(result.access_token, str) and result.access_token
        assert isinstance(result.refresh_token, str) and result.refresh_token
        assert isinstance(result.user_id, str) and result.user_id
        assert result.email == "octocat-dev@uski.dev"
        assert isinstance(result.needs_username, bool)

    def test_fallback_shape_without_live_supabase(self, client):
        """Fallback: when live Supabase is unreachable, verify the function
        still assembles the canonical AuthResponse shape by faking the Supabase
        round-trip (no genuine JWT). Skipped when live Supabase is available."""
        if LIVE_AVAILABLE:
            pytest.skip("live local Supabase reachable; covered by live test")

        from unittest.mock import MagicMock, patch

        print(
            "NOTE: live local Supabase unreachable - driving _mock_social_login "
            "with a faked Supabase round-trip to verify AuthResponse shape only."
        )

        fake_admin = MagicMock()
        fake_anon = MagicMock()
        verify = fake_anon.auth.verify_otp.return_value
        verify.session.access_token = "fallback-access"
        verify.session.refresh_token = "fallback-refresh"
        verify.user.id = "fallback-user-id"
        fake_admin.auth.admin.generate_link.return_value.properties.email_otp = "000000"

        fake_store = MagicMock()
        fake_account = MagicMock()
        fake_account.needs_username = True
        resolution = MagicMock()
        resolution.account = fake_account

        with patch("uski.api.auth.get_supabase_client", return_value=fake_admin), patch(
            "uski.api.auth.get_supabase_anon_client", return_value=fake_anon
        ), patch("uski.api.auth.SupabaseAccountStore", return_value=fake_store), patch(
            "uski.api.auth.resolve_account", return_value=resolution
        ):
            from uski.api.auth import _mock_social_login

            result = _mock_social_login(MockSocialRequest(provider="github"))

        assert isinstance(result, AuthResponse)
        assert result.access_token == "fallback-access"
        assert result.refresh_token == "fallback-refresh"
        assert result.user_id == "fallback-user-id"
        assert result.email == "octocat-dev@uski.dev"
        assert result.needs_username is True


# ===========================================================================
# Test 2: the minted access_token is accepted by the existing get_current_user.
# ===========================================================================
class TestMintedTokenAcceptedByGetCurrentUser:
    def test_minted_jwt_accepted_and_matches_user_id(self, live_env):
        result = _mint_mock_social(provider="github")

        # Same validation path OTP tokens use; no social-specific relaxation.
        current = get_current_user(_bearer(result.access_token))

        assert current.id == result.user_id

    def test_fallback_valid_token_accepted(self, client, make_token):
        """Fallback: validate that a session token is accepted by the unchanged
        get_current_user / security.py path using the shared test JWKS. Skipped
        when live Supabase is available."""
        if LIVE_AVAILABLE:
            pytest.skip("live local Supabase reachable; covered by live test")

        print(
            "NOTE: live local Supabase unreachable - validating the unchanged "
            "JWT path with a shared test-signed token instead of a live mint."
        )
        token = make_token({"sub": "social-user-1", "email": "octocat-dev@uski.dev"})
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["id"] == "social-user-1"


# ===========================================================================
# Test 3: a tampered JWT is rejected identically to a tampered OTP token.
# ===========================================================================
class TestTamperedTokenRejectedIdentically:
    def test_tampered_social_and_otp_rejected_the_same(self, live_env):
        social = _mint_mock_social(provider="discord")
        otp_access, _otp_refresh, _otp_uid = _mint_otp_style(
            "otp-compare-dev@uski.dev"
        )

        # Sanity: both untampered tokens are accepted by the same path.
        assert get_current_user(_bearer(social.access_token)).id == social.user_id
        get_current_user(_bearer(otp_access))

        # Tampering either one yields the identical rejection (401, no relaxation
        # for social sessions - both run through the same get_current_user).
        with pytest.raises(HTTPException) as social_err:
            get_current_user(_bearer(_tamper(social.access_token)))
        with pytest.raises(HTTPException) as otp_err:
            get_current_user(_bearer(_tamper(otp_access)))

        assert social_err.value.status_code == 401
        assert otp_err.value.status_code == 401
        assert social_err.value.status_code == otp_err.value.status_code

    def test_fallback_tampered_rejected_the_same(self, client, make_token):
        """Fallback: a tampered social-style token and a tampered OTP-style token
        are both rejected with 401 via the unchanged path. Skipped when live
        Supabase is available."""
        if LIVE_AVAILABLE:
            pytest.skip("live local Supabase reachable; covered by live test")

        print(
            "NOTE: live local Supabase unreachable - comparing tampered "
            "test-signed tokens through the unchanged validation path."
        )
        social = make_token({"sub": "social-user-2", "email": "octocat-dev@uski.dev"})
        otp = make_token({"sub": "otp-user-2", "email": "otp@example.com"})

        social_resp = client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {_tamper(social)}"}
        )
        otp_resp = client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {_tamper(otp)}"}
        )

        assert social_resp.status_code == 401
        assert otp_resp.status_code == 401
        assert social_resp.status_code == otp_resp.status_code
