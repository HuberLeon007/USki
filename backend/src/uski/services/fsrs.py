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


def _humanize(seconds: float) -> str:
    """Compact interval label like Anki: 10m, 1h, 4d, 3mo, 1y."""
    s = max(0, seconds)
    if s < 60:
        return f"{int(s)}s" if s >= 1 else "<1m"
    m = s / 60
    if m < 60:
        return f"{round(m)}m"
    h = m / 60
    if h < 24:
        return f"{round(h)}h"
    d = h / 24
    if d < 30:
        return f"{round(d)}d"
    mo = d / 30
    if mo < 12:
        return f"{round(mo)}mo"
    return f"{round(d / 365, 1)}y"


def preview(state: dict, now: datetime | None = None) -> dict[str, str]:
    """Next interval per rating without persisting (FSRS preview, like Anki)."""
    base = now or datetime.now(timezone.utc)
    out: dict[str, str] = {}
    for name, rating in _RATING.items():
        card = Card.from_dict(state) if state else Card()
        nxt, _ = _scheduler.review_card(card, rating, review_datetime=base)
        due = datetime.fromisoformat(nxt.to_dict()["due"])
        out[name] = _humanize((due - base).total_seconds())
    return out
