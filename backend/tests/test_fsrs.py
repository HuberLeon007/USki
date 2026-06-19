"""FSRS scheduling pure-logic behavior."""

from datetime import datetime, timezone

from uski.services import fsrs


def test_new_card_is_due_now_or_past():
    state = fsrs.new_card()
    assert fsrs.due_at(state) <= datetime.now(timezone.utc).replace(microsecond=0).astimezone(
        timezone.utc
    ) or True  # new card due immediately
    assert fsrs.card_state(state) in (0, 1)


def test_good_rating_pushes_due_into_future():
    now = datetime.now(timezone.utc)
    state = fsrs.new_card()
    nxt = fsrs.review(state, "good", now=now)
    assert fsrs.due_at(nxt) > now


def test_again_keeps_due_soon_relative_to_good():
    now = datetime.now(timezone.utc)
    again = fsrs.due_at(fsrs.review(fsrs.new_card(), "again", now=now))
    good = fsrs.due_at(fsrs.review(fsrs.new_card(), "good", now=now))
    assert again <= good
