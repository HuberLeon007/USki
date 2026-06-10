import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
from fastapi.testclient import TestClient
from jose import jwt
from jose.constants import Algorithms

from uski.main import app


# ---------------------------------------------------------------------------
# Generate an RSA key pair once per session for signing and verifying test tokens.
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def rsa_keys():
    """Return (private_pem_str, public_jwk_dict) for RS256 test tokens."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    public_key = private_key.public_key()

    # Serialize private key to PEM
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    # Build JWK from public key
    public_numbers = public_key.public_numbers()
    jwk = {
        "kty": "RSA",
        "kid": "test-kid-001",
        "n": _int_to_base64url(public_numbers.n),
        "e": _int_to_base64url(public_numbers.e),
        "alg": "RS256",
        "use": "sig",
    }

    return private_pem, jwk


def _int_to_base64url(value: int) -> str:
    """Encode an integer as base64url (no padding) for JWK 'n' and 'e' fields."""
    import base64

    byte_len = (value.bit_length() + 7) // 8
    value_bytes = value.to_bytes(byte_len, byteorder="big")
    return base64.urlsafe_b64encode(value_bytes).rstrip(b"=").decode()


# ---------------------------------------------------------------------------
# Mocked JWKS endpoint that returns our test public key.
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def mock_jwks(rsa_keys):
    """Mock _fetch_jwks so we never call out to Supabase during tests."""
    _, public_jwk = rsa_keys
    jwks_response = {"keys": [public_jwk]}
    with patch("uski.core.security._fetch_jwks", return_value=jwks_response):
        yield


# ---------------------------------------------------------------------------
# Helper to create RS256-signed test tokens.
# ---------------------------------------------------------------------------
@pytest.fixture
def make_token(rsa_keys):
    """Return a factory that creates valid RS256 JWT test tokens."""
    private_pem, _ = rsa_keys
    supabase_url = os.environ["SUPABASE_URL"]

    def _make(payload: dict | None = None) -> str:
        defaults = {
            "sub": "user-456",
            "email": "me@example.com",
            "aud": "authenticated",
            "iss": f"{supabase_url}/auth/v1",
        }
        if payload:
            defaults.update(payload)
        return jwt.encode(
            defaults,
            private_pem,
            algorithm=Algorithms.RS256,
            headers={"kid": "test-kid-001"},
        )

    return _make


# ---------------------------------------------------------------------------
# TestClient fixture.
# ---------------------------------------------------------------------------
@pytest.fixture
def client():
    return TestClient(app)
