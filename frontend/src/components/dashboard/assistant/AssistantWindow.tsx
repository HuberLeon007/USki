import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles, X, ArrowUp, Square, SquarePen, History, PanelRight, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clampToViewport, type Point, type Size } from "@/lib/window-bounds";
import { ASSISTANT_NAME, type AssistantState } from "./AssistantBubble";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AssistantConversation {
  messages: AssistantMessage[];
  draft: string;
}

/** A previously-finished chat, kept for the "recent chats" history (max 5). */
export interface ChatSummary {
  id: string;
  title: string;
  ts: number;
}

interface AssistantWindowProps {
  state: Exclude<AssistantState, "closed">;
  /** Docked panel width in px (resizable). */
  dockWidth: number;
  minDockWidth: number;
  onDockWidthChange: (px: number) => void;
  conversation: AssistantConversation;
  onDraftChange: (draft: string) => void;
  /** Toggle small <-> docked (right side panel). */
  onToggleDock: () => void;
  onClose: () => void;
  onSend?: () => void;
  sending?: boolean;
  /** What the assistant is currently doing (e.g. "Reading through <deck>"). */
  status?: string | null;
  /** Start a fresh chat (archives the current one into history). */
  onNewChat: () => void;
  /** Up to 5 most recent finished chats. */
  history: ChatSummary[];
  onLoadChat: (id: string) => void;
}

const SUGGESTIONS = [
  "Explain photosynthesis simply",
  "What were the causes of World War II?",
  "Difference between mitosis and meiosis?",
];

