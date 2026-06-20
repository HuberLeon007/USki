# Implementation Plan: Social Login

## Overview

This plan converts the social-login design into incremental, test-driven, vertical-slice tasks. Each
task implements one behavior and (optionally) tests it before the next behavior is added, rather than
writing all tests up front or all code up front. The order builds bottom-up from the safety-critical
pure functions, then the backend mock minting path, then the frontend `AuthBroker` seam and its two
adapters, and finally the UI and the wiring that routes a social session through the existing
`auth-context` / `tokenStorage` / `apiFetch` / `OnboardingStep` machinery unchanged. Every slice ends
by integrating into the running app, leaving no orphaned code.

The design's deep-module seams are extracted first as pure functions so the most safety-critical
decisions are exhaustively testable with no environment setup: `selectAdapter(APP_MODE)`
and `isAllowedRedirect` / `resolveRedirect` on the frontend, and `mockIdentityToProfile` and
email-keyed account resolution on the backend.

All eight active correctness properties from the design are covered by property-based tests: backend
properties (4, 5, 7) run under pytest + Hypothesis (already dev-installed in the backend
container); frontend properties (1, 2, 6, 8, 9) run under vitest + fast-check, which is now set up in
the repo and whose property tests pass. (Property 3 was withdrawn together with the backend boot guard
in favor of APP_MODE-only gating.) Each property maps to exactly one property-based
test, runs at least 100 iterations, and is tagged `Feature: social-login, Property {n}: {text}`.

Supabase Auth remains the only OAuth broker. The backend JWT validation in `security.py` is reused
unchanged, so a social or mock session is indistinguishable from an OTP session everywhere past the
seam.

## Tasks

- [x] 1. Backend production guard against mock auth
  - [x] 1.1 Gate the mock-social path on APP_MODE alone (no boot assertion)
    - Production protection is driven by `APP_MODE` only: there is no separate `MOCK_AUTH_ENABLED` env flag and no boot-time guard/startup assertion
    - In `backend/src/uski/main.py` (or the router wiring), register the mock-social route only when `APP_MODE == "dev"`; outside dev the route is never registered and any invocation is rejected
    - Read `APP_MODE` from environment configuration; no additional mock flag is consulted
    - _Requirements: 7.1, 7.3, 7.4_

  - [x]* 1.2 Property 3 test - withdrawn
    - Withdrawn: the boot guard and Property 3 (`mock_conflicts_with_prod`) were removed in favor of APP_MODE-only gating, and `backend/tests/test_social_guard.py` was deleted. No test is required here. Adapter-selection safety is covered by Property 2 (task 6.3).
    - _Withdrawn with the env flag and boot guard_

- [x] 2. Backend mock identity model and profile mapping
  - [x] 2.1 Define the `Mock_Identity` seed set and `mock_identity_to_profile`
    - Add a dev-only `Mock_Identity` seed (seed fixture or table) with exactly one row per provider (google, github, discord), each carrying `provider`, `email`, `display_name`, and a non-empty `avatar_placeholder`
    - Ensure the seed includes at least one email that matches an existing dev account (to exercise linking) and at least one that does not (to exercise onboarding)
    - Implement `mock_identity_to_profile(mock_identity)` mapping a mock identity into the same Profile/Session fields a real provider session fills
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 5.4, 5.5_

  - [x]* 2.2 Write property test for mock identity completeness and mapping
    - In `backend/tests/test_mock_identity.py` (pytest + Hypothesis, at least 100 iterations) assert each provider has exactly one identity with all four fields present and non-empty, and that `mock_identity_to_profile` fills the expected fields
    - **Property 7: Mock identity metadata is complete, one per provider** - tag `# Feature: social-login, Property 7: Mock identity metadata is complete, one per provider`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**

