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

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, status, Depends
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from uski.core.config import settings
from uski.core.security import CurrentUser, get_current_user
import json
import random

from uski.core.supabase import get_supabase_anon_client, get_supabase_client
from uski.schemas.auth import (
    AuthResponse,
    ChangeUsernameRequest,
    MessageResponse,
    MockSocialRequest,
    LinkApproveRequest,
    PasskeyInfo,
    PasskeyLoginVerify,
    PasskeyRegisterVerify,
    RefreshRequest,
    RevokeOthersRequest,
    SendOtpRequest,
    SessionInfo,
    SetUsernameRequest,
    TwoFactorRequest,
    TwoFactorResponse,
    TotpStatusResponse,
    TotpSetupResponse,
    TotpCodeRequest,
    TwoFactorChallengeVerify,
    UserResponse,
    UsernameCheckResponse,
    VerifyOtpRequest,
)
from uski.services.auth_identity import (
    ProviderIdentity,
    SupabaseAccountStore,
    requires_onboarding,
    resolve_account,
)
from uski.services import passkeys as passkeys_svc
from uski.services import device_link
from uski.services import totp as totp_svc
from uski.services import two_factor_challenge as tfc_svc
from uski.services.sessions import (
    device_from_user_agent,
    geolocate,
    list_sessions,
    location_label,
    record_login,
    revoke_other_sessions,
    revoke_session,
)
from uski.services.email import notify_login
from uski.services.mock_identity import (
    MockIdentity,
    get_mock_identity,
    mock_identity_to_profile,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.rate_limit_storage_uri)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    """Best-effort (client IP, user-agent) for session/device tracking.

    Honors X-Forwarded-For (the app sits behind the Vite dev proxy / a reverse
    proxy in prod), falling back to the direct peer address.
    """
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)
    return ip, request.headers.get("user-agent")


def _capture_login(
    user_id: str,
    email: str | None,
    refresh_token: str,
    request: Request,
    background: BackgroundTasks,
) -> None:
    """Record the device/session and schedule welcome + login-alert emails.

    Geolocation is resolved once and shared between the session row and the
    email. Email sending runs in the background so it never slows the login.
    """
    ip, ua = _client_meta(request)
    geo = geolocate(ip)
    record_login(user_id, refresh_token, ip, ua, geo=geo)
    device = device_from_user_agent(ua)
    location = location_label(geo, ip)
    background.add_task(notify_login, email, None, device, location)


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


def _two_factor_enabled(user_id: str) -> bool:
    """True if the account has app-based TOTP active (the login second factor)."""
    try:
        row = get_supabase_client().table("user").select("totp_enabled").eq("id", user_id).execute()
        return bool(row.data and row.data[0].get("totp_enabled"))
    except Exception:  # noqa: BLE001 - a lookup failure must not hard-block login
        return False


def _gate_two_factor(resp: AuthResponse) -> AuthResponse:
    """Withhold tokens behind a TOTP challenge when the account requires it.

    Grace by design: accounts without TOTP enabled pass straight through, so
    enabling enforcement never locks anyone out. Passkey and device-link logins
    do not call this — a passkey is already a strong factor.
    """
    if not resp.user_id or not _two_factor_enabled(resp.user_id):
        return resp
    challenge = tfc_svc.create(
        resp.user_id, resp.email, resp.access_token, resp.refresh_token, resp.needs_username
    )
    return AuthResponse(
        email=resp.email,
        needs_username=resp.needs_username,
        two_factor_required=True,
        challenge=challenge,
    )


@router.post("/verify-otp", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_VERIFY_OTP_IP)
async def verify_otp(body: VerifyOtpRequest, request: Request, background: BackgroundTasks) -> AuthResponse:
    """Verify the 6-digit OTP code and return session tokens (or a 2FA challenge)."""
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

    # Record this login (device/session + welcome/login-alert emails).
    _capture_login(user.id, body.email, session.refresh_token, request, background)

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

    return _gate_two_factor(
        AuthResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            user_id=user.id,
            email=body.email,
            needs_username=needs_username,
        )
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
    two_factor_email = False
    try:
        svc_client = get_supabase_client()
        user_row = (
            svc_client.table("user")
            .select("username, discriminator, two_factor_email")
            .eq("id", current_user.id)
            .execute()
        )
        if user_row.data:
            row = user_row.data[0]
            username = row.get("username")
            discriminator = row.get("discriminator")
            two_factor_email = bool(row.get("two_factor_email") or False)
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
        two_factor_email=two_factor_email,
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


