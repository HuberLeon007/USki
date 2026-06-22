const API_BASE = "/api";

/** localStorage keys — single source of truth for token persistence. */
const ACCESS_KEY = "uski_access_token";
const REFRESH_KEY = "uski_refresh_token";

/**
 * Single source of truth for reading/writing/clearing the auth tokens in
 * localStorage. All token persistence across `api.ts` and `auth-context.tsx`
 * goes through this module so the keys are never written ad-hoc (R1.1).
 */
export const tokenStorage = {
  getAccess: (): string | null => localStorage.getItem(ACCESS_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string): void => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: (): void => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Thrown when a protected request cannot be authenticated and the session can
 * no longer be recovered (missing token, or a failed/timed-out refresh).
 * Callers catch this to clear the session and route back to the login step
 * (R1.3, R1.7).
 */
export class SessionExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

/** Options controlling auth handling for a single `apiFetch` call. */
interface ApiFetchOptions {
  /** When true, the call is treated as authenticated: it requires a token and
   *  participates in the one-shot 401 refresh/retry. */
  requireAuth?: boolean;
  /** Internal flag — set on the single retry so a second 401 is not retried. */
  _retried?: boolean;
}

/** Performs the actual HTTP request and error mapping. */
async function rawFetch<T>(
  path: string,
  options: RequestInit,
  token: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as Record<string, string>).detail ||
        `Request failed with status ${response.status}`,
    );
  }

  // 204 No Content (and other empty bodies, e.g. DELETE) have nothing to parse.
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

const REFRESH_TIMEOUT_MS = 5000;

/**
 * Calls the refresh endpoint, racing it against a 5s timeout (R1.7). The
 * refresh call itself is unauthenticated and is never retried.
 */
async function refreshWithTimeout(
  refresh: string,
  timeoutMs: number = REFRESH_TIMEOUT_MS,
): Promise<AuthResponse> {
  return Promise.race([
    rawFetch<AuthResponse>(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify({ refresh_token: refresh }) },
      null,
    ),
    new Promise<AuthResponse>((_resolve, reject) =>
      setTimeout(() => reject(new Error("Refresh timed out")), timeoutMs),
    ),
  ]);
}

/**
 * Fetch wrapper with a token guard and a one-shot `401 → refresh → retry`.
 *
 * - When `requireAuth` is set and no access token is present, the request is
 *   NOT issued; tokens are cleared and `SessionExpiredError` is thrown (R1.3).
 * - On a 401 for a protected call, the refresh endpoint is called (with a 5s
 *   timeout), the refreshed tokens are persisted via `tokenStorage.set` BEFORE
 *   the single retry (R1.6), and the original request is retried exactly once
 *   (R1.5). A second 401 is not retried.
 * - On a failed or timed-out refresh, tokens are cleared and
 *   `SessionExpiredError` is thrown (R1.7).
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  opts: ApiFetchOptions = {},
): Promise<T> {
  const token = tokenStorage.getAccess();

  // R1.3: guard — protected calls without a token must not be issued.
  if (opts.requireAuth && (!token || token === "")) {
    tokenStorage.clear();
    throw new SessionExpiredError("Missing access token");
  }

  try {
    return await rawFetch<T>(path, options, token);
  } catch (err) {
    // R1.5/R1.6/R1.7: a single 401 on a protected call triggers
    // refresh-then-retry-once.
    if (
      opts.requireAuth &&
      err instanceof ApiError &&
      err.status === 401 &&
      !opts._retried
    ) {
      const refresh = tokenStorage.getRefresh();
      if (!refresh) {
        tokenStorage.clear();
        throw new SessionExpiredError();
      }
      let refreshed: AuthResponse;
      try {
        refreshed = await refreshWithTimeout(refresh, REFRESH_TIMEOUT_MS);
      } catch {
        tokenStorage.clear(); // R1.7 clear on failed/timed-out refresh
        throw new SessionExpiredError();
      }
      // R1.6: persist refreshed tokens BEFORE the single retry.
      tokenStorage.set(refreshed.access_token, refreshed.refresh_token);
      return await apiFetch<T>(path, options, { ...opts, _retried: true });
    }
    throw err;
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
  /** Whether the opt-in email-OTP second factor is enabled (R: 2FA). */
  two_factor_email?: boolean;
}

export interface TwoFactorResponse {
  enabled: boolean;
}

export interface UsernameCheckResponse {
  available: boolean;
  username: string;
}

export interface MessageResponse {
  message: string;
}

export async function sendOtp(email: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(
  email: string,
  token: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, token }),
  });
}