- [x] 3. Backend email-keyed account resolution and onboarding
  - [x] 3.1 Implement email-keyed account resolution and identity linking
    - Add a resolution function (e.g. `backend/src/uski/services/auth_identity.py`) that, given an email and a provider identity, resolves to exactly one account: links the provider as an additional `Auth_Identity` when the email matches an existing account (no duplicate profile, idempotent for an already-linked provider), or creates a new account and profile with `needs_username == true` when the email matches none
    - Keep permissions and deck-sharing relationships keyed to `user_id` (account level) so they apply regardless of which identity established the session, and preserve existing profile/settings/permissions/sharing when adding an identity
    - Provide a pure `requires_onboarding(account)` predicate expressing the gating decision (`true` while `needs_username` is set)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.1, 9.2, 9.3, 9.4, 9.5, 4.1, 4.2_

  - [x]* 3.2 Write property test for email-keyed linking
    - In `backend/tests/test_account_resolution.py` (pytest + Hypothesis, at least 100 iterations) over an email and arbitrary sequences of `Auth_Identity` records sharing it (email plus any combination of google/github/discord, including mock-origin): assert all map to one account with one profile, re-adding a linked provider creates no duplicate and leaves profile/settings/permissions/sharing unchanged
    - **Property 4: Email-keyed linking yields exactly one account and is idempotent** - tag `# Feature: social-login, Property 4: Email-keyed linking yields exactly one account and is idempotent`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 5.4, 9.1, 9.2, 9.3, 9.4, 9.5**

  - [x]* 3.3 Write property test for new-user onboarding and gating
    - In `backend/tests/test_account_resolution.py` (pytest + Hypothesis, at least 100 iterations) over identities whose email matches no account: assert a new account and profile are created with `needs_username == true`, and that `requires_onboarding` denies authenticated access until the username step completes
    - **Property 5: New social users are onboarded and gated** - tag `# Feature: social-login, Property 5: New social users are onboarded and gated`
    - **Validates: Requirements 4.1, 4.2, 4.3, 5.5**

- [x] 4. Backend dev-only mock-social endpoint
  - [x] 4.1 Implement `POST /api/auth/dev/mock-social` with local Supabase admin session minting
    - Add the route (e.g. `backend/src/uski/api/auth.py` or a dev module) accepting `{ provider: "google" | "github" | "discord" }`, registered only when `APP_MODE == "dev"`, and rejecting any invocation under `APP_MODE == "prod"`
    - Resolve the per-provider `Mock_Identity`, use the local Supabase admin (service-role) API to ensure the auth user exists and mint a genuine local session via `generate_link` (magiclink) verified server-side, reusing the account resolution from 3.1 and `mock_identity_to_profile` from 2.1
    - Return the existing canonical `AuthResponse` shape (`access_token`, `refresh_token`, `user_id`, `email`, `needs_username`); make no external Provider network call
    - _Requirements: 5.1, 5.2, 5.3, 6.5, 7.4_

  - [x]* 4.2 Write integration tests for the mock endpoint and unchanged JWT validation
    - Against a local Supabase instance: one end-to-end mock mint returns a valid `AuthResponse`, the minted JWT is accepted by the existing `get_current_user`, and a tampered JWT is rejected identically to a tampered OTP JWT (no relaxation)
    - _Requirements: 5.1, 8.5, 10.3_

- [x] 5. Checkpoint - backend tests pass
  - Run the backend test suite (pytest + Hypothesis). Ensure all tests pass, ask the user if questions arise. (Satisfied: social backend tests pass via the host venv; backend pytest runs via the host venv, not in-container.)

