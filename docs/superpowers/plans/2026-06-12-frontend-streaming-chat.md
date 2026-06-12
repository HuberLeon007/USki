# Frontend Streaming Chat Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sync chat in `ChatPanel.tsx` with real-time SSE streaming — the AI response appears token-by-token like ChatGPT.

**Architecture:** `streamChatMessage()` in `api.ts` wraps `fetch` with `ReadableStream` + SSE parsing. `ChatPanel.tsx` appends tokens to a growing assistant message bubble in real-time.

**Tech Stack:** React 19, TypeScript, Fetch API (ReadableStream), SSE (text/event-stream)

**Depends on:** `plans/2026-06-12-backend-chat-streaming.md` (backend must serve `/api/chat/stream` first)

---

## File Structure Map

MODIFY:
- `frontend/src/lib/api.ts`
- `frontend/src/components/chat/ChatPanel.tsx`

---

## Task 9: Frontend streaming ChatPanel

### Step 1: Add `streamChatMessage` to `api.ts`

**File:** `frontend/src/lib/api.ts`

Add `ApiError` class and `streamChatMessage()`:

```typescript
import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ... existing apiFetch, sendOtp, verifyOtp, getMe remain ...

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function streamChatMessage(
  messages: ChatMessage[],
  deckId: string | undefined,
  onToken: (token: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
): Promise<void> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, deck_id: deckId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.detail || `API error: ${response.status}`,
        response.status,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            onComplete();
            return;
          }
          onToken(data);
        }
      }
    }
    onComplete();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
```

### Step 2: Update `ChatPanel.tsx` to use streaming

**File:** `frontend/src/components/chat/ChatPanel.tsx`

Replace `handleSend` with streaming version:

```tsx
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChatMessage } from "./ChatMessage";
import { streamChatMessage, type ChatMessage as ChatMessageType } from "@/lib/api";

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: ChatMessageType = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    // Add empty assistant message that grows token-by-token
    const assistantIndex = updatedMessages.length;
    setMessages([...updatedMessages, { role: "assistant", content: "" }]);

    streamChatMessage(
      updatedMessages.filter((m) => m.role !== "assistant"),
      undefined,
      (token) => {
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIndex] = {
            ...next[assistantIndex],
            content: next[assistantIndex].content + token,
          };
          return next;
        });
      },
      () => {
        setIsLoading(false);
      },
      (error) => {
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIndex] = {
            role: "assistant",
            content: "Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuche es erneut.",
          };
          return next;
        });
        setIsLoading(false);
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex h-[600px] flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">USki KI-Assistent</h3>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs text-muted-foreground"
            onClick={() => setMessages([])}
          >
            Chat leeren
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Sparkles className="mb-3 size-8 opacity-50" />
            <p className="text-sm font-medium">Willkommen beim USki KI-Assistenten</p>
            <p className="mt-1 text-xs">
              Stelle eine Frage zu deinen Lernkarten oder bitte um Erklaerungen.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role as "user" | "assistant"}
            content={msg.content}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Frage stellen..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

### Step 3: Verify

**Run:** `cd frontend && npx tsc --noEmit`

**Expected:** No type errors.

---

## Summary

| File | Change |
|------|--------|
| `api.ts` | Add `ApiError` class + `streamChatMessage()` with ReadableStream SSE parsing |
| `ChatPanel.tsx` | Replace `handleSend` with streaming — tokens append live to assistant bubble |
