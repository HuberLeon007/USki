import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextView } from "@/components/editor/RichTextEditor";
import { dueCards, rateCard, type Card, type ReviewRating } from "@/lib/api";

const RATINGS: { rating: ReviewRating; label: string; cls: string }[] = [
  { rating: "again", label: "Again", cls: "bg-destructive/15 text-destructive hover:bg-destructive/25" },
  { rating: "hard", label: "Hard", cls: "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25" },
  { rating: "good", label: "Good", cls: "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25" },
  { rating: "easy", label: "Easy", cls: "bg-primary/15 text-primary hover:bg-primary/25" },
];

export function ReviewSession({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dueCards(deckId).then(setQueue).catch(() => setQueue([]));
  }, [deckId]);

  if (queue === null) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (queue.length === 0 || idx >= queue.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold">All caught up</h3>
        <p className="text-sm text-muted-foreground">No more cards due in this deck.</p>
        <Button onClick={onClose} className="rounded-xl">Back to deck</Button>
      </div>
    );
  }

  const card = queue[idx]!;

  async function rate(rating: ReviewRating) {
    if (busy) return;
    setBusy(true);
    try {
      await rateCard(deckId, card.id, rating);
      setFlipped(false);
      setIdx((i) => i + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{idx + 1} / {queue.length}</span>
        <button onClick={onClose} className="hover:text-foreground">Exit</button>
      </div>

      {/* Landscape card (mobile portrait via aspect on small screens) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={card.id + (flipped ? "-b" : "-f")}
          initial={reduce ? false : { opacity: 0, rotateY: flipped ? -8 : 8, y: 8 }}
          animate={{ opacity: 1, rotateY: 0, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex aspect-[16/10] w-full items-center justify-center overflow-auto rounded-3xl border border-border/60 bg-card p-8 shadow-xl shadow-primary/5 max-sm:portrait:aspect-[10/16]"
        >
          <RichTextView html={flipped ? card.back_html : card.front_html} className="text-center text-lg" />
        </motion.div>
      </AnimatePresence>

      {!flipped ? (
        <Button onClick={() => setFlipped(true)} className="h-12 rounded-xl text-base font-semibold">
          Show answer
        </Button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.rating}
              onClick={() => rate(r.rating)}
              disabled={busy}
              className={`flex h-12 items-center justify-center rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${r.cls}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
