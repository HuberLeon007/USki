/**
 * Broker construction and environment wiring (social-login).
 *
 * This module reads the frontend environment, picks the adapter through the
 * pure {@link selectAdapter} guard, and constructs the matching {@link AuthBroker}.
 * It is the one place that knows how `APP_MODE` is sourced on the client and how
 * the redirect allowlist is derived from the current origin. Dev always gets the
 * offline mock adapter, prod always gets real Supabase OAuth.
 *
 * Production guard (Requirement 7.2): the mock adapter is loaded through a
 * dynamic `import()` gated behind the build-time literal
 * `import.meta.env.VITE_APP_MODE`. When the build mode is `prod`, the condition
 * folds to `false`, the branch becomes dead code, and the bundler drops the mock
 * module entirely so no mock code path ever ships to production.
 */

import { selectAdapter, type AppMode } from "./select-adapter";
import { SupabaseOAuthAdapter } from "./supabase-oauth-adapter";
import type { AuthBroker } from "./types";

/** Read `APP_MODE` from the frontend env, defaulting to `"dev"`. */
export function getAppMode(): AppMode {
  const raw = import.meta.env.VITE_APP_MODE;
  return raw === "prod" || raw === "test" ? raw : "dev";
}

/** The current browser origin, or an empty string in a non-browser context. */
function currentOrigin(): string {
  return typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
}

/**
 * The pre-approved redirect allowlist: the OAuth callback plus the in-app
 * destinations a post-login redirect may target, all on the app's own origin
 * (Requirement 10.1).
 */
export function getRedirectAllowlist(): readonly string[] {
  const origin = currentOrigin();
  return [`${origin}/auth/callback`, `${origin}/login`, `${origin}/dashboard`];
}

/** The trusted LoginPage fallback used whenever a candidate redirect is rejected. */
export function getLoginFallback(): string {
  return `${currentOrigin()}/login`;
}

/**
 * Construct the real Supabase adapter with the app's allowlist and fallback.
 * Returned as the concrete type so the OAuth callback page can call
 * {@link SupabaseOAuthAdapter.handleOAuthCallback}.
 */
export function createSupabaseBroker(): SupabaseOAuthAdapter {
  return new SupabaseOAuthAdapter({
    allowlist: getRedirectAllowlist(),
    loginFallback: getLoginFallback(),
  });
}

/**
 * Select and construct the {@link AuthBroker} for the current environment. The
 * mock adapter is reachable only in a dev build; in a prod build the dynamic
 * import below is eliminated entirely (Requirement 7.2).
 */
export async function createSocialBroker(): Promise<AuthBroker> {
  const kind = selectAdapter(getAppMode());
  if (import.meta.env.VITE_APP_MODE !== "prod" && kind === "mock") {
    const { MockSocialAdapter } = await import("./mock-social-adapter");
    return new MockSocialAdapter();
  }
  return createSupabaseBroker();
}

/**
 * Map a {@link SocialLoginError} (or any thrown value) into a single English,
 * provider-agnostic message for the LoginPage to render (Requirement 11.3).
 */
export function socialErrorMessage(err: unknown): string {
  // Imported lazily-by-shape to avoid a hard dependency cycle; SocialLoginError
  // carries a `kind` discriminant we can switch on.
  const kind =
    err && typeof err === "object" && "kind" in err
      ? (err as { kind: unknown }).kind
      : undefined;
  switch (kind) {
    case "unconfigured_provider":
      return "That sign-in option isn't available right now. Please use your email or try another provider.";
    case "redirect_rejected":
      return "We couldn't complete a safe sign-in redirect. Please try again.";
    case "mock_unavailable":
      return "Offline mock sign-in isn't available. Please use your email to continue.";
    case "provider_failed":
      return "Sign-in didn't complete. Please try again or use your email.";
    default:
      return "Something went wrong. Please try again.";
  }
}
