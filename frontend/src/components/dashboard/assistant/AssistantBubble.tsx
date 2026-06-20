import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendChatStream, type ChatApiMessage } from "@/lib/api";
import { useAuth } from "@/app/auth-context";
import { AssistantWindow, type AssistantConversation, type AssistantMessage, type ChatSummary } from "./AssistantWindow";

/** Window states. `docked` = right side panel. (Fullscreen/maximize removed.) */
export type AssistantState = "closed" | "small" | "docked";

/** Assistant persona name shown in the header and greeting. */
export const ASSISTANT_NAME = "Sero";

interface AssistantBubbleProps {
  className?: string;
  dueContext?: string;
  /** When set, chat is grounded in this deck's cards (RAG). */
  deckId?: string | null;
  /** Reports px width reserved on the right while docked (0 otherwise). */
  onReservedWidthChange?: (px: number) => void;
}

const MIN_DOCK_WIDTH = 360;
const MAX_HISTORY = 5;

interface StoredChat extends ChatSummary {
  messages: AssistantMessage[];
}

/** The live (in-progress) conversation, persisted so it survives navigation/reload. */
interface StoredCurrent {
  id: string;
  messages: AssistantMessage[];
  draft: string;
}

function historyKey(uid: string) { return `uski.sero.history.${uid}`; }
function greetedKey(uid: string) { return `uski.sero.greeted.${uid}`; }
function currentKey(uid: string) { return `uski.sero.current.${uid}`; }

