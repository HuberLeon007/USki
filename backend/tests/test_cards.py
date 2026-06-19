"""Card CRUD + HTML sanitization, through the HTTP interface with in-memory repos."""

import pytest

from uski.core.deps import get_card_repo, get_chunk_repo, get_deck_repo, get_embedder, get_share_repo
from uski.main import app
from uski.repos.cards import InMemoryCardRepo
from uski.repos.chunks import InMemoryChunkRepo
from uski.repos.decks import InMemoryDeckRepo
from uski.repos.sharing import InMemoryShareRepo
from uski.schemas.deck import DeckCreate
from uski.services.card_content import sanitize
from uski.services.embeddings import FakeEmbedder


@pytest.fixture
def repos():
    decks, cards = InMemoryDeckRepo(), InMemoryCardRepo()
    chunks = InMemoryChunkRepo()
    app.dependency_overrides[get_deck_repo] = lambda: decks
    app.dependency_overrides[get_card_repo] = lambda: cards
    app.dependency_overrides[get_chunk_repo] = lambda: chunks
    app.dependency_overrides[get_embedder] = lambda: FakeEmbedder()
    app.dependency_overrides[get_share_repo] = lambda: InMemoryShareRepo()
    yield decks, cards
    for dep in (get_deck_repo, get_card_repo, get_chunk_repo, get_embedder, get_share_repo):
        app.dependency_overrides.pop(dep, None)


@pytest.fixture
def auth(make_token):
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def deck(repos):
    decks, _ = repos
    return decks.create("user-456", DeckCreate(title="Bio"))


def test_create_and_list_card(client, repos, auth, deck):
    res = client.post(
        f"/api/decks/{deck.id}/cards",
        json={"front_html": "<p>Q</p>", "back_html": "<p>A</p>"},
        headers=auth,
    )
    assert res.status_code == 201
    listed = client.get(f"/api/decks/{deck.id}/cards", headers=auth).json()
    assert len(listed) == 1


def test_script_is_stripped_on_create(client, repos, auth, deck):
    res = client.post(
        f"/api/decks/{deck.id}/cards",
        json={"front_html": "<p>ok</p><script>alert(1)</script>"},
        headers=auth,
    )
    assert "<script>" not in res.json()["front_html"]
    assert "<p>ok</p>" in res.json()["front_html"]


def test_cannot_add_card_to_foreign_deck(client, repos, auth):
    decks, _ = repos
    foreign = decks.create("other-user", DeckCreate(title="Theirs"))
    res = client.post(f"/api/decks/{foreign.id}/cards", json={"front_html": "x"}, headers=auth)
    assert res.status_code == 403


def test_sanitize_keeps_formatting():
    out = sanitize("<strong>bold</strong><script>x</script>")
    assert out == "<strong>bold</strong>"
