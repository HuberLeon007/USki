"""Image processing + storage seam.

`store_image` is the one entry point: it downscales the upload, encodes WebP,
content-hashes the bytes, deduplicates per user, enforces the storage quota,
uploads to the Storage bucket, records metadata, and returns a public URL.
All the Pillow / Storage / hashing detail stays hidden behind this function.
"""

from __future__ import annotations

import hashlib
import io
import re

from fastapi import HTTPException, status
from loguru import logger
from PIL import Image

from uski.core.config import settings
from uski.core.supabase import get_supabase_client
from uski.repos.images import ImageRepo

BUCKET = "card-images"
MAX_EDGE = 1600          # px: long edge after downscale
WEBP_QUALITY = 80
QUOTA_BYTES = 50 * 1024 * 1024  # 50 MB per user


def _encode_webp(raw: bytes) -> tuple[bytes, int, int]:
    """Downscale (keep aspect, max long edge) and encode to WebP. Returns bytes+size."""
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception as exc:  # noqa: BLE001 - any decode failure -> 400
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image") from exc
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.mode else "RGB")
    w, h = img.size
    scale = min(1.0, MAX_EDGE / max(w, h))
    if scale < 1.0:
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=WEBP_QUALITY, method=4)
    return out.getvalue(), img.width, img.height


def store_image(owner_id: str, raw: bytes, repo: ImageRepo) -> dict:
    """Process + store an image; dedup + quota enforced. Returns {url, sha256, ...}."""
    webp, w, h = _encode_webp(raw)
    sha = hashlib.sha256(webp).hexdigest()
    path = f"{owner_id}/{sha}.webp"
    public_url = f"{settings.storage_public_base}/storage/v1/object/public/{BUCKET}/{path}"

    existing = repo.get(owner_id, sha)
    if existing is not None:  # identical bytes already stored -> reuse, no quota cost
        return {"url": public_url, "sha256": sha, "bytes": existing["bytes"],
                "width": existing["width"], "height": existing["height"], "deduped": True}

    if repo.total_bytes(owner_id) + len(webp) > QUOTA_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Storage quota exceeded (50 MB). Delete some images first.",
        )

    db = get_supabase_client()
    db.storage.from_(BUCKET).upload(
        path, webp, {"content-type": "image/webp", "upsert": "true"}
    )
    repo.create(owner_id, sha, path, len(webp), w, h)
    logger.info("Image stored owner={} sha={} bytes={}", owner_id, sha[:8], len(webp))
    return {"url": public_url, "sha256": sha, "bytes": len(webp), "width": w, "height": h, "deduped": False}


def storage_usage(owner_id: str, repo: ImageRepo) -> dict:
    used = repo.total_bytes(owner_id)
    return {"used_bytes": used, "quota_bytes": QUOTA_BYTES}


# A stored image path is "<owner>/<sha256>.webp"; the URL embeds the same sha.
_SHA_RE = re.compile(r"([0-9a-f]{64})\.webp")


def referenced_shas(html_fragments: list[str]) -> set[str]:
    """Collect the sha256 of every card-image referenced across the given HTML."""
    found: set[str] = set()
    for html in html_fragments:
        if html:
            found.update(_SHA_RE.findall(html))
    return found


def prune_orphan_images(owner_id: str, *, image_repo: ImageRepo, deck_repo, card_repo) -> int:
    """Delete the owner's images that no card references anymore.

    Best-effort garbage collection: scans every card the owner owns, builds the
    set of still-referenced image hashes, and removes any stored image whose
    hash is absent. Storage + metadata are both cleaned. Returns the count
    removed. Callers should run this after a card edit/delete (references can
    only shrink there); on pure create nothing becomes orphaned.
    """
    fragments: list[str] = []
    for deck in deck_repo.list_for(owner_id):
        for card in card_repo.list_for_deck(deck.id):
            fragments.append(card.front_html)
            fragments.append(card.back_html)
    keep = referenced_shas(fragments)

    db = get_supabase_client()
    removed = 0
    for img in image_repo.list_for_owner(owner_id):
        if img["sha256"] in keep:
            continue
        try:
            db.storage.from_(BUCKET).remove([img["path"]])
        except Exception as exc:  # noqa: BLE001 - storage hiccup must not block the GC
            logger.warning("Orphan image storage delete failed path={} err={}", img["path"], exc)
        image_repo.delete(owner_id, img["sha256"])
        removed += 1
    if removed:
        logger.info("Pruned {} orphan image(s) for owner={}", removed, owner_id)
    return removed