export async function getMe(): Promise<UserResponse> {
  return apiFetch<UserResponse>("/auth/me", {}, { requireAuth: true });
}

/** Read the current email-OTP second-factor preference (R: 2FA). */
export async function getTwoFactor(): Promise<TwoFactorResponse> {
  return apiFetch<TwoFactorResponse>("/auth/2fa", {}, { requireAuth: true });
}

/** Enable or disable the email-OTP second factor for the current user (R: 2FA). */
export async function setTwoFactor(enabled: boolean): Promise<TwoFactorResponse> {
  return apiFetch<TwoFactorResponse>(
    "/auth/2fa",
    { method: "PATCH", body: JSON.stringify({ enabled }) },
    { requireAuth: true },
  );
}

// ── App-based TOTP second factor (authenticator apps) ───────────────────
export interface TotpStatus {
  enabled: boolean;
  pending?: boolean;
}

export interface TotpSetup {
  secret: string;
  otpauth_uri: string;
}

/** Current TOTP state (active, and whether a setup is mid-flight). */
export async function getTotpStatus(): Promise<TotpStatus> {
  return apiFetch<TotpStatus>("/auth/2fa/totp", {}, { requireAuth: true });
}

/** Begin enrollment: returns the secret + otpauth URI to render a QR. */
export async function setupTotp(): Promise<TotpSetup> {
  return apiFetch<TotpSetup>("/auth/2fa/totp/setup", { method: "POST" }, { requireAuth: true });
}

/** Confirm enrollment with a 6-digit code from the authenticator app. */
export async function verifyTotp(code: string): Promise<TotpStatus> {
  return apiFetch<TotpStatus>(
    "/auth/2fa/totp/verify",
    { method: "POST", body: JSON.stringify({ code }) },
    { requireAuth: true },
  );
}

/** Turn TOTP off (requires a valid current code). */
export async function disableTotp(code: string): Promise<TotpStatus> {
  return apiFetch<TotpStatus>(
    "/auth/2fa/totp/disable",
    { method: "POST", body: JSON.stringify({ code }) },
    { requireAuth: true },
  );
}

// ── Devices & sessions (Security settings) ──────────────────────────────
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

/** SHA-256 hex of the current refresh token; identifies THIS device server-side
 *  without ever sending the raw token to the sessions endpoints. */
async function currentSessionKey(): Promise<string> {
  const refresh = tokenStorage.getRefresh() ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(refresh));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listSessions(): Promise<SessionInfo[]> {
  const key = await currentSessionKey();
  return apiFetch<SessionInfo[]>(`/auth/sessions?current_key=${key}`, {}, { requireAuth: true });
}

export async function revokeSessionById(id: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>(`/auth/sessions/${id}`, { method: "DELETE" }, { requireAuth: true });
}

export async function revokeOtherSessions(): Promise<MessageResponse> {
  const key = await currentSessionKey();
  return apiFetch<MessageResponse>(
    "/auth/sessions/revoke-others",
    { method: "POST", body: JSON.stringify({ current_key: key }) },
    { requireAuth: true },
  );
}

// ── Passkeys / WebAuthn ─────────────────────────────────────────────────
export interface PasskeyInfo {
  id: string;
  name: string | null;
  created_at: string | null;
  last_used_at: string | null;
}

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  return apiFetch<PasskeyInfo[]>("/auth/passkeys", {}, { requireAuth: true });
}

/** Register a new passkey for the signed-in user via the platform authenticator. */
export async function registerPasskey(name: string): Promise<PasskeyInfo> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const optionsJSON = await apiFetch<Record<string, unknown>>(
    "/auth/passkeys/register/options",
    { method: "POST", body: "{}" },
    { requireAuth: true },
  );
  const credential = await startRegistration({ optionsJSON: optionsJSON as never });
  return apiFetch<PasskeyInfo>(
    "/auth/passkeys/register/verify",
    { method: "POST", body: JSON.stringify({ credential, name }) },
    { requireAuth: true },
  );
}

export async function deletePasskey(id: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>(`/auth/passkeys/${id}`, { method: "DELETE" }, { requireAuth: true });
}

/** Sign in with a discoverable passkey; returns a canonical session. */
export async function loginWithPasskey(): Promise<AuthResponse> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const { options, handle } = await apiFetch<{ options: Record<string, unknown>; handle: string }>(
    "/auth/passkeys/login/options",
    { method: "POST", body: "{}" },
  );
  const credential = await startAuthentication({ optionsJSON: options as never });
  return apiFetch<AuthResponse>(
    "/auth/passkeys/login/verify",
    { method: "POST", body: JSON.stringify({ handle, credential }) },
  );
}

