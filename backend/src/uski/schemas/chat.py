"""Chat request and response schemas."""

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    """Incoming chat request from the frontend."""

    messages: list[ChatMessage] = Field(..., min_length=1)
    deck_id: str | None = None


class ChatResponse(BaseModel):
    """AI chat response."""

    message: ChatMessage
    model: str
