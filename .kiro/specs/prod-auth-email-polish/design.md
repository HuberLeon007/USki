# Design Document

## Overview

This design addresses four production-readiness fixes for USki, each largely independent
so they can be implemented and verified in isolation:

1. **Prod sign-in code (Req 1):** Configure the Supabase Cloud email templates to render the
   6-digit `{{ .Token }}` instead of a magic link, mirroring the repo's `otp.html`. This is a
   hosted-project configuration change plus repo documentation; no request-time code path
   generates these mails.
2. **Branded transactional emails (Req 2):** Rework the pure template builders in
   `backend/src/uski/services/email.py` so welcome and login-alert mails use the same dark,
   table-based USki shell as `otp.html`. Delivery, outbox, and welcome-once logic stay intact.
3. **Repo hygiene (Req 3):** Ignore and untrack `mobile/.expo/`, and document the Windows
   `core.longpaths` setting so merges into `main` stop failing on long cache paths.
4. **Security tab (Req 4):** Enrich the device label parser and change the frontend
   `SessionRow` to always render a (larger) map, with a non-misleading fallback when no
   precise geolocation exists.

The unifying principle is to keep behavior-preserving seams: the OTP verify endpoint, the
email send/outbox pipeline, and the sessions API contract are all unchanged. Only templates,
pure parsing helpers, presentation, ignore rules, and hosted config move.

## Architecture

```mermaid
flowchart TD
    subgraph Auth Email (Req 1 — hosted config)
        A[sign_in_with_otp] --> B[Supabase Cloud GoTrue]
        B --> C{Email template}
        C -->|today: default Magic Link| D[link with ConfirmationURL]
        C -->|target: code-only otp.html| E[6-digit Token]
        E --> F[Resend SMTP -> user inbox]
    end

    subgraph Transactional Email (Req 2 — backend)
        G[notify_login] --> H[welcome_email / login_alert_email]
        H --> I[_shell branded dark template]
        I --> J[_record outbox]
        I --> K[_deliver_resend prod only]
    end

    subgraph Security Tab (Req 4 — frontend + helper)
        L[GET /api/auth/sessions] --> M[SessionInfo rows]
        M --> N[SessionRow]
        N --> O[device label]
        N --> P[map: geo -> marker / no geo -> fallback]
    end
```

The three runtime subsystems do not interact. Req 3 (repo hygiene) is a build-time/tooling
concern with no runtime surface.

## Components and Interfaces

### Req 1 — Supabase Cloud email template configuration

- **Source of truth:** `supabase/templates/otp.html` (already renders `{{ .Token }}`). It stays
  the canonical body. `supabase/config.toml` already maps every local template to it; that file
  only governs the local CLI stack, never the hosted project — this is the root cause of the
  prod regression.
- **Change:** In the Supabase Cloud dashboard (Authentication → Emails → Templates), set the
  HTML body of **Magic Link**, **Confirm signup**, **Reset Password**, and **Change Email Address**
  to the `otp.html` body. `sign_in_with_otp` triggers the *Magic Link* template for an existing
  user and the *Confirm signup* template for a brand-new email; both must show the token, so both
  are updated to avoid any link fallback.
- **Reproducibility:** Add `supabase/PROD_EMAIL_SETUP.md` documenting the exact steps, the four
  templates, the required `{{ .Token }}` variable, and (optionally) a Management API `curl`
  snippet that PATCHes `mailer_templates_*_content` for scripted reapplication. Secrets
  (`SUPABASE_ACCESS_TOKEN`, project ref) are referenced, never committed.
- **No code change:** `POST /api/auth/send-otp` / `verify-otp` are untouched (Req 1.5).

### Req 2 — Branded transactional email templates

File: `backend/src/uski/services/email.py`. Only the pure builders change; the adapter seam
(`_record`, `_deliver_resend`, `_send`, `_already_welcomed`, `notify_login`) and the
`EmailMessage` dataclass keep their current signatures.

- **`_shell(title, body_html)`** is rewritten to emit the dark, table-based USki shell that
  mirrors `otp.html`:
  - page background `#0b0b0f`, card `#15151c` with `1px solid #26262f`, radius 16px;
  - the split wordmark `<span style="color:#7c5cff">US</span><span style="color:#fff">ki</span>`
    (text-only, so it degrades with no external image — satisfies Req 2.6 without an `<img>`);
  - same system font stack; light body text (`#c9c9d4`) and muted footer (`#6b6b78`).
- **`welcome_email`** keeps `(to, name)` → greets by name (or "there"), introduces decks / FSRS /
  AI assistant inside the branded shell, `kind="welcome"`.
- **`login_alert_email`** keeps `(to, device, location, when)` → renders the device/location/time
  as a styled table on dark, preserving the exact `"%Y-%m-%d %H:%M UTC"` timestamp and the
  "Settings → Security" guidance.
- **Test-compatibility contract** (existing `tests/test_email.py` already asserts the target):
  HTML must contain accent `#7c5cff`, dark bg `#0b0b0f`, and the split markers `>US<` and `>ki<`;
  welcome must contain the name (or "there"); login-alert must contain device, location, and the
  formatted timestamp.

### Req 3 — Ignore + untrack Expo cache

- **`.gitignore`:** add a Mobile/Expo block: `mobile/.expo/`, `mobile/.expo-shared/`,
  `mobile/web-build/`, `mobile/dist/`, and a defensive `**/.expo/`.