# ──────────────────────────────────────────────────────────────────────────
# Email-OTP second factor (2FA) — opt-in per-user preference flag
# ──────────────────────────────────────────────────────────────────────────
#
# This is intentionally a thin flag store. The actual second-factor code
# delivery and verification at login time reuse the existing send-otp /
# verify-otp pair, driven by the frontend. The backend only persists and
# exposes the user's preference; it does not introduce a new email transport.


@router.get("/2fa", response_model=TwoFactorResponse)
async def get_two_factor(
    current_user: CurrentUser = Depends(get_current_user),
) -> TwoFactorResponse:
    """Return whether the email-OTP second factor is enabled for the user."""
    svc_client = get_supabase_client()

    user_row = (
        svc_client.table("user")
        .select("two_factor_email")
        .eq("id", current_user.id)
        .execute()
    )
    enabled = False
    if user_row.data:
        enabled = bool(user_row.data[0].get("two_factor_email") or False)

    return TwoFactorResponse(enabled=enabled)


@router.patch("/2fa", response_model=TwoFactorResponse)
async def set_two_factor(
    body: TwoFactorRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> TwoFactorResponse:
    """Enable or disable the email-OTP second factor for the current user."""
    svc_client = get_supabase_client()

    result = (
        svc_client.table("user")
        .update({"two_factor_email": body.enabled})
        .eq("id", current_user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    logger.info(f"2FA email preference updated: {current_user.id} -> {body.enabled}")
    return TwoFactorResponse(enabled=bool(result.data[0].get("two_factor_email") or False))


# ──────────────────────────────────────────────────────────────────────────
# App-based TOTP second factor (authenticator apps)
# ──────────────────────────────────────────────────────────────────────────


@router.get("/2fa/totp", response_model=TotpStatusResponse)
async def get_totp_status(
    current_user: CurrentUser = Depends(get_current_user),
) -> TotpStatusResponse:
    """Whether TOTP is active, and whether an unconfirmed setup is pending."""
    row = (
        get_supabase_client()
        .table("user")
        .select("totp_enabled, totp_secret")
        .eq("id", current_user.id)
        .execute()
    )
    enabled = False
    pending = False
    if row.data:
        enabled = bool(row.data[0].get("totp_enabled") or False)
        pending = bool(row.data[0].get("totp_secret")) and not enabled
    return TotpStatusResponse(enabled=enabled, pending=pending)


@router.post("/2fa/totp/setup", response_model=TotpSetupResponse)
async def setup_totp(
    current_user: CurrentUser = Depends(get_current_user),
) -> TotpSetupResponse:
    """Begin TOTP enrollment: mint a secret and return its provisioning URI.

    The secret is stored but stays inactive until a code is verified, so an
    abandoned setup never affects login.
    """
    svc = get_supabase_client()
    existing = (
        svc.table("user").select("totp_enabled").eq("id", current_user.id).execute()
    )
    if existing.data and bool(existing.data[0].get("totp_enabled")):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="TOTP is already enabled.")

    secret = totp_svc.generate_secret()
    svc.table("user").update({"totp_secret": secret, "totp_enabled": False}).eq(
        "id", current_user.id
    ).execute()
    uri = totp_svc.provisioning_uri(secret, current_user.email)
    return TotpSetupResponse(secret=secret, otpauth_uri=uri)


@router.post("/2fa/totp/verify", response_model=TotpStatusResponse)
async def verify_totp(
    body: TotpCodeRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> TotpStatusResponse:
    """Confirm enrollment by checking a code against the pending secret."""
    svc = get_supabase_client()
    row = svc.table("user").select("totp_secret").eq("id", current_user.id).execute()
    secret = row.data[0].get("totp_secret") if row.data else None
    if not secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start TOTP setup first.")
    if not totp_svc.verify_code(secret, body.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code didn't match. Try the current one.")
    svc.table("user").update({"totp_enabled": True}).eq("id", current_user.id).execute()
    logger.info(f"TOTP enabled for {current_user.id}")
    return TotpStatusResponse(enabled=True, pending=False)


@router.post("/2fa/totp/disable", response_model=TotpStatusResponse)
async def disable_totp(
    body: TotpCodeRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> TotpStatusResponse:
    """Turn TOTP off. Requires a valid current code to prove possession."""
    svc = get_supabase_client()
    row = svc.table("user").select("totp_secret, totp_enabled").eq("id", current_user.id).execute()
    if not row.data or not bool(row.data[0].get("totp_enabled")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="TOTP is not enabled.")
    if not totp_svc.verify_code(row.data[0].get("totp_secret"), body.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code didn't match. Try the current one.")
    svc.table("user").update({"totp_secret": None, "totp_enabled": False}).eq(
        "id", current_user.id
    ).execute()
    logger.info(f"TOTP disabled for {current_user.id}")
    return TotpStatusResponse(enabled=False, pending=False)


@router.post("/2fa/challenge/verify", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_VERIFY_OTP_IP)
async def verify_two_factor_challenge(body: TwoFactorChallengeVerify, request: Request) -> AuthResponse:
    """Finish a TOTP-gated login: check the code against the parked challenge.

    On success the parked session is released (and the challenge consumed). A
    wrong code leaves the challenge intact so the user can retry until it
    expires.
    """
    row = tfc_svc.peek(body.challenge)
    if not row or tfc_svc.is_expired(row.get("created_at")):
        if row:
            tfc_svc.delete(body.challenge)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This sign-in request expired. Start over.",
        )

    secret_row = (
        get_supabase_client().table("user").select("totp_secret, totp_enabled").eq("id", row["user_id"]).execute()
    )
    secret = secret_row.data[0].get("totp_secret") if secret_row.data else None
    if not totp_svc.verify_code(secret, body.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="That code didn't match. Enter the current one from your app.",
        )

    tfc_svc.delete(body.challenge)
    return AuthResponse(
        access_token=row["access_token"],
        refresh_token=row["refresh_token"],
        user_id=row["user_id"],
        email=row.get("email"),
        needs_username=bool(row.get("needs_username")),
    )


# ──────────────────────────────────────────────────────────────────────────
# Device / session history (Security settings)
# ──────────────────────────────────────────────────────────────────────────


@router.get("/sessions", response_model=list[SessionInfo])
async def get_sessions(
    current_key: str = Query("", description="SHA-256 of the caller's refresh token"),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[SessionInfo]:
    """List the user's logged-in devices, marking the caller's current one."""
    rows = list_sessions(current_user.id)
    return [
        SessionInfo(
            id=row["id"],
            device=row.get("device"),
            ip=row.get("ip"),
            city=row.get("city"),
            country=row.get("country"),
            lat=row.get("lat"),
            lon=row.get("lon"),
            created_at=row.get("created_at"),
            last_seen_at=row.get("last_seen_at"),
            current=bool(current_key) and row.get("session_key") == current_key,
        )
        for row in rows
    ]


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def delete_session(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> MessageResponse:
    """Sign out a single device by removing its session row."""
    revoke_session(current_user.id, session_id)
    return MessageResponse(message="Device signed out.")


@router.post("/sessions/revoke-others", response_model=MessageResponse)
async def revoke_other_sessions_endpoint(
    body: RevokeOthersRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> MessageResponse:
    """Sign out every device except the caller's current one."""
    removed = revoke_other_sessions(current_user.id, body.current_key)
    return MessageResponse(message=f"Signed out {removed} other device(s).")


# ──────────────────────────────────────────────────────────────────────────
# Passkeys / WebAuthn
# ──────────────────────────────────────────────────────────────────────────


@router.post("/passkeys/register/options")
async def passkey_register_options(current_user: CurrentUser = Depends(get_current_user)) -> dict:
    """Begin passkey registration: options for navigator.credentials.create()."""
    name = current_user.email or current_user.id
    return json.loads(passkeys_svc.registration_options(current_user.id, name))


@router.post("/passkeys/register/verify", response_model=PasskeyInfo)
async def passkey_register_verify(
    body: PasskeyRegisterVerify,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> PasskeyInfo:
    """Finish passkey registration: verify attestation and store the credential."""
    # Prefer the origin baked into the credential (works for web AND native, where
    # there is no browser Origin header); fall back to the header for old clients.
    origin = passkeys_svc.origin_from_credential(json.dumps(body.credential)) or request.headers.get("origin")
    if not passkeys_svc.origin_allowed(origin):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Untrusted origin")
    try:
        row = passkeys_svc.verify_registration(
            current_user.id, json.dumps(body.credential), origin, body.name
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("passkey registration failed for {}: {}", current_user.id, exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey registration failed")
    return PasskeyInfo(id=row["id"], name=row.get("name"), created_at=row.get("created_at"))


@router.get("/passkeys", response_model=list[PasskeyInfo])
async def passkey_list(current_user: CurrentUser = Depends(get_current_user)) -> list[PasskeyInfo]:
    """List the user's registered passkeys."""
    return [
        PasskeyInfo(
            id=c["id"],
            name=c.get("name"),
            created_at=c.get("created_at"),
            last_used_at=c.get("last_used_at"),
        )
        for c in passkeys_svc.list_credentials(current_user.id)
    ]


@router.delete("/passkeys/{cred_id}", response_model=MessageResponse)
async def passkey_delete(
    cred_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> MessageResponse:
    """Remove one of the user's passkeys."""
    passkeys_svc.delete_credential(current_user.id, cred_id)
    return MessageResponse(message="Passkey removed.")


@router.post("/passkeys/login/options")
async def passkey_login_options() -> dict:
    """Begin discoverable passkey login: options + a handle to echo back."""
    options_json, handle = passkeys_svc.authentication_options()
    return {"options": json.loads(options_json), "handle": handle}


@router.post("/passkeys/login/verify", response_model=AuthResponse)
async def passkey_login_verify(
    body: PasskeyLoginVerify,
    request: Request,
    background: BackgroundTasks,
) -> AuthResponse:
    """Finish passkey login: verify the assertion and mint a real session."""
    origin = passkeys_svc.origin_from_credential(json.dumps(body.credential)) or request.headers.get("origin")
    if not passkeys_svc.origin_allowed(origin):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Untrusted origin")

    user_id = passkeys_svc.verify_authentication(body.handle, json.dumps(body.credential), origin)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Passkey authentication failed")

    svc = get_supabase_client()
    row = svc.table("user").select("email, username").eq("id", user_id).execute()
    if not row.data or not row.data[0].get("email"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account has no email to sign in with")
    email = row.data[0]["email"]
    needs_username = row.data[0].get("username") is None

    access_token, refresh_token, uid = _mint_local_session(svc, get_supabase_anon_client(), email)
    _capture_login(uid, email, refresh_token, request, background)
    logger.info("passkey login: session minted for {}", email)
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=uid,
        email=email,
        needs_username=needs_username,
    )


# ──────────────────────────────────────────────────────────────────────────
# Cross-device sign-in (QR / device link)
# ──────────────────────────────────────────────────────────────────────────


@router.post("/link/start")
async def link_start() -> dict:
    """A signed-out device starts a link request; returns the code for its QR."""
    return {"code": device_link.start()}


@router.get("/link/poll")
async def link_poll(code: str = Query(...)) -> dict:
    """The signed-out device polls; once approved it claims the session (once)."""
    return device_link.claim(code)


@router.post("/link/approve", response_model=MessageResponse)
async def link_approve(
    body: LinkApproveRequest,
    request: Request,
    background: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
) -> MessageResponse:
    """An already-signed-in device approves the link, minting a fresh session."""
    svc = get_supabase_client()
    row = svc.table("user").select("email, username").eq("id", current_user.id).execute()
    email = (row.data[0].get("email") if row.data else None) or current_user.email
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account has no email")
    needs_username = bool(row.data and row.data[0].get("username") is None)

    access_token, refresh_token, uid = _mint_local_session(svc, get_supabase_anon_client(), email)
    if not device_link.approve(body.code, uid, email, access_token, refresh_token, needs_username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This sign-in request is invalid or expired")
    _capture_login(uid, email, refresh_token, request, background)
    return MessageResponse(message="Device approved. It will sign in shortly.")


# ──────────────────────────────────────────────────────────────────────────
# Dev-only offline Mock_Social_Login (social-login, Requirement 5, 6.5, 7.5)
# ──────────────────────────────────────────────────────────────────────────
#
# This endpoint is the backend half of the dev-offline experience. It mints a
# GENUINE local Supabase session for a per-provider Mock_Identity and returns
# the exact same canonical AuthResponse the OTP path produces, so a mock
# session is indistinguishable from a real one everywhere past the seam
# (tokenStorage, apiFetch, auth-context, and the unchanged security.py JWT
# validation).
#
# It contacts ONLY the local Supabase instance and never any external Provider
# (Google/GitHub/Discord) — Requirement 5.2.
#
# Production guard (Requirement 7.5): the route is REGISTERED only when
# APP_MODE == "dev". In prod it does not exist, so the mock path can never be
# invoked there, and the frontend never selects the mock adapter outside dev.


def _ensure_mock_auth_user(admin, identity: MockIdentity, profile: dict) -> None:
    """Idempotently ensure a confirmed local auth user exists for the mock email.

    Attaches provider-mimicking metadata (display name, avatar, provider) so the
    minted session surfaces the same Profile/Session fields a real social
    session would fill (Requirement 6.5). If the user already exists, the create
    call fails harmlessly and the existing user is left untouched — this is the
    expected path for repeat logins and for the email-linking case (the google
    Mock_Identity reuses an existing dev account email, Requirement 5.4).
    """
    attributes = {
        "email": identity.email,
        "email_confirm": True,
        "user_metadata": {
            "full_name": profile["display_name"],
            "name": profile["display_name"],
            "avatar_url": profile["avatar_url"],
            "provider": identity.provider,
        },
        "app_metadata": {
            "provider": identity.provider,
            "providers": [identity.provider],
        },
    }
    try:
        admin.auth.admin.create_user(attributes)
        logger.info("mock-social: created auth user for {}", identity.email)
    except Exception as exc:  # noqa: BLE001 - existing user is expected, not fatal
        logger.debug(
            "mock-social: create_user skipped for {} (likely already exists): {}",
            identity.email,
            exc,
        )


def _mint_local_session(admin, anon, email: str) -> tuple[str, str, str]:
    """Mint a genuine local Supabase session for ``email`` with zero external calls.

    Uses the local Supabase admin (service-role) API to generate a magiclink
    OTP for the email, then immediately verifies that OTP server-side with the
    anon client to obtain a real ``access_token`` / ``refresh_token`` pair. The
    resulting JWT is issued by the local GoTrue exactly like an OTP login, so it
    validates through the unchanged JWKS path in security.py.

    Returns ``(access_token, refresh_token, user_id)``.
    """
    link = admin.auth.admin.generate_link({"type": "magiclink", "email": email})
    email_otp = link.properties.email_otp

    result = anon.auth.verify_otp(
        {"email": email, "token": email_otp, "type": "magiclink"}
    )
    session = result.session
    if not session or not result.user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Mock session minting failed - no session returned",
        )
    return session.access_token, session.refresh_token, result.user.id


def _mock_social_login(body: MockSocialRequest) -> AuthResponse:
    """Resolve a Mock_Identity, mint a local session, and link/onboard the account.

    Builds the canonical ``AuthResponse`` by reusing the same account resolution
    (``resolve_account``) and onboarding gate (``requires_onboarding``) the real
    social path uses, so email-based linking (Requirement 5.4) and new-user
    onboarding (Requirement 5.5) behave identically to OTP.
    """
    provider = body.provider
    identity = get_mock_identity(provider)
    profile = mock_identity_to_profile(identity)

    admin = get_supabase_client()
    anon = get_supabase_anon_client()

    # 1. Ensure the local auth user exists (carrying provider metadata).
    _ensure_mock_auth_user(admin, identity, profile)

    # 2. Mint a genuine local Supabase session (no external Provider call).
    access_token, refresh_token, user_id = _mint_local_session(
        admin, anon, identity.email
    )

    # 3. Resolve to exactly one account (link existing or create + onboard new),
    #    pinning the profile row to the auth.users id.
    resolution = resolve_account(
        SupabaseAccountStore(),
        ProviderIdentity(
            provider=provider,
            email=identity.email,
            provider_account_ref=user_id,
        ),
        account_id=user_id,
    )
    needs_username = requires_onboarding(resolution.account)

    logger.info(
        "mock-social: session minted for {} ({}) needs_username={}",
        provider,
        identity.email,
        needs_username,
    )

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_id,
        email=identity.email,
        needs_username=needs_username,
    )


# Register the dev-only route ONLY under APP_MODE=dev. Registering conditionally
# is the production guard: in prod the route simply does not exist, so the mock
# path can never be invoked (the frontend MockSocialAdapter would receive a 404,
# but the frontend never selects it outside dev anyway).
if settings.is_dev:

    @router.post("/dev/mock-social", response_model=AuthResponse)
    async def mock_social_login(body: MockSocialRequest, request: Request, background: BackgroundTasks) -> AuthResponse:
        """Mint an offline development session for the provider's Mock_Identity.

        Dev-only. Contacts only the local Supabase instance, never an external
        Provider. Returns the canonical ``AuthResponse`` shared with OTP login.
        """
        resp = _mock_social_login(body)
        _capture_login(resp.user_id, resp.email, resp.refresh_token, request, background)
        return _gate_two_factor(resp)

    logger.info("mock-social: dev-only endpoint POST /api/auth/dev/mock-social registered")
