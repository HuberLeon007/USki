const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("uski_access_token");

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
  return apiFetch<UserResponse>("/auth/me");
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
  return apiFetch<UserResponse>("/auth/set-username", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function checkUsername(
  username: string,
): Promise<UsernameCheckResponse> {
  return apiFetch<UsernameCheckResponse>(
    `/auth/check-username?username=${encodeURIComponent(username)}`,
  );
}

export function deriveUsernameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  let cleaned = localPart.replace(/\./g, "");
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
