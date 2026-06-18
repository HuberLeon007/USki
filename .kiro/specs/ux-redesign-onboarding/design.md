# Design Document

## Overview

This design covers a comprehensive UX redesign and a critical onboarding authentication fix for
USki. It is organized into eight cohesive areas that together satisfy all 19 requirements:

1. **Auth/token lifecycle** — fix the 401 during onboarding by centralizing token persistence and
   adding a `401 → refresh → retry-once` wrapper (R1).
2. **Theme system** — consolidate theming on the existing `next-themes` provider, define a softer
   dark surface token, and move theme switching exclusively into Settings (R2, R10, R16).
3. **Landing page redesign** — modernize all sections for both themes and add an interactive,
   client-only `HeroDemo` that replicates the dashboard (R2, R3).
4. **Login/OTP improvements** — landscape card backdrop, larger logo, resend-with-countdown, and a
   multi-stage OTP success animation (R4, R5, R6, R7).
5. **Onboarding skip + username change** — derive a username from email on skip, mark onboarding
   complete via username presence, and add a backend update path for later changes (R8, R9).
6. **Settings surface** — a single place for username change, theme toggle, and logout (R9, R10,
   R11, R16).
7. **Dashboard restructure** — username instead of email, relocated collapse control, removed Review
   button, Overview vs Decks sections, due-deck computation (R12–R16).
8. **AI assistant** — collapsible bubble, draggable small window vs maximized fixed-right window,
   smooth `motion`-driven open/close animation, conversation retained on close (R17, R18, R19).

The guiding principles are: reuse what already exists (`next-themes`, `motion`, the `apiFetch`
abstraction, the Supabase OTP flow, `deriveUsernameFromEmail`/`username.py`), keep all logic that can
be made pure (token clamping, due-deck predicate, username derivation) free of side effects so it is
testable, and avoid a database migration by using **username presence** as the onboarding-complete
signal. All code, UI text, and comments are authored in English.

### Diagnosis of the onboarding 401 (R1)

The current `LoginPage.handleOtpSubmit` calls `setSession(...)`, which *does* write the tokens to
`localStorage` synchronously before any navigation. The `UsernameDialog` then fires
`checkUsername`/`setUsername` from the dashboard. Despite this, a 401 is observed during onboarding.
The contributing factors are:

- **No recovery path on token expiry.** `apiFetch` attaches the token but has **no `401 → refresh →
  retry` logic**. If the access token attached during onboarding is rejected (clock skew, an
  already-rotated token, or a token that expires between verify and the username calls), the request
  fails permanently with 401 and the dialog surfaces a generic error. Every onboarding request is a
  single point of failure.
- **No guard for a missing/empty token.** `apiFetch` issues the request even when the token is absent
  or empty, producing a 401 instead of routing the user back to sign-in.
- **Token reads are correct but unprotected.** `apiFetch` reads `localStorage` fresh on each call
  (good), but nothing guarantees the *freshest* token after a background refresh in `auth-context`
  is what the in-flight onboarding call uses.

The fix is therefore defensive and centralized rather than a single line change: persist tokens
through one helper, guard against a missing token, and add a one-shot refresh-and-retry to `apiFetch`
so a transient 401 self-heals. This satisfies R1 regardless of the precise trigger.

## Architecture