// ── Cross-device sign-in (QR / device link) ─────────────────────────────
export type LinkPoll =
  | { status: "pending" | "expired" | "not_found" }
  | { status: "approved"; session: AuthResponse };

/** Signed-out device: start a link request, returns the code for the QR. */
export async function linkStart(): Promise<{ code: string }> {
  return apiFetch<{ code: string }>("/auth/link/start", { method: "POST", body: "{}" });
}

/** Signed-out device: poll until the request is approved (then claims it once). */
export async function linkPoll(code: string): Promise<LinkPoll> {
  return apiFetch<LinkPoll>(`/auth/link/poll?code=${encodeURIComponent(code)}`);
}

/** Signed-in device: approve a scanned link code, minting a session for it. */
export async function linkApprove(code: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>(
    "/auth/link/approve",
    { method: "POST", body: JSON.stringify({ code }) },
    { requireAuth: true },
  );
}

export async function refreshToken(
  refresh_token: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token }),
  });
}

export async function setUsername(username: string): Promise<UserResponse> {
  return apiFetch<UserResponse>(
    "/auth/set-username",
    {
      method: "POST",
      body: JSON.stringify({ username }),
    },
    { requireAuth: true },
  );
}

export async function changeUsername(username: string): Promise<UserResponse> {
  return apiFetch<UserResponse>(
    "/auth/username",
    {
      method: "PATCH",
      body: JSON.stringify({ username }),
    },
    { requireAuth: true },
  );
}

export async function checkUsername(
  username: string,
): Promise<UsernameCheckResponse> {
  return apiFetch<UsernameCheckResponse>(
    `/auth/check-username?username=${encodeURIComponent(username)}`,
    {},
    { requireAuth: true },
  );
}

export function deriveUsernameFromEmail(email: string): string {
  // Mirror backend derive_username_from_email exactly:
  // 1. Take local part (before @) — empty if no @
  // 2. Strip +alias (e.g. test+tag@example.com -> test)
  // 3. Remove dots, remove non-ASCII-alphanumerics, lowercase, truncate to 20
  // 4. If < 3 valid chars, fall back to 'user' + 4 random digits
  const localPart = email.includes("@") ? email.split("@")[0] : "";
  const withoutAlias = localPart.split("+")[0] ?? "";
  let cleaned = withoutAlias.replace(/\./g, "");
  cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, "");
  cleaned = cleaned.toLowerCase().slice(0, 20);

  if (cleaned.length < 3) {
    const digits = Array.from({ length: 4 }, () =>
      Math.floor(Math.random() * 10),
    ).join("");
    return `user${digits}`;
  }

  return cleaned;
}

// ─────────────────────────────────────────────────────────────
// Decks, groups, cards, review, sharing, notifications
// Single data seam: components call these, never `fetch` directly.
// ─────────────────────────────────────────────────────────────

