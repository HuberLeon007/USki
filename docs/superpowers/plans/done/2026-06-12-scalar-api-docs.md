# Scalar API Docs Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add interactive API documentation via Scalar at /scalar, replacing the default Swagger/ReDoc.

**Architecture:** Scalar reads FastAPIs auto-generated OpenAPI spec and renders an interactive, modern API reference UI. We install scalar-fastapi, add a /scalar endpoint, and disable the default Swagger/ReDoc routes.

**Tech Stack:** FastAPI, scalar-fastapi, Python 3.11+

---

## Task 1: Install scalar-fastapi

**Files:**
- Modify: backend/pyproject.toml

### Step 1: Install the package

Run: cd backend && uv add scalar-fastapi
Expected: scalar-fastapi added to pyproject.toml and uv.lock updated.

### Step 2: Verify installation

Run: cd backend && uv run python -c "from scalar_fastapi import get_scalar_api_reference; print('OK')"
Expected: OK

### Step 3: Commit

```bash
git add backend/pyproject.toml backend/uv.lock
git commit -m "deps: add scalar-fastapi for API documentation"
```

---

## Task 2: Integrate Scalar into FastAPI App

**Files:**
- Modify: backend/src/uski/main.py

### Step 1: Update main.py

The full file should become:

```python
"""USki FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from scalar_fastapi import get_scalar_api_reference

from uski.api.router import api_router
from uski.core.config import settings
from uski.core.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    setup_logging()
    yield


app = FastAPI(
    title="USki API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

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
```

Key changes:
- Import get_scalar_api_reference from scalar_fastapi
- Set docs_url=None and redoc_url=None to disable default Swagger/ReDoc
- Add /scalar endpoint that returns Scalar HTML

### Step 2: Verify Scalar loads

Run: cd backend && uv run uvicorn uski.main:app --reload --port 8000
Open in browser: http://localhost:8000/scalar
Expected: Scalar UI loads showing all API endpoints (health, auth).

Also verify OpenAPI JSON still works:
Run: curl http://localhost:8000/openapi.json
Expected: JSON with openapi version and paths.

### Step 3: Commit

```bash
git add backend/src/uski/main.py
git commit -m "feat: integrate Scalar API docs at /scalar, disable Swagger/ReDoc"
```

---

## Task 3: Update API Documentation

**Files:**
- Modify: backend/api.md

### Step 1: Add Scalar URL to api.md

Add at the top of the file after the header:

```markdown
## Interaktive API-Dokumentation

- **Scalar UI:** http://localhost:8000/scalar
- **OpenAPI JSON:** http://localhost:8000/openapi.json
```

### Step 2: Commit

```bash
git add backend/api.md
git commit -m "docs: add Scalar API docs URL"
```

---

## Execution Summary

| Task | Description | Dependencies |
|---|---|---|
| 1 | Install scalar-fastapi | None |
| 2 | Integrate Scalar endpoint | Task 1 |
| 3 | Update documentation | Task 2 |