```
┌──────────────────────────── Frontend (React 19 + TS + Vite) ────────────────────────────┐
│                                                                                          │
│  app/                                                                                    │
│   ├─ providers.tsx ........... ThemeProvider (next-themes, storageKey "uski-theme")      │
│   ├─ auth-context.tsx ........ AuthProvider: session state + token persistence helper    │
│   └─ router.tsx .............. Public/Protected routes (unchanged shape)                 │
│                                                                                          │
│  lib/                                                                                    │
│   ├─ api.ts .................. apiFetch w/ 401→refresh→retry-once + token guard          │
│   │                            tokenStorage helper (single source of truth)              │
│   ├─ due-decks.ts (new) ...... isDeckDue() / selectDueDecks() pure predicate (R15, A4)   │
│   └─ window-bounds.ts (new) .. clampToViewport() pure helper for assistant drag (R18)    │
│                                                                                          │
│  pages/                                                                                  │
│   ├─ LandingPage.tsx ......... section composition (+ HeroDemo)                          │
│   ├─ LoginPage.tsx ........... step machine: email → otp(success anim) → onboarding      │
│   └─ DashboardPage.tsx ....... Sidebar(Overview/Decks) + Settings + AssistantBubble      │
│                                                                                          │
│  components/                                                                             │
│   ├─ landing/HeroDemo.tsx (new)  client-only dashboard mock (R3)                         │
│   ├─ auth/OtpStep.tsx ........ resend countdown + success animation state machine        │
│   ├─ auth/OnboardingStep (new) skip control + email-derived username (R8)                │
│   ├─ dashboard/Sidebar.tsx (new) Overview/Decks sections, collapse top-right (R12–R16)   │
│   ├─ dashboard/SettingsDialog.tsx (new) username/theme/logout (R9, R10, R11)             │
│   ├─ dashboard/assistant/* (new) AssistantBubble + AssistantWindow (R17–R19)             │
│   ├─ CardStackBackdrop.tsx ... landscape cards + mobile-portrait exception (R4)          │
│   └─ Logo.tsx ................ size props (already supports), larger on login (R5)       │
│                                                                                          │
│  index.css ................... Tailwind v4 @theme tokens (+ softer dark surface) (R2)    │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────── Backend (FastAPI + Supabase) ───────────────────────────────┐
│  api/auth.py ................. + PATCH /api/auth/username (update path, no 409) (R8.7,R9) │
│  services/username.py ........ derive_username_from_email (reused for skip) (R8)          │
│  schemas/auth.py ............. + ChangeUsernameRequest (reuses validation) (R9.2)         │
│  (no Supabase migration — username presence = onboarding complete) (R8.3, R8.4)           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cross-cutting state management

- **Auth/session**: `AuthProvider` (React context) remains the single owner of session state. Token
  writes/reads/removals move behind a small `tokenStorage` module so persistence is consistent
  across `auth-context.tsx` and `api.ts`.
- **Theme**: `next-themes` is the single source of truth (already wired in `providers.tsx` with
  `attribute="class"`, `enableSystem`, `storageKey="uski-theme"`). No new theme context is
  introduced — this already satisfies persistence (R10.3/R10.4) and OS default (R10.5).
- **Dashboard UI state** (selected view, sidebar collapsed, assistant open/maximized/position,
  conversation) is local component state in `DashboardPage`/assistant components. The assistant
  conversation is lifted to `DashboardPage` (or a small `useAssistant` hook) so it survives close
  (R17.6) while the window unmounts.
- **Derived data** (due decks) is computed with a pure selector over the deck list; no global store
  is added.

## Components and Interfaces

### Area 1 — Auth/token lifecycle (R1)

**`lib/api.ts` — `tokenStorage` (new, single source of truth)**

```ts
const ACCESS_KEY = "uski_access_token";
const REFRESH_KEY = "uski_refresh_token";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
```

**`lib/api.ts` — `apiFetch` with guard + one-shot refresh/retry**

```ts
export class SessionExpiredError extends Error {}

async function rawFetch<T>(path: string, options: RequestInit, token: string | null): Promise<T> { /* ...existing fetch... */ }

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  opts: { requireAuth?: boolean; _retried?: boolean } = {},
): Promise<T> {
  const token = tokenStorage.getAccess();

  // R1.3: guard — protected calls without a token must not be issued.
  if (opts.requireAuth && (!token || token === "")) {
    tokenStorage.clear();
    throw new SessionExpiredError("Missing access token");
  }

  try {
    return await rawFetch<T>(path, options, token);
  } catch (err) {
    // R1.5/R1.6/R1.7: a single 401 triggers refresh-then-retry-once.
    if (err instanceof ApiError && err.status === 401 && !opts._retried) {
      const refresh = tokenStorage.getRefresh();
      if (!refresh) { tokenStorage.clear(); throw new SessionExpiredError(); }
      try {
        const refreshed = await refreshWithTimeout(refresh, 5000); // R1.7 timeout
        tokenStorage.set(refreshed.access_token, refreshed.refresh_token); // R1.6 persist before retry
        return await apiFetch<T>(path, options, { ...opts, _retried: true });
      } catch {
        tokenStorage.clear();          // R1.7 clear on failed refresh
        throw new SessionExpiredError();
      }
    }
    throw err;
  }
}
```

- `checkUsername`/`setUsername`/`changeUsername`/`getMe` pass `{ requireAuth: true }` (R1.2, R1.3).
- `refreshWithTimeout` wraps the existing `/auth/refresh` call in `Promise.race` with a 5s timeout
  (R1.7). The refresh call itself uses `apiFetch` without `requireAuth` and without retry.
- The `verify-otp`/`send-otp`/`refresh` calls remain unauthenticated (no token guard).

**`app/auth-context.tsx` changes**

- Replace direct `localStorage.setItem/removeItem` calls with `tokenStorage.set/clear` (R1.1).
- `setSession(...)` keeps writing tokens **synchronously before** returning, so navigation/onboarding
  requests always see persisted tokens (R1.1).
- Add a top-level listener: when any `apiFetch` throws `SessionExpiredError`, the catch sites call
  `clearSession()` and navigate to `/login` (R1.7, R1.3). In practice the `UsernameDialog`/onboarding
  and dashboard data calls catch `SessionExpiredError` and call `clearSession()` + `navigate("/login")`.

**Onboarding request flow (R1.2–R1.6)**: `OnboardingStep` calls `checkUsername`/`setUsername` (both
`requireAuth`). On `SessionExpiredError` it routes back to the Login email step (R1.3/R1.7).

**Satisfies:** R1.1–R1.7.

### Area 2 — Theme system (R2, R10, R16)

- **No new provider.** Keep `ThemeProvider` (next-themes) from `providers.tsx`. It already persists to
  `localStorage` under `uski-theme` (R10.3/R10.4) and defaults to `system`/OS preference (R10.5).
- **Softer dark surface (R2.1, A2)**: raise the dark `--color-background` luminance floor slightly off
  pure black and introduce an explicit token so the intent is documented (see Data Models → Theme
  tokens). All sections consume `bg-background`/`bg-card`, so the change is global (R2.3/R2.4).
- **Remove dashboard theme toggle (R16.2)**: delete the `Sun/Moon` toggle in `DashboardPage` header.
- **Theme switching only in Settings (R16.3, R10.1, R10.2)**: `SettingsDialog` hosts the only theme
  control inside the authenticated app. The Login/Landing public pages keep their toggle (out of
  R16's "Dashboard" scope) for first-impression control.

**Satisfies:** R2.1–R2.4, R10.1–R10.5, R16.2, R16.3.

### Area 3 — Landing page redesign + HeroDemo (R2, R3)

- `LandingPage.tsx` keeps its section composition; sections are restyled to read well in both themes
  using existing tokens only (no hard-coded `#000`/hex colors that break a theme). Existing CTA
  destinations (`/login` in `Hero`, `CTASection`, `LandingNavbar`) are preserved verbatim (R2.5).
