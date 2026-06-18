# Implementation Plan: UX Redesign & Onboarding Fix

## Overview

This plan converts the design into incremental, test-driven coding tasks. It starts with the backend
auth/username and token-lifecycle support, then fixes the frontend token lifecycle and `apiFetch`,
establishes theme tokens, extracts pure helpers (with property-based tests), and finally implements
the UI surfaces (login/OTP, settings, dashboard, AI assistant, landing page). Each task builds on the
previous ones and ends by wiring the new code into the running app.

Pure functions identified in the design (`derive_username_from_email`/`deriveUsernameFromEmail`,
username validation, `selectDueDecks`/`isDeckDue`, `clampToViewport`) are covered by property-based
tests. Backend properties P1–P3 run under pytest + Hypothesis. Frontend properties P4–P5 are written
as side-effect-free, PBT-ready stubs tagged with their property numbers (per the design's testing
strategy, which has no frontend runner today); an optional vitest + fast-check setup task is included
to execute them.

## Tasks

- [x] 1. Backend auth/username + token-lifecycle support
  - [x] 1.1 Add username change endpoint and shared assignment helper
    - In `backend/src/uski/schemas/auth.py`, add `ChangeUsernameRequest` (`username: str`, `min_length=3`, `max_length=20`, `pattern=r"^[a-z0-9]+$"`)
    - In `backend/src/uski/api/auth.py`, extract a shared `_assign_username(svc_client, user_id, username)` helper containing the discriminator collision-retry loop (max 10) currently inside `set_username`, and refactor `set_username` to use it
    - Add `PATCH /api/auth/username` (`change_username`) that validates the body, performs an UPDATE even when a username already exists (no 409), reuses `_assign_username`, and returns `UserResponse` with the updated `username`/`discriminator`
    - _Requirements: 8.7, 9.2, 9.4_

  - [ ]* 1.2 Write property tests P1 and P2 for `derive_username_from_email`
    - Add `hypothesis` to the `dev` optional-dependencies in `backend/pyproject.toml`
    - In `backend/tests/test_username_service.py`, write Hypothesis tests over arbitrary local parts, `+alias`, dot-heavy, non-ASCII, and empty/invalid inputs (≥100 iterations each)
    - **Property 1: Derived username validity invariant** — tag `# Feature: ux-redesign-onboarding, Property 1: Derived username validity invariant`
    - **Property 2: Derived username fallback shape** — tag `# Feature: ux-redesign-onboarding, Property 2: Derived username fallback shape`
    - **Validates: Requirements 8.2, 8.5, 8.6**

  - [ ]* 1.3 Write property test P3 for username validation
    - In `backend/tests/test_username_service.py`, validate candidate strings against the `^[a-z0-9]{3,20}$` rule shared by `SetUsernameRequest`/`ChangeUsernameRequest`
    - **Property 3: Username validation correctness** — tag `# Feature: ux-redesign-onboarding, Property 3: Username validation correctness`
    - **Validates: Requirements 9.2**

  - [ ]* 1.4 Write example/integration tests for the auth endpoints
    - In `backend/tests/test_auth.py` (mocked JWKS + mocked Supabase client): valid token → `check-username`/`set-username`/`PATCH username` return 2xx; `set-username` returns 409 when already set while `PATCH /auth/username` succeeds and returns the new `username#discriminator`; `/me` and `verify-otp`/`refresh` report `needs_username == false` after assignment; `change_username` discriminator-collision retry and exhaustion (500); malformed `PATCH` body → 422
    - _Requirements: 1.4, 8.3, 8.4, 8.7, 9.2, 9.4, 9.6_

