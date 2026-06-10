"""Loguru logging configuration."""

import sys

from loguru import logger

from uski.core.config import settings


def setup_logging() -> None:
    """Configure loguru for the application."""
    logger.remove()
    logger.add(
        sys.stderr,
        level=settings.BACKEND_LOG_LEVEL,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    )
