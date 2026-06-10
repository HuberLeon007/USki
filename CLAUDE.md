# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

USki is an intelligent, containerized flashcard app using the FSRS algorithm for spaced repetition, with NotebookLM-like AI chat integration, a rich-text editor for cards, and a secure RBAC sharing system.

**Key principles:**
- Everything runs in Docker containers. Supabase is an external cloud dependency — no local DB.
- No passwords anywhere. Authentication is passwordless email-OTP only via Supabase Auth + Resend SMTP.
- Backend is Python + FastAPI. Frontend is React + Vite.

## Common Commands

**Build and run the full stack:**
```bash
docker compose up --build
```

**Backend only (inside container):**
```bash
docker compose up backend --build  # not yet implemented - current Dockerfile is a placeholder
```

**Frontend only:**
```bash
cd frontend && npm install && npm run dev
```

**Backend development (locally):**
```bash
cd backend
# Recommended: use uv (or pip)
uv venv .venv
source .venv/bin/activate  # windows: .venv\Scripts\activate
uv pip install -r requirements.txt  # or pyproject.toml deps
uvicorn uski.main:app --reload --port 8000
```

## Architecture

### Containers

Only two application containers exist locally:
- `frontend` — React/Vite on port `5173`
- `backend` — FastAPI on port `8000`

No local Postgres, Mailpit, or Supabase services. Supabase (Auth, Database, Storage, Realtime) and Resend SMTP are external cloud services.

### Authentication Flow

1. User enters email address.
2. Supabase Auth sends a 6-digit OTP via Resend SMTP (domain: `huberleon.com`).
3. User enters the code.
4. Supabase verifies and returns a session/JWT.
5. Frontend stores the session and sends the access token to FastAPI in every request header.
6. FastAPI validates the Supabase JWT on every protected request to identify `current_user.id`.
7. No passwords exist anywhere. No password reset flow. No registration form.

### Backend Structure

```
backend/src/uski/
├── main.py          # FastAPI app entrypoint
├── api/
│   ├── router.py    # API router aggregation
│   └── health.py    # Health check endpoint
├── core/
│   ├── config.py    # Pydantic settings from env vars
│   ├── logging.py   # Loguru configuration
│   ├── security.py  # Supabase JWT validation
│   └── supabase.py  # Supabase client setup
├── schemas/         # Pydantic request/response models
├── services/        # Business logic (FSRS, AI chat, etc.)
└── utils/
```

### External Services

- **Supabase Cloud**: PostgreSQL (with `pgvector`), Auth, Storage, Realtime.
- **Resend SMTP**: Sends login codes and auth emails.
- **Google Gemini API**: Text & vision models + embeddings.

### Database Model (Planned)

Tables in Supabase (`public` schema):
- `profiles` — app profile data linked to `auth.users.id`
- `decks`, `deck_shares`, `deck_memberships` — flashcard decks with sharing
- `flashcards` — cards with rich-text HTML front/back
- `file_attachments` — metadata for uploaded files
- `fsrs_states`, `review_logs` — spaced-repetition state
- `documents`, `document_chunks` — source material for AI chat
- `chat_sessions`, `chat_messages` — AI chat history
- `audit_logs` — request and access audit trail

### Storage

- Single private bucket: `uski-files`
- Path convention: `users/{user_id}/decks/{deck_id}/{images|documents}/{file_id}`
- Frontend never stores permanent public URLs. Backend returns short-lived signed URLs.

### Environment Variables

Copy `.env.example` → `.env` and fill in real values. Required:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `SUPABASE_STORAGE_BUCKET`
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`
- `BACKEND_CORS_ORIGINS`, `BACKEND_LOG_LEVEL`
- `FRONTEND_PUBLIC_SUPABASE_URL`, `FRONTEND_PUBLIC_SUPABASE_ANON_KEY`, `FRONTEND_API_BASE_URL`

## Project Structure

```
.
├── backend/         # FastAPI + Python
│   ├── src/uski/   # Application code
│   ├── tests/      # Python tests
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/        # React + Vite
│   ├── src/        # Application code
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── supabase/        # Supabase migrations and config
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
├── docs/            # Project documentation
├── docker-compose.yml
├── .env.example
└── README.md
```

## Technology Choices

- **Frontend**: React Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Python, FastAPI, Pydantic, Loguru
- **Database & Backend Services**: Supabase Cloud
- **Infrastructure**: Docker & Docker Compose
- **AI & Embeddings**: Google Gemini 1.5 Flash for Text & Vision
- **E-Mail Login**: Supabase Auth Passwordless OTP with 6-städndigem E-Mail-Code
- **E-Mail Versendung**: Resend SMTP (Loginkodes und Authentifizierungse-Mails über `huberleon.com`)

## Logging Architecture

Logging is structured in three layers:
1. **Container Level (Docker)**: Standard I/O logs of the two application containers.
2. **Application Level (FastAPI/Loguru)**: Detailed logging of internal processes, FSRS calculations, RAG pipeline steps, and exceptions.
3. **Request/Access Level**: Audit logs for email code logins, permission checks, and API access to protected resources.
