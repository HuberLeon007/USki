"""Development-only utilities.

These endpoints exist purely to make local iteration easier and are hard-gated
behind `settings.is_dev` — in any non-dev mode they return 404 and do nothing.
They are intentionally unauthenticated so they work from the logged-out landing
page (e.g. wiping the DB after running out of test emails). NEVER enable dev
mode in a deployed environment.
"""

from fastapi import APIRouter, HTTPException, status
from loguru import logger

from uski.core.config import settings
from uski.core.supabase import get_supabase_client

router = APIRouter(prefix="/api/dev", tags=["dev"])


def _require_dev() -> None:
    if not settings.is_dev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


@router.post("/wipe")
def wipe_database() -> dict:
    """Delete every auth user (dev only).

    All app tables FK to `public.user` which FKs to `auth.users` with
    ON DELETE CASCADE, so removing the auth users wipes every deck, card,
    schedule, share, image row, etc. — and frees the emails for re-registration.
    """
    _require_dev()
    db = get_supabase_client()
    deleted = 0
    page = 1
    while True:
        try:
            resp = db.auth.admin.list_users(page=page, per_page=200)
        except Exception as exc:  # noqa: BLE001 - dev convenience, never critical
            logger.warning("dev wipe: list_users failed: {}", exc)
            break
        users = resp if isinstance(resp, list) else (getattr(resp, "users", None) or [])
        if not users:
            break
        for u in users:
            uid = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
            if not uid:
                continue
            try:
                db.auth.admin.delete_user(uid)
                deleted += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("dev wipe: delete_user {} failed: {}", uid, exc)
        if len(users) < 200:
            break
        page += 1
    logger.info("dev wipe: deleted {} auth user(s)", deleted)
    return {"ok": True, "deleted_users": deleted}
