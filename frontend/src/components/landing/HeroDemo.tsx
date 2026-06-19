import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Sparkles,
  Library,
  Layers,
  Play,
  Settings,
  Plus,
  ChevronRight,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HeroDemo — a self-contained, client-only mock of the USki dashboard shown on
 * the landing page (R3). It visually replicates the real dashboard with a left
 * sidebar (Overview / Decks) and a right AI-assistant area.
 *
 * It is intentionally inert: every interaction updates LOCAL component state
 * only. There are NO backend calls, NO routing, and NO real account or deck
 * data — only the hard-coded demo constants below (R3.4, R3.5, R3.6).
 */

interface DemoDeck {
  id: number;
  name: string;
  due: number;
  total: number;
  isDue: boolean;
}

// Hard-coded demo data — never sourced from an account or API (R3.5, R3.6).
const DEMO_DECKS: readonly DemoDeck[] = [
  { id: 1, name: "Biology · Grade 10", due: 14, total: 42, isDue: true },
  { id: 2, name: "History · WWII", due: 8, total: 31, isDue: true },
  { id: 3, name: "English Vocabulary", due: 13, total: 58, isDue: true },
  { id: 4, name: "Chemistry · Bonds", due: 0, total: 24, isDue: false },
  { id: 5, name: "Geography · Capitals", due: 0, total: 19, isDue: false },
];

const DEMO_SUGGESTIONS: readonly string[] = [
  "Explain photosynthesis simply",
  "Make 5 cards from my notes",
  "Quiz me on World War II",
];

// Canned, hard-coded replies so the fake assistant feels alive without a backend.
const DEMO_REPLIES: Record<string, string> = {
  "Explain photosynthesis simply":
    "Plants turn sunlight, water, and CO₂ into sugar and oxygen. Light is the energy, leaves are the factory.",
  "Make 5 cards from my notes":
    "Done — drafted 5 cards on cell structure. Review them in the Biology deck whenever you're ready.",
  "Quiz me on World War II":
    "Sure! First question: in which year did WWII begin? (Tap a deck to keep studying.)",
};

const dueDecks = DEMO_DECKS.filter((d) => d.isDue);

