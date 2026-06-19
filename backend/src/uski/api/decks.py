"""Deck CRUD. Thin adapter; logic in repos + the permissions seam."""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from uski.core.deps import DeckRepoDep, ShareRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.deck import DeckCreate, DeckOut, DeckUpdate
from uski.services.permissions import Permission, effective_permission, require_permission

router = APIRouter(prefix="/api/decks", tags=["decks"])


def _load(repo, share_repo, deck_id: str, user_id: str, needed: Permission) -> DeckOut:
    deck = repo.get(deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    require_permission(effective_permission(user_id, deck, share_repo), needed)
    return deck


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
    _load(repo, share_repo, deck_id, user.id, Permission.EDIT)
    patch = body.model_dump(exclude_unset=True)
    return repo.update(deck_id, patch) if patch else _load(
        repo, share_repo, deck_id, user.id, Permission.EDIT
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
