# Auth Full Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement the complete authentication flow: Landing Page → Login (OTP) → Username Setup (first login) → Dashboard.

**Architecture:** Backend adds needs_username flag to verify-otp response, new /set-username endpoint with Discord-style discriminator system, and email-derived default username. Frontend rebuilt from scratch with React 19, Vite 8, Tailwind v4, shadcn/ui.

**Tech Stack:** FastAPI, Pydantic v2, Supabase (Python client), React 19, TypeScript, Vite 8, Tailwind CSS v4, shadcn/ui (Radix), React Router v7, Lucide icons

---

## Username Logic (Email → Nickname)

When a user logs in for the first time and **skips** username setup:
- Extract local part from email: leon.huber@example.com → leon.huber
- Remove dots: leonhuber
- Remove all non-alphanumeric: keep only [a-z0-9]
- Must be 3–20 chars, otherwise fall back to user + 4 random digits
- Auto-assign random 4-digit discriminator: leonhuber#4821

**Edge cases:** a@b.com → fallback user7234 | test.user+tag@example.com → testusertag | user@example.com → user (valid)

---

## File Structure Map

### Backend — CREATE:
- backend/src/uski/services/username.py — email→username derivation
- backend/tests/test_username.py — unit tests
- backend/tests/test_auth_username.py — endpoint tests

### Backend — MODIFY:
- backend/src/uski/schemas/auth.py — add SetUsernameRequest, UsernameCheckResponse, update AuthResponse
- backend/src/uski/api/auth.py — add set-username, check-username endpoints, update verify-otp

### Frontend — ALL NEW:
- Config: package.json, tsconfig*.json, vite.config.ts, index.html, components.json, Dockerfile, .dockerignore
- Entry: src/main.tsx, src/index.css, src/vite-env.d.ts
- App: src/app/providers.tsx, src/app/router.tsx, src/app/auth-context.tsx
- Lib: src/lib/api.ts, src/lib/supabase.ts, src/lib/utils.ts
- Pages: LandingPage.tsx, LoginPage.tsx, DashboardPage.tsx, SetupUsernamePage.tsx
- Components: auth/EmailStep.tsx, auth/OtpStep.tsx, landing/Hero.tsx, Features.tsx, LandingFooter.tsx, layout/LandingNavbar.tsx, layout/ProtectedRoute.tsx, ui/button.tsx, card.tsx, input.tsx, label.tsx

### Modify:
- docker-compose.yml — re-add frontend service
- .env.example — re-add frontend comments

---

## Task 1: Username Service — Email→Username Derivation

**Files:** Create: backend/src/uski/services/username.py, backend/tests/test_username.py

- [ ] **Step 1: Write failing tests** — 14 tests: simple email, dots removed, plus alias removed, numbers preserved, underscores stripped, too-short fallback, empty local part, only-dots fallback, long truncation, 3 chars valid, 2 chars fallback, uppercase lowercased, all-special-chars fallback.

- [ ] **Step 2: Run tests to verify fail** — cd backend && uv run python -c "from uski.services.username import derive_username_from_email" → ImportError

- [ ] **Step 3: Implement username service**

```python
import random, re
MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 20
FALLBACK_PREFIX = "user"

def derive_username_from_email(email: str) -> str:
    local_part = email.split("@")[0] if "@" in email else ""
    cleaned = local_part.replace(".", "")
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", cleaned).lower()[:MAX_USERNAME_LENGTH]
    if len(cleaned) < MIN_USERNAME_LENGTH:
        return f"{FALLBACK_PREFIX}" + "".join(str(random.randint(0,9)) for _ in range(4))
    return cleaned
```

- [ ] **Step 4: Run tests** — cd backend && uv run pytest tests/test_username.py -v → All PASS

- [ ] **Step 5: Commit** — git commit -m "feat: add email-to-username derivation service with tests"

---

## Task 2: Backend — New Auth Schemas

**Files:** Modify: backend/src/uski/schemas/auth.py

- [ ] **Step 1: Update schemas** — Add SetUsernameRequest (username: str, min 3, max 20, ^[a-z0-9]+$), UsernameCheckResponse (available: bool, username: str), update AuthResponse with needs_username: bool = False

- [ ] **Step 2: Verify imports** — cd backend && uv run python -c "from uski.schemas.auth import SetUsernameRequest, AuthResponse; r = AuthResponse(access_token='x', refresh_token='y', user_id='z'); print(r.needs_username)" → False

- [ ] **Step 3: Commit** — git commit -m "feat: add SetUsernameRequest, UsernameCheckResponse, needs_username flag"

---

## Task 3: Backend — Set Username + Check Username Endpoints

**Files:** Modify: backend/src/uski/api/auth.py, Create: backend/tests/test_auth_username.py

- [ ] **Step 1: Write failing tests** — TestSetUsername (success 200, taken 409, invalid 422, short 422, auth 401), TestCheckUsername (available, taken, auth)

- [ ] **Step 2: Run tests to verify fail**

- [ ] **Step 3: Implement endpoints** — Add imports (random, get_supabase_client, SetUsernameRequest, UsernameCheckResponse). Update verify_otp to check needs_username. Add POST /set-username (random discriminator, collision retry). Add GET /check-username.

