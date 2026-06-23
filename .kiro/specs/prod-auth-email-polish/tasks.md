# Implementation Plan

## Overview

Five independent tasks deliver the four fixes: branded transactional emails (Req 2), a richer
session device label (Req 4.1–4.2), an always-on larger Security-tab map (Req 4.3–4.7), Expo
cache ignore/untrack with Windows long-path docs (Req 3), and the Supabase Cloud code-only email
configuration doc (Req 1). Tasks 1, 2, and 4 are backend/repo with automated tests; task 3 is a
frontend presentation change; task 5 is documentation for a hosted-config change. All five are
independent and may run in parallel.

## Tasks

- [x] 1. Brand the transactional email templates
  - Rewrite `_shell(title, body_html)` in `backend/src/uski/services/email.py` to emit the dark,
    table-based USki shell mirroring `supabase/templates/otp.html` (page bg `#0b0b0f`, card
    `#15151c`/`#26262f` radius 16px, split wordmark `>US<`/`>ki<` with accent `#7c5cff`, system
    font stack, light body text).
  - Update `welcome_email` and `login_alert_email` bodies for the dark shell while keeping their
    signatures, `kind` values, the by-name/"there" greeting, and the `%Y-%m-%d %H:%M UTC` stamp.
  - Keep `_record`, `_deliver_resend`, `_send`, `_already_welcomed`, `notify_login`, and
    `EmailMessage` unchanged.
  - Run `pytest tests/test_email.py` and confirm the branding markers and detail assertions pass.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 2. Add device-model detection to the session device label
  - Extend `device_from_user_agent` in `backend/src/uski/services/sessions.py` to prepend a
    recognizable model (iPhone, iPad, named Android model) when present, falling back to the
    existing `"Browser on OS"` and `"Unknown device"` behavior.
  - Keep the function total (never raises) and preserve existing exact-match outputs.
  - Add cases to `tests/test_sessions.py` for model detection plus a regression guard for the
    current `"Browser on OS"` outputs; keep the `never_raises` and `is_private_ip` properties.
  - Run `pytest tests/test_sessions.py`.
  - _Requirements: 4.1, 4.2_

- [x] 3. Always render a larger map in the Security tab
  - In `frontend/src/pages/SettingsPage.tsx` `SessionRow`, render the map for every row: when
    `lat`/`lon` exist keep the marker + tight bbox; when absent show a same-sized zoomed-out
    neutral map with no marker plus a caption ("Approximate — signed in from a local network").
  - Increase the map height from `h-40` to `h-56` (≈224px), keep `w-full`/responsive.
  - Leave the "This device" badge, per-row sign-out, and "sign out others" behavior unchanged.
  - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 4. Ignore and untrack the Expo cache, document long paths
  - Add a Mobile/Expo block to `.gitignore`: `mobile/.expo/`, `mobile/.expo-shared/`,
    `mobile/web-build/`, `mobile/dist/`, and `**/.expo/`.
  - If tracked, run `git config core.longpaths true` (repo-local) then
    `git rm -r --cached --quiet mobile/.expo`; confirm `git status` shows nothing under
    `mobile/.expo/` and mobile source files remain tracked.
  - Document the Windows `core.longpaths true` step in `STARTUP.md`.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 5. Document the Supabase Cloud code-only email configuration
  - Add `supabase/PROD_EMAIL_SETUP.md` with step-by-step instructions to set the Magic Link,
    Confirm signup, Reset Password, and Change Email Address templates in the Supabase Cloud
    dashboard to the `otp.html` body rendering `{{ .Token }}`.
  - Include an optional Management API `curl` snippet (referencing `SUPABASE_ACCESS_TOKEN` and
    project ref, never committing secrets) for scripted reapplication.
  - Note that `send-otp`/`verify-otp` code is intentionally unchanged.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2", "3", "4", "5"] }
  ]
}
```

All five tasks are independent (no inter-task dependencies) and form a single parallel wave.

## Notes

- The OTP verify/send endpoints and the email outbox/delivery pipeline are intentionally
  unchanged; only templates, a pure parser, frontend presentation, ignore rules, and hosted
  config move.
- Task 5 is documentation for a Supabase Cloud dashboard change; the production link-vs-code
  behavior only changes once that dashboard configuration is applied.
- Unrelated aside (from the prod logging question): set `BACKEND_LOG_LEVEL=DEBUG` in the prod
  environment to surface verbose logs; it is independent of `APP_MODE`.
