"""FSRS review endpoints: list due cards, rate a card. Schedules are per-user."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from uski.core.deps import CardRepoDep, DeckRepoDep, ScheduleRepoDep, ShareRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.flashcard import CardOut
from uski.schemas.fsrs import ReviewRequest, ReviewResult
from uski.services import fsrs
from uski.services.permissions import Permission, effective_permission, require_permission

router = APIRouter(prefix="/api/decks/{deck_id}/review", tags=["review"])


def _require_read(deck_repo, share_repo, deck_id: str, user_id: str):
    deck = deck_repo.get(deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    require_permission(effective_permission(user_id, deck, share_repo), Permission.READ)


@router.get("/due", response_model=list[CardOut])
async def due_cards(
    deck_id: str,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    sched_repo: ScheduleRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> list[CardOut]:
    _require_read(deck_repo, share_repo, deck_id, user.id)
    cards = card_repo.list_for_deck(deck_id)
    sched = sched_repo.get_map(user.id, [c.id for c in cards])
    now = datetime.now(timezone.utc)
    due: list[CardOut] = []
    for c in cards:
        row = sched.get(c.id)
        if row is None:  # never scheduled -> new -> due
            due.append(c)
        elif fsrs.due_at(row["fsrs"]) <= now:
            due.append(c)
    return due


@router.post("/{card_id}", response_model=ReviewResult)
async def rate_card(
    deck_id: str,
    card_id: str,
    body: ReviewRequest,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    sched_repo: ScheduleRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> ReviewResult:
    _require_read(deck_repo, share_repo, deck_id, user.id)
    if card_repo.get(card_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    current = sched_repo.get_map(user.id, [card_id]).get(card_id)
    state = current["fsrs"] if current else fsrs.new_card()
    now = datetime.now(timezone.utc)
    nxt = fsrs.review(state, body.rating, now=now)
    due = fsrs.due_at(nxt)
    sched_repo.upsert(card_id, user.id, nxt, due.isoformat())
    return ReviewResult(card_id=card_id, due=due, state=fsrs.card_state(nxt))
