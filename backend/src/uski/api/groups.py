"""Deck-group (folder) CRUD. Owner-scoped."""

from fastapi import APIRouter, Depends, HTTPException, status

from uski.core.deps import GroupRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.deck import DeckGroupCreate, DeckGroupOut, DeckGroupUpdate

router = APIRouter(prefix="/api/groups", tags=["groups"])


def _owned(repo, group_id: str, user_id: str) -> DeckGroupOut:
    g = repo.get(group_id)
    if g is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if g.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your group")
    return g


@router.get("", response_model=list[DeckGroupOut])
async def list_groups(repo: GroupRepoDep, user: CurrentUser = Depends(get_current_user)):
    return repo.list_for(user.id)


@router.post("", response_model=DeckGroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: DeckGroupCreate, repo: GroupRepoDep, user: CurrentUser = Depends(get_current_user)
):
    return repo.create(user.id, body)


@router.patch("/{group_id}", response_model=DeckGroupOut)
async def update_group(
    group_id: str,
    body: DeckGroupUpdate,
    repo: GroupRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    _owned(repo, group_id, user.id)
    patch = body.model_dump(exclude_unset=True)
    return repo.update(group_id, patch) if patch else _owned(repo, group_id, user.id)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str, repo: GroupRepoDep, user: CurrentUser = Depends(get_current_user)
):
    _owned(repo, group_id, user.id)
    repo.delete(group_id)
