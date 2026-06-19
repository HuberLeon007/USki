"""Review flow via HTTP: new cards are due; a 'good' rating removes them from due."""

import pytest

from uski.core.deps import get_card_repo, get_deck_repo, get_schedule_repo, get_share_repo
from uski.main import app
from uski.repos.cards import InMemoryCardRepo
from uski.repos.decks import InMemoryDeckRepo
from uski.repos.schedules import InMemoryScheduleRepo
from uski.repos.sharing import InMemoryShareRepo
from uski.schemas.deck import DeckCreate


@pytest.fixture
def repos():
    d, c, s = InMemoryDeckRepo(), InMemoryCardRepo(), InMemoryScheduleRepo()
    app.dependency_overrides[get_deck_repo] = lambda: d
    app.dependency_overrides[get_card_repo] = lambda: c
    app.dependency_overrides[get_schedule_repo] = lambda: s
    app.dependency_overrides[get_share_repo] = lambda: InMemoryShareRepo()
    yield d, c, s
    for dep in (get_deck_repo, get_card_repo, get_schedule_repo, get_share_repo):
        app.dependency_overrides.pop(dep, None)


@pytest.fixture
def auth(make_token):
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def deck_with_card(repos):
    d, c, _ = repos
    deck = d.create("user-456", DeckCreate(title="Bio"))
    card = c.create(deck.id, {"front_html": "Q", "back_html": "A"})
    return deck, card


def test_new_card_is_due(client, repos, auth, deck_with_card):
    deck, card = deck_with_card
    due = client.get(f"/api/decks/{deck.id}/review/due", headers=auth).json()
    assert [x["id"] for x in due] == [card.id]


def test_rating_good_removes_from_due(client, repos, auth, deck_with_card):
    deck, card = deck_with_card
    res = client.post(
        f"/api/decks/{deck.id}/review/{card.id}", json={"rating": "good"}, headers=auth
    )
    assert res.status_code == 200
    due_after = client.get(f"/api/decks/{deck.id}/review/due", headers=auth).json()
    assert due_after == []
