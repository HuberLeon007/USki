# OTP-Authentifizierung (6-stelliger Code) - Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vollstaendige passwortlose Login-API mit 6-stelligem OTP-Code ueber Supabase Auth - E-Mail wird automatisch bei der Anfrage versendet.

**Architecture:** Supabase Auth verwaltet den gesamten OTP-Flow (Code generieren, E-Mail via Resend SMTP versenden, Code verifizieren, JWT ausstellen). Der FastAPI-Backend validiert die Supabase-JWTs auf geschuetzten Endpunkten. Das Frontend nutzt @supabase/supabase-js fuer den Login-Flow und speichert die Session im Browser.

**Tech Stack:** Python 3.11+, FastAPI, supabase-py, Pydantic, Loguru | React 18+, TypeScript, Vite, @supabase/supabase-js, Tailwind CSS, React Router

---

## File Structure

### Backend

| Datei | Verantwortung |
|-------|---------------|
| `backend/pyproject.toml` | Dependencies |
| `backend/src/uski/core/config.py` | Pydantic Settings |
| `backend/src/uski/core/supabase.py` | Supabase-Client |
| `backend/src/uski/core/security.py` | JWT-Validierung |
| `backend/src/uski/schemas/auth.py` | Request/Response-Modelle |
| `backend/src/uski/api/auth.py` | Auth-Endpunkte |
| `backend/src/uski/api/router.py` | Router-Registrierung |
| `backend/src/uski/main.py` | FastAPI-App |
| `backend/src/uski/core/logging.py` | Loguru-Konfiguration |
| `backend/tests/test_auth.py` | Tests |

### Frontend

| Datei | Verantwortung |
|-------|---------------|
| `frontend/src/lib/supabase.ts` | Supabase Browser Client |
| `frontend/src/lib/api.ts` | Fetch-Wrapper mit Auth-Token |
| `frontend/src/pages/LoginPage.tsx` | Login-UI: E-Mail -> OTP -> Erfolg |
| `frontend/src/app/router.tsx` | React Router |
| `frontend/src/app/providers.tsx` | Auth-Context |

---

## Task 1: Backend Dependencies and Config

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/src/uski/core/config.py`

- [ ] Step 1: Install backend dependencies
  Run: `cd backend && pip install fastapi uvicorn[standard] supabase python-jose[cryptography] pydantic pydantic-settings loguru python-dotenv httpx`

- [ ] Step 2: Update backend/pyproject.toml with all dependencies

- [ ] Step 3: Implement backend/src/uski/core/config.py (Pydantic Settings from env vars)

- [ ] Step 4: Commit

## Task 2: Supabase Client and Logging

**Files:**
- Modify: `backend/src/uski/core/supabase.py`
- Modify: `backend/src/uski/core/logging.py`

- [ ] Step 1: Implement logging.py (Loguru setup)
- [ ] Step 2: Implement supabase.py (client init)
- [ ] Step 3: Commit

## Task 3: JWT Security

**Files:**
- Modify: `backend/src/uski/core/security.py`

- [ ] Step 1: Implement security.py (HS256 JWT validation, CurrentUser model, get_current_user dependency)
- [ ] Step 2: Commit

## Task 4: Auth Schemas

**Files:**
- Create: `backend/src/uski/schemas/auth.py`

- [ ] Step 1: Create SendOtpRequest, VerifyOtpRequest, AuthResponse, UserResponse, MessageResponse
- [ ] Step 2: Commit

## Task 5: Auth API Endpoints

**Files:**
- Create: `backend/src/uski/api/auth.py`

- [ ] Step 1: Implement POST /api/auth/send-otp (calls Supabase signInWithOtp, email sent immediately)
- [ ] Step 2: Implement POST /api/auth/verify-otp (calls Supabase verify_otp, returns tokens)
- [ ] Step 3: Implement GET /api/auth/me (validates JWT, returns user)
- [ ] Step 4: Implement POST /api/auth/logout
- [ ] Step 5: Commit

## Task 6: Router and Main App

**Files:**
- Modify: `backend/src/uski/api/router.py`
- Modify: `backend/src/uski/main.py`
- Modify: `backend/src/uski/api/health.py`

- [ ] Step 1: Wire up router.py with health + auth routers
- [ ] Step 2: Implement main.py with CORS and lifespan
- [ ] Step 3: Implement health.py
- [ ] Step 4: Commit

## Task 7: Backend Tests

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_auth.py`

- [ ] Step 1: Create conftest.py with test env vars and TestClient fixture
- [ ] Step 2: Create test_auth.py with tests for send-otp, verify-otp, me, logout
- [ ] Step 3: Run tests and verify they pass
- [ ] Step 4: Commit

## Task 8: Frontend Setup

**Files:**
- Create: frontend/vite.config.ts, tsconfig.json, index.html, tailwind.config.js, postcss.config.js, src/index.css

- [ ] Step 1: Install frontend dependencies
- [ ] Step 2: Create config files
- [ ] Step 3: Commit

## Task 9: Frontend Supabase Client and API

**Files:**
- Modify: `frontend/src/lib/supabase.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] Step 1: Implement supabase.ts
- [ ] Step 2: Implement api.ts with sendOtp, verifyOtp, getMe functions
- [ ] Step 3: Commit

## Task 10: Auth Provider

**Files:**
- Modify: `frontend/src/app/providers.tsx`

- [ ] Step 1: Implement AuthProvider with session state and onAuthStateChange
- [ ] Step 2: Commit

## Task 11: Login Page

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

- [ ] Step 1: Implement 3-step login: Email input, OTP input, Success with redirect
- [ ] Step 2: Commit

## Task 12: Router and Main

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] Step 1: Implement router with ProtectedRoute and PublicRoute
- [ ] Step 2: Implement main.tsx entry point
- [ ] Step 3: Implement DashboardPage
- [ ] Step 4: Commit

## Task 13: Env and Docker

**Files:**
- Create: `.env.example`
- Modify: `docker-compose.yml`

- [ ] Step 1: Create .env.example
- [ ] Step 2: Update docker-compose.yml
- [ ] Step 3: Commit

## Task 14: End-to-End Smoke Test

- [ ] Step 1: Start backend, test /api/health
- [ ] Step 2: Test POST /api/auth/send-otp with real email
- [ ] Step 3: Test POST /api/auth/verify-otp with received code
- [ ] Step 4: Test GET /api/auth/me with returned token
- [ ] Step 5: Start frontend, test full login flow in browser