- [ ] **Step 4: Run all auth tests** — cd backend && uv run pytest tests/test_auth.py tests/test_auth_username.py -v

- [ ] **Step 5: Commit** — git commit -m "feat: add set-username and check-username endpoints with tests"

---

## Task 4: Frontend — Project Scaffolding

**Files:** Create: frontend/package.json, tsconfig*.json, vite.config.ts, index.html, components.json, .dockerignore, Dockerfile, src/main.tsx, src/index.css, src/vite-env.d.ts. Modify: docker-compose.yml, .env.example

- [ ] **Step 1: Create package.json** — React 19, Vite 8, Tailwind v4, shadcn deps, react-router-dom v7, motion, lucide-react, next-themes, sonner

- [ ] **Step 2: Create config files** — tsconfig (strict, path alias @/), vite (tailwindcss plugin, proxy /api → localhost:8000), components.json (shadcn new-york)

- [ ] **Step 3: Create entry files** — main.tsx (BrowserRouter + ThemeProvider + AuthProvider + AppRouter), index.css (Tailwind v4 @import, Geist font, shadcn CSS vars light+dark), vite-env.d.ts

- [ ] **Step 4: Re-add frontend to docker-compose.yml**

- [ ] **Step 5: Create Docker files**

- [ ] **Step 6: Install** — cd frontend && npm install

- [ ] **Step 7: Commit** — git commit -m "feat: scaffold frontend with Vite 8, React 19, Tailwind v4"

---

## Task 5: Frontend — Shared Lib + UI + Auth Context

**Files:** Create: src/lib/utils.ts, supabase.ts, api.ts, src/app/providers.tsx, auth-context.tsx, router.tsx, src/components/ui/button.tsx, card.tsx, input.tsx, label.tsx

- [ ] **Step 1: Create lib files** — utils.ts (cn helper), supabase.ts (createClient), api.ts (apiFetch<T>, ApiError, sendOtp, verifyOtp, getMe, setUsername, checkUsername, deriveUsernameFromEmail)

- [ ] **Step 2: Create auth context** — AuthProvider with accessToken/user/needsUsername/loading, setSession/clearSession, validates stored token on mount

- [ ] **Step 3: Create router** — / (Landing), /login (Public), /setup-username (Protected), /dashboard (Protected)

- [ ] **Step 4: Create shadcn/ui components** — button (CVA variants), card, input, label (Radix)

- [ ] **Step 5: Typecheck** — cd frontend && npx tsc --noEmit

- [ ] **Step 6: Commit** — git commit -m "feat: add shared lib, auth context, router, and shadcn/ui components"

---

## Task 6: Frontend — Landing Page

**Files:** Create: src/pages/LandingPage.tsx, src/components/landing/Hero.tsx, Features.tsx, LandingFooter.tsx, src/components/layout/LandingNavbar.tsx

- [ ] **Step 1: Create components** — Navbar (sticky, blur, gradient CTA), Hero (2-col, fade-in, gradient headline), Features (4 cards, 2x2, staggered scroll), Footer

- [ ] **Step 2: Create LandingPage** — composes all sections

- [ ] **Step 3: Typecheck**

- [ ] **Step 4: Commit** — git commit -m "feat: add landing page with hero, features, navbar, and footer"

---

## Task 7: Frontend — Login Flow

**Files:** Create: src/pages/LoginPage.tsx, src/components/auth/EmailStep.tsx, OtpStep.tsx

- [ ] **Step 1: Create EmailStep** — email input with Mail icon, gradient submit button, loading/error states

- [ ] **Step 2: Create OtpStep** — 6 individual input boxes, auto-advance, paste support, backspace nav, auto-submit on completion

- [ ] **Step 3: Create LoginPage** — EmailStep → send-otp → OtpStep → verify-otp → needs_username? /setup-username : /dashboard. Animated step transitions (AnimatePresence)

- [ ] **Step 4: Typecheck**

- [ ] **Step 5: Commit** — git commit -m "feat: add login page with email and OTP steps"

---

## Task 8: Frontend — Username Setup + Dashboard

**Files:** Create: src/pages/SetupUsernamePage.tsx, DashboardPage.tsx

- [ ] **Step 1: Create SetupUsernamePage** — suggested username from email, real-time availability check (debounced 400ms), green check / red X, Skip button

- [ ] **Step 2: Create DashboardPage** — minimal shell: topbar, empty state ("Noch keine Decks"), theme toggle, logout

- [ ] **Step 3: Typecheck** — cd frontend && npx tsc --noEmit

- [ ] **Step 4: Backend tests** — cd backend && uv run pytest tests/ -v

- [ ] **Step 5: Commit** — git commit -m "feat: add username setup page and dashboard with empty state"

---

## Execution Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Username service (email→username) | None |
| 2 | Auth schemas | None |
| 3 | Set-username + check-username endpoints | Tasks 1, 2 |
| 4 | Frontend scaffolding | None |
| 5 | Shared lib + UI + auth context | Task 4 |
| 6 | Landing page | Task 5 |
| 7 | Login flow (Email + OTP) | Task 5 |
| 8 | Username setup + Dashboard | Tasks 5, 7 |

**Parallelization:** Tasks 1–2 and Task 4 can run in parallel. Tasks 6–7 can run in parallel after Task 5.
