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


class UserResponse(BaseModel):
    """Current user info."""

    id: str
    email: str | None = None


class MessageResponse(BaseModel):
    """Generic message response."""

    message: str
