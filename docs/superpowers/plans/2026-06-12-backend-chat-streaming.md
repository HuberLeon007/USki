# Backend Chat Streaming + DI Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce FastAPI-native Dependency Injection, refactor AI chat to async with SSE streaming, replace sync endpoint with streaming-only.

**Architecture:** `AIChatService` class with `AsyncOpenAI`, injected via `Annotated[..., Depends()]`. SSE via `StreamingResponse` + `AsyncGenerator`. Frontend consumes `ReadableStream`.

**Tech Stack:** FastAPI, AsyncOpenAI, FastAPI Depends, SSE (text/event-stream)

**Depends on:** `done/2026-06-12-auth-cleanup.md` (rate limiting must be in place first)

---

## File Structure Map

CREATE:
- `backend/src/uski/core/dependencies.py`

MODIFY:
- `frontend/package.json`
- `backend/src/uski/services/ai_chat.py`
- `backend/src/uski/api/chat.py`
- `backend/tests/conftest.py`
- `backend/tests/test_chat.py`

---

## Task 1: Add package.json scripts

**File:** `frontend/package.json`

Replace empty `"scripts": {}` with:

```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "typecheck": "tsc --noEmit",
  "preview": "vite preview"
}
```

**Verify:** `cd frontend && npm run typecheck`

---

## Task 3: Create DI module dependencies.py

**Create:** `backend/src/uski/core/dependencies.py`

```python
"""FastAPI dependency injection for application services."""

from typing import Annotated

from fastapi import Depends, Request

from uski.services.ai_chat import AIChatService


def get_ai_chat_service(request: Request) -> AIChatService:
    """Get or create the AI chat service singleton on app state."""
    if not hasattr(request.app.state, "ai_chat_service"):
        request.app.state.ai_chat_service = AIChatService()
    return request.app.state.ai_chat_service


AIChatServiceDep = Annotated[AIChatService, Depends(get_ai_chat_service)]
```

