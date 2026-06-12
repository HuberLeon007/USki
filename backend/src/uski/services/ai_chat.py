"""AI chat service — works with any OpenAI-compatible API (Ollama, Gemini, OpenAI)."""

from openai import OpenAI
from loguru import logger

from uski.core.config import settings
from uski.schemas.chat import ChatMessage, ChatRequest, ChatResponse


SYSTEM_PROMPT = (
    "Du bist USki, ein intelligenter Lern-Assistent. "
    "Du hilfst Benutzern beim Lernen mit Flashcards und Karteikarten. "
    "Antworte kurz, praezise und auf Deutsch. "
    "Wenn du etwas nicht weisst, sage es ehrlich."
)


_client: OpenAI | None = None


def _get_client() -> OpenAI:
    """Return a cached OpenAI-compatible client."""
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=settings.ai_base_url_resolved,
            api_key=settings.AI_API_KEY or "ollama",
        )
    return _client


def chat(request: ChatRequest) -> ChatResponse:
    """Send a chat completion request to the AI provider."""
    client = _get_client()
    model = settings.ai_model_resolved

    messages = []
    if not request.messages or request.messages[0].role != "system":
        messages.append({"role": "system", "content": SYSTEM_PROMPT})
    messages.extend([m.model_dump() for m in request.messages])

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
