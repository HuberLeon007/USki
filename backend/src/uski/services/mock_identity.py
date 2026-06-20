"""Dev-only Mock_Identity seed set and profile mapping (social-login).

This module provides the synthetic per-provider identities used by the offline
Mock_Social_Login path. It is development-only: it is never reachable in a
production process because the endpoint is registered only under
``APP_MODE=dev`` and the frontend mock adapter is dropped from prod builds.

Each Provider (google, github, discord) has exactly one Mock_Identity carrying a
``provider`` name, an ``email`` (the account-linking key), a ``display_name``,
and a non-empty ``avatar_placeholder`` (Requirement 6.1-6.4, 6.6).

The seed set deliberately mixes two linking outcomes:

- ``google`` uses ``leon@uski.dev``, the email of the canonical existing dev
  account, so the mock login exercises email-based Account_Linking
  (Requirement 5.4). Treat this address as the "matches an existing account"
  case in local dev seeds.
- ``github`` and ``discord`` use fresh addresses (``octocat-dev@uski.dev`` and
  ``mockingbird-dev@uski.dev``) that match no existing account, so the mock
  login exercises new-user onboarding with ``needs_username`` (Requirement 5.5).
"""

from pydantic import BaseModel, Field

from uski.services.username import derive_username_from_email

# The three supported providers, in the canonical fixed order.
PROVIDERS: tuple[str, ...] = ("google", "github", "discord")


class MockIdentity(BaseModel):
    """A predefined per-provider synthetic identity for offline dev login."""

    provider: str = Field(..., description="google | github | discord")
    email: str = Field(..., description="Account-linking key for this identity")
    display_name: str = Field(..., description="Human-facing display name")
    avatar_placeholder: str = Field(
        ..., description="Non-empty placeholder avatar reference"
    )


# One Mock_Identity per provider. See module docstring for which emails are
# intended to match an existing dev account (google) versus not (github,
# discord).
MOCK_IDENTITIES: dict[str, MockIdentity] = {
    "google": MockIdentity(
        provider="google",
        # Matches the existing dev account -> exercises Account_Linking (5.4).
        email="leon@uski.dev",
        display_name="Leon Huber (Google Dev)",
        avatar_placeholder="https://avatars.uski.dev/mock/google.png",
    ),
    "github": MockIdentity(
        provider="github",
        # New email -> exercises new-user onboarding (5.5).
        email="octocat-dev@uski.dev",
        display_name="Octocat Dev (GitHub)",
        avatar_placeholder="https://avatars.uski.dev/mock/github.png",
    ),
    "discord": MockIdentity(
        provider="discord",
        # New email -> exercises new-user onboarding (5.5).
        email="mockingbird-dev@uski.dev",
        display_name="Mockingbird Dev (Discord)",
        avatar_placeholder="https://avatars.uski.dev/mock/discord.png",
    ),
}


def get_mock_identity(provider: str) -> MockIdentity:
    """Return the Mock_Identity for a provider, or raise ``KeyError`` if unknown."""
    return MOCK_IDENTITIES[provider]


def mock_identity_to_profile(mock_identity: MockIdentity) -> dict:
    """Map a Mock_Identity into the same Profile/Session fields a real provider
    session fills (Requirement 6.5).

    A real Supabase social session surfaces the provider name, the email, the
    provider-supplied display name and avatar via user metadata, and USki
    derives an initial username from the email exactly as it does for the OTP
    path. Returning that same field set keeps the mock identity
    downstream-indistinguishable for RBAC, sharing, route guards, and session
    handling.
    """
    return {
        "provider": mock_identity.provider,
        "email": mock_identity.email,
        "display_name": mock_identity.display_name,
        "avatar_url": mock_identity.avatar_placeholder,
        "username": derive_username_from_email(mock_identity.email),
    }
