"""Deck CRUD behavior, verified through the HTTP interface with an in-memory repo."""

import pytest

from uski.core.deps import get_deck_repo, get_share_repo
from uski.main import app
from uski.repos.decks import InMemoryDeckRepo
from uski.repos.sharing import InMemoryShareRepo
from uski.schemas.deck import DeckCreate


@pytest.fixture
def repo():
    r = InMemoryDeckRepo()
    app.dependency_overrides[get_deck_repo] = lambda: r
    app.dependency_overrides[get_share_repo] = lambda: InMemoryShareRepo()
    yield r
    app.dependency_overrides.pop(get_deck_repo, None)
    app.dependency_overrides.pop(get_share_repo, None)


@pytest.fixture
def auth(make_token):
    return {"Authorization": f"Bearer {make_token()}"}  # sub = user-456


def test_create_deck_returns_owned_deck(client, repo, auth):
    res = client.post("/api/decks", json={"title": "Biology"}, headers=auth)
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "Biology"
    assert body["owner_id"] == "user-456"


def test_list_returns_only_own_decks(client, repo, auth):
    client.post("/api/decks", json={"title": "Mine"}, headers=auth)
    repo.create("other-user", DeckCreate(title="Theirs"))
    res = client.get("/api/decks", headers=auth)
    titles = [d["title"] for d in res.json()]
    assert titles == ["Mine"]


def test_update_changes_title(client, repo, auth):
    created = client.post("/api/decks", json={"title": "Old"}, headers=auth).json()
    res = client.patch(f"/api/decks/{created['id']}", json={"title": "New"}, headers=auth)
    assert res.status_code == 200
    assert res.json()["title"] == "New"


def test_delete_then_get_is_404(client, repo, auth):
    created = client.post("/api/decks", json={"title": "Temp"}, headers=auth).json()
    assert client.delete(f"/api/decks/{created['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/decks/{created['id']}", headers=auth).status_code == 404


def test_cannot_access_other_users_deck(client, repo, auth):
    foreign = repo.create("other-user", DeckCreate(title="Secret"))
    assert client.get(f"/api/decks/{foreign.id}", headers=auth).status_code == 403
