# Project knowledge

This file gives Codebuff context about your project: goals, commands, conventions, and gotchas.

## What is this project?

**USki** — An intelligent flashcard app using the FSRS spaced repetition algorithm, with AI chat integration (RAG), rich-text editing, and a sharing/RBAC permission system. Written in German-language docs, English-language code.

## Quickstart

- **Setup**: Copy `.env.example` → `.env` with Supabase credentials. Install nothing on host — everything runs in Docker.
- **Dev (Docker)**: `docker compose --profile dev up --build` (starts backend :8000, frontend :5173, Ollama :11434, Redis :6379)
- **Dev (local frontend)**: `cd frontend && npm install && npm run dev` (Vite on :5173, proxies /api → :8000)
- **Dev (local backend)**: `cd backend && uv sync && uv run uvicorn uski.main:app --reload` (requires Python ≥3.11, uses `uv` package manager)
- **Dev (Ollama)**: Started automatically with `--profile dev`. Pull model once: `docker exec uski-ollama ollama pull qwen3:4b` (~3.5GB)
- **Dev (Supabase local)**: `supabase start` (requires Docker + Supabase CLI) — local Postgres + Auth + Inbucket at localhost:54321-54324
- **Test backend**: `cd backend && uv run pytest`
- **Lint/Typecheck frontend**: `cd frontend && npx tsc --noEmit` (no eslint configured)

## Architecture

- **`frontend/`** — React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + shadcn/ui (Radix) + React Router v7
  - `src/app/` — providers (Auth context via Supabase), router with ProtectedRoute/PublicRoute
  - `src/pages/` — LoginPage (OTP flow), DashboardPage
  - `src/components/` — organized by feature: `auth/`, `chat/`, `decks/`, `editor/`, `flashcards/`, `layout/`, `ui/`
  - `src/lib/` — `api.ts` (typed `apiFetch<T>` with Bearer auth), `supabase.ts` (client init), `utils.ts` (cn helper)
  - Path alias: `@/` → `./src` (via Vite config)
- **`backend/`** — FastAPI + Pydantic v2 + Supabase Python client + python-jose for JWT
  - `src/uski/core/` — `config.py` (pydantic-settings from .env), `security.py` (JWT/JWKS validation), `supabase.py` (client init), `logging.py` (Loguru)
  - `src/uski/api/` — `router.py` (main router), `auth.py` (send-otp, verify-otp, me), `health.py`
  - `src/uski/schemas/` — Pydantic models: auth, chat, deck, document, file, flashcard, fsrs
  - `src/uski/services/` — business logic: ai_chat, documents, embeddings, files, fsrs, permissions, rag
  - `src/uski/utils/` — ID generation helpers
- **`supabase/migrations/`** — SQL migrations (currently empty `.gitkeep`)
- **`docker-compose.yml`** — Single file with profiles. `backend` + `frontend` always start; `ollama` + `redis` start with `--profile dev`

## Data flow

1. Frontend authenticates via Supabase OTP (passwordless email code → JWT)
2. Frontend sends API requests to `/api/*` with `Authorization: Bearer <supabase_jwt>`
3. Backend validates JWT via Supabase JWKS endpoint (RS256)
4. Backend uses Supabase service role key for privileged DB operations
5. RLS policies protect data at the database level

## Conventions

- **Language**: Code in English, docs/comments may be in German
- **Package managers**: Frontend uses **npm** (lockfile present), backend uses **uv** (pyproject.toml + uv.lock)
- **TypeScript**: Strict mode, path alias `@/` for imports
- **Python**: Type hints everywhere, Pydantic v2 models for validation, Loguru for logging
- **UI**: shadcn/ui components in `src/components/ui/`, Tailwind v4, `cn()` utility for class merging
- **API pattern**: `apiFetch<T>(path, options)` on frontend; FastAPI router with dependency injection on backend
- **Auth**: Passwordless OTP only — no password flow. Supabase Auth handles session/JWT lifecycle.
- **No test runner on frontend** — backend uses pytest with httpx test client

## Key environment variables

No duplicates. Only unique values in `.env`:

```
APP_MODE=dev|prod

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

BACKEND_CORS_ORIGINS=http://localhost:5173
BACKEND_LOG_LEVEL=INFO

AI_BASE_URL=          # empty in dev → auto-resolves to Ollama
AI_API_KEY=
AI_MODEL=             # empty in dev → auto-resolves to qwen3:4b
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are **not** in `.env`.
They are derived automatically:
- **Docker**: `docker-compose.yml` passes them via `environment:` directive
- **npm run dev**: `vite.config.ts` reads `SUPABASE_URL` from parent `.env` via `loadEnv`

## Dev vs Prod Mode

Gesteuert via `APP_MODE=dev|prod` in `.env`:

| | Dev (lokal) | Prod (Cloud) |
|---|---|---|
| **Supabase** | `supabase start` (localhost:54321) | Supabase Cloud |
| **E-Mail** | Inbucket (localhost:54324) | Resend SMTP |
| **KI-Chat** | Ollama (localhost:11434) | Google Gemini / OpenAI |
| **AI-SDK** | OpenAI-kompatibel (openai lib) | Dasselbe (nur URL ändern) |

Ollama exposes OpenAI-compatible API at `/v1`, so the same `openai` Python library works for both modes.

## Gotchas

- Backend runs with `uv run`, NOT `pip install` / `python -m` — always use `uv`
- Supabase CLI (`supabase start`) runs GoTrue locally for OTP — no internet needed in dev mode
- Inbucket catches all OTP emails in dev — open http://localhost:54324 to see them
- Ollama model `qwen3:4b` needs ~3.5GB RAM, runs on CPU — good for dev, too slow for prod
- The `.env` file must exist at project root for Docker Compose to work
- JWT validation uses JWKS (not HMAC secret) — in dev mode, Supabase CLI serves its own JWKS endpoint
- No `OLLAMA_*` env vars — dev defaults are hardcoded in `config.py` properties (`ai_base_url_resolved`, `ai_model_resolved`)
- No `VITE_SUPABASE_*` in `.env` — derived from `SUPABASE_*` via docker-compose.yml and vite.config.ts
