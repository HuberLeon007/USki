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

from fastapi import APIRouter, HTTPException, Request, status, Depends
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from uski.core.config import settings
from uski.core.security import CurrentUser, get_current_user
from uski.core.supabase import get_supabase_anon_client
from uski.schemas.auth import (
    AuthResponse,
    MessageResponse,
    SendOtpRequest,
    UserResponse,
    VerifyOtpRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.rate_limit_storage_uri)


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

    return AuthResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        user_id=user.id,
        email=body.email,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
) -> UserResponse:
    """Return the currently authenticated user info (requires valid JWT)."""
    return UserResponse(id=current_user.id, email=current_user.email)


@router.post("/logout", response_model=MessageResponse)
async def logout() -> MessageResponse:
    """Logout endpoint. Client should discard tokens after calling this."""
    return MessageResponse(message="Logged out successfully. Please discard your tokens.")