- [x] 2. Frontend token lifecycle and `apiFetch` fix
  - [x] 2.1 Add `tokenStorage`, token guard, and refresh/retry to `apiFetch`
    - In `frontend/src/lib/api.ts`, add the `tokenStorage` module (single source of truth for `uski_access_token`/`uski_refresh_token`) and a `SessionExpiredError` class
    - Add `requireAuth` guard (throw `SessionExpiredError` and clear tokens when a protected call has a missing/empty access token, without issuing the request)
    - Add one-shot `401 → refresh → retry` with `refreshWithTimeout` (5s `Promise.race`), persisting refreshed tokens via `tokenStorage.set` before the single retry, and clearing tokens on failed/timed-out refresh
    - Add `changeUsername(username)` calling `PATCH /auth/username` with `{ requireAuth: true }`; mark `checkUsername`, `setUsername`, `getMe` with `{ requireAuth: true }`; keep `send-otp`/`verify-otp`/`refresh` unauthenticated
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 1.7, 9.4_

  - [x] 2.2 Route token persistence and session expiry through `auth-context`
    - In `frontend/src/app/auth-context.tsx`, replace direct `localStorage.setItem/removeItem` with `tokenStorage.set`/`tokenStorage.clear`; ensure `setSession` writes tokens synchronously before returning
    - Add `clearSession()` + navigate-to-`/login` handling when callers catch `SessionExpiredError`
    - _Requirements: 1.1, 1.3, 1.7_

  - [ ]* 2.3 Write unit tests for `apiFetch` token guard and refresh/retry
    - Cover: missing token throws without request; single 401 refresh+retry-once persists tokens before retry; second 401 not retried; refresh timeout/failure clears tokens
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 1.7_

- [x] 3. Theme tokens and theme consolidation
  - [x] 3.1 Define the softer dark surface tokens
    - In `frontend/src/index.css`, raise the dark `--color-background` luminance floor off pure black (e.g. `hsl(250 16% 9%)`) and adjust `--color-card`/`--color-surface` to keep contrast; document the intent (explicitly not `#000000`); leave light tokens unchanged
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.2 Remove the dashboard theme toggle
    - In `frontend/src/pages/DashboardPage.tsx`, remove the `Sun/Moon` theme toggle from the header so theme switching is no longer available on the dashboard
    - _Requirements: 16.2, 16.3_

