"""Sharing/RBAC flows via HTTP with in-memory repos.

Owner token = user-456 (conftest). Grantee = user-999 via a second token.
"""

import pytest

from uski.core.deps import (
    get_audit_repo, get_deck_repo, get_invite_repo, get_notification_repo,
    get_share_repo, get_user_repo,
)
from uski.main import app
from uski.repos.decks import InMemoryDeckRepo
from uski.repos.sharing import (
    InMemoryAuditRepo, InMemoryInviteRepo, InMemoryNotificationRepo,
    InMemoryShareRepo, InMemoryUserRepo,
)
from uski.schemas.deck import DeckCreate


@pytest.fixture
def ctx(make_token):
    decks = InMemoryDeckRepo()
    shares = InMemoryShareRepo()
    invites = InMemoryInviteRepo()
    audit = InMemoryAuditRepo()
    notif = InMemoryNotificationRepo()
    users = InMemoryUserRepo({("bob", "0001"): "user-999"})
    app.dependency_overrides[get_deck_repo] = lambda: decks
    app.dependency_overrides[get_share_repo] = lambda: shares
    app.dependency_overrides[get_invite_repo] = lambda: invites
    app.dependency_overrides[get_audit_repo] = lambda: audit
    app.dependency_overrides[get_notification_repo] = lambda: notif
    app.dependency_overrides[get_user_repo] = lambda: users
    owner = {"Authorization": f"Bearer {make_token()}"}  # user-456
    grantee = {"Authorization": f"Bearer {make_token({'sub': 'user-999'})}"}
    yield decks, shares, notif, owner, grantee
    for dep in (get_deck_repo, get_share_repo, get_invite_repo,
                get_audit_repo, get_notification_repo, get_user_repo):
        app.dependency_overrides.pop(dep, None)


def test_grant_lets_grantee_read_deck(client, ctx):
    decks, _, notif, owner, grantee = ctx
    deck = decks.create("user-456", DeckCreate(title="Shared"))
    # grantee cannot read before
    assert client.get(f"/api/decks/{deck.id}", headers=grantee).status_code == 403
    # owner grants read
    res = client.post(
        f"/api/decks/{deck.id}/shares",
        json={"username": "bob", "discriminator": "0001", "permission": "read"},
        headers=owner,
    )
    assert res.status_code == 201
    # now grantee can read
    assert client.get(f"/api/decks/{deck.id}", headers=grantee).status_code == 200
    # and got a notification
    assert client.get("/api/notifications", headers=grantee).json()


def test_revoke_removes_access(client, ctx):
    decks, _, _, owner, grantee = ctx
    deck = decks.create("user-456", DeckCreate(title="Shared"))
    client.post(
        f"/api/decks/{deck.id}/shares",
        json={"username": "bob", "discriminator": "0001", "permission": "read"},
        headers=owner,
    )
    assert client.delete(f"/api/decks/{deck.id}/shares/user-999", headers=owner).status_code == 204
    assert client.get(f"/api/decks/{deck.id}", headers=grantee).status_code == 403


def test_read_grant_cannot_edit(client, ctx):
    decks, _, _, owner, grantee = ctx
    deck = decks.create("user-456", DeckCreate(title="Shared"))
    client.post(
        f"/api/decks/{deck.id}/shares",
        json={"username": "bob", "discriminator": "0001", "permission": "read"},
        headers=owner,
    )
    res = client.patch(f"/api/decks/{deck.id}", json={"title": "Hacked"}, headers=grantee)
    assert res.status_code == 403


def test_invite_redeem_grants_access(client, ctx):
    decks, _, _, owner, grantee = ctx
    deck = decks.create("user-456", DeckCreate(title="Shared"))
    code = client.post(
        f"/api/decks/{deck.id}/invites", json={"permission": "read"}, headers=owner
    ).json()["code"]
    assert client.post("/api/shares/redeem", json={"code": code}, headers=grantee).status_code == 201
    assert client.get(f"/api/decks/{deck.id}", headers=grantee).status_code == 200