- **`components/landing/HeroDemo.tsx` (new)** replaces/augments the static preview card in `Hero.tsx`:
  - Renders a **mock dashboard**: a left sidebar area and a right AI-assistant area (R3.1).
  - Entrance animation via `motion` (`initial`/`animate`, `useReducedMotion` honored) (R3.2).
  - Interactivity is limited to internal state: an inner scroll container (R3.3), and clickable mock
    deck rows / a fake assistant suggestion that update **local component state only** — never
    navigating away (R3.4).
  - **Zero backend calls**, hard-coded demo constants, no real account/deck data (R3.5, R3.6).

```ts
// HeroDemo public surface — fully self-contained
export function HeroDemo(): JSX.Element; // no props, no data fetching
```

**Satisfies:** R2.1–R2.5, R3.1–R3.6.

### Area 4 — Login/OTP improvements (R4, R5, R6, R7)

**Landscape `CardStackBackdrop` (R4)** — `components/CardStackBackdrop.tsx`

- Card dimensions change to landscape aspect (width > height) for all cards (R4.1, R4.2).
- A mobile-portrait exception switches to portrait cards only on small portrait viewports, using a
  CSS/media approach so device rotation re-evaluates automatically (R4.3, R4.4, A7):
  `@media (max-width: 640px) and (orientation: portrait) { /* portrait cards */ }`.
  Orientation changes are handled by CSS (no JS resize listener required); a `useMediaQuery`
  fallback is available if a JS branch is needed.

**Larger Logo on Login (R5)** — `pages/LoginPage.tsx`

- Increase the `Logo` size props on the Login page (e.g. `imgClassName="h-16 w-16"`,
  `textClassName="text-3xl"`), keeping it legible in both themes via existing tokens (R5.1, R5.2).
  `Logo` already accepts `imgClassName`/`textClassName`, so no API change is needed.

**Resend code with countdown (R6)** — `components/auth/OtpStep.tsx`

- Add countdown state driven by a `setInterval`/`setTimeout` effect:

```ts
const RESEND_SECONDS = 60; // A3
const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
// tick every 1s to 0; resend disabled while secondsLeft > 0 (R6.1, R6.2, R6.3)
```

- `OtpStep` gains an `onResend: () => Promise<void>` prop. The button is disabled while
  `secondsLeft > 0` and shows the remaining seconds (R6.1, R6.2). At zero it enables (R6.3). On
  click it calls `onResend` (LoginPage re-calls `sendOtp(email)`), then resets `secondsLeft` to 60
  (R6.4). On failure it shows an error and re-enables the control (R6.5).

**OTP success animation state machine (R7)** — `components/auth/OtpStep.tsx`

The current `animState: "idle" | "success" | "error"` is extended into an explicit ordered sequence
so navigation is gated on completion (R7.5):

```ts
type OtpPhase =
  | "idle"
  | "verifying"      // request in flight
  | "green"          // R7.1: all six fields green within 100ms of correct verification
  | "spinner"        // R7.2: exactly one spinning circle, 600–1200ms
  | "checkmark"      // R7.3: exactly one drawn checkmark, 300–800ms
  | "transition"     // R7.4: animated step change, 200–600ms
  | "error";         // R7.6/R7.7: shake + retain code, no success animation
```

