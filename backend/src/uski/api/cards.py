"""Card CRUD endpoints, nested under a deck. HTML is sanitized on write and the
card's RAG chunk is re-indexed (best-effort) on every write."""

from fastapi import APIRouter, Depends, HTTPException, status

import uuid

from uski.core.deps import CardRepoDep, ChunkRepoDep, DeckRepoDep, EmbedderDep, ImageRepoDep, ShareRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.deck import DeckOut
from uski.schemas.flashcard import BidirectionalRequest, CardCreate, CardOut, CardUpdate, ReorderRequest
from uski.services.card_content import sanitize
from uski.services.card_index import reindex_card, remove_card_index
from uski.services.images import prune_orphan_images
from uski.services.permissions import Permission, effective_permission, require_permission

router = APIRouter(prefix="/api/decks/{deck_id}/cards", tags=["cards"])


def _check_deck(deck_repo, share_repo, deck_id: str, user_id: str, needed: Permission) -> DeckOut:
    deck = deck_repo.get(deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    require_permission(effective_permission(user_id, deck, share_repo), needed)
    return deck


def _gc_images(owner_id: str, deck_repo, card_repo, image_repo) -> None:
    """Best-effort orphan-image cleanup; never block the card operation on it."""
    try:
        prune_orphan_images(owner_id, image_repo=image_repo, deck_repo=deck_repo, card_repo=card_repo)
    except Exception:  # noqa: BLE001 - GC is housekeeping, not critical path
        pass


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
    make_reverse = data.pop("make_reverse", False)
    data["front_html"] = sanitize(data["front_html"])
    data["back_html"] = sanitize(data["back_html"])
    # Linked basic+reverse cards share a note_id so they can stay in sync.
    if make_reverse and not data.get("note_id"):
        data["note_id"] = str(uuid.uuid4())
    data["card_type"] = "basic"
    card = card_repo.create(deck_id, data)
    reindex_card(card.id, deck_id, deck.owner_id, card.front_html, card.back_html,
                 embedder=embedder, chunk_repo=chunk_repo)

    if make_reverse:
        rev = {**data, "card_type": "reverse",
               "front_json": data["back_json"], "front_html": data["back_html"],
               "back_json": data["front_json"], "back_html": data["front_html"],
               "position": data.get("position", 0) + 1}
        rcard = card_repo.create(deck_id, rev)
        reindex_card(rcard.id, deck_id, deck.owner_id, rcard.front_html, rcard.back_html,
                     embedder=embedder, chunk_repo=chunk_repo)
    return card


@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_cards(
    deck_id: str,
    body: ReorderRequest,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Set card study order (top->bottom) from the given id list (R: drag-drop order)."""
    _check_deck(deck_repo, share_repo, deck_id, user.id, Permission.EDIT)
    for pos, cid in enumerate(body.ordered_ids):
        card_repo.update(cid, {"position": pos})


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
    image_repo: ImageRepoDep,
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

    # Keep linked basic<->reverse cards in sync: mirror content edits onto the
    # sibling's opposite side (R: card types update each other sensibly).
    if card.note_id and any(k in patch for k in ("front_json", "front_html", "back_json", "back_html")):
        for sib in card_repo.list_for_note(card.note_id):
            if sib.id == card.id:
                continue
            mirror: dict = {}
            if sib.card_type != card.card_type:  # opposite orientation -> swap sides
                if "front_html" in patch: mirror["back_html"] = card.front_html
                if "front_json" in patch: mirror["back_json"] = card.front_json
                if "back_html" in patch: mirror["front_html"] = card.back_html
                if "back_json" in patch: mirror["front_json"] = card.back_json
            else:  # same orientation -> copy through
                for k in ("front_json", "front_html", "back_json", "back_html"):
                    if k in patch:
                        mirror[k] = getattr(card, k)
            if mirror:
                s2 = card_repo.update(sib.id, mirror)
                reindex_card(s2.id, deck_id, deck.owner_id, s2.front_html, s2.back_html,
                             embedder=embedder, chunk_repo=chunk_repo)
    # An edit may have removed the last reference to an image -> clean orphans.
    if any(k in patch for k in ("front_html", "back_html")):
        _gc_images(deck.owner_id, deck_repo, card_repo, image_repo)
    return card


@router.post("/{card_id}/bidirectional", response_model=CardOut)
async def set_bidirectional(
    deck_id: str,
    card_id: str,
    body: BidirectionalRequest,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    chunk_repo: ChunkRepoDep,
    embedder: EmbedderDep,
    share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> CardOut:
    """Toggle whether a card is studied in both directions.

    Enabling links a reverse sibling (back->front) under a shared note_id so each
    direction keeps its own FSRS schedule. Disabling removes the reverse sibling.
    Always operates on the note's primary (basic) card, even when called via the
    reverse card. Returns the primary card.
    """
    deck = _check_deck(deck_repo, share_repo, deck_id, user.id, Permission.EDIT)
    card = card_repo.get(card_id)
    if card is None or card.deck_id != deck_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    # Resolve the note's primary (basic) card.
    primary = card
    siblings = card_repo.list_for_note(card.note_id) if card.note_id else [card]
    basic = next((s for s in siblings if s.card_type == "basic"), None)
    if basic is not None:
        primary = basic

    if body.enabled:
        already_linked = bool(primary.note_id) and any(s.id != primary.id for s in card_repo.list_for_note(primary.note_id))
        if already_linked:
            return primary
        note_id = primary.note_id or str(uuid.uuid4())
        if not primary.note_id:
            primary = card_repo.update(primary.id, {"note_id": note_id, "card_type": "basic"})
        rev = {
            "front_json": primary.back_json, "front_html": primary.back_html,
            "back_json": primary.front_json, "back_html": primary.front_html,
            "card_type": "reverse", "note_id": note_id,
            "position": primary.position + 1,
            "group_label": primary.group_label, "group_color": primary.group_color,
        }
        rcard = card_repo.create(deck_id, rev)
        reindex_card(rcard.id, deck_id, deck.owner_id, rcard.front_html, rcard.back_html,
                     embedder=embedder, chunk_repo=chunk_repo)
        return primary

    # Disable: drop every sibling except the primary, then unlink it.
    if primary.note_id:
        for s in card_repo.list_for_note(primary.note_id):
            if s.id != primary.id:
                card_repo.delete(s.id)
                remove_card_index(s.id, chunk_repo=chunk_repo)
        primary = card_repo.update(primary.id, {"note_id": None, "card_type": "basic"})
    return primary


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    deck_id: str,
    card_id: str,
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    chunk_repo: ChunkRepoDep,
    share_repo: ShareRepoDep,
    image_repo: ImageRepoDep,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    deck = _check_deck(deck_repo, share_repo, deck_id, user.id, Permission.EDIT)
    card_repo.delete(card_id)
    remove_card_index(card_id, chunk_repo=chunk_repo)
    # Deleting a card may strand its images -> clean orphans.
    _gc_images(deck.owner_id, deck_repo, card_repo, image_repo)
