"""Bidirectional cards: one card studied in both directions, toggled per card.

Enabling links a reverse sibling (back->front) under a shared note_id so each
direction keeps its own schedule; disabling removes the reverse sibling. Exercised
through the HTTP interface with in-memory repos.
"""

import pytest

from uski.core.deps import get_card_repo, get_chunk_repo, get_deck_repo, get_embedder, get_share_repo
from uski.main import app
from uski.repos.cards import InMemoryCardRepo
from uski.repos.chunks import InMemoryChunkRepo
from uski.repos.decks import InMemoryDeckRepo
from uski.repos.sharing import InMemoryShareRepo
from uski.schemas.deck import DeckCreate
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


def _make_card(client, auth, deck_id, front="<p>Q</p>", back="<p>A</p>"):
    return client.post(
        f"/api/decks/{deck_id}/cards",
        json={"front_html": front, "back_html": back},
        headers=auth,
    ).json()


def test_enable_creates_linked_reverse_with_swapped_sides(client, repos, auth, deck):
    card = _make_card(client, auth, deck.id, front="<p>Cat</p>", back="<p>Katze</p>")

    res = client.post(
        f"/api/decks/{deck.id}/cards/{card['id']}/bidirectional",
        json={"enabled": True}, headers=auth,
    )
    assert res.status_code == 200

    listed = client.get(f"/api/decks/{deck.id}/cards", headers=auth).json()
    assert len(listed) == 2
    basic = next(c for c in listed if c["card_type"] == "basic")
    reverse = next(c for c in listed if c["card_type"] == "reverse")
    # Same note links them; reverse shows the original back as its front.
    assert basic["note_id"] and basic["note_id"] == reverse["note_id"]
    assert reverse["front_html"] == basic["back_html"]
    assert reverse["back_html"] == basic["front_html"]


def test_disable_removes_reverse_and_unlinks(client, repos, auth, deck):
    card = _make_card(client, auth, deck.id)
    client.post(f"/api/decks/{deck.id}/cards/{card['id']}/bidirectional",
                json={"enabled": True}, headers=auth)

    res = client.post(f"/api/decks/{deck.id}/cards/{card['id']}/bidirectional",
                      json={"enabled": False}, headers=auth)
    assert res.status_code == 200

    listed = client.get(f"/api/decks/{deck.id}/cards", headers=auth).json()
    assert len(listed) == 1
    assert listed[0]["card_type"] == "basic"
    assert listed[0]["note_id"] is None


def test_enable_is_idempotent(client, repos, auth, deck):
    card = _make_card(client, auth, deck.id)
    for _ in range(3):
        client.post(f"/api/decks/{deck.id}/cards/{card['id']}/bidirectional",
                    json={"enabled": True}, headers=auth)
    listed = client.get(f"/api/decks/{deck.id}/cards", headers=auth).json()
    assert len(listed) == 2  # never more than the linked pair


def test_toggling_from_reverse_card_targets_the_note(client, repos, auth, deck):
    card = _make_card(client, auth, deck.id)
    client.post(f"/api/decks/{deck.id}/cards/{card['id']}/bidirectional",
                json={"enabled": True}, headers=auth)
    listed = client.get(f"/api/decks/{deck.id}/cards", headers=auth).json()
    reverse = next(c for c in listed if c["card_type"] == "reverse")

    # Disabling via the reverse card still collapses the note to the basic card.
    res = client.post(f"/api/decks/{deck.id}/cards/{reverse['id']}/bidirectional",
                      json={"enabled": False}, headers=auth)
    assert res.status_code == 200
    listed = client.get(f"/api/decks/{deck.id}/cards", headers=auth).json()
    assert len(listed) == 1
    assert listed[0]["card_type"] == "basic"
