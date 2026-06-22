"""App-based TOTP second factor (authenticator apps).

The decision-carrying logic is pure and dependency-light so it can be tested
without a database: generate a secret, build the otpauth:// provisioning URI a
QR code is rendered from, and verify a 6-digit code with a small clock-skew
window. The DB read/write lives in the auth router, which is the thin adapter.
"""

from __future__ import annotations

import pyotp

ISSUER = "USki"

# Accept codes from the adjacent 30s windows so a small clock drift between the
# phone and server does not reject a freshly generated code.
_VALID_WINDOW = 1


def generate_secret() -> str:
    """A fresh Base32 TOTP secret to share with the authenticator app."""
    return pyotp.random_base32()


def provisioning_uri(secret: str, account: str | None) -> str:
    """otpauth:// URI encoded into the QR the user scans during setup."""
    label = account or "account"
    return pyotp.TOTP(secret).provisioning_uri(name=label, issuer_name=ISSUER)


def verify_code(secret: str | None, code: str | None) -> bool:
    """True if `code` is a valid current TOTP for `secret` (with skew window)."""
    if not secret or not code:
        return False
    cleaned = code.strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != 6:
        return False
    try:
        return pyotp.TOTP(secret).verify(cleaned, valid_window=_VALID_WINDOW)
    except Exception:
        return False