- **Untracking:** if anything under `mobile/.expo/` is tracked, run
  `git rm -r --cached --quiet mobile/.expo` so the working tree keeps the files but the index
  drops them. On Windows the long paths can block even this, so set `git config core.longpaths true`
  (repo-local, not global) first.
- **Docs:** record the `core.longpaths` step in `STARTUP.md` (or a short note) so contributors on
  Windows can clone/merge. No global git config is changed silently (Req 3.5).
- **Guard:** only `.expo/`-style generated output is touched; `mobile/` source (app code,
  `app.json`, assets) stays tracked (Req 3.6).

### Req 4 — Device label + always-on larger map

**Backend helper** `device_from_user_agent(ua)` in `backend/src/uski/services/sessions.py` gains
optional **model detection** layered before the existing browser/OS logic, returning a more
specific label when a model is recognizable, otherwise falling back to today's `"Browser on OS"`
and finally `"Unknown device"`:

- iPhone → prefer `"iPhone"`; iPad → `"iPad"`; named Android model parsed from the UA build token
  when present (e.g. `Pixel 7`, `SM-G991B`); otherwise unchanged.
- The label format stays human-readable and the function still never raises on arbitrary input
  (preserves `test_device_parsing_never_raises`). Existing exact-match tests
  (`Chrome on Windows`, `Safari on iOS`, `Firefox on Linux`) must still hold, so model detection
  only *adds* specificity for UAs that today fall through to OS-only.

**Frontend** `SessionRow` in `frontend/src/pages/SettingsPage.tsx`:

- The map is **always** rendered (Req 4.3). Height grows from `h-40` (160px) to `h-56` (224px),
  staying `w-full` and responsive (Req 4.5).
- When `lat`/`lon` exist → current behavior: OSM embed centered with a marker and a tight bbox
  (Req 4.6).
- When geo is absent → render the same-sized map frame at a zoomed-out neutral view **without** a
  marker, plus a small caption ("Approximate — signed in from a local network"), so it always
  looks like a map but never shows a misleading precise pin (Req 4.4, 4.6).
- Current-device badge, per-row sign-out, and "sign out others" are untouched (Req 4.7).

## Data Models

No schema changes. Existing shapes are reused:

- **`EmailMessage`** (`to`, `subject`, `html`, `kind`) — unchanged.
- **`SessionInfo`** API contract (`id`, `device`, `ip`, `city`, `country`, `lat`, `lon`,
  `created_at`, `last_seen_at`, `current`) — unchanged. Req 4 reads existing fields; the richer
  device label is produced at write time by `record_login` via `device_from_user_agent`, so
  newly-recorded sessions carry the improved label while old rows keep their stored value.
- **`user_session`** table — unchanged.

## Correctness Properties

These pure functions are the testable seam (property-based where ranges matter):

### Property 1: Email branding is invariant

For all valid inputs, `welcome_email(...).html` and `login_alert_email(...).html` contain the
accent `#7c5cff`, the dark background `#0b0b0f`, and both split-wordmark markers `>US<` and `>ki<`.

**Validates: Requirements 2.1, 2.6**

### Property 2: Login-alert detail preservation

For any `device`, `location`, and `when`, `login_alert_email` output contains the device string,
the location string, and the timestamp formatted as `%Y-%m-%d %H:%M UTC`.

**Validates: Requirements 2.3**

### Property 3: Welcome greeting

`welcome_email(to, name)` contains `name` when given, else `"there"`.

**Validates: Requirements 2.4**

### Property 4: Device parser totality

For all string (and `None`) inputs, `device_from_user_agent` returns a non-empty label and never
raises.

**Validates: Requirements 4.1**

### Property 5: Device parser specificity is monotonic

Known UAs that currently yield `"Browser on OS"` still do (regression guard); UAs containing a
recognizable model yield a label that includes that model.

**Validates: Requirements 4.1, 4.2**

### Property 6: Geolocatability classification

`is_private_ip` is `True` for loopback/private/empty and `False` for public addresses (existing
property, retained).

**Validates: Requirements 4.3, 4.4**

## Error Handling

- **Email:** unchanged — `notify_login` and `_record`/`_deliver_resend` swallow all exceptions and
  log warnings so email never blocks or breaks login. Template builders are pure and total.
- **Maps:** the OSM `<iframe>` is best-effort; if it fails to load the row still renders (caption +
  frame). No precise marker is shown without `lat`/`lon`.
- **Git untrack:** `git rm --cached` is a no-op if nothing is tracked; `core.longpaths` is set
  repo-local so it cannot corrupt global config.
- **Supabase config:** purely external; the repo documents and (optionally) scripts it. If the
  dashboard change is not applied, the app still works — users just keep getting links until it is.

## Testing Strategy

- **Backend unit/PBT (`pytest` + `hypothesis`):**
  - Extend `tests/test_email.py` — branding markers already asserted (P1–P3); keep green after
    `_shell` rewrite.
  - Extend `tests/test_sessions.py` — add cases for model detection (iPhone/iPad/named Android)
    while keeping the existing exact-match and `never_raises`/`is_private_ip` properties (P4–P6).
- **Frontend:** manual/visual check of the Security tab — map always present and larger, fallback
  caption on local network, device label specificity, badges and sign-out unaffected. If a
  component test harness exists, assert the map element renders for both geo and no-geo rows.
- **Repo hygiene:** verify `git status` shows nothing under `mobile/.expo/` and a test merge into a
  scratch branch on Windows no longer raises "Filename too long".
- **Prod email config:** after applying the dashboard change, trigger a real sign-in and confirm a
  6-digit code (no link) arrives; verify the code authenticates through `verify-otp`.
