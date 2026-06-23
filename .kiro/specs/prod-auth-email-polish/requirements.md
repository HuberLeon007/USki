# Requirements Document

## Introduction

USki authentication and transactional email work correctly in local development but
break or look unfinished in production. This spec captures four production-readiness
fixes:

1. **Sign-in code, not a link.** In production users receive a magic-link email instead
   of the intended 6-digit one-time code. The local Supabase CLI is configured correctly
   (`supabase/config.toml` → `supabase/templates/otp.html`, rendering `{{ .Token }}`), but
   that config does not apply to the hosted Supabase Cloud project, which still uses its
   default link-based templates.
2. **Branded transactional emails.** The backend's welcome and login-alert emails
   (`backend/src/uski/services/email.py`) use a minimal, light-mode template with no logo
   or color theme, unlike the polished dark `otp.html` used for sign-in codes.
3. **Repository hygiene.** `mobile/.expo/` is not ignored by git. Expo's web image cache
   produces deeply nested, hash-named paths that exceed the Windows `MAX_PATH` limit,
   causing `cannot stat ... Filename too long` errors and blocking merges into `main`.
4. **Security tab polish.** In the Settings → Security "Devices & sessions" list, each device
   should show a clearer device name, and the location map should always be shown (and larger)
   rather than only appearing for public-network sign-ins.

The goal is that the production sign-in and email experience matches the intended design,
the Security tab clearly identifies each device with a map, and the repository can be
committed and merged cleanly across machines (including Windows).

### Scope notes

- Issue 1 is primarily a **Supabase Cloud dashboard configuration** change plus keeping a
  single code-only HTML template as the source of truth in the repo. No request-time
  backend code generates these auth emails.
- Issue 2 is a **backend code** change to the email templates only; delivery transport
  (Resend) and the welcome-once rule stay as-is.
- Issue 3 is a **repository/tooling** change (`.gitignore`, git index, optional git config).
- Issue 4 is a **frontend** change to the `SessionRow`/`SessionsPanel` rendering, optionally
  with a small backend tweak to enrich the device label.

### Out of scope

- Changing the authentication flow itself (OTP send/verify endpoints stay unchanged).
- Adding new email types or a new email provider.
- Mobile app feature work beyond ignoring build/cache artifacts.
- Replacing the map provider or adding a paid mapping/geolocation service.

## Glossary

- **OTP / sign-in code:** The 6-digit numeric code rendered via `{{ .Token }}` that a user
  enters to sign in.
- **Magic link:** A clickable URL (`{{ .ConfirmationURL }}`) that signs a user in on click;
  this is what production currently sends and what we are removing from the sign-in path.
- **Transactional email:** Backend-generated welcome and login-alert emails sent via Resend,
  distinct from the Supabase-sent sign-in code email.
- **Session row:** One entry in the Settings → Security "Devices & sessions" list, backed by
  a `user_session` record (device, IP, geolocation).
- **Geolocation (geo):** Best-effort city/country/lat/lon resolved from a public IP; absent
  for local/private networks.
- **Source of truth template:** `supabase/templates/otp.html`, the canonical code-only email
  body the production templates must mirror.

## Requirements

### Requirement 1: Production sign-in delivers a 6-digit code, not a link

**User Story:** As a user signing in to production USki, I want to receive a 6-digit
verification code by email, so that I can enter it into the app instead of clicking an
unexpected magic link.

#### Acceptance Criteria

1. WHEN a user requests sign-in in production THEN the email they receive SHALL display a
   6-digit numeric code and SHALL NOT contain a sign-in/confirmation link as the primary
   call to action.
2. WHEN the production email is rendered THEN it SHALL use the same code-only content as
   the repo's canonical template (`supabase/templates/otp.html`, rendering `{{ .Token }}`).
3. THE repository SHALL contain documented, reproducible instructions for configuring the
   Supabase Cloud email templates (Magic Link, Confirm signup, and any other template that
   can be triggered by the sign-in flow) so that a maintainer can reapply the configuration.
4. WHEN the code-only template is applied in Supabase Cloud THEN the magic_link, confirmation,
   recovery, and email_change templates SHALL all present the 6-digit code consistently, so
   no sign-in path can fall back to a link.
