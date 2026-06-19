"""API router aggregation."""

from fastapi import APIRouter

from uski.api.health import router as health_router
from uski.api.auth import router as auth_router
from uski.api.chat import router as chat_router
from uski.api.decks import router as decks_router
from uski.api.cards import router as cards_router
from uski.api.groups import router as groups_router
from uski.api.review import router as review_router
from uski.api.shares import router as shares_router
from uski.api.notifications import router as notifications_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(chat_router)
api_router.include_router(decks_router)
api_router.include_router(cards_router)
api_router.include_router(groups_router)
api_router.include_router(review_router)
api_router.include_router(shares_router)
api_router.include_router(notifications_router)
