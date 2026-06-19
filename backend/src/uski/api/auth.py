"""Authentication API endpoints.

Flow:
1. Client sends email -> POST /api/auth/send-otp
   Supabase Auth generates a 6-digit code and sends it via Resend SMTP.
2. Client sends email + code -> POST /api/auth/verify-otp
   Supabase verifies the code and returns access + refresh tokens.
3. Client uses access token -> GET /api/auth/me
   Backend validates the JWT and returns user info.
4. Client logs out -> POST /api/auth/logout
"""

from fastapi import APIRouter, HTTPException, Query, Request, status, Depends
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from uski.core.config import settings
from uski.core.security import CurrentUser, get_current_user
import random

from uski.core.supabase import get_supabase_anon_client, get_supabase_client
from uski.schemas.auth import (
    AuthResponse,
    ChangeUsernameRequest,
    MessageResponse,
    RefreshRequest,
    SendOtpRequest,
    SetUsernameRequest,
    UserResponse,
    UsernameCheckResponse,
    VerifyOtpRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.rate_limit_storage_uri)


def _assign_username(svc_client, user_id: str, username: str, desired_disc: str | None = None) -> str:
    """Assign a username to a user, generating a free 4-digit discriminator.

    If `desired_disc` is given, try exactly that one (raises 409 if the
    username#discriminator combo is taken). Otherwise pick a random free one,
    retrying up to 10 times. Random (not sequential) so handles aren't guessable.

    Returns the assigned discriminator on success.
    """
    candidates = [desired_disc] if desired_disc else [f"{random.randint(0, 9999):04d}" for _ in range(10)]
    for discriminator in candidates:
        existing = (
            svc_client.table("user")
            .select("id")
            .eq("username", username)
            .eq("discriminator", discriminator)
            .execute()
        )
        if existing.data:
            continue  # taken

        result = (
            svc_client.table("user")
            .update({"username": username, "discriminator": discriminator})
            .eq("id", user_id)
            .execute()
        )
        if result.data:
            logger.info(f"Username assigned: {user_id} -> {username}#{discriminator}")
            return discriminator

    if desired_disc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{username}#{desired_disc} is already taken",
        )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to assign username after multiple attempts",
    )


@router.post("/send-otp", response_model=MessageResponse)
@limiter.limit(settings.RATE_LIMIT_SEND_OTP_IP)
async def send_otp(body: SendOtpRequest, request: Request) -> MessageResponse:
    """Send a 6-digit OTP code to the given email address.

    Supabase Auth handles code generation and email delivery (via Resend SMTP).
    The email is sent immediately and asynchronously by Supabase.
    """
    client = get_supabase_anon_client()

    try:
        client.auth.sign_in_with_otp({"email": body.email})
        logger.info(f"OTP sent to {body.email}")
    except Exception as exc:
        logger.error(f"Failed to send OTP to {body.email}: {exc}")

    return MessageResponse(
        message="If an account exists for this email, a verification code has been sent."
    )


@router.post("/verify-otp", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_VERIFY_OTP_IP)
async def verify_otp(body: VerifyOtpRequest, request: Request) -> AuthResponse:
    """Verify the 6-digit OTP code and return session tokens."""
    client = get_supabase_anon_client()

    try:
        response = client.auth.verify_otp(
            {
                "email": body.email,
                "token": body.token,
                "type": "email",
            }
        )
    except Exception as exc:
        logger.warning(f"OTP verification failed for {body.email}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code",
        )

    session = response.session
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Verification failed - no session returned",
        )

    user = response.user
    logger.info(f"User authenticated: {user.id} ({body.email})")

    # Check if user has set a username (first login detection)
    needs_username = True
    try:
        svc_client = get_supabase_client()
        user_row = (
            svc_client.table("user")
            .select("username")
            .eq("id", user.id)
            .execute()
        )
        if not user_row.data:
            needs_username = True
        elif user_row.data[0].get("username") is not None:
            needs_username = False
    except Exception as exc:
        logger.warning(f"Failed to check username for {user.id}: {exc}")

    return AuthResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        user_id=user.id,
        email=body.email,
        needs_username=needs_username,
    )


