import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client used ONLY for the OAuth handshake (Google/GitHub/Discord),
 * mirroring the web. After OAuth, the resulting Supabase session tokens are the
 * canonical USki session (the backend validates the Supabase JWT directly), so
 * we hand them to the existing tokenStorage/auth flow — we do NOT let supabase-js
 * persist the session itself (persistSession: false). Only the short-lived PKCE
 * verifier is kept in SecureStore between starting and finishing the flow.
 *
 * Configured from EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
 * (prod). When unset (dev), `supabaseConfigured` is false and the social buttons
 * are hidden.
 */
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True only when both Supabase env values are present (prod builds). */
export const supabaseConfigured = Boolean(url && anonKey);

// Small SecureStore adapter for the transient PKCE verifier (well under the
// 2 KB SecureStore value limit). The full session is never stored here.
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "public-anon-key",
  {
    auth: {
      storage: SecureStoreAdapter,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);
