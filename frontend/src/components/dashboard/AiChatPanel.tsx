import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Right-side AI assistant panel. UI only — no backend wired yet.
 * Slides in/out; collapsible via the dashboard toggle.
 */
export function AiChatPanel({ open, onClose }: AiChatPanelProps) {
  const [draft, setDraft] = useState("");

  const suggestions = [
    "Explain photosynthesis simply",
    "Make 5 cards from my notes",
    "Quiz me on World War II",
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* mobile scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-border/60 bg-card/95 backdrop-blur-xl lg:static lg:z-auto lg:max-w-md"
          >
            {/* header */}
            <div className="flex h-16 items-center justify-between border-b border-border/50 px-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md shadow-primary/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">AI Assistant</p>
                  <p className="label-mono">Beta · preview</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close assistant">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* empty / intro state */}
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
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
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft(s)}
                    className="rounded-xl border border-border/60 bg-background/50 px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* composer (visual only) */}
            <div className="border-t border-border/50 p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-background/60 p-2 transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl" aria-label="Attach">
                  <Plus className="h-4 w-4" />
                </Button>
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message the assistant…"
                  className="max-h-32 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/70"
                />
                <Button
                  size="icon"
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-xl transition-opacity",
                    !draft.trim() && "opacity-40",
                  )}
                  disabled={!draft.trim()}
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-center text-[0.6875rem] text-muted-foreground/70">
                Assistant isn't connected yet — preview only.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