@router.post("/refresh", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_VERIFY_OTP_IP)
async def refresh_token(body: RefreshRequest, request: Request) -> AuthResponse:
    """Refresh an expired access token using a valid refresh token."""
    client = get_supabase_anon_client()

    try:
        response = client.auth.refresh_session(body.refresh_token)
    except Exception as exc:
        logger.warning(f"Token refresh failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    session = response.session
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh failed - no session returned",
        )

    user = response.user
    logger.info(f"Token refreshed for user {user.id}")

    # Check if user has set a username
    needs_username = True
    try:
        svc_client = get_supabase_client()
        user_row = (
            svc_client.table("user")
            .select("username")
            .eq("id", user.id)
            .execute()
        )
        if not user_row.data:
            needs_username = True
        elif user_row.data[0].get("username") is not None:
            needs_username = False
    except Exception as exc:
        logger.warning(f"Failed to check username for {user.id}: {exc}")

    return AuthResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        user_id=user.id,
        email=user.email,
        needs_username=needs_username,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
) -> UserResponse:
    """Return the currently authenticated user info (requires valid JWT)."""
    has_username = True
    username = None
    discriminator = None
    try:
        svc_client = get_supabase_client()
        user_row = (
            svc_client.table("user")
            .select("username, discriminator")
            .eq("id", current_user.id)
            .execute()
        )
        if user_row.data:
            row = user_row.data[0]
            username = row.get("username")
            discriminator = row.get("discriminator")
            if username is None:
                has_username = False
        else:
            has_username = False
    except Exception as exc:
        logger.warning(f"Failed to check username for /me {current_user.id}: {exc}")

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=username,
        discriminator=discriminator,
        has_username=has_username,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout() -> MessageResponse:
    """Logout endpoint. Client should discard tokens after calling this."""
    return MessageResponse(message="Logged out successfully. Please discard your tokens.")


@router.post("/set-username", response_model=UserResponse)
async def set_username(
    body: SetUsernameRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> UserResponse:
    """Set the username for the current user (first-time onboarding).

    Generates a random 4-digit discriminator. Retries up to 10 times
    if the username#discriminator combination is already taken.
    """
    svc_client = get_supabase_client()

    # Guard: prevent re-setting username
    existing_user = (
        svc_client.table("user")
        .select("username")
        .eq("id", current_user.id)
        .execute()
    )
    if existing_user.data and existing_user.data[0].get("username") is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already set",
        )

    discriminator = _assign_username(svc_client, current_user.id, body.username, body.discriminator)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=body.username,
        discriminator=discriminator,
        has_username=True,
    )


@router.patch("/username", response_model=UserResponse)
async def change_username(
    body: ChangeUsernameRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> UserResponse:
    """Update the current user's username (allowed even when one is already set).

    Unlike set_username (onboarding), this performs an UPDATE regardless of
    whether the user already has a username, so there is no 409 conflict.
    Generates a fresh 4-digit discriminator and retries on collision via the
    shared _assign_username helper.
    """
    svc_client = get_supabase_client()

    discriminator = _assign_username(svc_client, current_user.id, body.username, body.discriminator)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=body.username,
        discriminator=discriminator,
        has_username=True,
    )


@router.get("/check-username", response_model=UsernameCheckResponse)
async def check_username(
    username: str = Query(
        ...,
        min_length=3,
        max_length=20,
        pattern=r"^[a-z0-9]+$",
        description="Lowercase alphanumeric username to check",
    ),
    current_user: CurrentUser = Depends(get_current_user),
) -> UsernameCheckResponse:
    """Check if a username is available.

    Note: Usernames are NOT unique by themselves - only the
    username#discriminator combo is unique. This endpoint checks
    if ANY user has this username (to give a sense of availability).
    """
    svc_client = get_supabase_client()

    existing = (
        svc_client.table("user")
        .select("id")
        .eq("username", username)
        .execute()
    )

    return UsernameCheckResponse(
        available=len(existing.data) == 0,
        username=username,
    )
