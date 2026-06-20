"""AI chat service — works with any OpenAI-compatible API (Ollama, Gemini, OpenAI)."""

from collections.abc import Iterator
import threading

from openai import OpenAI
from loguru import logger

from uski.core.config import settings
from uski.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from uski.services import ai_providers


SYSTEM_PROMPT = (
    "You are Sero, the friendly study assistant for USki. "
    "You only answer the user's questions about their study material and flashcards. "
    "You do NOT create cards and you do NOT run quizzes — you are here to answer questions. "
    "Base your answers on the user's card content when it is provided. "
    "Always reply in English by default, unless the user clearly writes in another language. "
    "Keep answers short and precise, in PLAIN TEXT: no markdown formatting, no asterisks, "
    "no bold, no headings, no bullet characters. "
    "If you don't know something, say so honestly."
)


_clients: dict[tuple[str, str], OpenAI] = {}
_clients_lock = threading.Lock()


def _client_for(base_url: str, api_key: str) -> OpenAI:
    """Return a cached OpenAI-compatible client per (base_url, api_key).

    Clients are thread-safe (httpx connection pool), so sharing one per target
    across the request threadpool is correct and lets users chat concurrently.
    """
    key = (base_url, api_key)
    client = _clients.get(key)
    if client is None:
        with _clients_lock:
            client = _clients.get(key)
            if client is None:
                client = OpenAI(base_url=base_url, api_key=api_key or "ollama")
                _clients[key] = client
    return client


def _resolve_target() -> tuple[OpenAI, str]:
    """Pick (client, model) for this request.

    Dev: always the single local Ollama. Prod: round-robin the provider pool
    (multiple free API keys/endpoints in parallel); falls back to the single
    AI_BASE_URL/AI_MODEL when no pool is configured.
    """
    if not settings.is_dev:
        prov = ai_providers.next_chat_provider()
        if prov is not None:
            return _client_for(prov.base_url, prov.api_key), prov.model
    return _client_for(settings.ai_base_url_resolved, settings.AI_API_KEY), settings.ai_model_resolved


def _prepare_messages(request: ChatRequest) -> list[dict]:
    """Build the OpenAI message list, injecting the default system prompt if absent."""
    messages: list[dict] = []
    if not request.messages or request.messages[0].role != "system":
        messages.append({"role": "system", "content": SYSTEM_PROMPT})
    messages.extend([m.model_dump() for m in request.messages])
    return messages


def chat(request: ChatRequest) -> ChatResponse:
    """Send a chat completion request to the AI provider."""
    client, model = _resolve_target()
    messages = _prepare_messages(request)

    logger.info(f"Chat request to {model} with {len(messages)} messages")

    completion = client.chat.completions.create(
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


def chat_stream(request: ChatRequest) -> Iterator[str]:
    """Stream the assistant reply as text deltas (token by token)."""
    client, model = _resolve_target()
    messages = _prepare_messages(request)

    logger.info(f"Streaming chat to {model} with {len(messages)} messages")

    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=1024,
        stream=True,
    )
    for chunk in completion:
        try:
            delta = chunk.choices[0].delta.content or ""
        except (IndexError, AttributeError):
            delta = ""
        if delta:
            yield delta
