import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";

import { supabase, supabaseConfigured } from "./supabase";

// Required so the in-app browser auth session can be completed on return.
WebBrowser.maybeCompleteAuthSession();

export type Provider = "google" | "github" | "discord";

export type SocialResult =
  | { ok: true; access_token: string; refresh_token: string }
  | { ok: false; cancelled?: boolean; error?: string };

export { supabaseConfigured };

/**
 * Run the Supabase OAuth handshake for `provider` via the system browser and
 * return the resulting session tokens (same shape the OTP path produces). The
 * caller installs them with auth.signIn(). Mirrors the web SupabaseOAuthAdapter.
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL/ANON_KEY (prod) and the provider enabled in
 * Supabase Auth, with the app redirect (uski://auth-callback) on the Supabase
 * redirect allow-list.
 */
export async function signInWithProvider(provider: Provider): Promise<SocialResult> {
  if (!supabaseConfigured) {
    return { ok: false, error: "Social sign-in isn't configured for this server." };
  }

  // Auto-selects the right redirect: exp:// in Expo Go, uski:// in a standalone
  // build. Add BOTH resulting URIs to the Supabase Auth redirect allow-list.
  const redirectTo = makeRedirectUri({ path: "auth-callback" });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { ok: false, error: error?.message ?? "Could not start sign-in." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") {
    return { ok: false, cancelled: true };
  }
  if (result.type !== "success") {
    return { ok: false, error: "Sign-in didn't complete." };
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode) return { ok: false, error: errorCode };

  // PKCE: exchange the returned code for a session.
  if (params.code) {
    const { data: s, error: e2 } = await supabase.auth.exchangeCodeForSession(params.code);
    if (e2 || !s.session) {
      return { ok: false, error: e2?.message ?? "Could not finish sign-in." };
    }
    return { ok: true, access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  }

  // Implicit fallback (tokens straight in the redirect).
  if (params.access_token && params.refresh_token) {
    return { ok: true, access_token: params.access_token, refresh_token: params.refresh_token };
  }

  return { ok: false, error: "No session was returned." };
}
