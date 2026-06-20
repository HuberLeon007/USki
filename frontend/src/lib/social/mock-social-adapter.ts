/**
 * MockSocialAdapter (social-login, dev-only).
 *
 * The offline {@link AuthBroker} adapter, reachable only when `selectAdapter`
 * returns `"mock"` (dev + mock flag) and excluded from production builds. It
 * makes ZERO calls to any external Provider (Google, GitHub, Discord): the only
 * service it contacts is the local USki backend's dev-only endpoint
 * `POST /api/auth/dev/mock-social`, which mints a genuine local Supabase session
 * for the per-provider Mock_Identity and returns the canonical `AuthResponse`
 * (Requirement 5.1, 5.2, 5.3).
 *
 * The returned payload is mapped through the shared {@link toCanonicalSession}
 * so the installed session is byte-for-byte identical to an OTP session.
 */

import { apiFetch, ApiError, type AuthResponse } from "../api";
import {
  type AuthBroker,
  type Provider,
  type SocialLoginOutcome,
  SocialLoginError,
  toCanonicalSession,
} from "./types";

/** Path (relative to the shared `/api` base) of the dev-only mock endpoint. */
const MOCK_SOCIAL_PATH = "/auth/dev/mock-social";

/** The minimal HTTP surface this adapter depends on (testable seam). */
export type MockFetch = (
  path: string,
  options: RequestInit,
) => Promise<AuthResponse>;

/** Configuration for the adapter; the fetch surface is injectable for tests. */
export interface MockSocialAdapterConfig {
  /**
   * The HTTP call used to reach the local backend. Defaults to the shared
   * {@link apiFetch}, so the mock adapter reuses the exact same HTTP layer and
   * `/api` base URL as the rest of the app (no second HTTP layer is introduced).
   */
  fetchImpl?: MockFetch;
}

/** Default transport: the shared apiFetch, posting JSON to the local backend. */
const defaultFetch: MockFetch = (path, options) =>
  apiFetch<AuthResponse>(path, options);

/**
 * The dev-only mock adapter satisfying {@link AuthBroker}.
 */
export class MockSocialAdapter implements AuthBroker {
  private readonly fetchImpl: MockFetch;

  constructor(config: MockSocialAdapterConfig = {}) {
    this.fetchImpl = config.fetchImpl ?? defaultFetch;
  }

  /**
   * Mint a local development session for `provider` by posting `{ provider }` to
   * the backend dev endpoint. No external Provider is contacted. The returned
   * `AuthResponse` is mapped to the canonical session shape and installed.
   *
   * @returns `{ kind: "session", session }` with the OTP-identical session.
   * @throws {SocialLoginError} `mock_unavailable` when the dev endpoint is
   *   absent or refuses (e.g. not running under dev + mock), otherwise
   *   `provider_failed` for an unexpected backend failure.
   */
  async startSocialLogin(provider: Provider): Promise<SocialLoginOutcome> {
    let response: AuthResponse;
    try {
      response = await this.fetchImpl(MOCK_SOCIAL_PATH, {
        method: "POST",
        body: JSON.stringify({ provider }),
      });
    } catch (err) {
      // A 404 (route not registered) or 403 (guard refused) means the mock path
      // is not available in this environment (Requirement 7.5).
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        throw new SocialLoginError("mock_unavailable", err.message);
      }
      const message = err instanceof Error ? err.message : "Mock sign-in failed";
      throw new SocialLoginError("provider_failed", message);
    }

    return { kind: "session", session: toCanonicalSession(response) };
  }
}