export function HeroDemo(): JSX.Element {
  const reduce = useReducedMotion();

  // All interactivity is local state only — nothing leaves this component.
  const [selectedDeckId, setSelectedDeckId] = useState<number>(DEMO_DECKS[0]!.id);
  const [activeReply, setActiveReply] = useState<string | null>(null);

  return (
    <motion.div
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
      aria-label="Interactive dashboard preview"
    >
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/5">
        {/* faux window chrome */}
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 text-[11px] font-medium text-muted-foreground">
            USki — Dashboard preview
          </span>
        </div>

        <div className="flex h-[28rem] min-h-0 md:h-[32rem]">
          {/* ── Left sidebar (R3.1) ───────────────────────── */}
          <aside className="hidden w-48 shrink-0 flex-col border-r border-border/50 bg-card/60 sm:flex">
            <div className="flex h-12 items-center gap-2 px-4">
              <img src="/logo.png" alt="" className="h-6 w-6 rounded-md" />
              <span className="text-sm font-bold tracking-tight">
                <span className="text-primary">US</span>
                <span className="text-foreground">ki</span>
              </span>
            </div>

            {/* scrollable nav (R3.3) */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overview
              </p>
              <button
                type="button"
                className="mb-1 flex w-full items-center gap-2.5 rounded-lg bg-primary/10 px-2.5 py-2 text-left text-xs font-semibold text-primary"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Review
                <span className="ml-auto rounded-full bg-primary/20 px-1.5 text-[10px] tabular-nums">
                  {dueDecks.reduce((s, d) => s + d.due, 0)}
                </span>
              </button>
              {dueDecks.map((deck) => (
                <DeckRow
                  key={deck.id}
                  deck={deck}
                  selected={selectedDeckId === deck.id}
                  onSelect={() => setSelectedDeckId(deck.id)}
                  compact
                />
              ))}

              <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Decks
              </p>
              {DEMO_DECKS.map((deck) => (
                <DeckRow
                  key={deck.id}
                  deck={deck}
                  selected={selectedDeckId === deck.id}
                  onSelect={() => setSelectedDeckId(deck.id)}
                  compact
                />
              ))}
              <button
                type="button"
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                New deck
              </button>
            </div>

            {/* footer — username, never an email (mock) */}
            <div className="border-t border-border/50 p-2">
              <div className="mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </div>
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-[10px] font-semibold text-primary-foreground">
                  A
                </div>
                <span className="truncate font-mono text-[11px] text-foreground">alex#0427</span>
              </div>
            </div>
          </aside>

          {/* ── Main + AI assistant (R3.1) ────────────────── */}
          <div className="flex min-w-0 flex-1">
            {/* main study column — scrollable (R3.3) */}
            <main className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Today's review
              </p>
              <h3 className="mt-1 text-lg font-bold tracking-tight">
                <span className="font-mono tabular-nums text-primary">
                  {dueDecks.reduce((s, d) => s + d.due, 0)}
                </span>{" "}
                cards ready
              </h3>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "New", count: 12, color: "text-state-new", bg: "bg-state-new/10" },
                  { label: "Learn", count: 8, color: "text-state-learn", bg: "bg-state-learn/10" },
                  { label: "Due", count: 35, color: "text-state-due", bg: "bg-state-due/10" },
                ].map((s) => (
                  <div key={s.label} className={cn("rounded-lg p-2.5 text-center", s.bg)}>
                    <div className={cn("text-base font-bold tabular-nums", s.color)}>{s.count}</div>
                    <div className="text-[10px] font-medium text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-foreground">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                Your decks
              </div>
              <div className="mt-2 space-y-1.5">
                {DEMO_DECKS.map((deck) => (
                  <button
                    key={deck.id}
                    type="button"
                    onClick={() => setSelectedDeckId(deck.id)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                      selectedDeckId === deck.id
                        ? "border-primary/40 bg-card shadow-sm"
                        : "border-border/60 bg-card/50 hover:border-primary/30 hover:bg-card",
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Library className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{deck.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {deck.total} cards · {deck.due > 0 ? `${deck.due} due` : "all caught up"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </main>

            {/* AI assistant area (R3.1) — scrollable (R3.3) */}
            <aside className="hidden w-56 shrink-0 flex-col border-l border-border/50 bg-card/60 lg:flex">
              <div className="flex h-12 items-center gap-2 border-b border-border/50 px-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-semibold">AI Assistant</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {activeReply ? (
                  <motion.div
                    key={activeReply}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-xl rounded-tl-sm bg-accent/60 p-2.5 text-[11px] leading-relaxed text-foreground"
                  >
                    {activeReply}
                  </motion.div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Ask anything about your decks — summarize material, generate cards, or get
                    quizzed. Tap a suggestion to try it.
                  </p>
                )}

                <div className="mt-3 space-y-1.5">
                  {DEMO_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActiveReply(DEMO_REPLIES[s] ?? null)}
                      className="w-full rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* composer (visual only — inert) */}
              <div className="border-t border-border/50 p-2.5">
                <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-2.5 py-1.5">
                  <span className="flex-1 text-[11px] text-muted-foreground/70">Message…</span>
                  <Send className="h-3.5 w-3.5 text-muted-foreground/70" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* decorative offset accent (matches the real hero card) */}
      <div
        aria-hidden
        className="absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-2xl bg-primary/10"
      />
    </motion.div>
  );
}

/* ── Sidebar deck row (compact) ─────────────────────────── */
function DeckRow({
  deck,
  selected,
  onSelect,
  compact,
}: {
  deck: DemoDeck;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium transition-colors",
        compact ? "text-[11px]" : "text-xs",
        selected
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Layers className={cn("h-3.5 w-3.5 shrink-0", selected && "text-primary")} />
      <span className="truncate">{deck.name}</span>
      {deck.due > 0 && (
        <span className="ml-auto text-[10px] tabular-nums text-primary">{deck.due}</span>
      )}
    </button>
  );
}
