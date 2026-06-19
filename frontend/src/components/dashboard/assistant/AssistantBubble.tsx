import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendChat } from "@/lib/api";
import { AssistantWindow, type AssistantConversation } from "./AssistantWindow";

/** The three states of the AI assistant surface (R17). */
export type AssistantState = "closed" | "small" | "maximized";

interface AssistantBubbleProps {
  /** Optional extra classes for the bubble button. */
  className?: string;
}

/**
 * Self-contained AI assistant entry point.
 *
 * Owns the `closed | small | maximized` state machine and the conversation/draft
 * state, so it can simply be mounted by `DashboardPage` (wired in task 8.3) without
 * any extra plumbing. The conversation lives here — above `AssistantWindow` — so the
 * window can unmount on close without losing messages (R17.6).
 *
 * Replaces the slide-in `AiChatPanel`.
 */
export function AssistantBubble({ className }: AssistantBubbleProps) {
  const [state, setState] = useState<AssistantState>("closed");

  // Conversation/draft lifted above the window so closing/reopening retains it (R17.6).
  const [conversation, setConversation] = useState<AssistantConversation>({
    messages: [],
    draft: "",
  });
  const [sending, setSending] = useState(false);

  const open = () => setState("small");
  const close = () => setState("closed");
  const toggleMaximize = () =>
    setState((prev) => (prev === "maximized" ? "small" : "maximized"));

  const setDraft = (draft: string) =>
    setConversation((prev) => ({ ...prev, draft }));

  const send = async () => {
    const text = conversation.draft.trim();
    if (!text || sending) return;
    const id = () => Math.random().toString(36).slice(2);
    const history = [...conversation.messages, { id: id(), role: "user" as const, content: text }];
    setConversation({ messages: history, draft: "" });
    setSending(true);
    try {
      const res = await sendChat(history.map((m) => ({ role: m.role, content: m.content })));
      setConversation((c) => ({
        ...c,
        messages: [...c.messages, { id: id(), role: "assistant", content: res.message.content }],
      }));
    } catch {
      setConversation((c) => ({
        ...c,
        messages: [...c.messages, { id: id(), role: "assistant", content: "The assistant is unavailable right now." }],
      }));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {state !== "closed" && (
          <AssistantWindow
            key="assistant-window"
            state={state}
            conversation={conversation}
            onDraftChange={setDraft}
            onToggleMaximize={toggleMaximize}
            onClose={close}
            onSend={send}
            sending={sending}
          />
        )}
      </AnimatePresence>

      {/* R17.1: circular bubble fixed bottom-right with a ~20px margin while closed. */}
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
            aria-label="Open AI assistant"
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
