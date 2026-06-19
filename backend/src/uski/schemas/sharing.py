"""Sharing / RBAC schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Perm = Literal["read", "edit", "share"]


class ShareGrant(BaseModel):
    username: str
    discriminator: str
    permission: Perm = "read"


class ShareOut(BaseModel):
    deck_id: str
    grantee_id: str
    permission: Perm
    created_at: datetime | None = None


class InviteCreate(BaseModel):
    permission: Perm = "read"


class InviteOut(BaseModel):
    code: str
    deck_id: str
    permission: Perm


class RedeemRequest(BaseModel):
    code: str = Field(min_length=4, max_length=64)


class NotificationOut(BaseModel):
    id: str
    deck_id: str | None = None
    kind: str
    message: str
    seen: bool = False
    created_at: datetime | None = None


class AccessLogOut(BaseModel):
    id: str
    deck_id: str
    actor_id: str | None = None
    event_type: str
    detail: dict = {}
    created_at: datetime | None = None
