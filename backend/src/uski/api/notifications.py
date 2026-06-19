"""Permission-change notifications, shown to the user at next login."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from uski.core.deps import NotificationRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.sharing import NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class SeenRequest(BaseModel):
    ids: list[str]


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    repo: NotificationRepoDep, user: CurrentUser = Depends(get_current_user)
):
    return repo.list_unseen(user.id)


@router.post("/seen", status_code=204)
async def mark_seen(
    body: SeenRequest, repo: NotificationRepoDep, user: CurrentUser = Depends(get_current_user)
):
    repo.mark_seen(user.id, body.ids)
