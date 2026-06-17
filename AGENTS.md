# USki — Flashcard App

Intelligente Flashcard-App mit FSRS-Algorithmus, KI-Chat (RAG), Rich-Text-Editor und Sharing/RBAC.

## Quick Reference

```bash
# Dev (Docker) — backend :8000, frontend :5173, ollama :11434, redis :6379
docker compose --profile dev up --build

# Dev (local frontend)
cd frontend && npm install && npm run dev

# Dev (local backend)
cd backend && uv sync && uv run uvicorn uski.main:app --reload

# Test backend
cd backend && uv run pytest

# Lint/Typecheck frontend (no eslint configured — tsc only)
cd frontend && npm run typecheck

# Supabase local
supabase start
```

## Architecture

```
USki/
├── frontend/          # React 19 + TypeScript + Vite 8 + Tailwind v4 + shadcn/ui
│   └── src/
│       ├── app/       # Auth context, router, ProtectedRoute
│       ├── pages/     # LoginPage (OTP), DashboardPage
│       ├── components/# auth/, chat/, decks/, editor/, flashcards/, layout/, ui/
│       └── lib/       # api.ts (apiFetch), supabase.ts, utils.ts
├── backend/           # FastAPI + Pydantic v2 + Supabase Python + python-jose
│   └── src/uski/
│       ├── core/      # config.py, security.py, supabase.py, logging.py
│       ├── api/       # router.py, auth.py, health.py, chat.py
│       ├── schemas/   # Pydantic models
│       ├── services/  # ai_chat, documents, embeddings, files, fsrs, permissions, rag
│       └── utils/     # ID generation
├── supabase/          # Migrations + config.toml
├── docker-compose.yml # backend + frontend (always), ollama + redis (--profile dev)
└── .env               # All config (no VITE_* vars — derived automatically)
```

## Data Flow

1. Frontend auth via Supabase OTP (passwordless email code → JWT)
2. API requests to `/api/*` with `Authorization: Bearer <supabase_jwt>`
3. Backend validates JWT via Supabase JWKS (RS256)
4. Backend uses Supabase service role key for privileged DB ops
5. RLS policies protect data at database level

## Tech Stack

- **Frontend**: React 19, TypeScript (strict), Vite 8, Tailwind CSS v4, shadcn/ui (Radix), React Router v7
- **Backend**: Python ≥3.11, FastAPI, Pydantic v2, Loguru, uv package manager
- **Database**: Supabase Cloud (PostgreSQL + pgvector + Auth + Storage + Realtime)
- **Infra**: Docker & Docker Compose (nothing native on host)
- **AI**: Google Gemini 1.5 Flash / Ollama (dev), OpenAI-compatible API
- **Auth**: Supabase Passwordless OTP (6-digit email code), Resend SMTP

## Conventions

- **Language**: Code in English, docs/comments may be German
- **Package managers**: Frontend = npm, Backend = uv
- **TypeScript**: Strict mode, path alias `@/` → `./src`
- **Python**: Type hints everywhere, Pydantic v2, Loguru logging
- **UI**: shadcn/ui in `src/components/ui/`, Tailwind v4, `cn()` utility
- **API**: `apiFetch<T>(path, options)` on frontend; FastAPI router with DI on backend
- **Auth**: Passwordless OTP only — no password flow
- **No test runner on frontend** — backend uses pytest with httpx

## Key Environment Variables

```
APP_MODE=dev|prod
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BACKEND_CORS_ORIGINS=http://localhost:5173
BACKEND_LOG_LEVEL=INFO
AI_BASE_URL=          # empty → auto-resolves to Ollama in dev
AI_API_KEY=
AI_MODEL=             # empty → auto-resolves to qwen3:4b in dev
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are NOT in `.env` — derived via docker-compose.yml and vite.config.ts.

## Gotchas

- Backend runs with `uv run`, NOT `pip install` / `python -m`
- Backend `pyproject.toml` has no `[build-system]` — can't be pip-installed. Docker uses `PYTHONPATH=/app/src`; locally `uv run` handles it
- Rate limiting uses slowapi — Redis in prod, in-memory when `APP_MODE=dev` or `test` (see `config.py:rate_limit_storage_uri`)
- Vite proxies `/api` to backend — `VITE_API_PROXY_TARGET` in Docker (host.docker.internal:8000), defaults to `localhost:8000` locally
- Supabase CLI runs GoTrue locally for OTP — no internet in dev
- Inbucket catches all OTP emails in dev — http://localhost:54324
- Ollama `qwen3:4b` needs ~3.5GB RAM, CPU-only — dev only
- JWT validation uses JWKS (not HMAC) — dev Supabase CLI serves own JWKS
- No `OLLAMA_*` env vars — defaults hardcoded in `config.py`
- No `VITE_SUPABASE_*` in `.env` — derived from `SUPABASE_*`
- No eslint or prettier configured — frontend type-checks with `tsc --noEmit` only
- API docs at `/scalar` (Scalar UI), not Swagger/ReDoc

## Dev vs Prod Mode

| | Dev (lokal) | Prod (Cloud) |
|---|---|---|
| **Supabase** | `supabase start` (localhost:54321) | Supabase Cloud |
| **E-Mail** | Inbucket (localhost:54324) | Resend SMTP |
| **KI-Chat** | Ollama (localhost:11434) | Google Gemini / OpenAI |
| **AI-SDK** | OpenAI-kompatibel (openai lib) | Dasselbe (nur URL ändern) |

## Testing

- Backend: `cd backend && uv run pytest` — uses `httpx` TestClient
- Tests mock JWKS via autouse fixture (`conftest.py:mock_jwks`) so no Supabase connection needed
- `APP_MODE=test` triggers in-memory rate limiting (no Redis needed for tests)
- Frontend: no test runner configured (`src/tests/` is empty)

## Database

See `DB_SCHEMA.md` for full schema. Key tables:
- `auth.users` — Supabase managed (read-only)
- `public.user` — App profiles (username#discriminator system)
- `public.login_audit` — Append-only login history
- `public.user_sessions` — Active devices/sessions
- Migrations in `supabase/migrations/` as numbered SQL files
