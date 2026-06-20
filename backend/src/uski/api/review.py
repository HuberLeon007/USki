"""FSRS review endpoints: list due cards, rate a card. Schedules are per-user."""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from uski.core.deps import CardRepoDep, DeckRepoDep, ScheduleRepoDep, ShareRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.flashcard import CardOut, IntervalPreview
from uski.schemas.fsrs import ReviewRequest, ReviewResult
from uski.services import fsrs
from uski.services.permissions import Permission, effective_permission, require_permission

router = APIRouter(prefix="/api/decks/{deck_id}/review", tags=["review"])


def _require_read(deck_repo, share_repo, deck_id: str, user_id: str):
    deck = deck_repo.get(deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    require_permission(effective_permission(user_id, deck, share_repo), Permission.READ)


class ResetRequest(BaseModel):
    card_ids: list[str]


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_progress(
    deck_id: str,
    body: ResetRequest,
    deck_repo: DeckRepoDep,
    share_repo: ShareRepoDep,
    sched_repo: ScheduleRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Reset learning progress for the given cards (they become 'new' again)."""
    deck = deck_repo.get(deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    require_permission(effective_permission(user.id, deck, share_repo), Permission.EDIT)
    sched_repo.delete_for(user.id, body.card_ids)


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


@router.get("/stats")
async def review_stats(
    deck_id: str,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    sched_repo: ScheduleRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, int]:
    """Counts for the deck study screen: new / learning / due (Anki-style),
    plus `done` = cards already reviewed today (for the progress bar)."""
    _require_read(deck_repo, share_repo, deck_id, user.id)
    cards = card_repo.list_for_deck(deck_id)
    sched = sched_repo.get_map(user.id, [c.id for c in cards])
    now = datetime.now(timezone.utc)
    today = now.date()
    new = learning = due = done = 0
    for c in cards:
        row = sched.get(c.id)
        if row is None:
            new += 1
            continue
        fsrs_state = row["fsrs"]
        last = fsrs_state.get("last_review") if isinstance(fsrs_state, dict) else None
        if last:
            try:
                if datetime.fromisoformat(last).date() == today:
                    done += 1
            except (ValueError, TypeError):
                pass
        st = fsrs.card_state(fsrs_state)
        is_due = fsrs.due_at(fsrs_state) <= now
        if st in (1, 3):  # Learning / Relearning
            if is_due:
                learning += 1
        elif st == 0:
            new += 1
        elif is_due:  # Review
            due += 1
    return {"new": new, "learning": learning, "due": due, "done": done, "total": len(cards)}


@router.get("/custom", response_model=list[CardOut])
async def custom_study(
    deck_id: str,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    sched_repo: ScheduleRepoDep,
    share_repo: ShareRepoDep,
    mode: str = "all",
    days: int = 0,
    user: CurrentUser = Depends(get_current_user),
) -> list[CardOut]:
    """Custom study set. `mode=all` returns every card; `mode=ahead` returns
    cards due within `days` from now. Ratings in custom study are NOT persisted
    by the client, so scheduling is untouched unless the deck opts in."""
    _require_read(deck_repo, share_repo, deck_id, user.id)
    cards = card_repo.list_for_deck(deck_id)
    if mode == "all":
        return cards
    sched = sched_repo.get_map(user.id, [c.id for c in cards])
    horizon = datetime.now(timezone.utc) + timedelta(days=max(0, days))
    out: list[CardOut] = []
    for c in cards:
        row = sched.get(c.id)
        if row is None or fsrs.due_at(row["fsrs"]) <= horizon:
            out.append(c)
    return out


@router.get("/{card_id}/intervals", response_model=IntervalPreview)
async def card_intervals(
    deck_id: str,
    card_id: str,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    sched_repo: ScheduleRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> IntervalPreview:
    """Next interval per rating button (FSRS preview), shown under again/hard/good/easy."""
    _require_read(deck_repo, share_repo, deck_id, user.id)
    if card_repo.get(card_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    current = sched_repo.get_map(user.id, [card_id]).get(card_id)
    state = current["fsrs"] if current else fsrs.new_card()
    return IntervalPreview(**fsrs.preview(state))


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
