"""Deck import endpoint: build a new deck from an uploaded apkg / csv / txt file."""

import re
from urllib.parse import unquote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from loguru import logger
from pydantic import BaseModel

from uski.core.deps import CardRepoDep, DeckRepoDep, ImageRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.deck import DeckCreate
from uski.services.card_content import sanitize
from uski.services.images import store_image
from uski.services.import_cards import parse_apkg, parse_apkg_media, parse_delimited

router = APIRouter(prefix="/api/import", tags=["import"])

# Matches the src of an <img> tag, capturing the prefix, the src value, and the suffix.
_IMG_SRC = re.compile(r'(<img\b[^>]*?\bsrc=["\'])([^"\']+)(["\'])', re.IGNORECASE)


def _localize_images(html: str, media: dict[str, bytes], owner_id: str, image_repo, cache: dict[str, str | None]) -> str:
    """Rewrite ``<img src="file.png">`` to re-hosted URLs for bundled media.

    Each referenced filename is uploaded once (cached), turning the Anki-local
    reference into a USki Storage URL. Non-image or failed media are left as-is.
    """
    def repl(m: re.Match) -> str:
        key = unquote(m.group(2))
        if key not in media:
            return m.group(0)
        if key not in cache:
            try:
                cache[key] = store_image(owner_id, media[key], image_repo)["url"]
            except Exception:  # noqa: BLE001 - non-image / oversized media: skip
                cache[key] = None
        url = cache[key]
        return f"{m.group(1)}{url}{m.group(3)}" if url else m.group(0)

    return _IMG_SRC.sub(repl, html)


class ImportResult(BaseModel):
    deck_id: str
    title: str
    imported: int


def _unique_title(repo, owner_id: str, base: str) -> str:
    if repo.find_by_title(owner_id, base) is None:
        return base
    n = 1
    while True:
        cand = f"{base} (copy)" if n == 1 else f"{base} (copy {n})"
        if repo.find_by_title(owner_id, cand) is None:
            return cand
        n += 1


@router.post("/deck", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_deck_file(
    deck_repo: DeckRepoDep,
    card_repo: CardRepoDep,
    image_repo: ImageRepoDep,
    file: UploadFile = File(...),
    title: str = Form(""),
    delimiter: str = Form(";"),
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new deck from an uploaded file. Format inferred from extension:
    `.apkg` (Anki), otherwise treated as delimited text with the given delimiter."""
    raw = await file.read()
    name = (file.filename or "import").rsplit(".", 1)
    ext = name[1].lower() if len(name) == 2 else ""
    base_title = (title.strip() or name[0]) or "Imported deck"

    try:
        if ext == "apkg":
            pairs = parse_apkg(raw)
            # Re-host any images the package bundled, rewriting their <img> srcs.
            media = parse_apkg_media(raw)
            if media:
                cache: dict[str, str | None] = {}
                pairs = [
                    (_localize_images(f, media, user.id, image_repo, cache),
                     _localize_images(b, media, user.id, image_repo, cache))
                    for f, b in pairs
                ]
        else:  # csv / txt / anything delimited
            pairs = parse_delimited(raw.decode("utf-8", errors="replace"), delimiter)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not pairs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No cards found in file")

    deck = deck_repo.create(user.id, DeckCreate(title=_unique_title(deck_repo, user.id, base_title)))
    for i, (front, back) in enumerate(pairs):
        card_repo.create(deck.id, {
            "front_html": sanitize(front), "back_html": sanitize(back),
            "front_json": {}, "back_json": {}, "position": i,
            "card_type": "basic", "note_id": None, "group_label": None, "group_color": None,
        })
    logger.info("Imported {} cards into deck {} ({})", len(pairs), deck.id, ext or "delimited")
    return ImportResult(deck_id=deck.id, title=deck.title, imported=len(pairs))
