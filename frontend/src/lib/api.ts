import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export async function sendOtp(email: string) {
  return apiFetch<{ message: string }>("/api/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(email: string, token: string) {
  return apiFetch<{
    access_token: string;
    refresh_token: string;
    user_id: string;
    email: string | null;
  }>("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, token }),
  });
}

export async function getMe() {
  return apiFetch<{ id: string; email: string | null }>("/api/auth/me");
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResponseData {
  message: ChatMessage;
  model: string;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  deckId?: string
): Promise<ChatResponseData> {
  return apiFetch<ChatResponseData>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages, deck_id: deckId }),
  });
}