export interface Deck {
  id: string;
  owner_id: string;
  group_id: string | null;
  title: string;
  description: string;
  card_template: string;
  custom_study_updates?: boolean;
  icon?: string | null;
  color?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeckGroup {
  id: string;
  owner_id: string;
  parent_group_id: string | null;
  name: string;
  position: number;
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

export type ReviewRating = "again" | "hard" | "good" | "easy";
export type Permission = "read" | "edit" | "share";

export interface Share {
  deck_id: string;
  grantee_id: string;
  permission: Permission;
}

export interface Notification {
  id: string;
  deck_id: string | null;
  kind: string;
  message: string;
  seen: boolean;
}

const authed = { requireAuth: true } as const;

// decks
export const listDecks = () => apiFetch<Deck[]>("/decks", {}, authed);
export const listSharedDecks = () => apiFetch<Deck[]>("/decks/shared", {}, authed);
export const getDeck = (id: string) => apiFetch<Deck>(`/decks/${id}`, {}, authed);
export const createDeck = (data: { title: string; description?: string; group_id?: string | null; icon?: string | null; color?: string | null }) =>
  apiFetch<Deck>("/decks", { method: "POST", body: JSON.stringify(data) }, authed);
export const updateDeck = (id: string, patch: Partial<Pick<Deck, "title" | "description" | "group_id" | "icon" | "color">>) =>
  apiFetch<Deck>(`/decks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }, authed);
export const deleteDeck = (id: string) =>
  apiFetch<void>(`/decks/${id}`, { method: "DELETE" }, authed);

export interface DeckAccess {
  permission: Permission;
  is_owner: boolean;
  owner: string | null;
  granted_by: string | null;
}
/** Clone a readable (e.g. shared) deck into the user's own decks. */
export const importDeck = (id: string) =>
  apiFetch<Deck>(`/decks/${id}/import`, { method: "POST" }, authed);
/** What access the current user has on a deck, and from whom. */
export const getDeckAccess = (id: string) =>
  apiFetch<DeckAccess>(`/decks/${id}/access`, {}, authed);

// groups
export const listGroups = () => apiFetch<DeckGroup[]>("/groups", {}, authed);
export const createGroup = (data: { name: string; parent_group_id?: string | null }) =>
  apiFetch<DeckGroup>("/groups", { method: "POST", body: JSON.stringify(data) }, authed);
export const deleteGroup = (id: string) =>
  apiFetch<void>(`/groups/${id}`, { method: "DELETE" }, authed);

// cards
export const listCards = (deckId: string) =>
  apiFetch<Card[]>(`/decks/${deckId}/cards`, {}, authed);
export const createCard = (
  deckId: string,
  data: {
    front_json?: object; front_html: string; back_json?: object; back_html: string;
    card_type?: CardType; make_reverse?: boolean; note_id?: string | null;
    group_label?: string | null; group_color?: string | null; position?: number;
  },
) => apiFetch<Card>(`/decks/${deckId}/cards`, { method: "POST", body: JSON.stringify(data) }, authed);
export const updateCard = (deckId: string, cardId: string, patch: Partial<Card>) =>
  apiFetch<Card>(`/decks/${deckId}/cards/${cardId}`, { method: "PATCH", body: JSON.stringify(patch) }, authed);
export const deleteCard = (deckId: string, cardId: string) =>
  apiFetch<void>(`/decks/${deckId}/cards/${cardId}`, { method: "DELETE" }, authed);
/** Toggle whether a card is studied in both directions (links/removes a reverse sibling). */
export const setBidirectional = (deckId: string, cardId: string, enabled: boolean) =>
  apiFetch<Card>(`/decks/${deckId}/cards/${cardId}/bidirectional`, { method: "POST", body: JSON.stringify({ enabled }) }, authed);
/** Persist new study order (top->bottom) for a deck's cards. */
export const reorderCards = (deckId: string, orderedIds: string[]) =>
  apiFetch<void>(`/decks/${deckId}/cards/reorder`, { method: "PATCH", body: JSON.stringify({ ordered_ids: orderedIds }) }, authed);

// review
export interface ReviewStats { new: number; learning: number; due: number; done: number; total: number; }
export interface IntervalPreview { again: string; hard: string; good: string; easy: string; }
export const dueCards = (deckId: string) =>
  apiFetch<Card[]>(`/decks/${deckId}/review/due`, {}, authed);
export const reviewStats = (deckId: string) =>
  apiFetch<ReviewStats>(`/decks/${deckId}/review/stats`, {}, authed);
/** Reset learning progress for cards (they become 'new' again). */
export const resetProgress = (deckId: string, cardIds: string[]) =>
  apiFetch<void>(`/decks/${deckId}/review/reset`, { method: "POST", body: JSON.stringify({ card_ids: cardIds }) }, authed);
export const cardIntervals = (deckId: string, cardId: string) =>
  apiFetch<IntervalPreview>(`/decks/${deckId}/review/${cardId}/intervals`, {}, authed);
export const customStudy = (deckId: string, mode: "all" | "ahead", days = 0) =>
  apiFetch<Card[]>(`/decks/${deckId}/review/custom?mode=${mode}&days=${days}`, {}, authed);
export const rateCard = (deckId: string, cardId: string, rating: ReviewRating) =>
  apiFetch<{ card_id: string; due: string; state: number }>(
    `/decks/${deckId}/review/${cardId}`,
    { method: "POST", body: JSON.stringify({ rating }) },
    authed,
  );

// sharing
export const listShares = (deckId: string) =>
  apiFetch<Share[]>(`/decks/${deckId}/shares`, {}, authed);
export const grantShare = (
  deckId: string,
  data: { username: string; discriminator: string; permission: Permission },
) => apiFetch<Share>(`/decks/${deckId}/shares`, { method: "POST", body: JSON.stringify(data) }, authed);
export const revokeShare = (deckId: string, granteeId: string) =>
  apiFetch<void>(`/decks/${deckId}/shares/${granteeId}`, { method: "DELETE" }, authed);

/** Grants the current user has made on their own decks (Shared overview). */
export interface OutgoingShare {
  deck_id: string;
  deck_title: string;
  grantee_id: string;
  grantee: string | null;
  permission: Permission;
}
export const outgoingShares = () =>
  apiFetch<OutgoingShare[]>("/shares/outgoing", {}, authed);
/** Current user removes their OWN access to a deck shared with them (one-time, final). */
export const leaveSharedDeck = (deckId: string) =>
  apiFetch<void>(`/shares/incoming/${deckId}`, { method: "DELETE" }, authed);
export const createInvite = (deckId: string, permission: Permission) =>
  apiFetch<{ code: string; deck_id: string; permission: Permission }>(
    `/decks/${deckId}/invites`,
    { method: "POST", body: JSON.stringify({ permission }) },
    authed,
  );
export const redeemInvite = (code: string) =>
  apiFetch<Share>("/shares/redeem", { method: "POST", body: JSON.stringify({ code }) }, authed);

// notifications
export const listNotifications = () =>
  apiFetch<Notification[]>("/notifications", {}, authed);
export const markNotificationsSeen = (ids: string[]) =>
  apiFetch<void>("/notifications/seen", { method: "POST", body: JSON.stringify({ ids }) }, authed);

// settings: change username (optional custom discriminator)
export const changeUsernameFull = (username: string, discriminator?: string) =>
  apiFetch<UserResponse>(
    "/auth/username",
    { method: "PATCH", body: JSON.stringify({ username, discriminator }) },
    authed,
  );

// images
export interface ImageUploadResult { url: string; sha256: string; bytes: number; width: number; height: number; deduped: boolean; }
export interface StorageUsage { used_bytes: number; quota_bytes: number; }
/** Upload an inline card image (multipart). Backend downscales + dedups. */
export async function uploadImage(file: File): Promise<ImageUploadResult> {
  const token = tokenStorage.getAccess();
  if (!token) { tokenStorage.clear(); throw new SessionExpiredError("Missing access token"); }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/images`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as Record<string, string>).detail || `Upload failed (${res.status})`);
  }
  return (await res.json()) as ImageUploadResult;
}
export const storageUsage = () => apiFetch<StorageUsage>("/images/usage", {}, authed);

