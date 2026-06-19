import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles, X, ArrowUp, Plus, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clampToViewport, type Point, type Size } from "@/lib/window-bounds";

/** A single message in the (preview-only) assistant conversation. */
export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** The conversation/draft state that is lifted above the window so it survives close/reopen. */
export interface AssistantConversation {
  messages: AssistantMessage[];
  draft: string;
}

interface AssistantWindowProps {
  /** Whether the window is shown small or maximized (the window is never rendered while closed). */
  state: "small" | "maximized";
  /** Lifted conversation/draft so the window can unmount without losing messages (R17.6). */
  conversation: AssistantConversation;
  /** Update the lifted draft text. */
  onDraftChange: (draft: string) => void;
  /** Toggle between small and maximized (R17.3 / R17.5). */
  onToggleMaximize: () => void;
  /** Close the window and return to the bubble (R17.6). */
  onClose: () => void;
  /** Send the current draft as a chat message. */
  onSend?: () => void;
  /** Whether a chat request is in flight. */
  sending?: boolean;
}

const SUGGESTIONS = [
  "Explain photosynthesis simply",
  "Make 5 cards from my notes",
  "Quiz me on World War II",
];

/**
 * The AI assistant chat surface. UI only — no backend wired yet (preview).
 *
 * Reuses the visual design of the legacy `AiChatPanel` (Sparkles header, intro
 * suggestions, inert composer) but is rendered inside a bubble-anchored window
 * rather than a slide-in panel.
 *
 * Structure notes for follow-up tasks:
 *  - The title bar carries `data-assistant-drag-handle` so task 9.2 can attach a
 *    drag handle (small state only) and clamp via `clampToViewport`.
 *  - The outer element is a single `motion.div` so task 9.3 can wrap it in
 *    `AnimatePresence` and animate transform/opacity/scale on open/close.
 */
