"""API router aggregation."""

from fastapi import APIRouter

from uski.api.health import router as health_router
from uski.api.auth import router as auth_router
from uski.api.chat import router as chat_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(chat_router)
