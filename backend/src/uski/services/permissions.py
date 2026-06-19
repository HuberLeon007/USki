"""Permission resolution — the central authorization seam.

Pure core: `resolve_permission` decides a user's effective permission on a deck
given the owner and the list of shares. No I/O, fully testable. Hierarchy:
read < edit < share. The deck owner always has SHARE (full) permission.

`require_permission` is the thin orchestration wrapper used by routers: it loads
the deck + shares through the injected repos and raises HTTP errors.
"""

from __future__ import annotations

from enum import IntEnum

from fastapi import HTTPException, status


class Permission(IntEnum):
    READ = 1
    EDIT = 2
    SHARE = 3


_LEVEL = {"read": Permission.READ, "edit": Permission.EDIT, "share": Permission.SHARE}


def resolve_permission(
    user_id: str,
    deck_owner_id: str,
    shares: list[dict] | None = None,
) -> Permission | None:
    """Effective permission of `user_id` on a deck, or None if no access.

    A `share` is a dict with `grantee_id` and `permission` ('read'|'edit'|'share').
    The owner outranks any share. Among shares for the user, the highest wins.
    """
    if user_id == deck_owner_id:
        return Permission.SHARE
    best: Permission | None = None
    for s in shares or []:
        if s.get("grantee_id") == user_id:
            lvl = _LEVEL.get(s.get("permission", ""))
            if lvl is not None and (best is None or lvl > best):
                best = lvl
    return best


def require_permission(
    effective: Permission | None,
    needed: Permission,
) -> None:
    """Raise 403 unless `effective` meets or exceeds `needed`."""
    if effective is None or effective < needed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action",
        )


def effective_permission(user_id: str, deck, share_repo=None) -> Permission | None:
    """Resolve a user's permission on a deck, loading shares via the repo."""
    shares = share_repo.list_for_deck(deck.id) if share_repo is not None else []
    return resolve_permission(user_id, deck.owner_id, shares)
