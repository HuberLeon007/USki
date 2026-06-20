"""Global card browse: every card the user owns, across all decks."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from uski.core.deps import CardRepoDep, DeckRepoDep
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
    user: CurrentUser = Depends(get_current_user),
) -> list[BrowseCard]:
    """All of the user's cards (owned decks), each tagged with its deck title."""
    out: list[BrowseCard] = []
    for deck in deck_repo.list_for(user.id):
        for c in card_repo.list_for_deck(deck.id):
            out.append(BrowseCard(**c.model_dump(), deck_title=deck.title))
    return out