// browse (all cards across the user's decks)
export interface BrowseCard extends Card { deck_title: string; }
export const browseCards = () => apiFetch<BrowseCard[]>("/browse/cards", {}, authed);

// import a deck from an uploaded file (apkg / csv / txt)
export interface ImportResult { deck_id: string; title: string; imported: number; }
export async function importDeckFile(file: File, title: string, delimiter: string): Promise<ImportResult> {
  const token = tokenStorage.getAccess();
  if (!token) { tokenStorage.clear(); throw new SessionExpiredError("Missing access token"); }
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("delimiter", delimiter);
  const res = await fetch(`${API_BASE}/import/deck`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as Record<string, string>).detail || `Import failed (${res.status})`);
  }
  return (await res.json()) as ImportResult;
}

// chat (RAG when deckId is given)
export interface ChatApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export const sendChat = (messages: ChatApiMessage[], deckId?: string | null) =>
  apiFetch<{ message: ChatApiMessage; model: string }>(
    "/chat",
    { method: "POST", body: JSON.stringify({ messages, deck_id: deckId ?? null }) },
    authed,
  );

export interface ChatStreamHandlers {
  onStatus?: (text: string) => void;
  onDelta?: (text: string) => void;
  onDone?: () => void;
  onError?: (message?: string) => void;
}

/**
 * Stream a chat reply via SSE so the UI can render tokens live and show what
 * the assistant is doing (e.g. "Reading through <deck>"). Falls back to onError
 * when the stream can't be opened.
 */
export async function sendChatStream(
  messages: ChatApiMessage[],
  deckId: string | null | undefined,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const token = tokenStorage.getAccess();
  if (!token) { tokenStorage.clear(); handlers.onError?.("Session expired"); return; }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, deck_id: deckId ?? null }),
    });
  } catch {
    handlers.onError?.();
    return;
  }
  if (!res.ok || !res.body) { handlers.onError?.(); return; }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finished = false;
  const finish = () => { if (!finished) { finished = true; handlers.onDone?.(); } };
  try {
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
          else if (evt.type === "error") { handlers.onError?.(evt.text); finished = true; return; }
        } catch { /* ignore malformed frame */ }
      }
    }
  } catch {
    handlers.onError?.();
    return;
  }
  finish();
}

// dev-only: wipe the whole database (deletes all auth users → cascades). 404 in prod.
export const wipeDatabaseDev = () =>
  apiFetch<{ ok: boolean; deleted_users: number }>("/dev/wipe", { method: "POST" });
