"""USki FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from scalar_fastapi import get_scalar_api_reference
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from uski.api.router import api_router
from uski.core.config import settings  # noqa: F401  (kept for parity / future use)
from uski.core.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown.

    The offline mock social-login path is gated purely on APP_MODE: it is only
    wired in dev (the route is registered only when ``settings.is_dev``) and is
    dropped from prod builds on the frontend, so it cannot exist in production.
    No separate flag or boot-time guard is needed.
    """
    setup_logging()
    yield


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.rate_limit_storage_uri,
    default_limits=[],
)


app = FastAPI(
    title="USki API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please wait and try again.",
            "retry_after": getattr(exc, "retry_after", None),
        },
    )

app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/scalar", include_in_schema=False)
async def scalar_html():
    """Scalar API reference documentation."""
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title="USki API Documentation",
    )
