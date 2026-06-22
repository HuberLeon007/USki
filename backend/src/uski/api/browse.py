"""Global card browse: every card the user can see (owned + shared)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from uski.core.deps import CardRepoDep, DeckRepoDep, ShareRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.flashcard import CardOut

router = APIRouter(prefix="/api/browse", tags=["browse"])


class BrowseCard(CardOut):
    deck_id: str
    deck_title: str


@router.get("/cards", response_model=list[BrowseCard])
async def browse_cards(
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> list[BrowseCard]:
    """All of the user's cards, owned AND shared-with-them, each tagged with its
    deck title. Shared decks are referenced (not copied), so their cards appear
    here exactly like owned cards - matching how they show up in the deck views."""
    out: list[BrowseCard] = []
    seen: set[str] = set()

    def add_deck(deck) -> None:
        if deck is None or deck.id in seen:
            return
        seen.add(deck.id)
        for c in card_repo.list_for_deck(deck.id):
            out.append(BrowseCard(**c.model_dump(), deck_title=deck.title))

    for deck in deck_repo.list_for(user.id):
        add_deck(deck)
    for s in share_repo.list_for_grantee(user.id):
        add_deck(deck_repo.get(s["deck_id"]))
    return out
