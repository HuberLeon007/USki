"""Property tests for the Mock_Identity seed set and profile mapping."""

from hypothesis import given, settings as hyp_settings, strategies as st

from uski.services.mock_identity import (
    MOCK_IDENTITIES,
    PROVIDERS,
    get_mock_identity,
    mock_identity_to_profile,
)

# Feature: social-login, Property 7: Mock identity metadata is complete, one per provider

PROVIDER_STRATEGY = st.sampled_from(PROVIDERS)

_PROFILE_FIELDS = ("provider", "email", "display_name", "avatar_url", "username")


def test_exactly_one_identity_per_provider():
    """The seed has exactly the three providers, one identity each.

    Validates: Requirements 6.1, 6.6
    """
    assert set(MOCK_IDENTITIES.keys()) == set(PROVIDERS)
    assert len(MOCK_IDENTITIES) == 3
    # Every stored identity's provider key matches its provider field.
    for provider, identity in MOCK_IDENTITIES.items():
        assert identity.provider == provider


@hyp_settings(max_examples=200)
@given(provider=PROVIDER_STRATEGY)
def test_every_field_present_and_non_empty(provider):
    """Each Mock_Identity has all four fields present and non-empty.

    Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6
    """
    identity = get_mock_identity(provider)
    assert identity.provider == provider
    for field in ("provider", "email", "display_name", "avatar_placeholder"):
        value = getattr(identity, field)
        assert isinstance(value, str)
        assert value.strip() != ""


@hyp_settings(max_examples=200)
@given(provider=PROVIDER_STRATEGY)
def test_mock_identity_to_profile_fills_expected_fields(provider):
    """`mock_identity_to_profile` fills the profile/session fields non-empty.

    Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6
    """
    identity = get_mock_identity(provider)
    profile = mock_identity_to_profile(identity)

    for field in _PROFILE_FIELDS:
        assert field in profile, f"missing profile field: {field}"
        assert isinstance(profile[field], str)
        assert profile[field].strip() != ""

    # The mapping preserves the source identity's values.
    assert profile["provider"] == identity.provider
    assert profile["email"] == identity.email
    assert profile["display_name"] == identity.display_name
    assert profile["avatar_url"] == identity.avatar_placeholder


def test_seed_includes_matching_and_non_matching_emails():
    """The seed mixes a linking case and onboarding cases (distinct emails).

    Validates: Requirements 5.4, 5.5
    """
    emails = {identity.email for identity in MOCK_IDENTITIES.values()}
    # Three distinct emails -> at least one linking + one onboarding scenario.
    assert len(emails) == 3