- [ ] **Step 1:** Create file with exact content above
- [ ] **Step 2:** Verify Python syntax: `cd backend && uv run python -c "from uski.core.dependencies import AIChatServiceDep"` → Expected: FAIL (AIChatService doesn't exist yet)

---

## Task 4: Refactor ai_chat.py to async AIChatService class

**File:** `backend/src/uski/services/ai_chat.py`

Replace entire file content with async class using `openai.AsyncOpenAI`:

```python
"""AI chat service — async with SSE streaming support."""

from collections.abc import AsyncGenerator

from loguru import logger
from openai import AsyncOpenAI

from uski.core.config import settings
from uski.schemas.chat import ChatMessage, ChatRequest, ChatResponse


SYSTEM_PROMPT = (
    "Du bist USki, ein intelligenter Lern-Assistent. "
    "Du hilfst Benutzern beim Lernen mit Flashcards und Karteikarten. "
    "Antworte kurz, praezise und auf Deutsch. "
    "Wenn du etwas nicht weisst, sage es ehrlich."
)


class AIChatService:
    """Async AI chat service using any OpenAI-compatible API."""

    def __init__(self) -> None:
        self._client = AsyncOpenAI(
            base_url=settings.ai_base_url_resolved,
            api_key=settings.AI_API_KEY or "ollama",
        )

    def _build_messages(self, request: ChatRequest) -> list[dict[str, str]]:
        """Build message list with system prompt prepended if missing."""
        messages: list[dict[str, str]] = []
        if not request.messages or request.messages[0].role != "system":
            messages.append({"role": "system", "content": SYSTEM_PROMPT})
        messages.extend([m.model_dump() for m in request.messages])
        return messages

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """Non-streaming chat completion (kept for internal use, not exposed via API)."""
        model = settings.ai_model_resolved
        messages = self._build_messages(request)
        logger.info(f"Chat request to {model} with {len(messages)} messages")
        completion = await self._client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        content = completion.choices[0].message.content or ""
        logger.info(f"Chat response: {len(content)} chars")
        return ChatResponse(
            message=ChatMessage(role="assistant", content=content),
            model=model,
        )

    async def stream(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        """Stream chat completion tokens as SSE events."""
        model = settings.ai_model_resolved
        messages = self._build_messages(request)
        logger.info(f"Streaming chat request to {model} with {len(messages)} messages")
        stream = await self._client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield f"data: {delta.content}\n\n"
        yield "data: [DONE]\n\n"
        logger.info("Streaming chat response complete")
```

- [ ] **Step 1:** Write test for `AIChatService.stream()` in `test_chat.py`
- [ ] **Step 2:** Run test → Expected FAIL
- [ ] **Step 3:** Replace `ai_chat.py` with code above
- [ ] **Step 4:** Run tests → Expected PASS

**Verify:** `cd backend && uv run pytest tests/test_chat.py -v`

---

## Task 5: Streaming-only chat endpoint

**File:** `backend/src/uski/api/chat.py`

Replace entirely. Remove sync endpoint, use DI, only SSE streaming:

```python
"""Chat API — streaming-only via SSE."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from loguru import logger

from uski.core.security import CurrentUser, get_current_user
from uski.schemas.chat import ChatRequest
from uski.core.dependencies import AIChatServiceDep

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    current_user: CurrentUser = Depends(get_current_user),
    ai_chat: AIChatServiceDep = None,
) -> StreamingResponse:
    """Stream AI chat response token-by-token via SSE."""
    logger.info(f"Streaming chat request from user {current_user.id}")
    try:
        return StreamingResponse(
            ai_chat.stream(request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as exc:
        logger.error(f"Chat streaming failed for user {current_user.id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable",
        )
```

**File:** `backend/tests/conftest.py`

Update mock fixture to provide `AIChatService.stream` with async generator:

```python
@pytest.fixture
def mock_ai_chat_service():
    """Mock AIChatService with streaming async generator."""
    mock = MagicMock()

    async def mock_stream(request):
        yield "data: Test\n\n"
        yield "data: response\n\n"
        yield "data: [DONE]\n\n"

    mock.stream = mock_stream
    return mock
```

Override `AIChatServiceDep` in test conftest:

```python
from uski.core.dependencies import get_ai_chat_service

@pytest.fixture(autouse=True)
def override_ai_chat_service(mock_ai_chat_service):
    app.dependency_overrides[get_ai_chat_service] = lambda: mock_ai_chat_service
    yield
    app.dependency_overrides.clear()
```

**File:** `backend/tests/test_chat.py`

Update tests for streaming endpoint. Replace `POST /api/chat` with `POST /api/chat/stream` and read SSE stream:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from uski.main import app


class TestChatStream:
    """Test the streaming chat endpoint."""

    @pytest.mark.anyio
    async def test_stream_returns_sse(self, mock_ai_chat_service):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat/stream",
                json={"messages": [{"role": "user", "content": "Hello"}]},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]
            body = response.text
            assert "data: Test" in body
            assert "data: [DONE]" in body

    @pytest.mark.anyio
    async def test_stream_requires_auth(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat/stream",
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )
            assert response.status_code == 403

    @pytest.mark.anyio
    async def test_stream_empty_messages_422(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat/stream",
                json={"messages": []},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 422
```

**Verify:** `cd backend && uv run pytest tests/ -v` → All tests pass

---

## Execution Order

Tasks MUST run in this order: **1 → 3 → 4 → 5**

| # | Task | Depends On |
|---|------|-----------|
| 1 | package.json scripts | Nothing |
| 3 | DI dependencies.py | Nothing (but needs AIChatService from Task 4 to verify) |
| 4 | Async AIChatService | Tasks 1, 3 |
| 5 | Streaming endpoint | Tasks 3, 4 |

---

## Summary

| Task | Type | Files |
|------|------|-------|
| 1 | chore | `frontend/package.json` |
| 3 | feat | CREATE `backend/src/uski/core/dependencies.py` |
| 4 | refactor | `backend/src/uski/services/ai_chat.py` |
| 5 | feat | `backend/src/uski/api/chat.py`, `backend/tests/conftest.py`, `backend/tests/test_chat.py` |
