# Integration Test Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify that all backend tests pass and frontend typechecks cleanly after all sub-plans are implemented.

**Architecture:** Run backend test suite (`pytest`) and frontend type checker (`tsc --noEmit`). Both must pass.

**Depends on:**
- `done/2026-06-12-auth-cleanup.md`
- `plans/2026-06-12-backend-chat-streaming.md`
- `plans/2026-06-12-frontend-streaming-chat.md`

---

## Task 11: Integration Test

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && uv run pytest tests/ -v
```

**Expected:** ALL tests pass (auth + chat, ~25+ tests).

- [ ] **Step 2: Run frontend typecheck**

```bash
cd frontend && npm run typecheck
```

**Expected:** No type errors.

- [ ] **Step 3: Check for leftover references**

Search for any remaining references to removed code:

```bash
cd backend && rg "from supabase import create_client" backend/src/uski/api/
```

**Expected:** No matches (all `create_client` calls now go through `core/supabase.py`).

---

## Summary

| Check | Command | Must Pass |
|-------|---------|-----------|
| Backend Tests | `cd backend && uv run pytest tests/ -v` | ✅ All green |
| Frontend Typecheck | `cd frontend && npm run typecheck` | ✅ No errors |
| No Duplicate Code | `rg "from supabase import create_client" backend/src/uski/api/` | ❌ No matches |
