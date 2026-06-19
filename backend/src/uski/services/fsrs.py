"""FSRS scheduling seam — pure wrapper over the `fsrs` library.

Interface: `new_card()` returns the initial FSRS state, `review(state, rating, now)`
returns the next state, `due_at(state)` reads the next-review time. State is the
`fsrs.Card` dict (card_id/state/step/stability/difficulty/due/last_review). No I/O,
fully testable. The library internals stay hidden behind these three functions.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fsrs import Card, Rating, Scheduler

_scheduler = Scheduler()

_RATING = {
    "again": Rating.Again,
    "hard": Rating.Hard,
    "good": Rating.Good,
    "easy": Rating.Easy,
}


def new_card() -> dict:
    """Initial FSRS state for a brand-new card (due immediately)."""
    return Card().to_dict()


def review(state: dict, rating: str, now: datetime | None = None) -> dict:
    """Apply a rating and return the next FSRS state."""
    card = Card.from_dict(state) if state else Card()
    nxt, _log = _scheduler.review_card(card, _RATING[rating], review_datetime=now)
    return nxt.to_dict()


def due_at(state: dict) -> datetime:
    """Next-review timestamp from an FSRS state. New/empty -> epoch-now (due)."""
    raw = state.get("due") if state else None
    if not raw:
        return datetime.now(timezone.utc)
    return datetime.fromisoformat(raw)


def card_state(state: dict) -> int:
    return int(state.get("state", 0)) if state else 0
