"""Auth request/response schemas."""

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
    """Response after successful OTP verification."""

    access_token: str
    refresh_token: str
    user_id: str
    email: str | None = None
    needs_username: bool = False


class UserResponse(BaseModel):
    """Current user info."""

    id: str
    email: str | None = None
    username: str | None = None
    discriminator: str | None = None
    has_username: bool = False


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
