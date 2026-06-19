"""Deck-group CRUD via HTTP with in-memory repo."""

import pytest

from uski.core.deps import get_group_repo
from uski.main import app
from uski.repos.groups import InMemoryGroupRepo
from uski.schemas.deck import DeckGroupCreate


@pytest.fixture
def repo():
    r = InMemoryGroupRepo()
    app.dependency_overrides[get_group_repo] = lambda: r
    yield r
    app.dependency_overrides.pop(get_group_repo, None)


@pytest.fixture
def auth(make_token):
    return {"Authorization": f"Bearer {make_token()}"}


def test_create_and_list_group(client, repo, auth):
    assert client.post("/api/groups", json={"name": "Semester 1"}, headers=auth).status_code == 201
    names = [g["name"] for g in client.get("/api/groups", headers=auth).json()]
    assert names == ["Semester 1"]


def test_nested_group_keeps_parent(client, repo, auth):
    parent = client.post("/api/groups", json={"name": "Root"}, headers=auth).json()
    child = client.post(
        "/api/groups", json={"name": "Child", "parent_group_id": parent["id"]}, headers=auth
    ).json()
    assert child["parent_group_id"] == parent["id"]


def test_cannot_touch_foreign_group(client, repo, auth):
    foreign = repo.create("other-user", DeckGroupCreate(name="Theirs"))
    assert client.delete(f"/api/groups/{foreign.id}", headers=auth).status_code == 403