export function AssistantWindow({
  state,
  conversation,
  onDraftChange,
  onToggleMaximize,
  onClose,
  onSend,
  sending = false,
}: AssistantWindowProps) {
  const maximized = state === "maximized";

  // R19: honor the OS "reduce motion" preference — collapse the open/close
  // transition to a near-instant opacity-only fade (no scale movement).
  const reduceMotion = useReducedMotion();

  /**
   * R18.4: the released position is retained across drags until the window is
   * dragged again, closed (the component unmounts via `AnimatePresence`), or
   * maximized. `null` means "use the default bottom-right placement" (R17.2);
   * once dragged we switch to absolute top-left positioning driven by this
   * clamped point.
   */
  const [position, setPosition] = useState<Point | null>(null);

  const windowRef = useRef<HTMLDivElement>(null);
  // Live drag bookkeeping: the pointer origin and the window's top-left at grab.
  const dragRef = useRef<{
    pointerStartX: number;
    pointerStartY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // Actual on-screen window size (honours the responsive width clamp, R17.7),
  // falling back to the nominal small dimensions before first layout.
  const measureSize = useCallback((): Size => {
    const el = windowRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }
    return { width: 380, height: 560 };
  }, []);

  const viewportSize = (): Size => ({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // R18.2: maximizing resets the retained position so restoring returns the
  // small window to its default bottom-right placement, and the maximized
  // window stays pinned right (never driven by `position`).
  useEffect(() => {
    if (maximized) setPosition(null);
  }, [maximized]);

  // R18.5: re-clamp the stored position on viewport resize so the window can
  // never end up off-screen. Idempotent, so an already-valid window is left put.
  useEffect(() => {
    if (maximized) return;
    const onResize = () => {
      setPosition((prev) =>
        prev ? clampToViewport(prev, measureSize(), viewportSize()) : prev,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [maximized, measureSize]);

  // R18.1: press-and-hold the title bar to drag — small state only.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (maximized || e.button !== 0) return;
    // Ignore presses that land on the header controls (maximize/close).
    if ((e.target as HTMLElement).closest("button")) return;
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      originX: rect.left,
      originY: rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = {
      x: drag.originX + (e.clientX - drag.pointerStartX),
      y: drag.originY + (e.clientY - drag.pointerStartY),
    };
    // R18.3: keep the entire window within all four viewport edges.
    setPosition(clampToViewport(next, measureSize(), viewportSize()));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Apply the dragged position only in the small state; never when maximized.
  const dragged = !maximized && position !== null;

  /**
   * R19 open/close animation. We animate ONLY GPU-friendly properties
   * (`opacity` + `transform`/`scale`) so the transition holds ≥55fps with no
   * layout work — width/height/top/left are never animated here (R19.3). The
   * dragged top/left lives in `style` and is left untouched so the open/close
   * transform never fights the drag positioning (R18 / task 9.2).
   *
   * A single keyed element in `AnimatePresence` (see `AssistantBubble`) means a
   * state change mid-flight interrupts and retargets cleanly from the current
   * value rather than leaving a partial resting state (R19.4).
   */
  const enterExit = reduceMotion
    ? // Reduced motion: near-instant, opacity-only — no scale movement.
      {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        // ~120ms keeps it perceptibly smooth yet effectively instant.
        transition: { duration: 0.12, ease: "linear" as const },
      }
    : {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 },
        // ~250ms eased tween — lands inside the 150–400ms window (R19.1/R19.2)
        // and retargets cleanly on rapid toggles.
        transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <motion.div
      ref={windowRef}
      initial={enterExit.initial}
      animate={enterExit.animate}
      exit={enterExit.exit}
      transition={enterExit.transition}
      style={
        dragged
          ? { top: position!.y, left: position!.x, right: "auto", bottom: "auto" }
          : undefined
      }
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden border border-border/60 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl",
        maximized
          ? // R17.4: full viewport height × 33–50% width, pinned to the right edge.
            "inset-y-0 right-0 h-screen w-[40vw] min-w-[360px] max-w-[50vw] rounded-none border-y-0 border-r-0"
          : // R17.2 / R17.7: 380×560 small window, width clamped to the viewport when narrower than 320px.
            cn(
              "h-[560px] max-h-[calc(100vh-2.5rem)] w-[380px] max-w-[calc(100vw-2.5rem)] rounded-2xl",
              // Default bottom-right placement until the window has been dragged.
              !dragged && "bottom-5 right-5",
            ),
      )}
      role="dialog"
      aria-label="AI assistant"
    >
      {/* header / title bar — drag handle (R18.1, small state only) */}
      <div
        data-assistant-drag-handle
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "flex h-16 items-center justify-between border-b border-border/50 px-5",
          !maximized && "cursor-grab touch-none select-none active:cursor-grabbing",
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md shadow-primary/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">AI Assistant</p>
            <p className="label-mono">Beta · preview</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onToggleMaximize}
            aria-label={maximized ? "Restore window" : "Maximize window"}
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onClose}
            aria-label="Close assistant"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* conversation / intro state */}
      <div className="flex-1 overflow-y-auto">
        {conversation.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold">Ask anything about your decks</h3>
              <p className="text-sm text-muted-foreground">
                Summarize material, generate cards, or get quizzed. Grounded in what you're learning.
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2">
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
          <div className="flex flex-col gap-3 p-4">
            {conversation.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                  m.role === "user"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start border border-border/60 bg-background/50 text-foreground",
                )}
              >
                {m.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* composer (visual only) */}
      <div className="border-t border-border/50 p-4">
        <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-background/60 p-2 transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl" aria-label="Attach">
            <Plus className="h-4 w-4" />
          </Button>
          <textarea
            rows={1}
            value={conversation.draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (conversation.draft.trim() && !sending) onSend?.();
              }
            }}
            placeholder="Message the assistant…"
            className="max-h-32 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <Button
            size="icon"
            onClick={() => onSend?.()}
            className={cn(
              "h-9 w-9 shrink-0 rounded-xl transition-opacity",
              (!conversation.draft.trim() || sending) && "opacity-40",
            )}
            disabled={!conversation.draft.trim() || sending}
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[0.6875rem] text-muted-foreground/70">
          Assistant isn't connected yet — preview only.
        </p>
      </div>
    </motion.div>
  );
}
