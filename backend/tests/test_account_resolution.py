"""Property tests for email-keyed account resolution and onboarding gating.

Covers design Property 4 (email-keyed linking yields exactly one account and is
idempotent) and Property 5 (new social users are onboarded and gated). Both use
the in-memory ``AccountStore`` so the pure decision logic is exercised without a
live database.
"""

import copy

from hypothesis import given, settings as hyp_settings, strategies as st

from uski.services.auth_identity import (
    PROVIDERS,
    InMemoryAccountStore,
    ProviderIdentity,
    requires_onboarding,
    resolve_account,
)

PROVIDER_STRATEGY = st.sampled_from(PROVIDERS)
REF_STRATEGY = st.one_of(st.none(), st.text(min_size=0, max_size=16))
IDENTITY_STRATEGY = st.tuples(PROVIDER_STRATEGY, REF_STRATEGY)


# Feature: social-login, Property 4: Email-keyed linking yields exactly one account and is idempotent
@hyp_settings(max_examples=200)
@given(
    email=st.emails(),
    identities=st.lists(IDENTITY_STRATEGY, min_size=1, max_size=12),
)
def test_email_keyed_linking_one_account_and_idempotent(email, identities):
    """All identities sharing an email map to one account/one profile, and
    re-linking is idempotent and non-destructive.

    Validates: Requirements 3.1, 3.2, 3.3, 3.4, 5.4, 9.1, 9.2, 9.3, 9.4, 9.5
    """
    store = InMemoryAccountStore()

    # First pass: resolve every identity (all share the same email).
    account_ids = set()
    for provider, ref in identities:
        result = resolve_account(store, ProviderIdentity(provider, email, ref))
        account_ids.add(result.account.id)

    # Exactly one account, exactly one profile.
    assert len(account_ids) == 1
    assert store.account_count == 1

    account_id = next(iter(account_ids))

    # The number of stored identities equals the number of DISTINCT inbound
    # (provider, ref) pairs: duplicates within the first pass did not duplicate.
    distinct = {(provider, ref) for provider, ref in identities}
    assert len(store.list_identities(account_id)) == len(distinct)

    # Establish a Profile + account-level settings/permissions/sharing, as if
    # the account had been used before an extra identity is linked.
    account = store.get_account_by_email(email)
    account.username = "established"
    account.discriminator = "0007"
    account.settings = {"theme": "dark"}
    store.permissions[account_id] = [{"deck_id": "d1", "role": "share"}]
    store.sharing[account_id] = [{"deck_id": "d2", "grantee_id": "friend"}]

    identities_before = copy.deepcopy(store.list_identities(account_id))
    permissions_before = copy.deepcopy(store.permissions[account_id])
    sharing_before = copy.deepcopy(store.sharing[account_id])
    profile_before = (account.username, account.discriminator, copy.deepcopy(account.settings))

    # Second pass: re-add every identity. Each is already linked.
    for provider, ref in identities:
        result = resolve_account(store, ProviderIdentity(provider, email, ref))
        assert result.account.id == account_id
        assert result.created is False
        assert result.linked is False  # idempotent: nothing new added

    # Still one account, no duplicate identities, profile/relationships intact.
    assert store.account_count == 1
    assert store.list_identities(account_id) == identities_before
    assert store.permissions[account_id] == permissions_before
    assert store.sharing[account_id] == sharing_before
    account_after = store.get_account_by_email(email)
    assert (
        account_after.username,
        account_after.discriminator,
        account_after.settings,
    ) == profile_before


# Feature: social-login, Property 5: New social users are onboarded and gated
@hyp_settings(max_examples=200)
@given(
    provider=PROVIDER_STRATEGY,
    email=st.emails(),
    ref=REF_STRATEGY,
)
def test_new_social_user_is_onboarded_and_gated(provider, email, ref):
    """An identity matching no account creates a new account+profile with
    needs_username true, and access is gated until a username is set.

    Validates: Requirements 4.1, 4.2, 4.3, 5.5
    """
    store = InMemoryAccountStore()  # empty: the email matches no account

    result = resolve_account(store, ProviderIdentity(provider, email, ref))

    # A brand new account + profile was created.
    assert result.created is True
    assert store.account_count == 1

    account = result.account
    # New account needs a username and is gated out of authenticated areas.
    assert account.needs_username is True
    assert requires_onboarding(account) is True

    # Completing the onboarding username step lifts the gate.
    account.username = "newuser"
    account.discriminator = "1234"
    assert account.needs_username is False
    assert requires_onboarding(account) is False
