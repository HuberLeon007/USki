"""Card CRUD endpoints, nested under a deck. HTML is sanitized on write and the
card's RAG chunk is re-indexed (best-effort) on every write."""

from fastapi import APIRouter, Depends, HTTPException, status

from uski.core.deps import CardRepoDep, ChunkRepoDep, DeckRepoDep, EmbedderDep, ShareRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.deck import DeckOut
from uski.schemas.flashcard import CardCreate, CardOut, CardUpdate
from uski.services.card_content import sanitize
from uski.services.card_index import reindex_card, remove_card_index
from uski.services.permissions import Permission, effective_permission, require_permission

router = APIRouter(prefix="/api/decks/{deck_id}/cards", tags=["cards"])


def _check_deck(deck_repo, share_repo, deck_id: str, user_id: str, needed: Permission) -> DeckOut:
    deck = deck_repo.get(deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    require_permission(effective_permission(user_id, deck, share_repo), needed)
    return deck


@router.get("", response_model=list[CardOut])
async def list_cards(
    deck_id: str,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> list[CardOut]:
    _check_deck(deck_repo, share_repo, deck_id, user.id, Permission.READ)
    return card_repo.list_for_deck(deck_id)


@router.post("", response_model=CardOut, status_code=status.HTTP_201_CREATED)
async def create_card(
    deck_id: str,
    body: CardCreate,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    chunk_repo: ChunkRepoDep,
    embedder: EmbedderDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> CardOut:
    deck = _check_deck(deck_repo, share_repo, deck_id, user.id, Permission.EDIT)
    data = body.model_dump()
    data["front_html"] = sanitize(data["front_html"])
    data["back_html"] = sanitize(data["back_html"])
    card = card_repo.create(deck_id, data)
    reindex_card(card.id, deck_id, deck.owner_id, card.front_html, card.back_html,
                 embedder=embedder, chunk_repo=chunk_repo)
    return card


@router.patch("/{card_id}", response_model=CardOut)
async def update_card(
    deck_id: str,
    card_id: str,
    body: CardUpdate,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    chunk_repo: ChunkRepoDep,
    embedder: EmbedderDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> CardOut:
    deck = _check_deck(deck_repo, share_repo, deck_id, user.id, Permission.EDIT)
    patch = body.model_dump(exclude_unset=True)
    if "front_html" in patch:
        patch["front_html"] = sanitize(patch["front_html"])
    if "back_html" in patch:
        patch["back_html"] = sanitize(patch["back_html"])
    if not patch:
        existing = card_repo.get(card_id)
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
        return existing
    card = card_repo.update(card_id, patch)
    reindex_card(card.id, deck_id, deck.owner_id, card.front_html, card.back_html,
                 embedder=embedder, chunk_repo=chunk_repo)
    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    deck_id: str,
    card_id: str,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    chunk_repo: ChunkRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    _check_deck(deck_repo, share_repo, deck_id, user.id, Permission.EDIT)
    card_repo.delete(card_id)
    remove_card_index(card_id, chunk_repo=chunk_repo)