function loadCurrent(uid: string): StoredCurrent | null {
  try {
    const raw = localStorage.getItem(currentKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return {
      id: typeof parsed.id === "string" ? parsed.id : Math.random().toString(36).slice(2),
      messages: parsed.messages,
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
    };
  } catch {
    return null;
  }
}

function loadHistory(uid: string): StoredChat[] {
  try {
    const raw = localStorage.getItem(historyKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function titleFor(messages: AssistantMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content !== "(greeting)");
  const basis = firstUser?.content ?? messages.find((m) => m.role === "assistant")?.content ?? "New chat";
  const clean = basis.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? clean.slice(0, 42) + "…" : clean || "New chat";
}

export function AssistantBubble({ className, dueContext, deckId, onReservedWidthChange }: AssistantBubbleProps) {
  const { user } = useAuth();
  const uid = user?.id ?? "anon";
  const [state, setState] = useState<AssistantState>("closed");
  const [dockWidth, setDockWidth] = useState(440);

  const [conversation, setConversation] = useState<AssistantConversation>({ messages: [], draft: "" });
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<StoredChat[]>([]);
  const greetedRef = useRef(false);
  const currentIdRef = useRef<string>(Math.random().toString(36).slice(2));
  // True once we've attempted to restore the persisted live conversation for `uid`.
  const hydratedRef = useRef(false);
  // Always-current conversation, used to flush synchronously on close/unmount.
  const convRef = useRef(conversation);
  convRef.current = conversation;

  const persistCurrent = useCallback(() => {
    if (uid === "anon") return;
    try {
      localStorage.setItem(
        currentKey(uid),
        JSON.stringify({ id: currentIdRef.current, messages: convRef.current.messages, draft: convRef.current.draft }),
      );
    } catch { /* ignore storage errors */ }
  }, [uid]);

  // Load persisted recent chats once the user is known.
  useEffect(() => { setHistory(loadHistory(uid)); }, [uid]);

  // Restore the live conversation (messages + draft) across mounts and reloads.
  // A restored non-empty chat is marked greeted so the greeting effect stays quiet.
  useEffect(() => {
    hydratedRef.current = false;
    const stored = loadCurrent(uid);
    if (stored && stored.messages.length > 0) {
      currentIdRef.current = stored.id;
      greetedRef.current = true;
      setConversation({ messages: stored.messages, draft: stored.draft });
    } else if (stored && stored.draft) {
      setConversation((prev) => ({ ...prev, draft: stored.draft }));
    }
    hydratedRef.current = true;
  }, [uid]);

  // Persist the live conversation on every change (debounced). The debounce also
  // discards the stale empty write that would otherwise clobber a restore on mount.
  useEffect(() => {
    if (!hydratedRef.current || uid === "anon") return;
    const t = setTimeout(persistCurrent, 250);
    return () => clearTimeout(t);
  }, [conversation, uid, persistCurrent]);

  // Flush synchronously on unmount (e.g. navigating to another route) so the last
  // change within the debounce window is never lost.
  useEffect(() => () => { persistCurrent(); }, [persistCurrent]);

  // Reserve space only while docked.
  useEffect(() => {
    onReservedWidthChange?.(state === "docked" ? dockWidth : 0);
  }, [state, dockWidth, onReservedWidthChange]);

  // First-time only: pop Sero open on its own so it greets the new user once.
  useEffect(() => {
    if (!user?.id) return;
    try {
      if (!localStorage.getItem(greetedKey(uid))) {
        localStorage.setItem(greetedKey(uid), "1");
        setState((s) => (s === "closed" ? "small" : s));
      }
    } catch { /* ignore storage errors */ }
  }, [user?.id, uid]);

  const persistHistory = useCallback((next: StoredChat[]) => {
    const capped = next.slice(0, MAX_HISTORY);
    setHistory(capped);
    try { localStorage.setItem(historyKey(uid), JSON.stringify(capped)); } catch { /* ignore */ }
  }, [uid]);

  const id = () => Math.random().toString(36).slice(2);

  // Archive the live conversation into history (upsert by current id, cap 5).
  const archiveCurrent = useCallback((msgs: AssistantMessage[]) => {
    const real = msgs.filter((m) => m.content !== "(greeting)");
    if (real.length === 0) return;
    const entry: StoredChat = { id: currentIdRef.current, title: titleFor(msgs), ts: Date.now(), messages: msgs };
    setHistory((prev) => {
      const without = prev.filter((c) => c.id !== entry.id);
      const next = [entry, ...without].slice(0, MAX_HISTORY);
      try { localStorage.setItem(historyKey(uid), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [uid]);

  const open = () => setState("small");
  const close = () => { archiveCurrent(conversation.messages); persistCurrent(); setState("closed"); };
  const toggleDock = () => setState((p) => (p === "docked" ? "small" : "docked"));

  const setDraft = (draft: string) => setConversation((prev) => ({ ...prev, draft }));

  const newChat = () => {
    archiveCurrent(conversation.messages);
    currentIdRef.current = id();
    greetedRef.current = false;
    setConversation({ messages: [], draft: "" });
  };

  const loadChat = (chatId: string) => {
    archiveCurrent(conversation.messages);
    const chat = history.find((c) => c.id === chatId);
    if (!chat) return;
    currentIdRef.current = chat.id;
    greetedRef.current = true;
    setConversation({ messages: chat.messages, draft: "" });
  };

  // Persona greeting: generated when a fresh chat is opened, tailored to the
  // user's due cards via `dueContext`. Varies every time.
  useEffect(() => {
    if (state === "closed" || greetedRef.current || conversation.messages.length) return;
    greetedRef.current = true;
    const ctx = dueContext?.trim()
      ? `The user's current study status: ${dueContext}.`
      : "The user has no cards due right now.";
    const name = user?.username ? user.username : "there";
    const vibes = ["witty", "motivating", "laid-back cool", "enthusiastic", "warm and playful", "warm"];
    const vibe = vibes[Math.floor(Math.random() * vibes.length)];
    const sys: ChatApiMessage = {
      role: "system",
      content:
        `You are ${ASSISTANT_NAME}, the personal study assistant for USki. ` +
        `The user is called "${name}". ${ctx} ` +
        `Greet ${name} personally by name, in a ${vibe} tone. ` +
        "Add a short fun or encouraging line and make ONE concrete suggestion of how you can help today. " +
        "Vary the greeting completely every time. Max 2 sentences, English, plain text, no bold.",
    };
    const fallback = `Hi${user?.username ? " " + user.username : ""}, I'm ${ASSISTANT_NAME}. How can I help you study today?`;
    const gid = id();
    setConversation((c) => ({ ...c, messages: [{ id: gid, role: "assistant", content: "" }] }));
    setSending(true);
    setStatus(null);
    let acc = "";
    void sendChatStream([sys, { role: "user", content: "(greeting)" }], null, {
      onStatus: setStatus,
      onDelta: (d) => { acc += d; setConversation((c) => ({ ...c, messages: c.messages.map((m) => (m.id === gid ? { ...m, content: acc } : m)) })); },
      onDone: () => { setSending(false); setStatus(null); if (!acc) setConversation((c) => ({ ...c, messages: c.messages.map((m) => (m.id === gid ? { ...m, content: fallback } : m)) })); },
      onError: () => { setSending(false); setStatus(null); setConversation((c) => ({ ...c, messages: c.messages.map((m) => (m.id === gid ? { ...m, content: fallback } : m)) })); },
    });
  }, [state, conversation.messages.length, dueContext, user]);

  const send = async () => {
    const text = conversation.draft.trim();
    if (!text || sending) return;
    const base = [...conversation.messages, { id: id(), role: "user" as const, content: text }];
    const aid = id();
    setConversation({ messages: [...base, { id: aid, role: "assistant", content: "" }], draft: "" });
    setSending(true);
    setStatus(null);
    let acc = "";
    const fail = "Sero is unavailable right now. Please try again in a moment.";
    await sendChatStream(base.map((m) => ({ role: m.role, content: m.content })), deckId ?? null, {
      onStatus: setStatus,
      onDelta: (d) => { acc += d; setConversation((c) => ({ ...c, messages: c.messages.map((m) => (m.id === aid ? { ...m, content: acc } : m)) })); },
      onDone: () => { setSending(false); setStatus(null); if (!acc) setConversation((c) => ({ ...c, messages: c.messages.map((m) => (m.id === aid ? { ...m, content: fail } : m)) })); },
      onError: () => { setSending(false); setStatus(null); setConversation((c) => ({ ...c, messages: c.messages.map((m) => (m.id === aid ? { ...m, content: fail } : m)) })); },
    });
  };

  return (
    <>
      <AnimatePresence>
        {state !== "closed" && (
          <AssistantWindow
            key="assistant-window"
            state={state}
            dockWidth={dockWidth}
            minDockWidth={MIN_DOCK_WIDTH}
            onDockWidthChange={setDockWidth}
            conversation={conversation}
            onDraftChange={setDraft}
            onToggleDock={toggleDock}
            onClose={close}
            onSend={send}
            sending={sending}
            status={status}
            onNewChat={newChat}
            history={history.map(({ id, title, ts }) => ({ id, title, ts }))}
            onLoadChat={loadChat}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state === "closed" && (
          <motion.button
            key="assistant-bubble"
            type="button"
            onClick={open}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            aria-label={`Open ${ASSISTANT_NAME}`}
            className={cn(
              "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full",
              "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground",
              "shadow-lg shadow-primary/30 transition-shadow hover:shadow-xl hover:shadow-primary/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              className,
            )}
          >
            <Sparkles className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
