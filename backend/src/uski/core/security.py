"""Supabase JWT validation and current_user dependency.

Supabase has migrated from HS256 (legacy JWT secret) to RS256 (JWKS).
We fetch the public signing keys from Supabase's JWKS endpoint,
cache them for 10 minutes, and use the matching key (by kid) to
verify every incoming access token.
"""

from cachetools import TTLCache, cached
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from loguru import logger
from pydantic import BaseModel
import requests
from requests.exceptions import RequestException

from uski.core.config import settings

security_scheme = HTTPBearer()

# 10-minute TTL matches Supabase's key rotation window.
_jwks_cache = TTLCache(maxsize=1, ttl=600)


class CurrentUser(BaseModel):
    """Authenticated user extracted from Supabase JWT."""

    id: str
    email: str | None = None


@cached(_jwks_cache)
def _fetch_jwks() -> dict:
    """Fetch the JWKS from Supabase. Cached for 10 minutes."""
    logger.debug("Fetching JWKS from {}", settings.jwks_url)
    response = requests.get(settings.jwks_url, timeout=10)
    response.raise_for_status()
    try:
        return response.json()
    except ValueError as exc:
        raise RequestException(f"Invalid JSON from JWKS endpoint: {exc}") from exc


def _get_signing_key(token: str) -> dict:
    """Extract kid from the token header and find the matching JWKS key."""
    jwks = _fetch_jwks()
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    if not kid:
        raise JWTError("Token header missing 'kid'")

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key

    raise JWTError(f"No JWKS key found for kid={kid}")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> CurrentUser:
    """Validate Supabase JWT (RS256 via JWKS) and return the current user."""
    token = credentials.credentials

    try:
        signing_key = _get_signing_key(token)
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
            options={"verify_iss": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except RequestException as exc:
        logger.error("JWKS fetch failed: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable",
        )

    # Validate issuer against the allow-list (browser URL may differ from the
    # backend's internal SUPABASE_URL in dev — see Settings.allowed_issuers).
    token_iss = payload.get("iss")
    if token_iss not in settings.allowed_issuers:
        logger.warning(
            "Token issuer {} not in allowed issuers {}",
            token_iss,
            settings.allowed_issuers,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user id",
        )

    return CurrentUser(
        id=user_id,
        email=payload.get("email"),
    )
