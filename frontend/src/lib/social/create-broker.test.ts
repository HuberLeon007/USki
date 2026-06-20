import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ApiError, tokenStorage } from "../api";
import { createSocialBroker } from "./create-broker";
import { MockSocialAdapter } from "./mock-social-adapter";
import { SupabaseOAuthAdapter } from "./supabase-oauth-adapter";
import { SocialLoginError } from "./types";

/**
 * Unit tests for the production guard and post-failure availability
 * (social-login 8.4).
 *
 * The prod exclusion of the mock module is handled by the build-time
 * dynamic-import gate in create-broker (a bundler tree-shake concern, not
 * assertable here). What we assert is the runtime selection contract that gate
 * relies on: createSocialBroker yields the MockSocialAdapter under dev and the
 * SupabaseOAuthAdapter otherwise. We also confirm that a SocialLoginError path
 * leaves no session installed (token storage untouched).
 */
describe("createSocialBroker environment selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("selects the mock adapter under dev", async () => {
    vi.stubEnv("VITE_APP_MODE", "dev");
    const broker = await createSocialBroker();
    expect(broker).toBeInstanceOf(MockSocialAdapter);
  });

  it("selects the supabase adapter under prod", async () => {
    vi.stubEnv("VITE_APP_MODE", "prod");
    const broker = await createSocialBroker();
    expect(broker).toBeInstanceOf(SupabaseOAuthAdapter);
  });

  it("selects the supabase adapter under test", async () => {
    vi.stubEnv("VITE_APP_MODE", "test");
    const broker = await createSocialBroker();
    expect(broker).toBeInstanceOf(SupabaseOAuthAdapter);
  });
});

describe("post-failure session safety", () => {
  beforeEach(() => {
    tokenStorage.clear();
  });

  it("leaves no session installed when a SocialLoginError is raised", async () => {
    tokenStorage.set("existing-access", "existing-refresh");
    const before = [tokenStorage.getAccess(), tokenStorage.getRefresh()];

    const adapter = new MockSocialAdapter({
      fetchImpl: async () => {
        // 403 from the dev endpoint means the mock path is unavailable here.
        throw new ApiError(403, "Forbidden");
      },
    });

    await expect(adapter.startSocialLogin("google")).rejects.toBeInstanceOf(SocialLoginError);

    // The pre-existing token state is untouched; no new session was installed.
    expect([tokenStorage.getAccess(), tokenStorage.getRefresh()]).toEqual(before);
  });
});
