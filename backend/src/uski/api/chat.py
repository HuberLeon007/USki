"""Chat API. When a deck_id is given, answers are grounded in that deck's cards
(RAG over card content). Otherwise a plain assistant reply."""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from uski.core.deps import ChunkRepoDep, DeckRepoDep, EmbedderDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from uski.services.ai_chat import chat as ai_chat
from uski.services import rag
from uski.services.permissions import Permission, require_permission, resolve_permission

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    deck_repo: DeckRepoDep,
    chunk_repo: ChunkRepoDep,
    embedder: EmbedderDep,
    current_user: CurrentUser = Depends(get_current_user),
) -> ChatResponse:
    logger.info("Chat from {} deck={}", current_user.id, request.deck_id)

    if request.deck_id:
        deck = deck_repo.get(request.deck_id)
        if deck is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
        require_permission(
            resolve_permission(current_user.id, deck.owner_id, shares=[]), Permission.READ
        )
        question = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
        contexts = rag.retrieve_context(
            question, deck.owner_id, request.deck_id,
            embedder=embedder, chunk_repo=chunk_repo,
        )
        system = ChatMessage(role="system", content=rag.build_system_prompt(contexts))
        request = request.model_copy(update={"messages": [system, *request.messages]})

    try:
        return ai_chat(request)
    except Exception as exc:
        logger.error("Chat failed for {}: {}", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable",
        )
