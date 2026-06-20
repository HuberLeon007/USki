"""Deck CRUD. Thin adapter; logic in repos + the permissions seam."""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel

from uski.core.deps import CardRepoDep, DeckRepoDep, ShareRepoDep, UserRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.deck import DeckCreate, DeckOut, DeckUpdate
from uski.services.permissions import (
    Permission, effective_permission, require_permission, resolve_permission,
)

router = APIRouter(prefix="/api/decks", tags=["decks"])

# Card fields copied verbatim when importing/cloning a deck.
_CARD_COPY_FIELDS = ("front_json", "front_html", "back_json", "back_html", "position", "card_type")


def _load(repo, share_repo, deck_id: str, user_id: str, needed: Permission) -> DeckOut:
    deck = repo.get(deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    require_permission(effective_permission(user_id, deck, share_repo), needed)
    return deck


def _unique_title(repo: DeckRepoDep, owner_id: str, base: str) -> str:
    """Return `base`, or `base (copy)`, `base (copy 2)`, … if already taken."""
    if repo.find_by_title(owner_id, base) is None:
        return base
    n = 1
    while True:
        candidate = f"{base} (copy)" if n == 1 else f"{base} (copy {n})"
        if repo.find_by_title(owner_id, candidate) is None:
            return candidate
        n += 1


@router.get("", response_model=list[DeckOut])
async def list_decks(repo: DeckRepoDep, user: CurrentUser = Depends(get_current_user)):
    return repo.list_for(user.id)


@router.get("/shared", response_model=list[DeckOut])
async def list_shared_decks(
    repo: DeckRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    """Decks shared with the current user (not owned by them)."""
    out: list[DeckOut] = []
    for s in share_repo.list_for_grantee(user.id):
        deck = repo.get(s["deck_id"])
        if deck is not None:
            out.append(deck)
    return out


@router.post("", response_model=DeckOut, status_code=status.HTTP_201_CREATED)
async def create_deck(
    body: DeckCreate, repo: DeckRepoDep, user: CurrentUser = Depends(get_current_user)
):
    # Deck titles are unique per user (R: no two decks with the same name).
    if repo.find_by_title(user.id, body.title) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already have a deck with this name")
    deck = repo.create(user.id, body)
    logger.info("Deck created: {} by {}", deck.id, user.id)
    return deck


@router.get("/{deck_id}", response_model=DeckOut)
async def get_deck(
    deck_id: str,
    repo: DeckRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    return _load(repo, share_repo, deck_id, user.id, Permission.READ)


@router.patch("/{deck_id}", response_model=DeckOut)
async def update_deck(
    deck_id: str,
    body: DeckUpdate,
    repo: DeckRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    deck = _load(repo, share_repo, deck_id, user.id, Permission.EDIT)
    patch = body.model_dump(exclude_unset=True)
    # Enforce per-user unique titles on rename, ignoring the deck itself.
    if "title" in patch and patch["title"] != deck.title:
        clash = repo.find_by_title(deck.owner_id, patch["title"])
        if clash is not None and clash.id != deck_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already have a deck with this name")
    return repo.update(deck_id, patch) if patch else deck


@router.post("/{deck_id}/import", response_model=DeckOut, status_code=status.HTTP_201_CREATED)
async def import_deck(
    deck_id: str,
    repo: DeckRepoDep,
    card_repo: CardRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    """Clone a deck the user can read into their own decks (independent copy)."""
    src = _load(repo, share_repo, deck_id, user.id, Permission.READ)
    title = _unique_title(repo, user.id, src.title)
    clone = repo.create(user.id, DeckCreate(
        title=title, description=src.description, card_template=src.card_template,
    ))
    for card in card_repo.list_for_deck(deck_id):
        data = {f: getattr(card, f) for f in _CARD_COPY_FIELDS if hasattr(card, f)}
        card_repo.create(clone.id, data)
    logger.info("Deck {} imported as {} by {}", deck_id, clone.id, user.id)
    return clone


class DeckAccessOut(BaseModel):
    permission: str
    is_owner: bool
    owner: str | None = None
    granted_by: str | None = None


@router.get("/{deck_id}/access", response_model=DeckAccessOut)
async def deck_access(
    deck_id: str,
    repo: DeckRepoDep,
    share_repo: ShareRepoDep,
    user_repo: UserRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    """What access the current user has on a deck, and from whom."""
    deck = repo.get(deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    shares = share_repo.list_for_deck(deck_id)
    perm = resolve_permission(user.id, deck.owner_id, shares)
    require_permission(perm, Permission.READ)
    is_owner = user.id == deck.owner_id
    granted_by = None
    if not is_owner:
        for s in shares:
            if s.get("grantee_id") == user.id:
                granted_by = user_repo.get_handle(s.get("granted_by"))
                break
    return DeckAccessOut(
        permission=perm.name.lower(),
        is_owner=is_owner,
        owner=user_repo.get_handle(deck.owner_id),
        granted_by=granted_by,
    )


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: str,
    repo: DeckRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    _load(repo, share_repo, deck_id, user.id, Permission.SHARE)
    repo.delete(deck_id)
