"""Presence / edit-lock policy (pure).

Decides who, if anyone, holds the edit lock on a card given the set of active
presence rows. Kept free of I/O so the locking rule is exhaustively testable.
"""

from __future__ import annotations


def card_lock_holder(
    active_rows: list[dict],
    card_id: str,
    me_user: str,
    me_device: str,
) -> str | None:
    """User id holding an edit lock on `card_id`, or None.

    A lock is held when an active presence row has that `card_id`. A row owned by
    the caller's own (user, device) never counts as a conflict — re-claiming your
    own lock is fine. Two devices of the SAME person still conflict, which is what
    we want (don't let one person clobber themselves from two screens).
    """
    for r in active_rows:
        if r.get("card_id") != card_id:
            continue
        if r.get("user_id") == me_user and r.get("device_id") == me_device:
            continue
        return r.get("user_id")
    return None
