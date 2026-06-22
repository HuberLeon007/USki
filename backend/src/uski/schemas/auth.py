"""Auth request/response schemas."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class SendOtpRequest(BaseModel):
    """Request to send a 6-digit OTP code to the given email."""

    email: EmailStr


class VerifyOtpRequest(BaseModel):
    """Request to verify the 6-digit OTP code."""

    email: EmailStr
    token: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="The 6-digit verification code from the email",
        examples=["123456"],
    )


class AuthResponse(BaseModel):
    """Response after successful authentication.

    When the account has TOTP enabled, the first factor returns
    ``two_factor_required=True`` plus a ``challenge`` id and withholds the
    tokens until the TOTP code is verified via ``/2fa/challenge/verify``.
    """

    access_token: str = ""
    refresh_token: str = ""
    user_id: str = ""
    email: str | None = None
    needs_username: bool = False
    two_factor_required: bool = False
    challenge: str | None = None


class TwoFactorChallengeVerify(BaseModel):
    """Finish a TOTP-gated login: the parked challenge id + a 6-digit code."""

    challenge: str
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$", examples=["123456"])


class UserResponse(BaseModel):
    """Current user info."""

    id: str
    email: str | None = None
    username: str | None = None
    discriminator: str | None = None
    has_username: bool = False
    two_factor_email: bool = False


class TwoFactorRequest(BaseModel):
    """Request to toggle the opt-in email-OTP second factor."""

    enabled: bool = Field(
        ...,
        description="Whether the email-OTP second factor is enabled for the account",
    )


class TwoFactorResponse(BaseModel):
    """Current state of the opt-in email-OTP second factor."""

    enabled: bool


class TotpStatusResponse(BaseModel):
    """Whether app-based TOTP is active, and whether a setup is mid-flight."""

    enabled: bool
    pending: bool = False


class TotpSetupResponse(BaseModel):
    """Secret + otpauth URI for rendering the enrollment QR code."""

    secret: str
    otpauth_uri: str


class TotpCodeRequest(BaseModel):
    """A 6-digit code from the authenticator app."""

    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$", examples=["123456"])


class SessionInfo(BaseModel):
    """One device/login session for the Security settings list."""

    id: str
    device: str | None = None
    ip: str | None = None
    city: str | None = None
    country: str | None = None
    lat: float | None = None
    lon: float | None = None
    created_at: str | None = None
    last_seen_at: str | None = None
    current: bool = False


class RevokeOthersRequest(BaseModel):
    """Sign out all sessions except the caller's current one."""

    current_key: str = Field(..., description="SHA-256 of the caller's refresh token")


class PasskeyInfo(BaseModel):
    """A registered passkey for the management list."""

    id: str
    name: str | None = None
    created_at: str | None = None
    last_used_at: str | None = None


class PasskeyRegisterVerify(BaseModel):
    """Browser attestation response for finishing passkey registration."""

    credential: dict
    name: str | None = None


class PasskeyLoginVerify(BaseModel):
    """Browser assertion response for finishing passkey login."""

    handle: str
    credential: dict


class LinkApproveRequest(BaseModel):
    """Approve a cross-device sign-in by its QR code."""

    code: str


class MessageResponse(BaseModel):
    """Generic message response."""

    message: str


class SetUsernameRequest(BaseModel):
    """Request to set username during onboarding."""

    username: str = Field(
        ...,
        min_length=3,
        max_length=20,
        pattern=r"^[a-z0-9]+$",
        description="Lowercase alphanumeric username, 3-20 characters",
        examples=["leonhuber"],
    )
    discriminator: str | None = Field(
        default=None,
        pattern=r"^\d{4}$",
        description="Optional desired 4-digit discriminator; random if omitted",
    )


class ChangeUsernameRequest(BaseModel):
    """Request to change an existing username (Settings)."""

    username: str = Field(
        ...,
        min_length=3,
        max_length=20,
        pattern=r"^[a-z0-9]+$",
        description="Lowercase alphanumeric username, 3-20 characters",
        examples=["leonhuber"],
    )
    discriminator: str | None = Field(
        default=None,
        pattern=r"^\d{4}$",
        description="Optional desired 4-digit discriminator; random if omitted",
    )


class UsernameCheckResponse(BaseModel):
    """Response for username availability check."""

    available: bool
    username: str


class RefreshRequest(BaseModel):
    """Request to refresh an expired access token."""

    refresh_token: str = Field(
        ...,
        description="The refresh token from the original login",
    )


class RecordSessionRequest(BaseModel):
    """Record a device/session for a login that completed client-side.

    OTP and passkey logins are recorded server-side already; social OAuth runs
    entirely through Supabase on the client, so the app/web posts the resulting
    refresh token here once so the device appears in Security with IP + map.
    """

    refresh_token: str = Field(..., description="The refresh token of the freshly installed session")


class MockSocialRequest(BaseModel):
    """Request to mint an offline development session for a Mock_Identity.

    Used only by the dev-only ``POST /api/auth/dev/mock-social`` endpoint. The
    provider selects which per-provider Mock_Identity is resolved; no external
    Provider is ever contacted (Requirement 5.1, 5.2).
    """

    provider: Literal["google", "github", "discord"] = Field(
        ...,
        description="The social provider whose Mock_Identity to sign in as",
        examples=["google"],
    )