- Phase advances on `motion`'s `onAnimationComplete` callbacks (not on fixed timers racing the UI),
  guaranteeing each stage finishes before the next begins and before navigation (R7.5).
- `LoginPage` passes `onSuccessComplete` that performs the route change; `OtpStep` only invokes it
  after `checkmark → transition` completes (R7.4).
- The checkmark is an SVG path animated with `pathLength` (drawn-checkmark) via `motion`.
- On incorrect code (verify returns 401) → `error` phase: existing shake + field reset, **no** green/
  spinner/checkmark (R7.6). On network/service failure → `error` phase, **retain entered digits**,
  show error, no success animation (R7.7). Note: this changes current behavior which clears digits on
  every error — digits are retained for the network-error case per R7.7, cleared for wrong-code.
- All animation timings respect `useReducedMotion` (collapse to near-instant but preserve ordering).

**Satisfies:** R4.1–R4.4, R5.1–R5.2, R6.1–R6.5, R7.1–R7.7.

### Area 5 — Onboarding skip + username change (R8, R9)

**Onboarding presentation** — moves from the always-mounted `UsernameDialog` into an explicit
`OnboardingStep` rendered when `needsUsername` is true. It keeps the existing claim/skip UI.

**Skip flow (R8.1–R8.6)** — `components/auth/OnboardingStep.tsx` (refactor of `UsernameDialog`)

- A skip control is always present (R8.1).
- On skip, derive the username with the existing `deriveUsernameFromEmail(user.email)` (frontend) —
  which already strips `+alias` is **not** done on the frontend version. **Decision:** align the
  frontend `deriveUsernameFromEmail` with the backend `derive_username_from_email` by also stripping
  the `+` alias (split on `+`) so both implementations match R8.2 exactly. The derived value is then
  submitted via `setUsername` (R8.2). Fallback `user####` rules already exist in both (R8.5, R8.6).
- After a successful assignment, `needsUsername` becomes false and onboarding is not shown again —
  because the user now has a username and `needs_username` is derived from username presence
  (R8.3, R8.4).
- **No "skip without assigning" path.** The previous `handleSkip` that only closed the dialog is
  replaced: skip now *assigns* the derived username (so onboarding truly completes). This is the
  behavioral change required by R8.2/R8.3.

**Username change in Settings (R8.7, R9)** — needs a backend update path because the current
`set-username` returns **409 if a username already exists**. See Data Models → API changes for the
new `PATCH /api/auth/username`. Frontend adds `changeUsername(username)` in `lib/api.ts`.

**Satisfies:** R8.1–R8.7, R9.1–R9.6.

### Area 6 — Settings surface (R9, R10, R11, R16)

**`components/dashboard/SettingsDialog.tsx` (new)** — a shadcn `Dialog` (modal) opened from the
sidebar Settings entry. (A dialog is chosen over a route to keep the dashboard mounted and avoid
router changes; it is the least invasive option.)

- **Username section (R9)**: shows current `username#discriminator`, an edit field with the same
  validation as onboarding (3–20 lowercase alphanumeric, R9.2), live availability check, submit →
  `changeUsername`. On success updates the displayed value via `getMe`/returned payload (R9.4, R9.5);
  on validation failure shows an inline error and does not submit (R9.3); on request error shows an
  error and keeps the previous username (R9.6).
- **Theme section (R10)**: a light/dark control bound to `next-themes` `setTheme` (R10.1, R10.2);
  persistence/OS default handled by the provider (R10.3–R10.5). This is the only theme control in the
  authenticated app (R16.3).
- **Logout section (R11)**: a logout button that calls `clearSession()` (clears tokens via
  `tokenStorage.clear`) and navigates to `/login` (R11.1, R11.2).

**Satisfies:** R9.1–R9.6, R10.1–R10.5, R11.1–R11.2, R16.3.

### Area 7 — Dashboard restructure (R12, R13, R14, R15, R16)

**`components/dashboard/Sidebar.tsx` (new, extracted from `DashboardPage`)**

Layout, top to bottom:

```
┌─────────────────────────────────────┐
│  [Logo USki]            [⟨ collapse] │  ← collapse top-right, opposite logo (R13.1, R13.2)
├─────────────────────────────────────┤
│  OVERVIEW                            │  ← Overview section above Decks (R15.1)
│   ▸ Review                           │  ← first/topmost item (R15.2); no "Review" button elsewhere (R14)
│   ▸ <due deck>  (only due decks)     │  ← only Due_Decks, no create control (R15.3,R15.4,R15.7)
│                                      │
│  DECKS                               │
│   ▸ <all decks…>                     │  ← all decks incl. not-due (R15.5)
│   ▸ + New deck                       │  ← the only create control (R15.6)
├─────────────────────────────────────┤
│  ⚙ Settings                          │  ← bottom, directly above username (R16.1)
│  [avatar] username#1234              │  ← username, never email (R12.1, R12.2); no logout (R11.3)
└─────────────────────────────────────┘
```

