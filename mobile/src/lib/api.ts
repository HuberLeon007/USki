import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Base URL of the USki backend. On a phone you cannot reach the PC via
 * "localhost" - it must be the PC's LAN IP. The default is baked at build time
 * from EXPO_PUBLIC_API_URL, but the user can override it in-app (Settings /
 * login) so a built APK keeps working when the PC's LAN IP changes - no rebuild.
 */
const DEFAULT_SERVER = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const SERVER_KEY = "uski_server_url";

// Cached, synchronously-readable current server URL. Hydrated once at startup
// via initServerUrl() from persistent storage; defaults to the build-time value.
let serverUrl = DEFAULT_SERVER;

const normalizeUrl = (u: string) => u.trim().replace(/\/+$/, "");

/** Current backend base URL (no trailing slash, no /api suffix). */
export function getServerUrl(): string {
  return serverUrl;
}

const apiBase = () => `${serverUrl}/api`;

const ACCESS_KEY = "uski_access_token";
const REFRESH_KEY = "uski_refresh_token";
const isWeb = Platform.OS === "web";

async function readStored(key: string): Promise<string | null> {
  return isWeb ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key);
}
async function writeStored(key: string, value: string): Promise<void> {
  if (isWeb) globalThis.localStorage?.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

/** Load any saved server-URL override into the cache. Call once at app start. */
export async function initServerUrl(): Promise<void> {
  try {
    const saved = await readStored(SERVER_KEY);
    if (saved) serverUrl = normalizeUrl(saved);
  } catch {
    /* keep default */
  }
}

/** Persist and apply a new backend URL (e.g. "http://192.168.1.42:8000"). */
export async function setServerUrl(url: string): Promise<void> {
  serverUrl = normalizeUrl(url) || DEFAULT_SERVER;
  try {
    await writeStored(SERVER_KEY, serverUrl);
  } catch {
    /* in-memory update still applies for this session */
  }
}

/** Quick reachability probe against GET /api/health. */
export async function pingServer(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${normalizeUrl(url)}/api/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

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
  two_factor_required?: boolean;
  challenge?: string | null;
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

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface IntervalPreview {
  again: string;
  hard: string;
  good: string;
  easy: string;
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

  const res = await fetch(`${apiBase()}${path}`, { ...options, headers });

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

export const changeUsername = (username: string, discriminator?: string) =>
  apiFetch<UserResponse>(
    "/auth/username",
    { method: "PATCH", body: JSON.stringify({ username, discriminator }) },
    authed,
  );

// ── Decks ───────────────────────────────────────────────────────────────
export const listDecks = () => apiFetch<Deck[]>("/decks", {}, authed);
export const listSharedDecks = () => apiFetch<Deck[]>("/decks/shared", {}, authed);
export const getDeck = (id: string) => apiFetch<Deck>(`/decks/${id}`, {}, authed);
export const getDeckAccess = (id: string) => apiFetch<DeckAccess>(`/decks/${id}/access`, {}, authed);
export const createDeck = (data: { title: string; description?: string; group_id?: string | null }) =>
  apiFetch<Deck>("/decks", { method: "POST", body: JSON.stringify(data) }, authed);
export const updateDeck = (id: string, patch: { title?: string; description?: string; group_id?: string | null }) =>
  apiFetch<Deck>(`/decks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }, authed);
export const deleteDeck = (id: string) => apiFetch<void>(`/decks/${id}`, { method: "DELETE" }, authed);

export const reviewStats = (deckId: string) =>
  apiFetch<ReviewStats>(`/decks/${deckId}/review/stats`, {}, authed);

// ── Review / study (SRS) ──────────────────────────────────────────────────
export const dueCards = (deckId: string) =>
  apiFetch<Card[]>(`/decks/${deckId}/review/due`, {}, authed);

export const customStudy = (deckId: string, mode: "all" | "ahead", days = 0) =>
  apiFetch<Card[]>(`/decks/${deckId}/review/custom?mode=${mode}&days=${days}`, {}, authed);

export const cardIntervals = (deckId: string, cardId: string) =>
  apiFetch<IntervalPreview>(`/decks/${deckId}/review/${cardId}/intervals`, {}, authed);

export const rateCard = (deckId: string, cardId: string, rating: ReviewRating) =>
  apiFetch<{ card_id: string; due: string; state: number }>(
    `/decks/${deckId}/review/${cardId}`,
    { method: "POST", body: JSON.stringify({ rating }) },
    authed,
  );

// ── Groups (folders) ──────────────────────────────────────────────────────
export const listGroups = () => apiFetch<DeckGroup[]>("/groups", {}, authed);
export const createGroup = (name: string) =>
  apiFetch<DeckGroup>("/groups", { method: "POST", body: JSON.stringify({ name }) }, authed);
export const deleteGroup = (id: string) => apiFetch<void>(`/groups/${id}`, { method: "DELETE" }, authed);

// ── Cards / browse ────────────────────────────────────────────────────────
export const listCards = (deckId: string) => apiFetch<Card[]>(`/decks/${deckId}/cards`, {}, authed);
export const browseCards = () => apiFetch<BrowseCard[]>("/browse/cards", {}, authed);
export const createCard = (deckId: string, data: { front_html: string; back_html: string }) =>
  apiFetch<Card>(`/decks/${deckId}/cards`, { method: "POST", body: JSON.stringify(data) }, authed);
export const updateCard = (deckId: string, cardId: string, patch: { front_html?: string; back_html?: string }) =>
  apiFetch<Card>(`/decks/${deckId}/cards/${cardId}`, { method: "PATCH", body: JSON.stringify(patch) }, authed);
export const deleteCard = (deckId: string, cardId: string) =>
  apiFetch<void>(`/decks/${deckId}/cards/${cardId}`, { method: "DELETE" }, authed);

// ── Live presence + edit locks (collaborative decks) ─────────────────────
const DEVICE_KEY = "uski_device_id";
let cachedDeviceId: string | null = null;

function makeUuid(): string {
  // RFC4122-ish v4; good enough as a stable device identifier.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable per-install device id (persisted in SecureStore) for presence/locks. */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const saved = await readStored(DEVICE_KEY);
    if (saved) { cachedDeviceId = saved; return saved; }
  } catch { /* fall through to generate */ }
  const id = makeUuid();
  cachedDeviceId = id;
  try { await writeStored(DEVICE_KEY, id); } catch { /* in-memory still works */ }
  return id;
}

export interface DeckPresence {
  others: string[];
  locked_cards: Record<string, string>;
  owner_id: string;
}

/** Heartbeat presence + optionally hold the edit lock on `cardId`. Throws
 *  ApiError(409) when another device holds that card's lock. */
export const deckPresence = (deckId: string, deviceId: string, cardId: string | null) =>
  apiFetch<DeckPresence>(
    `/decks/${deckId}/presence`,
    { method: "POST", body: JSON.stringify({ device_id: deviceId, card_id: cardId }) },
    authed,
  );

/** Drop this device's presence/lock in a deck. */
export const deckPresenceLeave = (deckId: string, deviceId: string) =>
  apiFetch<void>(
    `/decks/${deckId}/presence/leave`,
    { method: "POST", body: JSON.stringify({ device_id: deviceId }) },
    authed,
  );

// ── Sharing ───────────────────────────────────────────────────────────────
export interface Share {
  deck_id: string;
  grantee_id: string;
  permission: Permission;
}
export const outgoingShares = () => apiFetch<OutgoingShare[]>("/shares/outgoing", {}, authed);
export const leaveSharedDeck = (deckId: string) =>
  apiFetch<void>(`/shares/incoming/${deckId}`, { method: "DELETE" }, authed);
export const importDeck = (id: string) =>
  apiFetch<Deck>(`/decks/${id}/import`, { method: "POST" }, authed);
export const listShares = (deckId: string) => apiFetch<Share[]>(`/decks/${deckId}/shares`, {}, authed);
export const grantShare = (deckId: string, data: { username: string; discriminator: string; permission: Permission }) =>
  apiFetch<Share>(`/decks/${deckId}/shares`, { method: "POST", body: JSON.stringify(data) }, authed);
export const revokeShare = (deckId: string, granteeId: string) =>
  apiFetch<void>(`/decks/${deckId}/shares/${granteeId}`, { method: "DELETE" }, authed);
export const createInvite = (deckId: string, permission: Permission) =>
  apiFetch<{ code: string; deck_id: string; permission: Permission }>(
    `/decks/${deckId}/invites`,
    { method: "POST", body: JSON.stringify({ permission }) },
    authed,
  );
export const redeemInvite = (code: string) =>
  apiFetch<Share>("/shares/redeem", { method: "POST", body: JSON.stringify({ code }) }, authed);

// ── Notifications ─────────────────────────────────────────────────────────
export const listNotifications = () => apiFetch<Notification[]>("/notifications", {}, authed);
export const markNotificationsSeen = (ids: string[]) =>
  apiFetch<void>("/notifications/seen", { method: "POST", body: JSON.stringify({ ids }) }, authed);

// ── Two-factor (email OTP) ────────────────────────────────────────────────
export const getTwoFactor = () => apiFetch<TwoFactorResponse>("/auth/2fa", {}, authed);
export const setTwoFactor = (enabled: boolean) =>
  apiFetch<TwoFactorResponse>("/auth/2fa", { method: "PATCH", body: JSON.stringify({ enabled }) }, authed);

// ── App-based TOTP second factor (authenticator apps) ─────────────────────
export interface TotpStatus { enabled: boolean; pending?: boolean }
export interface TotpSetup { secret: string; otpauth_uri: string }

export const getTotpStatus = () => apiFetch<TotpStatus>("/auth/2fa/totp", {}, authed);
export const setupTotp = () => apiFetch<TotpSetup>("/auth/2fa/totp/setup", { method: "POST" }, authed);
export const verifyTotp = (code: string) =>
  apiFetch<TotpStatus>("/auth/2fa/totp/verify", { method: "POST", body: JSON.stringify({ code }) }, authed);
export const disableTotp = (code: string) =>
  apiFetch<TotpStatus>("/auth/2fa/totp/disable", { method: "POST", body: JSON.stringify({ code }) }, authed);

/** Finish a TOTP-gated login: exchange a parked challenge + code for tokens. */
export const verifyTwoFactorChallenge = (challenge: string, code: string) =>
  apiFetch<AuthResponse>("/auth/2fa/challenge/verify", { method: "POST", body: JSON.stringify({ challenge, code }) });

// ── Passkeys / WebAuthn ───────────────────────────────────────────────────
export interface PasskeyInfo {
  id: string;
  name: string | null;
  created_at?: string | null;
  last_used_at?: string | null;
}

/** Registration options (PublicKeyCredentialCreationOptionsJSON) for the OS. */
export const passkeyRegisterOptions = () =>
  apiFetch<Record<string, unknown>>("/auth/passkeys/register/options", { method: "POST" }, authed);

/** Persist a freshly created passkey. `credential` is the OS attestation JSON. */
export const passkeyRegisterVerify = (credential: unknown, name?: string) =>
  apiFetch<PasskeyInfo>(
    "/auth/passkeys/register/verify",
    { method: "POST", body: JSON.stringify({ credential, name }) },
    authed,
  );

export const listPasskeys = () => apiFetch<PasskeyInfo[]>("/auth/passkeys", {}, authed);
export const deletePasskey = (id: string) =>
  apiFetch<MessageResponse>(`/auth/passkeys/${id}`, { method: "DELETE" }, authed);

/** Discoverable-login options + a handle echoed back on verify (pre-auth). */
export const passkeyLoginOptions = () =>
  apiFetch<{ options: Record<string, unknown>; handle: string }>("/auth/passkeys/login/options", { method: "POST" });

/** Finish passkey login: assertion JSON + handle -> session tokens (pre-auth). */
export const passkeyLoginVerify = (handle: string, credential: unknown) =>
  apiFetch<AuthResponse>(
    "/auth/passkeys/login/verify",
    { method: "POST", body: JSON.stringify({ handle, credential }) },
  );

// ── Devices & sessions ────────────────────────────────────────────────────
export interface SessionInfo {
  id: string;
  device: string | null;
  ip: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  created_at: string | null;
  last_seen_at: string | null;
  current: boolean;
}
export const listSessions = (currentKey = "") =>
  apiFetch<SessionInfo[]>(`/auth/sessions?current_key=${encodeURIComponent(currentKey)}`, {}, authed);
export const revokeSessionById = (id: string) =>
  apiFetch<MessageResponse>(`/auth/sessions/${id}`, { method: "DELETE" }, authed);

/** Record this device/session after an OAuth login that bypassed the backend
 *  (OTP and passkey logins are already recorded server-side). Best-effort. */
export const recordSession = (refreshToken: string) =>
  apiFetch<MessageResponse>(
    "/auth/session/record",
    { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) },
    authed,
  );

// ── Chat (Sero) ───────────────────────────────────────────────────────────
export interface ChatApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatStreamHandlers {
  onStatus?: (text: string) => void;
  onDelta?: (text: string) => void;
  onDone?: () => void;
  onError?: (message?: string) => void;
}

/**
 * Stream a Sero reply over SSE so tokens render live. Uses expo/fetch, which
 * (unlike React Native's global fetch) exposes a readable response body on
 * native. Frames are `data: {json}\n\n` with type status | delta | done | error.
 */
export async function sendChatStream(
  messages: ChatApiMessage[],
  deckId: string | null,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const { fetch: streamFetch } = await import("expo/fetch");
  const token = await tokenStorage.getAccess();
  if (!token) {
    handlers.onError?.("Session expired");
    return;
  }
  let res: Awaited<ReturnType<typeof streamFetch>>;
  try {
    res = await streamFetch(`${apiBase()}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, deck_id: deckId ?? null }),
    });
  } catch {
    handlers.onError?.();
    return;
  }
  if (!res.ok || !res.body) {
    handlers.onError?.();
    return;
  }

  let buf = "";
  let finished = false;
  const finish = () => {
    if (!finished) {
      finished = true;
      handlers.onDone?.();
    }
  };
  try {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const evt = JSON.parse(payload) as { type: string; text?: string };
          if (evt.type === "status") handlers.onStatus?.(evt.text ?? "");
          else if (evt.type === "delta") handlers.onDelta?.(evt.text ?? "");
          else if (evt.type === "done") finish();
          else if (evt.type === "error") {
            handlers.onError?.(evt.text);
            finished = true;
            return;
          }
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  } catch {
    handlers.onError?.();
    return;
  }
  finish();
}
