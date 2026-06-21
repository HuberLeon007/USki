import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Base URL of the USki backend. On a phone you cannot reach the PC via
 * "localhost" - it must be the PC's LAN IP. Set EXPO_PUBLIC_API_URL in
 * mobile/.env (e.g. http://192.168.1.192:8000). The backend serves under /api.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const API_BASE = `${API_URL.replace(/\/$/, "")}/api`;

const ACCESS_KEY = "uski_access_token";
const REFRESH_KEY = "uski_refresh_token";

/**
 * Token persistence. On native, SecureStore keeps the JWTs in the device
 * keychain / keystore. SecureStore is unavailable on web, so there we fall back
 * to localStorage (used by the web export only). All reads/writes go through here.
 */
const isWeb = Platform.OS === "web";

export const tokenStorage = {
  getAccess: async (): Promise<string | null> =>
    isWeb ? globalThis.localStorage?.getItem(ACCESS_KEY) ?? null : SecureStore.getItemAsync(ACCESS_KEY),
  getRefresh: async (): Promise<string | null> =>
    isWeb ? globalThis.localStorage?.getItem(REFRESH_KEY) ?? null : SecureStore.getItemAsync(REFRESH_KEY),
  set: async (access: string, refresh: string) => {
    if (isWeb) {
      globalThis.localStorage?.setItem(ACCESS_KEY, access);
      globalThis.localStorage?.setItem(REFRESH_KEY, refresh);
      return;
    }
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  clear: async () => {
    if (isWeb) {
      globalThis.localStorage?.removeItem(ACCESS_KEY);
      globalThis.localStorage?.removeItem(REFRESH_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class SessionExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string | null;
  needs_username: boolean;
}

export interface UserResponse {
  id: string;
  email: string | null;
  username?: string | null;
  discriminator?: string | null;
  has_username?: boolean;
  two_factor_email?: boolean;
}

export interface MessageResponse {
  message: string;
}

export interface Deck {
  id: string;
  owner_id: string;
  group_id: string | null;
  title: string;
  description: string;
  card_template: string;
  icon?: string | null;
  color?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReviewStats {
  new: number;
  learning: number;
  due: number;
  done: number;
  total: number;
}

export interface DeckGroup {
  id: string;
  owner_id: string;
  parent_group_id: string | null;
  name: string;
  position: number;
}

export type Permission = "read" | "edit" | "share";

export interface DeckAccess {
  permission: Permission;
  is_owner: boolean;
  owner: string | null;
  granted_by: string | null;
}

export interface OutgoingShare {
  deck_id: string;
  deck_title: string;
  grantee_id: string;
  grantee: string | null;
  permission: Permission;
}

export type CardType = "basic" | "reverse";

export interface Card {
  id: string;
  deck_id: string;
  front_json: Record<string, unknown>;
  front_html: string;
  back_json: Record<string, unknown>;
  back_html: string;
  position: number;
  card_type: CardType;
  note_id: string | null;
  group_label: string | null;
  group_color: string | null;
}

export interface BrowseCard extends Card {
  deck_title: string;
}

export interface Notification {
  id: string;
  deck_id: string | null;
  kind: string;
  message: string;
  seen: boolean;
}

export interface TwoFactorResponse {
  enabled: boolean;
}

interface FetchOpts {
  requireAuth?: boolean;
  _retried?: boolean;
}

async function rawFetch<T>(path: string, options: RequestInit, token: string | null): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { detail?: string }).detail || `Request failed (${res.status})`);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

const REFRESH_TIMEOUT_MS = 5000;

async function refreshTokens(refresh: string): Promise<AuthResponse> {
  return Promise.race([
    rawFetch<AuthResponse>("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token: refresh }) }, null),
    new Promise<AuthResponse>((_, reject) =>
      setTimeout(() => reject(new SessionExpiredError("Refresh timed out")), REFRESH_TIMEOUT_MS),
    ),
  ]);
}

/**
 * Core request helper. For authenticated calls it attaches the access token and,
 * on a single 401, transparently refreshes and retries once before surfacing a
 * SessionExpiredError so the UI can route back to login.
 */
async function apiFetch<T>(path: string, options: RequestInit = {}, opts: FetchOpts = {}): Promise<T> {
  if (!opts.requireAuth) return rawFetch<T>(path, options, null);

  const access = await tokenStorage.getAccess();
  if (!access) throw new SessionExpiredError("No access token");

  try {
    return await rawFetch<T>(path, options, access);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !opts._retried) {
      const refresh = await tokenStorage.getRefresh();
      if (!refresh) throw new SessionExpiredError();
      let next: AuthResponse;
      try {
        next = await refreshTokens(refresh);
      } catch {
        await tokenStorage.clear();
        throw new SessionExpiredError();
      }
      await tokenStorage.set(next.access_token, next.refresh_token);
      return apiFetch<T>(path, options, { ...opts, _retried: true });
    }
    throw err;
  }
}

const authed: FetchOpts = { requireAuth: true };

// ── Auth ────────────────────────────────────────────────────────────────
export const sendOtp = (email: string) =>
  apiFetch<MessageResponse>("/auth/send-otp", { method: "POST", body: JSON.stringify({ email }) });

export const verifyOtp = (email: string, token: string) =>
  apiFetch<AuthResponse>("/auth/verify-otp", { method: "POST", body: JSON.stringify({ email, token }) });

export const getMe = () => apiFetch<UserResponse>("/auth/me", {}, authed);

export const setUsername = (username: string) =>
  apiFetch<UserResponse>("/auth/set-username", { method: "POST", body: JSON.stringify({ username }) }, authed);

// ── Decks ───────────────────────────────────────────────────────────────
export const listDecks = () => apiFetch<Deck[]>("/decks", {}, authed);
export const listSharedDecks = () => apiFetch<Deck[]>("/decks/shared", {}, authed);
export const getDeck = (id: string) => apiFetch<Deck>(`/decks/${id}`, {}, authed);
export const getDeckAccess = (id: string) => apiFetch<DeckAccess>(`/decks/${id}/access`, {}, authed);

export const reviewStats = (deckId: string) =>
  apiFetch<ReviewStats>(`/decks/${deckId}/review/stats`, {}, authed);

// ── Groups (folders) ──────────────────────────────────────────────────────
export const listGroups = () => apiFetch<DeckGroup[]>("/groups", {}, authed);

// ── Cards / browse ────────────────────────────────────────────────────────
export const listCards = (deckId: string) => apiFetch<Card[]>(`/decks/${deckId}/cards`, {}, authed);
export const browseCards = () => apiFetch<BrowseCard[]>("/browse/cards", {}, authed);

// ── Sharing ───────────────────────────────────────────────────────────────
export const outgoingShares = () => apiFetch<OutgoingShare[]>("/shares/outgoing", {}, authed);
export const leaveSharedDeck = (deckId: string) =>
  apiFetch<void>(`/shares/incoming/${deckId}`, { method: "DELETE" }, authed);

// ── Notifications ─────────────────────────────────────────────────────────
export const listNotifications = () => apiFetch<Notification[]>("/notifications", {}, authed);
export const markNotificationsSeen = (ids: string[]) =>
  apiFetch<void>("/notifications/seen", { method: "POST", body: JSON.stringify({ ids }) }, authed);

// ── Two-factor (email OTP) ────────────────────────────────────────────────
export const getTwoFactor = () => apiFetch<TwoFactorResponse>("/auth/2fa", {}, authed);
export const setTwoFactor = (enabled: boolean) =>
  apiFetch<TwoFactorResponse>("/auth/2fa", { method: "PATCH", body: JSON.stringify({ enabled }) }, authed);

export { API_URL };