- **Username display (R12)**: footer shows `username#discriminator`. While not yet loaded, show a
  neutral placeholder (e.g. a skeleton or "…"), never the email (R12.1, R12.2, R12.3). The old
  `displayName` fallback to `user?.email` is removed.
- **Collapse control relocation (R13)**: a single collapse button sits in the sidebar header's
  top-right, horizontally opposite the `Logo` (R13.1). The previous bottom "Collapse" row is removed
  (R13.2). Toggling collapses/expands the whole sidebar (R13.3, R13.4). The mobile close (X) button
  is retained but distinct from the desktop collapse.
- **Remove Review button (R14)**: the standalone primary "Review" CTA button is removed; "Review" now
  exists only as the Overview section's first entry (R14.1, R15.2).
- **Overview vs Decks sections (R15)**:
  - Overview renders `Review` first, then only `Due_Decks` (R15.2, R15.3), nothing when there are no
    due decks (R15.4), and provides no create control (R15.7).
  - Decks lists all decks (R15.5) and holds the single "New deck" control (R15.6).
  - Due-deck membership is recomputed on load/refresh and whenever deck data changes (R15.8, R15.9,
    R15.10) using the pure selector below; with React state updates this re-renders within the 2s
    bound trivially.
- **Settings placement (R16.1)**: Settings entry sits at the bottom, directly above the username row.

**`lib/due-decks.ts` (new) — pure due-deck logic (R15.3, A4)**

```ts
export interface DeckCard { nextReview: string | null; } // ISO timestamp from FSRS, null = never scheduled
export interface DeckLike { id: string; name: string; cards: DeckCard[]; }

/** A deck is due iff at least one card's next-review time is at or before `now`. */
export function isDeckDue(deck: DeckLike, now: Date = new Date()): boolean;

/** Returns only the due decks, preserving input order. */
export function selectDueDecks<T extends DeckLike>(decks: T[], now?: Date): T[];
```

> Note: backend deck/flashcard schemas and the FSRS service are currently placeholders, and the
> dashboard renders mock decks. The Due_Deck predicate is defined as a pure frontend function over
> card `nextReview` timestamps so it works on today's mock data and on real API data unchanged once
> deck endpoints exist. No backend work is required for R15 in this feature.

**Satisfies:** R11.3, R12.1–R12.3, R13.1–R13.4, R14.1, R15.1–R15.10, R16.1.

### Area 8 — AI assistant (R17, R18, R19)

**`components/dashboard/assistant/AssistantBubble.tsx` + `AssistantWindow.tsx` (new)** — replace the
slide-in `AiChatPanel`. State machine:

```ts
type AssistantState = "closed" | "small" | "maximized";
```

- **Bubble (R17.1)**: while `closed`, a circular button is fixed in the bottom-right with a 16–24px
  margin from the bottom/right edges (`bottom-5 right-5` ≈ 20px).
- **Small window (R17.2, R17.7)**: opening sets `small` — a window 320–400px wide × 480–600px tall
  (e.g. 380×560). If the viewport is < 320px wide, width is clamped to the viewport (R17.7).
- **Maximize/restore (R17.3–R17.5)**: a control toggles `small ↔ maximized`. Maximized = full
  viewport height × 33–50% width (e.g. 40vw, min 360px), fixed to the right edge (R17.4). A restore
  control returns to `small` (R17.5).
- **Close + retain conversation (R17.6)**: closing returns to `closed` and shows the bubble. The
  conversation lives in `DashboardPage`/`useAssistant` state (above the window), so unmounting the
  window does not lose messages.

**Dragging (R18)** — only in `small` state, via `motion`:

- The title bar is the drag handle (`onPointerDown` starts drag); `motion` `drag` with manual bounds,
  or controlled position updated via a pure clamp.
- Position is clamped so the **entire** window stays within all four viewport edges (R18.3) using
  `lib/window-bounds.ts`:

```ts
export interface Size { width: number; height: number; }
export interface Point { x: number; y: number; }
/** Clamp the window's top-left so the whole window stays within [0, viewport]. */
export function clampToViewport(pos: Point, size: Size, viewport: Size): Point;
```

- Maximized state is not draggable and stays pinned right (R18.2).
- Released position is retained in state until dragged again / closed / maximized (R18.4).
- A `resize` listener re-clamps the stored position so the window never falls outside after a resize
  (R18.5).

**Open/close animation (R19)** — `motion`:

- Open/close animations target 150–400ms (e.g. `duration: 0.25`, spring or eased) (R19.1, R19.2).
- Animate only GPU-friendly properties (`transform`/`opacity`, `scale`) to hold ≥55fps with no frame
  interval > 32ms (R19.3). Avoid animating layout-affecting properties (width/height/top/left) during
  open/close; use `scale`/`opacity` for the transition.
