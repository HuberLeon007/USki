"""FastAPI dependency providers for repositories.

Routers depend on these (not on concrete adapters), so tests override them with
in-memory fakes via `app.dependency_overrides`.
"""

from typing import Annotated

from fastapi import Depends

from uski.repos.decks import DeckRepo, SupabaseDeckRepo
from uski.repos.cards import CardRepo, SupabaseCardRepo
from uski.repos.images import ImageRepo, SupabaseImageRepo
from uski.repos.groups import GroupRepo, SupabaseGroupRepo
from uski.repos.schedules import ScheduleRepo, SupabaseScheduleRepo
from uski.repos.chunks import ChunkRepo, SupabaseChunkRepo
from uski.repos.presence import PresenceRepo, SupabasePresenceRepo
from uski.services.embeddings import Embedder, OllamaEmbedder
from uski.repos.sharing import (
    AuditRepo, InviteRepo, NotificationRepo, ShareRepo, UserRepo,
    SupabaseAuditRepo, SupabaseInviteRepo, SupabaseNotificationRepo,
    SupabaseShareRepo, SupabaseUserRepo,
)


def get_deck_repo() -> DeckRepo:
    return SupabaseDeckRepo()


def get_card_repo() -> CardRepo:
    return SupabaseCardRepo()


def get_image_repo() -> ImageRepo:
    return SupabaseImageRepo()


def get_group_repo() -> GroupRepo:
    return SupabaseGroupRepo()


def get_schedule_repo() -> ScheduleRepo:
    return SupabaseScheduleRepo()


def get_chunk_repo() -> ChunkRepo:
    return SupabaseChunkRepo()


def get_embedder() -> Embedder:
    return OllamaEmbedder()


def get_share_repo() -> ShareRepo:
    return SupabaseShareRepo()


def get_invite_repo() -> InviteRepo:
    return SupabaseInviteRepo()


def get_audit_repo() -> AuditRepo:
    return SupabaseAuditRepo()


def get_notification_repo() -> NotificationRepo:
    return SupabaseNotificationRepo()


def get_user_repo() -> UserRepo:
    return SupabaseUserRepo()


def get_presence_repo() -> PresenceRepo:
    return SupabasePresenceRepo()


DeckRepoDep = Annotated[DeckRepo, Depends(get_deck_repo)]
CardRepoDep = Annotated[CardRepo, Depends(get_card_repo)]
ImageRepoDep = Annotated[ImageRepo, Depends(get_image_repo)]
GroupRepoDep = Annotated[GroupRepo, Depends(get_group_repo)]
ScheduleRepoDep = Annotated[ScheduleRepo, Depends(get_schedule_repo)]
ChunkRepoDep = Annotated[ChunkRepo, Depends(get_chunk_repo)]
EmbedderDep = Annotated[Embedder, Depends(get_embedder)]
ShareRepoDep = Annotated[ShareRepo, Depends(get_share_repo)]
InviteRepoDep = Annotated[InviteRepo, Depends(get_invite_repo)]
AuditRepoDep = Annotated[AuditRepo, Depends(get_audit_repo)]
NotificationRepoDep = Annotated[NotificationRepo, Depends(get_notification_repo)]
UserRepoDep = Annotated[UserRepo, Depends(get_user_repo)]
PresenceRepoDep = Annotated[PresenceRepo, Depends(get_presence_repo)]
