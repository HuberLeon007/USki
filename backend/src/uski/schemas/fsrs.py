"""FSRS review schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Rating = Literal["again", "hard", "good", "easy"]


class ReviewRequest(BaseModel):
    rating: Rating


class ReviewResult(BaseModel):
    card_id: str
    due: datetime
    state: int


class DueCount(BaseModel):
    deck_id: str
    due: int
