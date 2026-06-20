import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import type { AuthResponse } from "../api";
import { MockSocialAdapter, type MockFetch } from "./mock-social-adapter";
import type { Provider } from "./types";

/**
 * Property test for zero external Provider network calls (social-login).
 *
 * The mock adapter's only network surface is its injectable `fetchImpl`. For any
 * provider, a mock run contacts exactly the local backend dev endpoint
 * ("/auth/dev/mock-social") and nothing else: the injected spy records exactly
 * one local path, no path resembles an external Provider host (Google, GitHub,
 * Discord), and the global `fetch` is never touched.
 */
// Feature: social-login, Property 6: Mock login makes zero external Provider network calls
describe("Property 6: Mock login makes zero external Provider network calls", () => {
  const EXTERNAL_HOST = /google\.com|github\.com|githubusercontent|discord\.com|discordapp/i;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("contacts only the local backend, never an external Provider host", async () => {
    const providerArb = fc.constantFrom<Provider>("google", "github", "discord");

    await fc.assert(
      fc.asyncProperty(providerArb, async (provider) => {
        const calls: string[] = [];
        const spy: MockFetch = async (path) => {
          calls.push(path);
          const response: AuthResponse = {
            access_token: "mock-access",
            refresh_token: "mock-refresh",
            user_id: "mock-user",
            email: null,
            needs_username: false,
          };
          return response;
        };

        // Guard the global fetch too: the adapter must never reach for it.
        const globalFetchSpy = vi.spyOn(globalThis, "fetch");

        const adapter = new MockSocialAdapter({ fetchImpl: spy });
        const outcome = await adapter.startSocialLogin(provider);

        expect(outcome.kind).toBe("session");
        // Exactly one call, to the local dev endpoint.
        expect(calls).toEqual(["/auth/dev/mock-social"]);
        // No call targets an external Provider host.
        for (const path of calls) {
          expect(EXTERNAL_HOST.test(path)).toBe(false);
        }
        // The real network was never engaged.
        expect(globalFetchSpy).not.toHaveBeenCalled();

        globalFetchSpy.mockRestore();
      }),
      { numRuns: 100 },
    );
  });
});