- [x] 6. Frontend pure seam functions (adapter selection and redirect safety)
  - [x]* 6.1 Set up vitest + fast-check as the frontend test runner
    - Add `vitest` and `fast-check` as dev dependencies and an `npm test` script in `frontend/package.json` so the frontend property tests in this plan can execute (now set up; the frontend property tests pass)
    - _Requirements: 2.1, 2.2, 10.1, 10.2_

  - [x] 6.2 Implement `selectAdapter`
    - Add `frontend/src/lib/social/select-adapter.ts` exporting `selectAdapter(appMode)` returning `"mock"` only when `appMode === "dev"`, otherwise `"supabase"` (including every `prod` and `test` input)
    - _Requirements: 2.1, 2.2, 7.1, 7.4, 10.5_

  - [x]* 6.3 Write property test for adapter selection
    - In `frontend/src/lib/social/select-adapter.test.ts` (vitest + fast-check, at least 100 iterations) over all `appMode` values assert the iff condition and that `prod` and `test` never select `"mock"`
    - **Property 2: Adapter selection guard** - tag `// Feature: social-login, Property 2: Adapter selection guard`
    - **Validates: Requirements 2.1, 2.2, 7.1, 7.4, 10.5**

  - [x] 6.4 Implement the redirect allowlist guard
    - Add `frontend/src/lib/social/redirect-allowlist.ts` exporting `isAllowedRedirect(target, allowlist)` and `resolveRedirect(target, allowlist, fallback)`; normalize scheme/host/trailing-slash/relative-vs-absolute internally so callers cannot bypass the check; `resolveRedirect` returns an allowlisted target or the `LoginPage` fallback, never an off-allowlist destination
    - _Requirements: 10.1, 10.2_

  - [x]* 6.5 Write property test for redirect safety
    - In `frontend/src/lib/social/redirect-allowlist.test.ts` (vitest + fast-check, at least 100 iterations) over generated targets (relative, absolute, off-host, trailing-slash, scheme-varied) and allowlists assert `isAllowedRedirect` matches only normalized allowlist entries and `resolveRedirect` never yields an open redirect
    - **Property 8: Redirect target is always on the allowlist** - tag `// Feature: social-login, Property 8: Redirect target is always on the allowlist`
    - **Validates: Requirements 10.1, 10.2**

- [x] 7. Frontend AuthBroker seam and adapters
  - [x] 7.1 Define the canonical session types, `AuthBroker` interface, and error type
    - Add `frontend/src/lib/social/types.ts` with `Provider`, `CanonicalSession` (shape-identical to the OTP `AuthResponse`), `SocialLoginOutcome` (`redirecting` | `session` | `cancelled`), the `AuthBroker` interface (`startSocialLogin(provider): Promise<SocialLoginOutcome>`), and `SocialLoginError` with `kind` in `unconfigured_provider | provider_failed | redirect_rejected | mock_unavailable`
    - Add a shared `toCanonicalSession(...)` mapper producing the canonical shape
    - _Requirements: 2.3, 8.4_

  - [x] 7.2 Implement `SupabaseOAuthAdapter`
    - Add `frontend/src/lib/social/supabase-oauth-adapter.ts` satisfying `AuthBroker`: compute a redirect target, validate it via `resolveRedirect`, call `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`, read the post-callback session, distinguish user cancellation (return `cancelled`) from provider failure and unconfigured provider (throw the matching `SocialLoginError`), and map to `CanonicalSession`
    - _Requirements: 2.1, 2.2, 2.3, 11.4, 12.5_

  - [x] 7.3 Implement `MockSocialAdapter`
    - Add `frontend/src/lib/social/mock-social-adapter.ts` satisfying `AuthBroker`: POST `{ provider }` to `POST /api/auth/dev/mock-social`, make zero external Provider calls, and map the returned `AuthResponse` to `CanonicalSession`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x]* 7.4 Write property test for canonical session indistinguishability
    - In `frontend/src/lib/social/canonical-session.test.ts` (vitest + fast-check, at least 100 iterations) over generated `AuthResponse` payloads from OTP, supabase, and mock origins assert the installed value has the canonical shape and that `tokenStorage` returns exactly those tokens, with no field/ordering/type distinguishing origin
    - **Property 1: Canonical session indistinguishability** - tag `// Feature: social-login, Property 1: Canonical session indistinguishability`
    - **Validates: Requirements 2.3, 2.4, 5.3, 6.5, 8.2, 8.4**

  - [x]* 7.5 Write property test for zero external Provider network calls
    - In `frontend/src/lib/social/mock-social-adapter.test.ts` (vitest + fast-check, at least 100 iterations) over any provider, inject a network spy/fake and assert the mock run contacts only the local backend, with zero calls to any external Provider host
    - **Property 6: Mock login makes zero external Provider network calls** - tag `// Feature: social-login, Property 6: Mock login makes zero external Provider network calls`
    - **Validates: Requirements 5.2**

  - [x]* 7.6 Write property test for no session without successful authorization
    - In `frontend/src/lib/social/auth-broker.test.ts` (vitest + fast-check, at least 100 iterations) over cancelled, closed, failed, and unconfigured-provider attempts assert no session is installed into `auth-context` and `tokenStorage` is unchanged; a session installs only after a successful authorization
    - **Property 9: No session without a successful authorization** - tag `// Feature: social-login, Property 9: No session without a successful authorization`
    - **Validates: Requirements 11.4, 12.5**

