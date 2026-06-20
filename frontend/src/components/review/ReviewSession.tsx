import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Loader2, Check, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextView } from "@/components/editor/RichTextEditor";
import {
  dueCards, customStudy, rateCard, cardIntervals,
  type Card, type ReviewRating, type IntervalPreview,
} from "@/lib/api";

const RATINGS: { rating: ReviewRating; label: string; cls: string }[] = [
  { rating: "again", label: "Again", cls: "bg-destructive/15 text-destructive hover:bg-destructive/25" },
  { rating: "hard", label: "Hard", cls: "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25" },
  { rating: "good", label: "Good", cls: "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25" },
  { rating: "easy", label: "Easy", cls: "bg-primary/15 text-primary hover:bg-primary/25" },
];

export interface ReviewSessionProps {
  deckId: string;
  onClose: () => void;
  /** Custom study source. Omit for the normal due queue. */
  custom?: { mode: "all" | "ahead"; days?: number } | null;
  /**
   * Whether ratings update the FSRS schedule. Normal review: true. Custom study:
   * defaults to false (no algo impact) unless the deck opted in.
   */
  persist?: boolean;
}

export function ReviewSession({ deckId, onClose, custom = null, persist = true }: ReviewSessionProps) {
  const reduce = useReducedMotion();
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [intervals, setIntervals] = useState<IntervalPreview | null>(null);

  useEffect(() => {
    const load = custom ? customStudy(deckId, custom.mode, custom.days ?? 0) : dueCards(deckId);
    load.then(setQueue).catch(() => setQueue([]));
  }, [deckId, custom]);

  const card = queue && idx < queue.length ? queue[idx]! : null;

  // Fetch the FSRS interval preview when the answer is shown (real reviews only).
  useEffect(() => {
    if (!flipped || !card || !persist) { setIntervals(null); return; }
    let alive = true;
    cardIntervals(deckId, card.id).then((p) => { if (alive) setIntervals(p); }).catch(() => {});
    return () => { alive = false; };
  }, [flipped, card, deckId, persist]);

  if (queue === null) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold">{custom ? "Custom study done" : "All caught up"}</h3>
        <p className="text-sm text-muted-foreground">
          {custom ? "You've gone through the custom set." : "No more cards due in this deck."}
        </p>
        <Button onClick={onClose} className="rounded-xl">Back to deck</Button>
      </div>
    );
  }

  async function advance() {
    setFlipped(false);
    setIntervals(null);
    setIdx((i) => i + 1);
  }

  async function rate(rating: ReviewRating) {
    if (busy || !card) return;
    setBusy(true);
    try {
      if (persist) await rateCard(deckId, card.id, rating);
      await advance();
    } finally {
      setBusy(false);
    }
  }

  // Skip: push the current card to the end of THIS run only (no scheduling).
  function skip() {
    setQueue((q) => {
      if (!q || !card) return q;
      const rest = q.filter((_, i) => i !== idx);
      return [...rest, card];
    });
    setFlipped(false);
    setIntervals(null);
    // idx stays; the next card slides into this index. If idx now past end, clamp.
    setIdx((i) => Math.min(i, (queue?.length ?? 1) - 1));
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Top bar: progress + skip/exit */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-4 text-sm text-muted-foreground">
        <span className="font-mono tabular-nums">{idx + 1} / {queue.length}{custom ? " · custom" : ""}</span>
        <div className="flex items-center gap-4">
          <button onClick={skip} className="inline-flex items-center gap-1 hover:text-foreground" aria-label="Skip card">
            <SkipForward className="h-4 w-4" /> Skip
          </button>
          <button onClick={onClose} className="hover:text-foreground">Exit</button>
        </div>
      </div>

      {/* Canvas: the whole area is the card. Content scrolls if tall. */}
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id + (flipped ? "-b" : "-f")}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-stretch justify-center gap-5 px-6 py-10 text-left"
          >
            {flipped ? (
              <>
                <RichTextView html={card.front_html} className="text-base text-muted-foreground/80" />
                <div className="h-px w-full bg-border" />
                <RichTextView html={card.back_html} className="text-xl" />
              </>
            ) : (
              <RichTextView html={card.front_html} className="text-xl" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav: show-answer OR the four ratings (Anki-style). */}
      <div className="shrink-0 border-t border-border/50 bg-background/80 p-3 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-2xl">
          {!flipped ? (
            <Button
              onClick={() => setFlipped(true)}
              variant="secondary"
              className="h-12 w-full rounded-xl text-sm font-medium"
            >
              Show answer
            </Button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r.rating}
                  onClick={() => rate(r.rating)}
                  disabled={busy}
                  className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${r.cls}`}
                >
                  <span>{r.label}</span>
                  {persist && intervals && (
                    <span className="font-mono text-[10px] tabular-nums opacity-80">{intervals[r.rating]}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
