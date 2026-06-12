"""Chat API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from uski.core.security import CurrentUser, get_current_user
from uski.schemas.chat import ChatRequest, ChatResponse
from uski.services.ai_chat import chat as ai_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ChatResponse:
    """Send a chat message and get an AI response."""
    logger.info(f"Chat request from user {current_user.id}")
    try:
        return ai_chat(request)
    except Exception as exc:
        logger.error(f"Chat failed for user {current_user.id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable",
        )