- `AnimatePresence` with a single keyed element ensures a state change mid-animation interrupts and
  retargets cleanly without a partially-animated resting state (R19.4). `useReducedMotion` collapses
  durations.

**Satisfies:** R17.1–R17.7, R18.1–R18.5, R19.1–R19.4.

## Data Models

### Theme tokens (`index.css`, Tailwind v4 `@theme` / `.dark`) — R2.1, A2

The dark background is currently `hsl(250 18% 7%)` (already off pure black). To make the "softer dark
surface" intent explicit and documented, the dark surface luminance floor is nudged up and named:

```css
.dark {
  /* Softer near-black surface — explicitly NOT #000000 (A2, R2.1).
     Luminance floor kept above pure black with a faint violet tint. */
  --color-background: hsl(250 16% 9%);   /* was 7% — softer, still dark-first */
  --color-card:       hsl(250 14% 12%);  /* raised to keep card/background contrast */
  --color-surface:    hsl(250 14% 12%);
  /* other dark tokens unchanged */
}
```

No new utility classes are required — sections already consume `bg-background`/`bg-card`. Light-mode
tokens are unchanged (R2.2, R2.4).

### Onboarding completion — no migration (R8.3, R8.4)

Onboarding completion is represented by **username presence** on `public.user`:

- `needs_username == (user.username IS NULL)` — already implemented in `verify-otp`, `refresh`, and
  `/me`.
- Skipping assigns a derived username → `username` becomes non-null → `needs_username` is false on all
  subsequent logins → onboarding is never shown again.

**Decision:** No Supabase migration and no new `onboarding_complete` column. The existing
`username#discriminator` model fully expresses completion, avoiding schema churn.

### API changes (backend)

**New: `PATCH /api/auth/username` — update an existing username (R8.7, R9.4)**

The existing `POST /auth/set-username` intentionally rejects updates (409 if already set). Rather than
weaken that onboarding guard, add a dedicated update endpoint.

```python
# schemas/auth.py
class ChangeUsernameRequest(BaseModel):
    """Request to change an existing username (Settings)."""
    username: str = Field(
        ..., min_length=3, max_length=20, pattern=r"^[a-z0-9]+$",
        description="Lowercase alphanumeric username, 3-20 characters",
    )
```

```python
# api/auth.py
@router.patch("/username", response_model=UserResponse)
async def change_username(
    body: ChangeUsernameRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> UserResponse:
    """Update the current user's username (allowed even when one is already set).

    Generates a fresh 4-digit discriminator and retries on collision, mirroring
    set_username, but performs an UPDATE regardless of whether a username exists.
    """
    # 1. (optional) if username unchanged, keep discriminator
    # 2. retry up to 10 times: pick discriminator, ensure (username, discriminator) free, UPDATE
    # 3. return UserResponse(..., has_username=True)
```

Behavior:
- Same validation as `SetUsernameRequest` (R9.2 enforced by Pydantic and at the DB-availability
  check).
- Performs an `UPDATE` even when `username` is already set (the difference from `set-username`)
  (R8.7, R9.4).
- Returns the updated `username` and a `discriminator` (R9.4).
- Reuses the discriminator collision-retry loop from `set_username` (extract a shared helper
  `_assign_username(svc_client, user_id, username)` used by both endpoints).

**Frontend `lib/api.ts` additions**

```ts
export async function changeUsername(username: string): Promise<UserResponse> {
  return apiFetch<UserResponse>("/auth/username", {
    method: "PATCH",
    body: JSON.stringify({ username }),
  }, { requireAuth: true });
}
```

`checkUsername`, `setUsername`, `getMe` also adopt `{ requireAuth: true }`.

### Frontend session/data types (unchanged shapes, clarified)

- `AuthResponse`, `UserResponse`, `UsernameCheckResponse` are unchanged.
- `auth-context` `setSession` writes via `tokenStorage.set`; `clearSession` via `tokenStorage.clear`.

### Assistant + due-deck model types

- `AssistantState`, `Point`, `Size` (frontend only, defined above).
- `DeckLike`/`DeckCard` (frontend, defined above) — adapter shape over current mock decks and future
  deck API.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Most of this feature is UI redesign (layout, animation timing, theming, interaction) which is
verified by manual QA and `tsc` typechecking rather than property-based testing. However, several
pieces are **pure functions** with universal invariants and are excellent PBT candidates:

- `derive_username_from_email` / `deriveUsernameFromEmail` (R8.2, R8.5, R8.6)
- username validation (R9.2)
- `selectDueDecks` / `isDeckDue` (R15.3, R15.4)
- `clampToViewport` (R18.3, R18.5, R17.7)

