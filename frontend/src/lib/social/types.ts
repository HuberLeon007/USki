/**
 * Canonical types and the `AuthBroker` seam (social-login).
 *
 * This module defines the small, deep interface the rest of the app talks to
 * for social login. A caller activates a provider and receives a
 * {@link SocialLoginOutcome}; the entire OAuth dance, the offline mock mint, the
 * redirect-safety check, and the mapping of provider session objects are hidden
 * behind {@link AuthBroker.startSocialLogin}.
 *
 * The session a broker produces is the {@link CanonicalSession} -- shape
 * identical to the OTP `AuthResponse` -- which is precisely why a social or mock
 * session is indistinguishable from an OTP session everywhere downstream
 * (tokenStorage, apiFetch, auth-context). See Requirements 2.3 and 8.4.
 */

import type { AuthResponse } from "../api";

/** The three supported OAuth providers, in canonical lowercase form. */
export type Provider = "google" | "github" | "discord";

/**
 * The canonical authenticated-session payload, shape-identical to the OTP
 * `AuthResponse`. Both adapters and both backend paths (OTP verify and mock
 * mint) produce exactly this shape, so nothing downstream can tell a social
 * session apart from an OTP session (Requirement 2.3, 5.3, 8.4).
 */
export interface CanonicalSession {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string | null;
  needs_username: boolean;
  two_factor_required?: boolean;
  challenge?: string | null;
}

/**
 * The result of starting a social login.
 *
 * - `redirecting` -- the browser is navigating to the provider; no session yet.
 * - `session` -- a session is ready to install via `auth-context.setSession`.
 * - `cancelled` -- the user dismissed or closed the flow; no session, no error.
 */
export type SocialLoginOutcome =
  | { kind: "redirecting" }
  | { kind: "session"; session: CanonicalSession }
  | { kind: "cancelled" };

/**
 * The provider-agnostic error kinds the seam normalizes failures into, so
 * `LoginPage` can render English states without learning provider or transport
 * details (Requirement 11.3, 12.5).
 *
 * - `unconfigured_provider` -- the provider is not enabled in Supabase Auth.
 * - `provider_failed` -- the provider flow failed (network or provider error).
 * - `redirect_rejected` -- the computed redirect target was off the allowlist.
 * - `mock_unavailable` -- the dev-only mock path was requested but is not
 *   available (e.g. the backend dev endpoint is absent or refused).
 */
export type SocialLoginErrorKind =
  | "unconfigured_provider"
  | "provider_failed"
  | "redirect_rejected"
  | "mock_unavailable";

/**
 * The single error type thrown across the `AuthBroker` seam. Its {@link kind}
 * is provider-agnostic so callers render one of a small, fixed set of English
 * error states. User cancellation is never an error -- it is reported as the
 * `cancelled` outcome instead.
 */
export class SocialLoginError extends Error {
  readonly kind: SocialLoginErrorKind;

  constructor(kind: SocialLoginErrorKind, message?: string) {
    super(message ?? kind);
    this.name = "SocialLoginError";
    this.kind = kind;
    // Restore the prototype chain for instanceof across transpile targets.
    Object.setPrototypeOf(this, SocialLoginError.prototype);
  }
}

/**
 * The social-login seam. One method gives a caller the entire login capability:
 * start a login for a provider and get back an outcome. The interface knows
 * nothing about Supabase, mock mode, or HTTP.
 *
 * Invariants implementations MUST uphold:
 * - never return a `session` whose redirect target failed the allowlist;
 * - never throw for user cancellation (return `{ kind: "cancelled" }`);
 * - the produced session is a {@link CanonicalSession} (OTP-identical shape).
 */
export interface AuthBroker {
  /**
   * Begin a social login for `provider`.
   *
   * @returns `redirecting` when the browser is navigating to the provider,
   *   `session` when a session is ready to install, or `cancelled` when the
   *   user abandoned the flow.
   * @throws {SocialLoginError} for an unconfigured provider, a provider failure,
   *   a rejected redirect, or an unavailable mock path.
   */
  startSocialLogin(provider: Provider): Promise<SocialLoginOutcome>;
}

/**
 * Shape of any object carrying the canonical session fields. Both an
 * `AuthResponse` from the backend and a Supabase session mapped to these fields
 * satisfy it. Extra fields are permitted on the input and dropped by
 * {@link toCanonicalSession}.
 */
export type CanonicalSessionLike = {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string | null;
  needs_username: boolean;
  two_factor_required?: boolean;
  challenge?: string | null;
};

/**
 * Project any canonical-session-shaped input down to exactly the canonical
 * fields, dropping anything else. This is the shared mapper every adapter and
 * callback path uses so the installed value is byte-for-byte the same regardless
 * of origin (OTP, real social, or mock) -- the basis of canonical-session
 * indistinguishability (Requirement 2.3, 5.3, 8.4). The two optional TOTP-gating
 * fields (`two_factor_required`, `challenge`) are part of the OTP-identical
 * `AuthResponse` shape and so are carried through here as well.
 */
export function toCanonicalSession(input: CanonicalSessionLike): CanonicalSession {
  return {
    access_token: input.access_token,
    refresh_token: input.refresh_token,
    user_id: input.user_id,
    email: input.email,
    needs_username: input.needs_username,
    two_factor_required: input.two_factor_required,
    challenge: input.challenge,
  };
}

/**
 * Compile-time guarantee that {@link CanonicalSession} stays shape-identical to
 * the OTP `AuthResponse`. If either type drifts, this assignment fails to
 * typecheck.
 */
type _AssertCanonicalMatchesAuthResponse = [
  AuthResponse extends CanonicalSession ? true : never,
  CanonicalSession extends AuthResponse ? true : never,
];
// Reference the assertion so it is not flagged as unused.
export type __CanonicalSessionContract = _AssertCanonicalMatchesAuthResponse;
