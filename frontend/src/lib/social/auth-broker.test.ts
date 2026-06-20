import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { ApiError, tokenStorage, type AuthResponse } from "../api";
import { MockSocialAdapter } from "./mock-social-adapter";
import {
  SupabaseOAuthAdapter,
  type SupabaseAuthLike,
} from "./supabase-oauth-adapter";
import { SocialLoginError, type Provider, type SocialLoginOutcome } from "./types";

/**
 * Property test for no session without a successful authorization (social-login).
 *
 * Across cancelled, provider-failed, unconfigured-provider, and
 * mock-unavailable attempts (driven through injected fakes for both adapters),
 * the broker never produces a `{ kind: "session" }` outcome: it either returns
 * `cancelled`/`redirecting` or throws a `SocialLoginError`. A session outcome
 * appears only on the genuinely successful path. In every case the broker never
 * touches token persistence, so `tokenStorage` is left exactly as it was.
 */
// Feature: social-login, Property 9: No session without a successful authorization
describe("Property 9: No session without a successful authorization", () => {
  const ALLOWLIST = ["https://app.uski.example/auth/callback"] as const;
  const FALLBACK = "https://app.uski.example/login";

  type Scenario =
    | "success"
    | "cancelled"
    | "provider_failed"
    | "unconfigured"
    | "mock_unavailable";

  const okResponse: AuthResponse = {
    access_token: "real-access",
    refresh_token: "real-refresh",
    user_id: "real-user",
    email: "user@uski.example",
    needs_username: false,
  };

  function supabaseAdapter(auth: SupabaseAuthLike): SupabaseOAuthAdapter {
    return new SupabaseOAuthAdapter({
      allowlist: ALLOWLIST,
      loginFallback: FALLBACK,
      redirectTarget: ALLOWLIST[0],
      auth,
    });
  }

  async function runScenario(scenario: Scenario, provider: Provider): Promise<SocialLoginOutcome> {
    switch (scenario) {
      case "success": {
        const adapter = new MockSocialAdapter({ fetchImpl: async () => okResponse });
        return adapter.startSocialLogin(provider);
      }
      case "cancelled": {
        const auth: SupabaseAuthLike = {
          signInWithOAuth: async () => ({ data: null, error: null }),
          getSession: async () => ({ data: { session: null }, error: null }),
        };
        // No session after returning from the provider -> cancelled.
        return supabaseAdapter(auth).handleOAuthCallback();
      }
      case "provider_failed": {
        const auth: SupabaseAuthLike = {
          signInWithOAuth: async () => ({ data: null, error: { message: "network exploded" } }),
          getSession: async () => ({ data: { session: null }, error: null }),
        };
        return supabaseAdapter(auth).startSocialLogin(provider);
      }
      case "unconfigured": {
        const auth: SupabaseAuthLike = {
          signInWithOAuth: async () => ({
            data: null,
            error: { message: "Provider is not enabled", code: "provider_disabled" },
          }),
          getSession: async () => ({ data: { session: null }, error: null }),
        };
        return supabaseAdapter(auth).startSocialLogin(provider);
      }
      case "mock_unavailable": {
        const adapter = new MockSocialAdapter({
          fetchImpl: async () => {
            throw new ApiError(404, "Not Found");
          },
        });
        return adapter.startSocialLogin(provider);
      }
    }
  }

  beforeEach(() => {
    tokenStorage.clear();
  });

  it("installs no session for cancelled, failed, or unconfigured attempts", async () => {
    const scenarioArb = fc.constantFrom<Scenario>(
      "success",
      "cancelled",
      "provider_failed",
      "unconfigured",
      "mock_unavailable",
    );
    const providerArb = fc.constantFrom<Provider>("google", "github", "discord");

    await fc.assert(
      fc.asyncProperty(scenarioArb, providerArb, async (scenario, provider) => {
        // Seed a known token state and assert the broker never disturbs it.
        tokenStorage.set("baseline-access", "baseline-refresh");
        const before = [tokenStorage.getAccess(), tokenStorage.getRefresh()];

        let outcome: SocialLoginOutcome | undefined;
        let thrown: unknown = null;
        try {
          outcome = await runScenario(scenario, provider);
        } catch (err) {
          thrown = err;
        }

        if (scenario === "success") {
          expect(thrown).toBeNull();
          expect(outcome?.kind).toBe("session");
        } else if (thrown !== null) {
          // Failures surface only as the normalized seam error.
          expect(thrown).toBeInstanceOf(SocialLoginError);
        } else {
          // A non-throwing non-success outcome is never a session.
          expect(outcome?.kind).not.toBe("session");
          expect(outcome?.kind === "cancelled" || outcome?.kind === "redirecting").toBe(true);
        }

        // The broker never installs a session: token storage is untouched.
        expect([tokenStorage.getAccess(), tokenStorage.getRefresh()]).toEqual(before);
      }),
      { numRuns: 150 },
    );
  });
});
