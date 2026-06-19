"""Deck and deck-group request/response schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

TitleStr = Annotated[str, Field(min_length=1, max_length=120)]


class DeckGroupCreate(BaseModel):
    name: TitleStr
    parent_group_id: str | None = None


class DeckGroupUpdate(BaseModel):
    name: TitleStr | None = None
    parent_group_id: str | None = None
    position: int | None = None


class DeckGroupOut(BaseModel):
    id: str
    owner_id: str
    parent_group_id: str | None = None
    name: str
    position: int = 0
    created_at: datetime | None = None


class DeckCreate(BaseModel):
    title: TitleStr
    description: str = ""
    group_id: str | None = None
    card_template: str = "default"


class DeckUpdate(BaseModel):
    title: TitleStr | None = None
    description: str | None = None
    group_id: str | None = None
    card_template: str | None = None


class DeckOut(BaseModel):
    id: str
    owner_id: str
    group_id: str | None = None
    title: str
    description: str = ""
    card_template: str = "default"
    created_at: datetime | None = None
    updated_at: datetime | None = None
