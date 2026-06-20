"""Flashcard request/response schemas."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

CardType = Literal["basic", "reverse"]


class CardCreate(BaseModel):
    front_json: dict[str, Any] = Field(default_factory=dict)
    front_html: str = ""
    back_json: dict[str, Any] = Field(default_factory=dict)
    back_html: str = ""
    position: int = 0
    card_type: CardType = "basic"
    note_id: str | None = None
    group_label: str | None = None
    group_color: str | None = None
    # When true, also create the linked reverse card (back->front) sharing note_id.
    make_reverse: bool = False


class CardUpdate(BaseModel):
    front_json: dict[str, Any] | None = None
    front_html: str | None = None
    back_json: dict[str, Any] | None = None
    back_html: str | None = None
    position: int | None = None
    group_label: str | None = None
    group_color: str | None = None


class CardOut(BaseModel):
    id: str
    deck_id: str
    front_json: dict[str, Any] = Field(default_factory=dict)
    front_html: str = ""
    back_json: dict[str, Any] = Field(default_factory=dict)
    back_html: str = ""
    position: int = 0
    card_type: CardType = "basic"
    note_id: str | None = None
    group_label: str | None = None
    group_color: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ReorderRequest(BaseModel):
    """Ordered list of card ids defining the new study order (top to bottom)."""
    ordered_ids: list[str]


class BidirectionalRequest(BaseModel):
    """Toggle whether a card is studied in both directions (front<->back).

    Enabling links a reverse sibling under a shared note_id; disabling removes
    the reverse sibling so only the original direction remains.
    """
    enabled: bool


class IntervalPreview(BaseModel):
    """Human-readable next intervals per rating button (FSRS preview)."""
    again: str
    hard: str
    good: str
    easy: str