The username properties (P1–P3) are executed in the backend test suite (pytest + Hypothesis), since
`username.py` lives there and the same rules govern the frontend helper. The frontend pure helpers
(P4, P5) are designed side-effect-free so they can be property-tested with `fast-check` if a frontend
runner is later added; today they are verified by typecheck + manual QA (see Testing Strategy).

### Property 1: Derived username validity invariant

*For any* email string, `derive_username_from_email` returns a username that consists only of
lowercase ASCII alphanumeric characters (`^[a-z0-9]+$`) and whose length is between 3 and 20
inclusive; and when the cleaned local part (before `@`, before `+`, with dots and non-alphanumerics
removed, lowercased, truncated to 20) already has at least 3 characters, the result equals that
cleaned value (deterministic, no randomness).

**Validates: Requirements 8.2**

### Property 2: Derived username fallback shape

*For any* email whose cleaned local part yields fewer than 3 ASCII-alphanumeric characters (including
an empty or all-invalid local part), `derive_username_from_email` returns a value matching
`^user\d{4}$` (the literal `user` followed by exactly four digits).

**Validates: Requirements 8.5, 8.6**

### Property 3: Username validation correctness

*For any* candidate string, the username validation accepts it if and only if the string is between 3
and 20 characters long and contains only lowercase ASCII alphanumeric characters
(`^[a-z0-9]{3,20}$`).

**Validates: Requirements 9.2**

### Property 4: Due-deck selection correctness

*For any* list of decks where each deck has a list of cards with optional next-review timestamps, and
*for any* reference time `now`, `selectDueDecks(decks, now)` returns exactly those decks that contain
at least one card whose next-review timestamp is at or before `now`, preserves the original relative
order, and excludes every deck with no such card (yielding an empty result when no deck is due).

**Validates: Requirements 15.3, 15.4**

### Property 5: Assistant window stays within the viewport

*For any* requested position, window size, and viewport size, `clampToViewport(pos, size, viewport)`
returns a position whose resulting window rectangle lies fully within all four viewport edges when
the window fits (and is pinned to the available space, never negative, when the window is larger than
the viewport, e.g. width below 320px); and applying `clampToViewport` again to its own result returns
the same position (idempotence), so re-clamping after a viewport resize never moves an already-valid
window.

**Validates: Requirements 18.3, 18.5, 17.7**

## Error Handling

### Auth / token lifecycle (R1)

- **Missing/empty access token on a protected call**: `apiFetch({ requireAuth: true })` throws
  `SessionExpiredError` without issuing the request; callers clear the session and route to the Login
  email step (R1.3).
- **401 on a protected call**: one refresh attempt (5s timeout) then exactly one retry; tokens are
  persisted before the retry (R1.5, R1.6). A second 401 is not retried.
- **Refresh fails / times out**: tokens are cleared and `SessionExpiredError` propagates → route to
  Login (R1.7). The 5s timeout is enforced with `Promise.race`.
- **Onboarding requests** (`checkUsername`/`setUsername`) surface `SessionExpiredError` distinctly
  from validation/availability errors so the UI can redirect rather than show a generic message.

### OTP / resend (R6, R7)

- **Wrong code (verify 401)**: error phase with shake; digits cleared; no success animation (R7.6).
- **Network/service error on verify**: error indication, **entered digits retained**, no success
  animation (R7.7).
- **Resend failure**: inline error shown and resend control re-enabled immediately (countdown not
  restarted) (R6.5).

### Username change (R9)

- **Client-side invalid username**: inline validation error, request not sent (R9.3).
- **Server error / taken combo**: error message shown, previously displayed username retained;
  the update endpoint retries discriminator collisions up to 10 times before returning 500 (R9.6).

### Backend `change_username` (R8.7, R9.4)

- Pydantic rejects malformed usernames with 422.
- Discriminator collision retry loop (max 10) mirrors `set_username`; exhaustion returns 500 with a
  clear detail. Unlike `set_username`, no 409 is raised when a username already exists.

### Assistant (R17–R19)

- **Viewport smaller than the small window** (< 320px wide): width clamped to the viewport; position
  clamp keeps it on-screen (R17.7).
- **Resize while open**: stored position re-clamped so the window never ends up off-screen (R18.5).
- **Rapid open/close toggling**: `AnimatePresence` interrupts and retargets; no partial resting state
  (R19.4).

### HeroDemo (R3)

- The demo is fully self-contained: it imports no API client and performs no fetches, so it cannot
  fail due to network/auth. Interactions only mutate local state (R3.4, R3.5).

## Testing Strategy

USki has **no frontend test runner** (typecheck via `tsc --noEmit` only); the backend uses
**pytest + httpx** with a JWKS-mocking autouse fixture. The strategy reflects this split.

### Backend (pytest) — executed automated tests

**Property-based tests** (add `hypothesis` to the backend dev dependencies; do not hand-roll a PBT
framework). Each runs ≥ 100 iterations and is tagged with its design property.

