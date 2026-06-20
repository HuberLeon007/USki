/**
 * SupabaseOAuthAdapter (social-login).
 *
 * The real {@link AuthBroker} adapter, used in production and dev-online. It
 * brokers OAuth strictly through Supabase Auth -- no other auth provider is
 * introduced (Requirement 2.1, 2.2, 8.5). Starting a login computes an
 * allowlisted redirect target and hands control to the provider via
 * `supabase.auth.signInWithOAuth`; because that triggers a full-page browser
 * navigation, the expected outcome of starting the flow is
 * `{ kind: "redirecting" }`.
 *
 * After the provider returns the user to the callback URL, Supabase exchanges
 * the code and establishes a session. {@link SupabaseOAuthAdapter.handleOAuthCallback}
 * reads that session and maps it into the canonical OTP-identical shape, or
 * reports cancellation / throws a normalized {@link SocialLoginError}
 * (Requirement 2.3, 11.4, 12.5).
 *
 * All redirect computation and validation, cancellation-versus-failure
 * detection, unconfigured-provider detection, and session mapping are hidden
 * inside this module; the seam exposes none of it.
 */

import { supabase } from "../supabase";
import { resolveRedirect } from "./redirect-allowlist";
import {
  type AuthBroker,
  type CanonicalSession,
  type Provider,
  type SocialLoginOutcome,
  SocialLoginError,
  toCanonicalSession,
} from "./types";

/** The minimal shape of a Supabase auth error this adapter inspects. */
interface SupabaseAuthErrorLike {
  message?: string;
  status?: number;
  code?: string;
}

/** The minimal shape of a Supabase session this adapter maps from. */
interface SupabaseSessionLike {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
}

/** The minimal Supabase auth surface this adapter depends on (testable seam). */
export interface SupabaseAuthLike {
  signInWithOAuth(args: {
    provider: Provider;
    options?: { redirectTo?: string };
  }): Promise<{ data: unknown; error: SupabaseAuthErrorLike | null }>;
  getSession(): Promise<{
    data: { session: SupabaseSessionLike | null };
    error: SupabaseAuthErrorLike | null;
  }>;
}

/** Configuration for the adapter; everything has a safe default. */
export interface SupabaseOAuthAdapterConfig {
  /** Allowlist of approved USki redirect destinations (Requirement 10.1). */
  allowlist: readonly string[];
  /** Trusted LoginPage fallback used when a candidate target is off-allowlist. */
  loginFallback: string;
  /**
   * The candidate post-OAuth redirect target. Defaults to the current origin's
   * `/auth/callback`. It is always run through {@link resolveRedirect} before
   * use, so an off-allowlist value can never reach the provider.
   */
  redirectTarget?: string | null;
  /** Injectable auth surface; defaults to the shared `supabase.auth` client. */
  auth?: SupabaseAuthLike;
}

/**
 * Decide whether a Supabase auth error means the provider is not configured in
 * Supabase Auth (Requirement 12.5) versus a generic provider failure.
 */
function isUnconfiguredProvider(error: SupabaseAuthErrorLike): boolean {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "provider_disabled") {
    return true;
  }
  return (
    message.includes("not enabled") ||
    message.includes("provider is not enabled") ||
    message.includes("provider is disabled") ||
    message.includes("unsupported provider")
  );
}

/** Map a Supabase auth error into the normalized seam error. */
function toSocialLoginError(error: SupabaseAuthErrorLike): SocialLoginError {
  if (isUnconfiguredProvider(error)) {
    return new SocialLoginError(
      "unconfigured_provider",
      error.message ?? "Provider is not configured",
    );
  }
  return new SocialLoginError("provider_failed", error.message ?? "Provider sign-in failed");
}

/** Derive the default callback target from the current browser origin. */
function defaultRedirectTarget(): string | null {
  if (typeof window === "undefined" || !window.location?.origin) {
    return null;
  }
  return `${window.location.origin}/auth/callback`;
}

/**
 * Map a Supabase session into the canonical OTP-identical shape.
 *
 * `needs_username` is a USki-level concept that the raw Supabase session does
 * not carry; it is read from `user_metadata.needs_username` when present and
 * defaults to `false`. The post-callback wiring (a later wave) confirms it
 * against the backend; this adapter only provides the structural mapping.
 */
function sessionToCanonical(session: SupabaseSessionLike): CanonicalSession {
  const meta = session.user.user_metadata ?? {};
  const needsUsername = meta["needs_username"] === true;
  return toCanonicalSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: session.user.id,
    email: session.user.email ?? null,
    needs_username: needsUsername,
  });
}

/**
 * The real Supabase OAuth adapter satisfying {@link AuthBroker}.
 */
export class SupabaseOAuthAdapter implements AuthBroker {
  private readonly allowlist: readonly string[];
  private readonly loginFallback: string;
  private readonly redirectTarget: string | null;
  private readonly auth: SupabaseAuthLike;

  constructor(config: SupabaseOAuthAdapterConfig) {
    this.allowlist = config.allowlist;
    this.loginFallback = config.loginFallback;
    this.redirectTarget =
      config.redirectTarget !== undefined ? config.redirectTarget : defaultRedirectTarget();
    this.auth = config.auth ?? supabase.auth;
  }

  /**
   * Start the Supabase OAuth flow for `provider`. Computes an allowlisted
   * `redirectTo`, then asks Supabase to begin the OAuth handshake. On success
   * the browser navigates to the provider, so the outcome is `redirecting`.
   *
   * @throws {SocialLoginError} `unconfigured_provider` when the provider is not
   *   enabled in Supabase Auth, otherwise `provider_failed`.
   */
  async startSocialLogin(provider: Provider): Promise<SocialLoginOutcome> {
    // resolveRedirect guarantees a safe destination: an off-allowlist candidate
    // collapses to the trusted LoginPage fallback, so no open redirect is ever
    // sent to the provider (Requirement 10.1, 10.2).
    const redirectTo = resolveRedirect(this.redirectTarget, this.allowlist, this.loginFallback);

    const { error } = await this.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (error) {
      throw toSocialLoginError(error);
    }

    return { kind: "redirecting" };
  }

  /**
   * Handle the post-redirect callback: read the session Supabase established
   * after exchanging the provider code, and map it to a {@link CanonicalSession}.
   *
   * @returns `{ kind: "session", session }` when a session is present, or
   *   `{ kind: "cancelled" }` when the user dismissed the provider authorization
   *   and no session exists (Requirement 11.4).
   * @throws {SocialLoginError} `unconfigured_provider` or `provider_failed` when
   *   Supabase reports an error establishing the session (Requirement 12.5).
   */
  async handleOAuthCallback(): Promise<SocialLoginOutcome> {
    const { data, error } = await this.auth.getSession();

    if (error) {
      throw toSocialLoginError(error);
    }

    const session = data.session;
    if (!session) {
      // No session after returning from the provider means the user cancelled
      // or closed the authorization; this is not an error.
      return { kind: "cancelled" };
    }

    return { kind: "session", session: sessionToCanonical(session) };
  }
}
