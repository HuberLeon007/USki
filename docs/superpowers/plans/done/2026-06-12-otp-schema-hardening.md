# OTP Schema Hardening Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the 6-digit OTP token validation so only exactly 6 numeric digits are accepted, with comprehensive edge-case tests.

**Architecture:** Add Pydantic Field constraints (min_length=6, max_length=6, regex pattern) to VerifyOtpRequest.token. Add 6 new tests covering invalid formats (too short, too long, non-numeric, mixed, empty) and valid format.

**Tech Stack:** FastAPI, Pydantic v2, pytest

---

## Current State

VerifyOtpRequest.token currently accepts any string:
```python
class VerifyOtpRequest(BaseModel):
    email: EmailStr
    token: str  # No validation!
```

This means abc, 12, 1234567890 all pass schema validation.

---

## Task 1: Add 6-Digit Validation to Token Schema

**Files:**
- Modify: backend/src/uski/schemas/auth.py

### Step 1: Update VerifyOtpRequest

Replace the VerifyOtpRequest class in backend/src/uski/schemas/auth.py:

```python
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
```

Make sure Field is imported:
```python
from pydantic import BaseModel, EmailStr, Field
```

The full file should become:

```python
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
```

### Step 2: Verify import works

Run: cd backend && uv run python -c "from uski.schemas.auth import VerifyOtpRequest; print('OK')"
Expected: OK

### Step 3: Commit

```bash
git add backend/src/uski/schemas/auth.py
git commit -m "feat: add 6-digit regex validation to OTP token schema"
```

---

## Task 2: Add Edge-Case Tests

**Files:**
- Modify: backend/tests/test_auth.py

### Step 1: Add TestVerifyOtpValidation class

Append this class at the end of backend/tests/test_auth.py:

```python
class TestVerifyOtpValidation:
    """Test 6-digit code format validation."""

    def test_code_too_short_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": "12345"},
        )
        assert response.status_code == 422

    def test_code_too_long_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": "1234567"},
        )
        assert response.status_code == 422

    def test_code_non_numeric_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": "abcdef"},
        )
        assert response.status_code == 422

    def test_code_mixed_alpha_numeric_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": "12345a"},
        )
        assert response.status_code == 422

    def test_code_empty_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": ""},
        )
        assert response.status_code == 422

    def test_exactly_6_digits_accepted(self, client):
        """Valid format should reach Supabase mock and succeed."""
        with patch("uski.api.auth.create_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_session = MagicMock()
            mock_session.access_token = "test-token"
            mock_session.refresh_token = "test-refresh"
            mock_user = MagicMock()
            mock_user.id = "user-789"
            mock_response = MagicMock()
            mock_response.session = mock_session
            mock_response.user = mock_user
            mock_client.auth.verify_otp.return_value = mock_response
            response = client.post(
                "/api/auth/verify-otp",
                json={"email": "test@example.com", "token": "654321"},
            )
        assert response.status_code == 200
        assert response.json()["access_token"] == "test-token"
```

### Step 2: Run all auth tests

Run: cd backend && uv run pytest tests/test_auth.py -v
Expected: All 17 tests PASS (11 existing + 6 new).

### Step 3: Commit

```bash
git add backend/tests/test_auth.py
git commit -m "test: add OTP token validation edge-case tests"
```

---

## Execution Summary

| Task | Description | Dependencies |
|---|---|---|
| 1 | Add 6-digit validation to schema | None |
| 2 | Add edge-case tests | Task 1 |

