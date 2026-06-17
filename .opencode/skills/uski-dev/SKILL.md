---
name: uski-dev
description: USki development workflow guide — Docker commands, Supabase setup, testing patterns, and common tasks
metadata:
  audience: developers
  workflow: fullstack
---

# USki Development Skill

Quick reference for common USki development tasks.

## Quick Commands

```bash
# Start everything (dev mode)
docker compose --profile dev up --build

# Start only core services
docker compose up backend frontend

# Local frontend (faster hot-reload)
cd frontend && npm run dev

# Local backend
cd backend && uv run uvicorn uski.main:app --reload

# Run backend tests
cd backend && uv run pytest

# Type check frontend
cd frontend && npx tsc --noEmit

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Supabase local
supabase start        # Start local Supabase
supabase stop         # Stop local Supabase
supabase db reset     # Reset database
supabase migration new <name>  # Create migration
```

## Common Patterns

### Adding a New API Endpoint

1. Create schema in `backend/src/uski/schemas/`
2. Add service logic in `backend/src/uski/services/`
3. Create endpoint in `backend/src/uski/api/`
4. Register router in `backend/src/uski/api/router.py`
5. Test with `uv run pytest`

### Adding a New Frontend Page

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/app/router.tsx`
3. Use `ProtectedRoute` or `PublicRoute` wrapper
4. Add to navigation if needed

### Adding a shadcn/ui Component

```bash
cd frontend && npx shadcn@latest add <component>
```

Components go in `frontend/src/components/ui/`

### Working with Supabase

```bash
# Create migration
supabase migration new add_decks_table

# Apply locally
supabase db push

# Generate TypeScript types
supabase gen types typescript --local > frontend/src/types/supabase.ts
```

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in Supabase credentials
3. For dev: `APP_MODE=dev`
4. For prod: `APP_MODE=prod`

## Debugging

### Backend not starting
- Check `.env` exists at project root
- Verify Python ≥3.11: `python --version`
- Check uv installed: `uv --version`

### Frontend not starting
- Check `node_modules` exists: `cd frontend && npm install`
- Check port 5173 not in use

### Supabase issues
- Check Supabase running: `supabase status`
- Check Inbucket for OTP emails: http://localhost:54324
- Check JWT valid: backend logs should show JWKS validation

### Docker issues
- Check Docker running: `docker ps`
- Rebuild: `docker compose up --build`
- Clean: `docker compose down -v`
