# Local Dev Mode: Supabase CLI + Ollama Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make USki run 100% locally without internet in dev mode, using Supabase CLI (local Postgres + Auth + Inbucket) and Ollama (local LLM), with a clean dev/prod environment switch.

**Architecture:** APP_MODE=dev|prod environment variable controls backend services. Dev mode: local Supabase (localhost:54321) + Ollama (localhost:11434). Prod mode: Supabase Cloud + Google Gemini. The AI chat service uses the openai Python library with configurable base_url. Ollama exposes OpenAI-compatible API, so code is identical for both modes.

**Tech Stack:** Supabase CLI, Docker, Ollama, openai Python SDK, FastAPI, React, TypeScript

**Recommended Model:** qwen3:4b (best German quality, ~3.5GB RAM, runs on CPU). Mobile later: gemma3:1b or qwen3:1.7b.

---

## Files to CREATE
| File | Responsibility |
|---|---|
| .env.example | All env vars with dev/prod comments |
| docker-compose.dev.yml | Dev-only: Ollama service |
| supabase/config.toml | Supabase CLI local config |
| backend/src/uski/services/ai_chat.py | AI chat via OpenAI-compatible API |
| backend/src/uski/api/chat.py | POST /api/chat endpoint |
| backend/tests/test_chat.py | Chat endpoint tests |
| frontend/src/components/chat/ChatPanel.tsx | Chat UI |
| frontend/src/components/chat/ChatMessage.tsx | Message bubble |
| frontend/src/components/chat/index.ts | Barrel export |

## Files to MODIFY
| File | Change |
|---|---|
| backend/pyproject.toml | Add openai dependency |
| backend/src/uski/core/config.py | Add APP_MODE, resolved properties |
| backend/src/uski/api/router.py | Include chat router |
| backend/src/uski/schemas/chat.py | Chat schemas |
| frontend/src/lib/api.ts | sendChatMessage function |
| frontend/src/pages/DashboardPage.tsx | Integrate ChatPanel |
| knowledge.md | Document dev/prod setup |

---

## Task 1: Environment Configuration

**Files:** Create .env.example, Modify backend/src/uski/core/config.py

### Step 1: Create .env.example

```bash
# === APP MODE ===
APP_MODE=dev

# === SUPABASE ===
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# === FRONTEND ===
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=

# === BACKEND ===
BACKEND_CORS_ORIGINS=http://localhost:5173
BACKEND_LOG_LEVEL=DEBUG

# === AI PROVIDER ===
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=qwen3:4b

# === OLLAMA ===
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
```

### Step 2: Update config.py

```python
"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings loaded from environment variables."""

    APP_MODE: str = "dev"
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"
    BACKEND_LOG_LEVEL: str = "INFO"
    AI_BASE_URL: str = ""
    AI_API_KEY: str = ""
    AI_MODEL: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3:4b"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",")]

    @property
    def jwks_url(self) -> str:
        return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def is_dev(self) -> bool:
        return self.APP_MODE == "dev"

    @property
    def ai_base_url_resolved(self) -> str:
        if self.AI_BASE_URL:
            return self.AI_BASE_URL
        if self.is_dev:
            return f"{self.OLLAMA_BASE_URL}/v1"
        return ""

    @property
    def ai_model_resolved(self) -> str:
        if self.AI_MODEL:
            return self.AI_MODEL
        if self.is_dev:
            return self.OLLAMA_MODEL
        return ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
```

### Step 3: Verify config loads

Run: cd backend && uv run python -c "from uski.core.config import settings; print(settings.APP_MODE, settings.ai_base_url_resolved)"
Expected: dev http://localhost:11434/v1

### Step 4: Commit

```bash
git add .env.example backend/src/uski/core/config.py
git commit -m "feat: add dev/prod mode switch with env configuration"
```

---

## Task 2: Supabase CLI Local Setup

### Step 1: Run supabase init
Run: supabase init (if supabase/config.toml does not exist)

### Step 2: Start local Supabase
Run: supabase start
Expected: API URL http://localhost:54321, Studio at :54323, Inbucket at :54324
Copy the anon key and service role key into .env

### Step 3: Commit

```bash
git add supabase/
git commit -m "feat: add Supabase CLI config for local development"
```

---

## Task 3: Ollama Docker Compose

### Step 1: Create docker-compose.dev.yml

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: uski-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0

volumes:
  ollama_data:
```

### Step 2: Start Ollama and pull model

Run: docker compose -f docker-compose.dev.yml up ollama -d
Run: docker exec uski-ollama ollama pull qwen3:4b

### Step 3: Test model

Run: curl http://localhost:11434/v1/chat/completions -H "Content-Type: application/json" -d {"model":"qwen3:4b","messages":[{"role":"user","content":"Was ist FSRS?"}]}
Expected: JSON response with German explanation.

### Step 4: Commit

```bash
git add docker-compose.dev.yml
git commit -m "feat: add Ollama service for local dev"
```

---

## Task 4: AI Chat Service

### Step 1: Add openai dependency
Run: cd backend && uv add openai

### Step 2: Implement schemas/chat.py

```python
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    deck_id: str | None = None

class ChatResponse(BaseModel):
    message: ChatMessage
    model: str
```

### Step 3: Implement services/ai_chat.py

```python
from openai import OpenAI
from loguru import logger
from uski.core.config import settings
from uski.schemas.chat import ChatMessage, ChatRequest, ChatResponse

SYSTEM_PROMPT = (
    "Du bist USki, ein intelligenter Lern-Assistent. "
    "Du hilfst Benutzern beim Lernen mit Flashcards. "
    "Antworte kurz und auf Deutsch."
)

def _get_client() -> OpenAI:
    return OpenAI(base_url=settings.ai_base_url_resolved, api_key=settings.AI_API_KEY or "ollama")

def chat(request: ChatRequest) -> ChatResponse:
    client = _get_client()
    model = settings.ai_model_resolved
    messages = []
    if not request.messages or request.messages[0].role != "system":
        messages.append({"role": "system", "content": SYSTEM_PROMPT})
    messages.extend([m.model_dump() for m in request.messages])
    completion = client.chat.completions.create(model=model, messages=messages, temperature=0.7, max_tokens=1024)
    content = completion.choices[0].message.content or ""
    return ChatResponse(message=ChatMessage(role="assistant", content=content), model=model)
```

### Step 4: Commit

```bash
git add backend/pyproject.toml backend/src/uski/schemas/chat.py backend/src/uski/services/ai_chat.py
git commit -m "feat: implement AI chat service with OpenAI-compatible API"
```

---

## Task 5: Chat API Endpoint

### Step 1: Create api/chat.py

```python
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.chat import ChatRequest, ChatResponse
from uski.services.ai_chat import chat as ai_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.post("", response_model=ChatResponse)
async def send_message(request: ChatRequest, current_user: CurrentUser = Depen
