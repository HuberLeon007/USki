# USki Foundation Cleanup — PLAN INDEX

> **Original:** 11 Tasks → aufgeteilt in 4 Sub-Pläne (1 done, 3 offen)

**Goal:** Remove duplicate code, introduce DI, add rate limiting, implement SSE streaming, create Supabase migrations, configure dev tooling.

**Architecture:** FastAPI-native Depends() + Annotated for DI. slowapi (Redis prod / InMemory dev) for rate limiting. SSE via StreamingResponse + AsyncOpenAI for chat.

---

## ✅ Done (5/11 Tasks)

→ [`done/2026-06-12-auth-cleanup.md`](done/2026-06-12-auth-cleanup.md)

| Task | Was |
|------|-----|
| 2 | Duplicate `_get_anon_client()` entfernt |
| 6 | Rate Limiting (slowapi) auf send-otp + verify-otp |
| 7 | Redis in docker-compose.dev.yml |
| 8 | Supabase Migration (Auth-Tabellen) |
| 10 | .env.example aktualisiert |

**Verification:** `cd backend && uv run pytest tests/ -v` → 22/22 ✅

---

## ❌ Offen (6/11 Tasks)

### 1. [`2026-06-12-backend-chat-streaming.md`](2026-06-12-backend-chat-streaming.md)

| Task | Was | Files |
|------|-----|-------|
| 1 | package.json scripts | `frontend/package.json` |
| 3 | DI `dependencies.py` | CREATE `backend/src/uski/core/dependencies.py` |
| 4 | Async `AIChatService` | `backend/src/uski/services/ai_chat.py` |
| 5 | `/api/chat/stream` SSE-Endpoint | `backend/src/uski/api/chat.py`, tests |

**Execution Order:** 1 → 3 → 4 → 5 (Sequentiell)

### 2. [`2026-06-12-frontend-streaming-chat.md`](2026-06-12-frontend-streaming-chat.md)

| Task | Was | Files |
|------|-----|-------|
| 9 | Streaming ChatPanel + streamChatMessage | `api.ts`, `ChatPanel.tsx` |

**Depends on:** Backend Chat Plan (muss zuerst fertig sein)

### 3. [`2026-06-12-integration-test.md`](2026-06-12-integration-test.md)

| Task | Was |
|------|-----|
| 11 | Backend-Tests + Frontend-Typecheck |

**Depends on:** Alle anderen Pläne müssen fertig sein

---

## Final Decisions

| Entscheidung | Begründung |
|---|---|
| Nur Streaming-Endpoint | YAGNI — sync endpoint wäre ungenutzt, da Frontend nur streamt |
| DI vor Rate Limiting | DI + Async Service sind Grundlage, Rate Limiting baut darauf auf |
| Migration nur Auth-Tabellen | Geplante Tabellen als eigene Migrationen später |
| Kein Frontend-Fallback | Fehler werden im ChatPanel angezeigt, kein automatisches Umschalten |
| Dev 100% offline | Inbucket (Supabase-eigen), Redis local, Ollama — kein Internet |