5. THE 6-digit code entered by the user SHALL continue to verify successfully through the
   existing `POST /api/auth/verify-otp` flow without code changes to that endpoint.

### Requirement 2: Branded, modern transactional emails

**User Story:** As a USki user, I want welcome and security (login-alert) emails to look
like they come from USki, so that the emails feel trustworthy and consistent with the rest
of the product.

#### Acceptance Criteria

1. WHEN a welcome email or a login-alert email is generated THEN it SHALL use a USki-branded
   template consistent with the sign-in code email (`otp.html`): dark background, the USki
   wordmark with the purple `US` accent, rounded card, and the same font stack.
2. THE branded template SHALL be implemented with email-client-safe HTML (table-based
   layout, inline styles) so it renders correctly in common clients including Gmail and
   Outlook.
3. WHEN a login-alert email is generated THEN it SHALL clearly present the device, location,
   and time of the sign-in in a readable, styled layout.
4. WHEN a welcome email is generated THEN it SHALL greet the user (by name when available)
   and introduce USki's core actions, styled within the branded shell.
5. THE existing behavior SHALL be preserved: emails are always recorded to the `email_log`
   outbox; Resend delivery happens only in production; the welcome email is sent at most
   once per email address; and email sending never raises into or blocks the login flow.
6. WHERE a logo image is used, the template SHALL degrade gracefully (e.g. text wordmark or
   `alt` text) if the image fails to load.

### Requirement 3: Repository excludes Expo cache and merges cleanly

**User Story:** As a developer, I want to commit and merge the project into `main` from any
machine (including Windows), so that build/cache artifacts never cause "Filename too long"
errors.

#### Acceptance Criteria

1. THE `.gitignore` SHALL exclude `mobile/.expo/` (and equivalent Expo build/cache output
   directories) so generated cache files are never staged.
2. IF any `mobile/.expo/` files are currently tracked by git THEN they SHALL be removed from
   the git index (without deleting the working-tree files unnecessarily) so they no longer
   participate in commits or checkouts.
3. WHEN a developer runs `git status` after the change THEN no files under `mobile/.expo/`
   SHALL appear as tracked or staged.
4. WHEN a developer commits and merges the branch into `main` on Windows THEN the merge
   SHALL NOT fail due to `Filename too long` errors originating from Expo cache paths.
5. THE repository SHALL document any required git configuration (e.g. `core.longpaths=true`)
   needed to handle long paths on Windows, without changing global git config silently.
6. THE change SHALL NOT remove or ignore source files needed to build the mobile app
   (only generated/cache artifacts under `.expo/`).

### Requirement 4: Security tab shows device name and always shows a larger map

**User Story:** As a USki user reviewing my logged-in devices, I want to see a clear device
name and always see a map, so that I can quickly recognize and trust (or revoke) each session.

#### Acceptance Criteria

1. WHEN the "Devices & sessions" list renders a session THEN it SHALL display a device label
   that is as specific as the available data allows (e.g. device model when present in the
   User-Agent, otherwise "Browser on OS", degrading to "Unknown device").
2. WHERE the User-Agent contains a recognizable device model (e.g. iPhone, iPad, a named
   Android device) THEN the device label SHALL include that model rather than only the OS.
3. WHEN a session row is rendered THEN a location map SHALL ALWAYS be shown for that row,
   regardless of whether the sign-in came from a public or a local/private network.
4. WHERE precise geolocation (lat/lon) is unavailable (e.g. local network) THEN the map area
   SHALL still render a sensible default (e.g. a generic/zoomed-out map or a clearly labeled
   placeholder) instead of being omitted, and SHALL NOT show a misleading precise pin.
5. THE map SHALL be visibly larger than the current 160px (`h-40`) height (e.g. at least
   ~224px) while remaining responsive to the panel width.
6. WHEN geolocation is available THEN the map SHALL center on and mark the resolved location;
   WHEN it is not available THEN no precise marker SHALL be shown.
7. THE existing functionality SHALL be preserved: the current device is badged "This device",
   per-device sign-out and "sign out all other devices" continue to work, and a session row
   never blocks rendering if map data is missing.
