"""Flashcard request/response schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CardCreate(BaseModel):
    front_json: dict[str, Any] = Field(default_factory=dict)
    front_html: str = ""
    back_json: dict[str, Any] = Field(default_factory=dict)
    back_html: str = ""
    position: int = 0


class CardUpdate(BaseModel):
    front_json: dict[str, Any] | None = None
    front_html: str | None = None
    back_json: dict[str, Any] | None = None
    back_html: str | None = None
    position: int | None = None


class CardOut(BaseModel):
    id: str
    deck_id: str
    front_json: dict[str, Any] = Field(default_factory=dict)
    front_html: str = ""
    back_json: dict[str, Any] = Field(default_factory=dict)
    back_html: str = ""
    position: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None
