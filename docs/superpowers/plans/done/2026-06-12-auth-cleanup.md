# USki Auth Cleanup ✅ DONE

**Umgesetzt 2026-06-12 | 22/22 Tests grün**

| Task | Datei |
|---|---|
| Duplicate `_get_anon_client()` entfernt | `auth.py` |
| Rate Limiting slowapi (5/min send-otp, 10/min verify-otp) | `auth.py`, `main.py`, `config.py` |
| 429 Exception Handler | `main.py` |
| Redis in docker-compose.dev.yml | `docker-compose.dev.yml` |
| Migration 0001_auth_schema.sql | `supabase/migrations/` |
| .env.example RATE_LIMIT_* vars | `.env.example` |
| slowapi + redis packages | `pyproject.toml` |

Nicht umgesetzt (separater Plan): DI, Async Chat, Streaming, Frontend, package.json scripts