- **P1, P2 — `derive_username_from_email`** (`tests/test_username_service.py`):
  - `# Feature: ux-redesign-onboarding, Property 1: Derived username validity invariant`
  - `# Feature: ux-redesign-onboarding, Property 2: Derived username fallback shape`
  - Generators: arbitrary text local parts, `+alias` variants, dot-heavy and non-ASCII inputs,
    empty/invalid local parts.
- **P3 — username validation** (`tests/test_username_service.py`):
  - `# Feature: ux-redesign-onboarding, Property 3: Username validation correctness`
  - Validate against the `^[a-z0-9]{3,20}$` rule used by `SetUsernameRequest`/`ChangeUsernameRequest`.

**Example / integration tests** (`tests/test_auth.py`, mocked JWKS + mocked Supabase client):

- Valid token → `check-username`/`set-username`/`PATCH username` return 2xx (R1.4).
- `set-username` returns 409 when already set; `PATCH /auth/username` **succeeds** when already set
  and returns the new `username#discriminator` (R8.7, R9.4).
- After assigning a username, `/me` and `verify-otp`/`refresh` report `needs_username == false`
  (R8.3, R8.4).
- `change_username` discriminator-collision retry and exhaustion (500) behavior (R9.6).
- `PATCH /auth/username` with malformed body → 422 (R9.2 server enforcement).

### Frontend — typecheck + manual QA

Pure helpers are written side-effect-free and exported so they are PBT-ready; **recommend** adding
`vitest + fast-check` later to execute P4 and P5. Until then:

- **P4 — `selectDueDecks`/`isDeckDue`** (`lib/due-decks.ts`): verified by manual scenarios + typecheck;
  test stub documented with `// Feature: ux-redesign-onboarding, Property 4: Due-deck selection correctness`.
- **P5 — `clampToViewport`** (`lib/window-bounds.ts`): verified by manual drag/resize QA; stub tagged
  `// Feature: ux-redesign-onboarding, Property 5: Assistant window stays within the viewport`.

**Manual QA checklist** (mapped to requirements):

- Onboarding completes without 401; expired-token path refreshes and retries once; missing token
  routes to Login (R1).
- Both themes render correctly across Landing, Login, Dashboard, Settings; dark surface is visibly
  off-black; no dashboard theme toggle; theme switch only in Settings; persists across reload; OS
  default when unset (R2, R10, R16.2, R16.3).
- HeroDemo animates in, scrolls, responds to clicks without navigation, shows only mock data (R3).
- Landscape cards everywhere except mobile portrait; rotation restores landscape (R4).
- Larger, legible logo on Login in both themes (R5).
- Resend disabled with countdown, enables at 0, restarts on resend, errors re-enable (R6).
- OTP success: green → spinner (600–1200ms) → checkmark (300–800ms) → transition (200–600ms); no
  navigation before completion; wrong code shakes without success anim; network error retains digits
  (R7).
- Skip assigns email-derived username and never shows onboarding again; Settings changes username
  (R8, R9).
- Sidebar: username (not email) with placeholder while loading; collapse top-right; no Review button;
  Overview (Review + only due decks, no create) above Decks (all decks + single create); Settings at
  bottom above username; no logout in sidebar (R11.3, R12–R16).
- Assistant: bubble bottom-right; small window sizing; maximize/restore; draggable small window
  clamped to viewport; maximized pinned right and not draggable; conversation retained on close;
  smooth ≥55fps open/close; clean interruption on rapid toggle (R17–R19).

### Requirements → design coverage map

| Requirement | Design area |
|---|---|
| R1 | Area 1 (apiFetch retry, tokenStorage, auth-context), Error Handling, P-none (example/integration) |
| R2 | Area 2 + Area 3, Theme tokens |
| R3 | Area 3 (HeroDemo) |
| R4 | Area 4 (CardStackBackdrop) |
| R5 | Area 4 (Logo on Login) |
| R6 | Area 4 (OtpStep resend) |
| R7 | Area 4 (OtpStep phase machine) |
| R8 | Area 5 (OnboardingStep skip, derivation), Data Models (no migration), P1, P2 |
| R9 | Area 5 + Area 6 (SettingsDialog), API change (PATCH username), P3 |
| R10 | Area 2 + Area 6 |
| R11 | Area 6 (logout), Area 7 (no sidebar logout) |
| R12 | Area 7 (Sidebar username) |
| R13 | Area 7 (collapse relocation) |
| R14 | Area 7 (no Review button) |
| R15 | Area 7 (Overview/Decks, due-decks selector), P4 |
| R16 | Area 2 + Area 6 + Area 7 |
| R17 | Area 8 (bubble/window states) |
| R18 | Area 8 (drag/clamp), P5 |
| R19 | Area 8 (motion open/close) |
