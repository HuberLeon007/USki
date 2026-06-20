"""Image upload + storage-usage endpoints. Thin adapter over the images service."""

from fastapi import APIRouter, Depends, File, UploadFile

from uski.core.deps import ImageRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.services.images import store_image, storage_usage

router = APIRouter(prefix="/api/images", tags=["images"])


@router.post("")
async def upload_image(
    repo: ImageRepoDep,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload an inline card image. Downscaled to WebP, deduped, quota-checked."""
    raw = await file.read()
    return store_image(user.id, raw, repo)


@router.get("/usage")
async def usage(repo: ImageRepoDep, user: CurrentUser = Depends(get_current_user)):
    """Current storage usage vs the 50 MB quota."""
    return storage_usage(user.id, repo)