export function AssistantWindow({
  state,
  dockWidth,
  minDockWidth,
  onDockWidthChange,
  conversation,
  onDraftChange,
  onToggleDock,
  onClose,
  onSend,
  sending = false,
  status,
  onNewChat,
  history,
  onLoadChat,
}: AssistantWindowProps) {
  const docked = state === "docked";
  const small = state === "small";
  const reduceMotion = useReducedMotion();

  const [position, setPosition] = useState<Point | null>(null);
  const [floatSize, setFloatSize] = useState<Size>({ width: 380, height: 560 });
  const [showHistory, setShowHistory] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<boolean>(false);
  // Free-resize (small window): which edge/corner + the geometry at grab time.
  const floatResizeRef = useRef<{ dir: string; px: number; py: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  const FLOAT_MIN_W = 300;
  const FLOAT_MIN_H = 360;

  const measureSize = useCallback((): Size => {
    const el = windowRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    }
    return { width: 380, height: 560 };
  }, []);
  const viewportSize = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.messages, sending]);

  // Reset float position when leaving the small state.
  useEffect(() => {
    if (!small) setPosition(null);
  }, [small]);

  // Anchor the floating window bottom-right on first open so it can be resized.
  useEffect(() => {
    if (small && position === null) {
      setPosition({
        x: Math.max(8, window.innerWidth - floatSize.width - 20),
        y: Math.max(8, window.innerHeight - floatSize.height - 20),
      });
    }
  }, [small, position, floatSize]);

  useEffect(() => {
    if (!small) return;
    const onResize = () =>
      setPosition((p) => (p ? clampToViewport(p, measureSize(), viewportSize()) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [small, measureSize]);

  // ----- Title-bar drag (small only) -----
  const onTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!small || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const el = windowRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragRef.current = { px: e.clientX, py: e.clientY, ox: r.left, oy: r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onTitlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    setPosition(clampToViewport({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }, measureSize(), viewportSize()));
  };
  const endTitleDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // ----- Left-edge resize (docked only) -----
  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!docked || e.button !== 0) return;
    resizeRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const next = window.innerWidth - e.clientX; // distance from right edge
    onDockWidthChange(Math.max(minDockWidth, Math.min(next, MAX_DOCK_PX())));
  };
  const endResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    resizeRef.current = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // ----- Free resize from any edge/corner (small floating window) -----
  const onFloatResizeDown = (dir: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!small || e.button !== 0) return;
    const el = windowRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    floatResizeRef.current = { dir, px: e.clientX, py: e.clientY, ox: r.left, oy: r.top, ow: r.width, oh: r.height };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const onFloatResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = floatResizeRef.current;
    if (!s) return;
    const dx = e.clientX - s.px, dy = e.clientY - s.py;
    let x = s.ox, y = s.oy, w = s.ow, h = s.oh;
    if (s.dir.includes("e")) w = s.ow + dx;
    if (s.dir.includes("s")) h = s.oh + dy;
    if (s.dir.includes("w")) { w = s.ow - dx; x = s.ox + dx; }
    if (s.dir.includes("n")) { h = s.oh - dy; y = s.oy + dy; }
    if (w < FLOAT_MIN_W) { if (s.dir.includes("w")) x = s.ox + (s.ow - FLOAT_MIN_W); w = FLOAT_MIN_W; }
    if (h < FLOAT_MIN_H) { if (s.dir.includes("n")) y = s.oy + (s.oh - FLOAT_MIN_H); h = FLOAT_MIN_H; }
    w = Math.min(w, window.innerWidth - 16);
    h = Math.min(h, window.innerHeight - 16);
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    setFloatSize({ width: w, height: h });
    setPosition({ x, y });
  };
  const endFloatResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!floatResizeRef.current) return;
    floatResizeRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const enterExit = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12, ease: "linear" as const } }
    : {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 },
        transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
      };

  const canSend = Boolean(conversation.draft.trim()) && !sending;
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const waiting = sending && (!lastMsg || lastMsg.role === "user" || (lastMsg.role === "assistant" && !lastMsg.content));

  return (
    <motion.div
      ref={windowRef}
      initial={enterExit.initial}
      animate={enterExit.animate}
      exit={enterExit.exit}
      transition={enterExit.transition}
      style={
        small
          ? { top: position?.y, left: position?.x, right: "auto", bottom: "auto", width: floatSize.width, height: floatSize.height }
          : docked
            ? { width: dockWidth }
            : undefined
      }
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden border-border/60 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl",
        docked && "inset-y-0 right-0 h-screen rounded-none border-y-0 border-l border-r-0",
        small && "rounded-2xl border",
      )}
      role="dialog"
      aria-label={ASSISTANT_NAME}
    >
      {/* Free-resize handles (small floating window only) */}
      {small && (
        <>
          {([
            ["n", "left-2 right-2 top-0 h-1.5 cursor-ns-resize"],
            ["s", "left-2 right-2 bottom-0 h-1.5 cursor-ns-resize"],
            ["e", "top-2 bottom-2 right-0 w-1.5 cursor-ew-resize"],
            ["w", "top-2 bottom-2 left-0 w-1.5 cursor-ew-resize"],
            ["ne", "top-0 right-0 h-3 w-3 cursor-nesw-resize"],
            ["nw", "top-0 left-0 h-3 w-3 cursor-nwse-resize"],
            ["se", "bottom-0 right-0 h-3 w-3 cursor-nwse-resize"],
            ["sw", "bottom-0 left-0 h-3 w-3 cursor-nesw-resize"],
          ] as const).map(([dir, cls]) => (
            <div
              key={dir}
              onPointerDown={onFloatResizeDown(dir)}
              onPointerMove={onFloatResizeMove}
              onPointerUp={endFloatResize}
              onPointerCancel={endFloatResize}
              className={cn("absolute z-20 touch-none", cls)}
            />
          ))}
        </>
      )}
      {/* Left-edge resize handle (docked only) */}
      {docked && (
        <div
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize touch-none bg-transparent hover:bg-primary/30"
          aria-label="Adjust width"
          role="separator"
        />
      )}

      <div
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endTitleDrag}
        onPointerCancel={endTitleDrag}
        className={cn(
          "relative flex h-16 items-center justify-between border-b border-border/50 px-5",
          small && "cursor-grab touch-none select-none active:cursor-grabbing",
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md shadow-primary/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{ASSISTANT_NAME}</p>
            <p className="label-mono">Study assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onNewChat} aria-label="New chat" title="New chat">
            <SquarePen className="h-4 w-4" />
          </Button>
          <Button
            variant={showHistory ? "secondary" : "ghost"}
            size="icon" className="h-9 w-9"
            onClick={() => setShowHistory((v) => !v)}
            aria-label="Recent chats" title="Recent chats"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onToggleDock} aria-label={docked ? "Undock" : "Dock to side"} title={docked ? "Undock" : "Dock to side"}>
            {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose} aria-label={`Close ${ASSISTANT_NAME}`}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Recent-chats dropdown */}
        {showHistory && (
          <>
            <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setShowHistory(false)} />
            <div className="absolute right-4 top-[3.75rem] z-20 w-64 overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl">
              <p className="label-mono px-3 pb-1 pt-2.5">Recent chats</p>
              {history.length === 0 ? (
                <p className="px-3 pb-3 pt-1 text-sm text-muted-foreground">No previous chats yet.</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto pb-1.5">
                  {history.map((h) => (
                    <li key={h.id}>
                      <button
                        onClick={() => { onLoadChat(h.id); setShowHistory(false); }}
                        className="block w-full truncate px-3 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-accent"
                        title={h.title}
                      >
                        {h.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {conversation.messages.length === 0 && !sending ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold">Ask {ASSISTANT_NAME} about your decks</h3>
              <p className="text-sm text-muted-foreground">
                Ask questions about your material. {ASSISTANT_NAME} explains and summarizes,
                grounded in what you're learning.
              </p>
            </div>
            <div className="mt-2 flex w-full max-w-md flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onDraftChange(s)}
                  className="rounded-xl border border-border/60 bg-background/50 px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn("mx-auto flex flex-col gap-3 p-4", docked && "max-w-3xl")}>
            {conversation.messages.map((m) => (
              (m.role === "assistant" && !m.content) ? null : (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "self-end bg-primary text-primary-foreground"
                      : "self-start border border-border/60 bg-background/50 text-foreground",
                  )}
                >
                  {m.content}
                </div>
              )
            ))}
            {waiting && <ThinkingDots status={status} />}
          </div>
        )}
      </div>

      <div className="border-t border-border/50 p-4">
        <div className={cn("mx-auto flex items-end gap-2 rounded-2xl border border-border/60 bg-background/60 p-2 transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10", docked && "max-w-3xl")}>
          <textarea
            rows={1}
            value={conversation.draft}
            onChange={(e) => onDraftChange(e.target.value)}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend?.();
              }
            }}
            placeholder={sending ? `${ASSISTANT_NAME} is thinking…` : `Message ${ASSISTANT_NAME}…`}
            className="max-h-32 flex-1 resize-none bg-transparent py-2 pl-2 text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
          />
          <Button
            size="icon"
            onClick={() => canSend && onSend?.()}
            className={cn("h-9 w-9 shrink-0 rounded-xl transition-opacity", !canSend && "opacity-40")}
            disabled={!canSend}
            aria-label={sending ? `${ASSISTANT_NAME} is thinking` : "Send"}
          >
            {sending ? <Square className="h-3.5 w-3.5 fill-current" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/** Docked panel never wider than half the viewport (and never past 640px). */
function MAX_DOCK_PX() {
  return Math.min(640, Math.round(window.innerWidth * 0.5));
}

/** Animated "thinking" indicator shown while Sero composes a reply. */
function ThinkingDots({ status }: { status?: string | null }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center gap-2.5 self-start rounded-2xl border border-border/60 bg-background/50 px-4 py-3">
      <span className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            animate={reduce ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={reduce ? undefined : { duration: 1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
          />
        ))}
      </span>
      {status && <span className="text-xs text-muted-foreground">{status}…</span>}
    </div>
  );
}
