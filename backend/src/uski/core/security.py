"""Supabase JWT validation and current_user dependency."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from uski.core.config import settings

security_scheme = HTTPBearer()


class CurrentUser(BaseModel):
    """Authenticated user extracted from Supabase JWT."""

    id: str
    email: str | None = None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> CurrentUser:
    """Validate Supabase JWT and return the current user.

    Supabase JWTs use HS256 with the project's JWT secret.
    The payload contains `sub` (user id) and `email`.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
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
