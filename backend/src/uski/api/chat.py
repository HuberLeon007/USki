"""Chat API. When a deck_id is given, answers are grounded in that deck's cards
(RAG over card content). Otherwise a plain assistant reply."""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from loguru import logger

from uski.core.deps import ChunkRepoDep, DeckRepoDep, EmbedderDep, ShareRepoDep
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from uski.services.ai_chat import chat as ai_chat
from uski.services.ai_chat import chat_stream as ai_chat_stream
from uski.services import rag
from uski.services.permissions import Permission, require_permission, resolve_permission

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def send_message(
    request: ChatRequest,
    deck_repo: DeckRepoDep,
    chunk_repo: ChunkRepoDep,
    embedder: EmbedderDep,
    share_repo: ShareRepoDep,
    current_user: CurrentUser = Depends(get_current_user),
) -> ChatResponse:
    # NOTE: sync `def` on purpose — the model call is blocking, so FastAPI runs
    # this route in its worker threadpool, letting many users chat concurrently
    # instead of serializing on the event loop.
    logger.info("Chat from {} deck={}", current_user.id, request.deck_id)

    if request.deck_id:
        deck = deck_repo.get(request.deck_id)
        if deck is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
        require_permission(
            resolve_permission(current_user.id, deck.owner_id, shares=share_repo.list_for_deck(request.deck_id)),
            Permission.READ,
        )
        question = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
        contexts = rag.retrieve_context(
            question, deck.owner_id, request.deck_id,
            embedder=embedder, chunk_repo=chunk_repo,
        )
        system = ChatMessage(role="system", content=rag.build_system_prompt(contexts, deck.title))
        request = request.model_copy(update={"messages": [system, *request.messages]})
    else:
        # No deck open: ground across all of the user's decks (cross-deck RAG).
        # Best-effort: if retrieval fails, still answer without grounding.
        try:
            question = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
            deck_ids = [d.id for d in deck_repo.list_for(current_user.id)]
            contexts = rag.retrieve_context_all(
                question, current_user.id, deck_ids, embedder=embedder, chunk_repo=chunk_repo,
            )
            if contexts:
                system = ChatMessage(role="system", content=rag.build_system_prompt(contexts))
                request = request.model_copy(update={"messages": [system, *request.messages]})
        except Exception as exc:  # noqa: BLE001
            logger.warning("Cross-deck RAG skipped: {}", exc)

    try:
        return ai_chat(request)
    except Exception as exc:
        logger.error("Chat failed for {}: {}", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable",
        )


@router.post("/stream")
async def stream_message(
    request: ChatRequest,
    deck_repo: DeckRepoDep,
    chunk_repo: ChunkRepoDep,
    embedder: EmbedderDep,
    share_repo: ShareRepoDep,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Stream the reply as Server-Sent Events so the client renders it live.

    Emits JSON events: {"type":"status","text":...} for progress (e.g. reading a
    deck), {"type":"delta","text":...} for each token chunk, then
    {"type":"done"} or {"type":"error",...}.
    """
    logger.info("Chat stream from {} deck={}", current_user.id, request.deck_id)

    # Resolve deck + permission up front so auth errors are proper HTTP responses.
    deck = None
    if request.deck_id:
        deck = deck_repo.get(request.deck_id)
        if deck is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
        require_permission(
            resolve_permission(current_user.id, deck.owner_id, shares=share_repo.list_for_deck(request.deck_id)),
            Permission.READ,
        )

    def sse(obj: dict) -> str:
        return f"data: {json.dumps(obj)}\n\n"

    def generate():
        try:
            req = request
            if deck is not None:
                yield sse({"type": "status", "text": f"Reading through {deck.title}"})
                question = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
                contexts = rag.retrieve_context(
                    question, deck.owner_id, request.deck_id,
                    embedder=embedder, chunk_repo=chunk_repo,
                )
                system = ChatMessage(role="system", content=rag.build_system_prompt(contexts, deck.title))
                req = request.model_copy(update={"messages": [system, *request.messages]})
            else:
                yield sse({"type": "status", "text": "Searching across your decks"})
                question = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
                deck_ids = [d.id for d in deck_repo.list_for(current_user.id)]
                contexts = rag.retrieve_context_all(
                    question, current_user.id, deck_ids, embedder=embedder, chunk_repo=chunk_repo,
                )
                if contexts:
                    system = ChatMessage(role="system", content=rag.build_system_prompt(contexts))
                    req = request.model_copy(update={"messages": [system, *request.messages]})
            yield sse({"type": "status", "text": "Thinking"})
            for delta in ai_chat_stream(req):
                yield sse({"type": "delta", "text": delta})
            yield sse({"type": "done"})
        except Exception as exc:  # noqa: BLE001 - surface a graceful error event
            logger.error("Chat stream failed for {}: {}", current_user.id, exc)
            yield sse({"type": "error", "text": "AI service temporarily unavailable"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