- [x] 4. Pure helpers + property tests
  - [x] 4.1 Align frontend `deriveUsernameFromEmail` with the backend rule
    - In `frontend/src/lib/api.ts`, update `deriveUsernameFromEmail` to also strip the `+alias` (split local part on `+`) so it matches `derive_username_from_email` exactly (dots removed, non-ASCII-alphanumerics removed, lowercased, truncated to 20, `user####` fallback)
    - _Requirements: 8.2, 8.5, 8.6_

  - [x] 4.2 Create `lib/due-decks.ts` pure due-deck selector
    - Add `frontend/src/lib/due-decks.ts` exporting `DeckCard`/`DeckLike` types, `isDeckDue(deck, now)`, and `selectDueDecks(decks, now)` (a deck is due iff at least one card's `nextReview` is at or before `now`; preserve input order)
    - _Requirements: 15.3, 15.4_

  - [x] 4.3 Create `lib/window-bounds.ts` pure viewport clamp
    - Add `frontend/src/lib/window-bounds.ts` exporting `Point`/`Size` types and `clampToViewport(pos, size, viewport)` that keeps the whole window within all four edges, pins (never negative) when the window is larger than the viewport, and is idempotent
    - _Requirements: 17.7, 18.3, 18.5_

  - [ ]* 4.4 Write property test stub P4 for due-deck selection
    - Add a PBT-ready stub for `selectDueDecks`/`isDeckDue` tagged `// Feature: ux-redesign-onboarding, Property 4: Due-deck selection correctness` (executed if vitest + fast-check is set up in 4.6; otherwise verified by typecheck + manual QA per the design)
    - **Property 4: Due-deck selection correctness**
    - **Validates: Requirements 15.3, 15.4**

  - [ ]* 4.5 Write property test stub P5 for `clampToViewport`
    - Add a PBT-ready stub for `clampToViewport` tagged `// Feature: ux-redesign-onboarding, Property 5: Assistant window stays within the viewport` (containment + idempotence)
    - **Property 5: Assistant window stays within the viewport**
    - **Validates: Requirements 17.7, 18.3, 18.5**

  - [ ]* 4.6 Set up vitest + fast-check to execute P4 and P5 (optional)
    - Add `vitest` + `fast-check` as dev dependencies and a `test` script in `frontend/package.json`, then convert the P4/P5 stubs (4.4, 4.5) into executable property tests (≥100 iterations each)
    - _Requirements: 15.3, 15.4, 17.7, 18.3, 18.5_

- [x] 5. Checkpoint — backend tests and frontend typecheck pass
  - Run `cd backend && uv run pytest` and `cd frontend && npm run typecheck`; ensure all tests pass and types are clean. Ask the user if questions arise.

- [x] 6. Login / OTP improvements
  - [x] 6.1 Make the card stack backdrop landscape with mobile-portrait exception
    - In `frontend/src/components/CardStackBackdrop.tsx`, render cards in landscape aspect (width > height); add a CSS media exception (`max-width: 640px and orientation: portrait`) so mobile portrait renders portrait and rotation restores landscape automatically
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Enlarge the logo on the login page
    - In `frontend/src/pages/LoginPage.tsx`, increase the `Logo` `imgClassName`/`textClassName` sizes (e.g. `h-16 w-16`, `text-3xl`), keeping it legible in both themes via existing tokens
    - _Requirements: 5.1, 5.2_

  - [x] 6.3 Add resend countdown to `OtpStep`
    - In `frontend/src/components/auth/OtpStep.tsx`, add a 60s countdown (`setInterval`) that disables the resend control while `secondsLeft > 0`, shows remaining seconds, and enables at zero; add an `onResend: () => Promise<void>` prop that restarts the countdown on success and shows an error + re-enables on failure; wire `LoginPage` to re-call `sendOtp(email)`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.4 Implement the OTP success animation phase machine
    - In `frontend/src/components/auth/OtpStep.tsx`, extend state into the ordered `OtpPhase` sequence (`idle → verifying → green → spinner → checkmark → transition`, plus `error`); turn all six fields green within 100ms, play exactly one spinner (600–1200ms) then one drawn SVG `pathLength` checkmark (300–800ms), advancing via `motion` `onAnimationComplete`
    - Gate `LoginPage` navigation on an `onSuccessComplete` invoked only after `checkmark → transition` (200–600ms); on wrong code (verify 401) play error/shake and clear digits with no success animation; on network/service error show error and **retain** digits with no success animation; honor `useReducedMotion`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 6.5 Implement onboarding skip with email-derived username
    - Create `frontend/src/components/auth/OnboardingStep.tsx` (refactor of `UsernameDialog`) rendered when `needsUsername` is true, keeping the claim UI and adding an always-present skip control
    - On skip, derive via `deriveUsernameFromEmail(user.email)` and submit through `setUsername` (so onboarding truly completes); both `checkUsername`/`setUsername` use `requireAuth` and route back to the Login email step on `SessionExpiredError`; remove the old "skip without assigning" path
    - Wire `LoginPage` to render `OnboardingStep` and not show onboarding again once a username exists
    - _Requirements: 1.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 7. Settings surface
  - [x] 7.1 Create the Settings dialog (username, theme, logout)
    - Create `frontend/src/components/dashboard/SettingsDialog.tsx` (shadcn `Dialog`)
    - Username section: show `username#discriminator`, edit field with 3–20 lowercase-alphanumeric validation, live availability check, submit via `changeUsername`; on success update displayed value; on validation failure show inline error and do not submit; on request error show error and retain previous username
    - Theme section: light/dark control bound to `next-themes` `setTheme` (the only theme control in the authenticated app)
    - Logout section: button calling `clearSession()` (clears tokens) and navigating to `/login`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 16.3_

- [x] 8. Dashboard restructure
  - [x] 8.1 Extract the `Sidebar` with relocated collapse and username footer
    - Create `frontend/src/components/dashboard/Sidebar.tsx` (extracted from `DashboardPage`) with the collapse control in the top-right header opposite the Logo (remove the old bottom collapse row), collapse/expand of the whole sidebar, and a footer showing `username#discriminator` (neutral placeholder while loading, never the email, no logout control)
    - _Requirements: 11.3, 12.1, 12.2, 12.3, 13.1, 13.2, 13.3, 13.4_

  - [x] 8.2 Build the Overview and Decks sections
    - In `frontend/src/components/dashboard/Sidebar.tsx`, render Overview above Decks: Overview shows `Review` first then only due decks (via `selectDueDecks`), nothing when none are due, and no create control; Decks lists all decks with the single "New deck" control; remove the standalone "Review" button; recompute due membership on load/refresh and when deck data changes; place the Settings entry at the bottom directly above the username row
    - _Requirements: 14.1, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 16.1_

  - [x] 8.3 Wire the Sidebar and Settings into `DashboardPage`
    - In `frontend/src/pages/DashboardPage.tsx`, replace inline sidebar markup with `Sidebar`, open `SettingsDialog` from the Settings entry, and remove now-defunct controls; ensure username (not email) is sourced from the auth/user data
    - _Requirements: 12.1, 16.1, 16.3_

- [x] 9. AI assistant bubble/window/drag/animation
  - [x] 9.1 Implement the assistant bubble and window states
    - Create `frontend/src/components/dashboard/assistant/AssistantBubble.tsx` and `AssistantWindow.tsx` (replacing the slide-in `AiChatPanel`) with `AssistantState = "closed" | "small" | "maximized"`
    - Bubble bottom-right (16–24px margins) while closed; small window 320–400px × 480–600px (clamped to viewport when < 320px wide); maximize/restore control toggling small ↔ full-height × 33–50% width pinned right; lift the conversation into `DashboardPage`/`useAssistant` so it is retained on close
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [x] 9.2 Add dragging with viewport clamping
    - In `AssistantWindow.tsx`, make the title bar the drag handle (small state only) using `motion`, clamp the position with `clampToViewport` so the whole window stays on-screen, retain the released position until dragged/closed/maximized, keep maximized pinned-right and non-draggable, and re-clamp on `resize`
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 9.3 Add smooth open/close animation
    - Animate open/close in 150–400ms using `motion` `AnimatePresence` with a single keyed element, animating only `transform`/`opacity`/`scale` (≥55fps, no frame interval > 32ms), interrupting and retargeting on rapid toggles without a partial resting state; honor `useReducedMotion`
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [x] 10. Landing page redesign + HeroDemo
  - [x] 10.1 Build the client-only HeroDemo
    - Create `frontend/src/components/landing/HeroDemo.tsx` rendering a mock dashboard (left sidebar area + right AI-assistant area), entrance animation via `motion` (honoring `useReducedMotion`), an inner scroll container, and clickable mock rows/suggestion that update local state only — zero backend calls, hard-coded demo constants, no real account/deck data
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 10.2 Restyle the landing page for both themes
    - In `frontend/src/pages/LandingPage.tsx` and `components/landing/*`, restyle all sections to read well in both themes using existing theme tokens only (no hard-coded `#000`/hex), mount `HeroDemo` in the hero, and preserve all existing navigation and CTA destinations (`/login`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 11. Final checkpoint — full verification
  - Run `cd backend && uv run pytest` and `cd frontend && npm run typecheck`; ensure everything passes. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (test setup, property/unit tests) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Backend properties P1–P3 run under pytest + Hypothesis. Frontend properties P4–P5 are written as side-effect-free, PBT-ready stubs tagged with their property numbers; task 4.6 (optional) sets up vitest + fast-check to actually execute them, matching the design's testing strategy.
- Verification commands: backend `cd backend && uv run pytest`; frontend `cd frontend && npm run typecheck`.
- Each task references the specific requirement clauses it satisfies for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.2", "4.3", "6.1", "10.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.2", "4.1", "4.4", "4.5", "6.2"] },
    { "id": 2, "tasks": ["2.3", "4.6", "6.3", "7.1", "8.1", "9.1"] },
    { "id": 3, "tasks": ["3.2", "6.4", "8.2", "9.2"] },
    { "id": 4, "tasks": ["6.5", "8.3", "9.3", "10.2"] }
  ]
}
```
