"""Email-keyed account resolution and identity linking (social-login).

This module holds the pure decision logic that both the offline mock path
(task 4.1) and the real social path call to turn a provider identity into
exactly one USki Account:

- If the identity's email matches an existing Account, the provider is linked
  as an additional ``Auth_Identity`` of that Account. No duplicate Profile is
  created, and re-linking an already-linked provider is idempotent. The
  Account's Profile, settings, permissions, and deck-sharing relationships are
  preserved untouched (Requirement 3.1-3.4, 9.1-9.5).
- If the email matches no Account, a new Account and Profile are created with
  ``needs_username`` set, so the user is routed through the same onboarding
  username step as any other new user (Requirement 4.1, 4.2).

Email is the single linking key: every email binds to exactly one Account
(Requirement 3.3, 9.3), so permissions and deck-sharing keyed to ``user_id``
apply regardless of which identity established the current Session
(Requirement 9.4).

Design seam: all DB-touching work sits behind the small ``AccountStore``
Protocol, so the match-vs-create, idempotent-linking, and onboarding decisions
are exhaustively testable without a live database. A ``SupabaseAccountStore``
backs the real path; an ``InMemoryAccountStore`` backs the property tests. This
mirrors the existing Supabase/in-memory repo pattern in ``repos/sharing.py``.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol

from uski.core.supabase import get_supabase_client

# The OTP/email identity plus the three supported social providers.
PROVIDERS: tuple[str, ...] = ("email", "google", "github", "discord")


# ── value types ──────────────────────────────────────────────
@dataclass(frozen=True)
class ProviderIdentity:
    """An inbound identity to resolve against the account model.

    ``provider`` is one of ``PROVIDERS`` (``email`` for the OTP path, or a
    social provider). ``email`` is the linking key. ``provider_account_ref`` is
    the provider subject (mirror of ``auth.identities``); two records with the
    same ``(provider, provider_account_ref)`` are considered the same identity
    for idempotency.
    """

    provider: str
    email: str
    provider_account_ref: str | None = None


@dataclass
class Account:
    """The single logical USki user identity (the Profile carrier).

    ``username is None`` is the ``Needs_Username`` state: a freshly created
    Account has no username until onboarding completes.
    """

    id: str
    email: str
    username: str | None = None
    discriminator: str | None = None
    settings: dict = field(default_factory=dict)

    @property
    def needs_username(self) -> bool:
        """True while the Account has no assigned username (onboarding gate)."""
        return self.username is None


@dataclass
class AuthIdentityRecord:
    """A provider identity linked to an Account (mirrors ``auth.identities``)."""

    id: str
    user_id: str
    provider: str
    provider_account_ref: str | None
    linked_at: str


@dataclass
class AccountResolution:
    """Outcome of resolving a ``ProviderIdentity`` to a single Account."""

    account: Account
    created: bool  # True if a new Account + Profile was created this call
    linked: bool  # True if a new Auth_Identity was added this call


def _normalize_email(email: str) -> str:
    """Normalize the linking key so casing/whitespace cannot split an account."""
    return email.strip().lower()


# ── pure gating predicate ────────────────────────────────────
def requires_onboarding(account: Account) -> bool:
    """Whether ``account`` must complete the onboarding username step first.

    Pure predicate: returns ``True`` while the ``Needs_Username`` state is set
    (no username assigned), denying access to authenticated application areas
    until the username step completes (Requirement 4.2, 4.3, 5.5).
    """
    return account.needs_username


# ── store seam ───────────────────────────────────────────────
class AccountStore(Protocol):
    """Small interface hiding all DB access behind the resolution logic.

    Implementations: ``SupabaseAccountStore`` (real path) and
    ``InMemoryAccountStore`` (tests).
    """

    def get_account_by_email(self, email: str) -> Account | None: ...

    def create_account(self, email: str, account_id: str | None = None) -> Account: ...

    def list_identities(self, user_id: str) -> list[AuthIdentityRecord]: ...

    def add_identity(
        self, user_id: str, provider: str, provider_account_ref: str | None
    ) -> AuthIdentityRecord: ...


# ── the resolution decision (pure over the store) ────────────
def resolve_account(
    store: AccountStore,
    identity: ProviderIdentity,
    account_id: str | None = None,
) -> AccountResolution:
    """Resolve ``identity`` to exactly one Account, linking idempotently.

    Decision logic (the part worth testing), free of any direct DB access:

    1. Look the Account up by normalized email.
    2. If none exists, create a new Account + Profile (``needs_username`` set).
       ``account_id`` lets the real path pin the new Account to the existing
       ``auth.users`` id; tests omit it and the store mints one.
    3. Link the provider as an additional ``Auth_Identity`` unless an identity
       with the same ``(provider, provider_account_ref)`` is already linked
       (idempotent re-link). Existing Profile, settings, permissions, and
       deck-sharing are never touched when linking (Requirement 9.5).

    Returns the resolved Account plus flags describing what happened.
    """
    email = _normalize_email(identity.email)

    account = store.get_account_by_email(email)
    created = False
    if account is None:
        account = store.create_account(email, account_id)
        created = True

    already_linked = any(
        rec.provider == identity.provider
        and rec.provider_account_ref == identity.provider_account_ref
        for rec in store.list_identities(account.id)
    )
    linked = False
    if not already_linked:
        store.add_identity(account.id, identity.provider, identity.provider_account_ref)
        linked = True

    return AccountResolution(account=account, created=created, linked=linked)


# ── Supabase-backed store (real path; wired by task 4.1) ─────
class SupabaseAccountStore:
    """``AccountStore`` backed by the USki ``user`` and ``auth_identity`` tables.

    Account identity is anchored to ``auth.users``: an Account's ``id`` equals
    the ``auth.users.id``. The real social path (task 4.1) ensures the auth user
    exists via the local Supabase admin API, then passes that id as
    ``account_id`` so the Profile row is pinned to the same id. This adapter only
    performs I/O when its methods are called, so importing it is side-effect
    free.
    """

    def __init__(self) -> None:
        self._db = get_supabase_client()

    def get_account_by_email(self, email: str) -> Account | None:
        res = (
            self._db.table("user")
            .select("id, email, username, discriminator, settings")
            .eq("email", _normalize_email(email))
            .execute()
        )
        if not res.data:
            return None
        row = res.data[0]
        return Account(
            id=row["id"],
            email=row.get("email") or email,
            username=row.get("username"),
            discriminator=row.get("discriminator"),
            settings=row.get("settings") or {},
        )

    def create_account(self, email: str, account_id: str | None = None) -> Account:
        row: dict = {"email": _normalize_email(email), "username": None}
        if account_id is not None:
            row["id"] = account_id
        res = self._db.table("user").upsert(row, on_conflict="id").execute()
        created = res.data[0] if res.data else row
        return Account(
            id=created.get("id", account_id or str(uuid.uuid4())),
            email=created.get("email") or _normalize_email(email),
            username=created.get("username"),
            discriminator=created.get("discriminator"),
            settings=created.get("settings") or {},
        )

    def list_identities(self, user_id: str) -> list[AuthIdentityRecord]:
        res = (
            self._db.table("auth_identity")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return [
            AuthIdentityRecord(
                id=r["id"],
                user_id=r["user_id"],
                provider=r["provider"],
                provider_account_ref=r.get("provider_account_ref"),
                linked_at=r.get("linked_at", ""),
            )
            for r in (res.data or [])
        ]

    def add_identity(
        self, user_id: str, provider: str, provider_account_ref: str | None
    ) -> AuthIdentityRecord:
        row = {
            "user_id": user_id,
            "provider": provider,
            "provider_account_ref": provider_account_ref,
            "linked_at": datetime.now(timezone.utc).isoformat(),
        }
        res = (
            self._db.table("auth_identity")
            .upsert(row, on_conflict="user_id,provider,provider_account_ref")
            .execute()
        )
        created = res.data[0] if res.data else row
        return AuthIdentityRecord(
            id=created.get("id", str(uuid.uuid4())),
            user_id=user_id,
            provider=provider,
            provider_account_ref=provider_account_ref,
            linked_at=created.get("linked_at", row["linked_at"]),
        )


# ── In-memory store (tests; no live DB required) ─────────────
class InMemoryAccountStore:
    """``AccountStore`` kept fully in memory for the property tests.

    It also tracks account-level ``permissions`` and ``sharing`` so tests can
    assert that linking an additional identity leaves them unchanged
    (Requirement 9.4, 9.5).
    """

    def __init__(self) -> None:
        self._accounts: dict[str, Account] = {}
        self._by_email: dict[str, str] = {}
        self._identities: dict[str, list[AuthIdentityRecord]] = {}
        # Account-level relationships, keyed by user_id (account level).
        self.permissions: dict[str, list] = {}
        self.sharing: dict[str, list] = {}

    @property
    def account_count(self) -> int:
        return len(self._accounts)

    def get_account_by_email(self, email: str) -> Account | None:
        uid = self._by_email.get(_normalize_email(email))
        return self._accounts.get(uid) if uid is not None else None

    def create_account(self, email: str, account_id: str | None = None) -> Account:
        normalized = _normalize_email(email)
        uid = account_id or str(uuid.uuid4())
        account = Account(id=uid, email=normalized, username=None, discriminator=None)
        self._accounts[uid] = account
        self._by_email[normalized] = uid
        self._identities[uid] = []
        self.permissions.setdefault(uid, [])
        self.sharing.setdefault(uid, [])
        return account

    def list_identities(self, user_id: str) -> list[AuthIdentityRecord]:
        return list(self._identities.get(user_id, []))

    def add_identity(
        self, user_id: str, provider: str, provider_account_ref: str | None
    ) -> AuthIdentityRecord:
        rec = AuthIdentityRecord(
            id=str(uuid.uuid4()),
            user_id=user_id,
            provider=provider,
            provider_account_ref=provider_account_ref,
            linked_at=datetime.now(timezone.utc).isoformat(),
        )
        self._identities.setdefault(user_id, []).append(rec)
        return rec
