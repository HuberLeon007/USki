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

  return (await response.json()) as T;
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