- [x] 8. Frontend SocialButtons UI and LoginPage integration
  - [x] 8.1 Implement the `SocialButtons` module
    - Add `frontend/src/components/auth/SocialButtons.tsx` rendering three buttons in fixed order Google, GitHub, Discord with English labels ("Continue with Google/GitHub/Discord") and a provider identifier, grouped and visually distinguished from the OTP email step, exposing `onSelect(provider)`, a per-button `loading`/`disabled` state, and an English error string; honor reduced-motion consistent with `OtpStep`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.1, 11.2, 11.3_

  - [x]* 8.2 Write unit tests for `SocialButtons`
    - Cover button presence, fixed order, English labels and grouping, per-button loading state, and per-failure-kind English error rendering
    - _Requirements: 1.2, 1.3, 1.4, 11.1, 11.2, 11.3_

  - [x] 8.3 Wire `AuthBroker` into `LoginPage` and route the session through existing machinery
    - In `frontend/src/pages/LoginPage.tsx`, mount `SocialButtons`, use `selectAdapter` to pick the adapter, and call `AuthBroker.startSocialLogin(provider)`; on a `session` outcome call the unchanged `auth-context.setSession(...)` (which persists via `tokenStorage` and routes to the same post-login destination as OTP), and run `OnboardingStep` first when `needs_username`
    - Handle the OAuth callback path, map cancellation/failure into interactive `LoginPage` states keeping the OTP email step usable, and exclude the mock adapter import from the build when `APP_MODE === "prod"` so no mock code ships
    - _Requirements: 2.4, 2.5, 4.3, 5.3, 7.2, 8.1, 8.2, 8.3, 8.4, 11.4, 11.5_

  - [x]* 8.4 Write tests for the production guard and post-failure availability
    - Assert the prod build path excludes the mock adapter module, and that after a social failure or cancellation the OTP email step remains available and no session is installed
    - _Requirements: 7.2, 8.1, 11.5_

- [x] 9. Provider configuration and secret hygiene
  - [x] 9.1 Add provider configuration entries and a short callback-URL note
    - Add placeholder provider client-id/secret keys to `.env.example` (no real secrets) and confirm `.gitignore` keeps `.env` out of version control
    - Add a short note (in the spec folder or repo docs) stating the callback-URL principle: production destinations point at the deployed USki callback, localhost development destinations point at the local dev origin, and client ids/secrets are sourced from environment configuration or Supabase Auth only, never committed
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 10. Final checkpoint - full verification
  - Run the backend suite (pytest + Hypothesis) and the frontend checks (`cd frontend && npm run typecheck`, and `npm test`). Everything passes: frontend 20 tests pass and typecheck is clean; the backend social tests pass via the host venv (backend pytest runs via the host venv, not in-container).

## Notes

- Tasks marked with `*` are optional (frontend test-runner setup, property tests, unit tests,
  integration tests) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Backend properties (4, 5, 7) run under pytest + Hypothesis, already dev-installed in the backend
  container. Frontend properties (1, 2, 6, 8, 9) run under vitest + fast-check; task 6.1 set up that
  runner and the frontend property tests now pass. (Property 3 was withdrawn with the boot guard.)
- Each correctness property is implemented by exactly one property-based test, runs at least 100
  iterations, and is tagged `Feature: social-login, Property {n}: {text}`.
- The existing `auth-context`, `tokenStorage`, `apiFetch`, `OnboardingStep`, and backend `security.py`
  JWT validation are reused unchanged, so a social or mock session is indistinguishable from an OTP
  session past the seam.
- Verification commands: backend `pytest` via the host venv (not in-container); frontend `cd frontend && npm run
  typecheck` and `npm test` (vitest + fast-check are set up).
- Each task references the specific requirement clauses it satisfies for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "6.1", "6.2", "6.4"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.1", "6.3", "6.5", "7.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "4.1", "7.2", "7.3"] },
    { "id": 3, "tasks": ["4.2", "7.4", "7.5", "7.6", "8.1"] },
    { "id": 4, "tasks": ["8.2", "8.3", "9.1"] },
    { "id": 5, "tasks": ["8.4"] }
  ]
}
```
