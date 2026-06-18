import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Menu, Plus, ChevronRight, Layers, Play } from "lucide-react";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SettingsDialog } from "@/components/dashboard/SettingsDialog";
import { AssistantBubble } from "@/components/dashboard/assistant/AssistantBubble";
import { OnboardingStep } from "@/components/auth/OnboardingStep";
import type { DeckLike } from "@/lib/due-decks";

const mockDecks = [
  { id: 1, name: "Biology · Grade 10", newCards: 5, learning: 4, due: 14, lastStudied: "2h ago" },
  { id: 2, name: "History · WWII", newCards: 0, learning: 2, due: 8, lastStudied: "1d ago" },
  { id: 3, name: "English Vocabulary", newCards: 7, learning: 2, due: 13, lastStudied: "30m ago" },
  { id: 4, name: "Chemistry · Bonds", newCards: 3, learning: 0, due: 0, lastStudied: "3d ago" },
];

const totals = {
  new: mockDecks.reduce((s, d) => s + d.newCards, 0),
  learn: mockDecks.reduce((s, d) => s + d.learning, 0),
  due: mockDecks.reduce((s, d) => s + d.due, 0),
};

// Reference timestamps for synthesizing the `cards[].nextReview` schedule that
// the Sidebar's Overview section evaluates via the real `selectDueDecks`
// predicate. Decks with a positive `due` count get a card whose review is in
// the PAST (due); decks with `due === 0` get one in the FUTURE (not due).
const PAST_REVIEW = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const FUTURE_REVIEW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

export default function DashboardPage() {
  const { needsUsername } = useAuth();
  const reduce = useReducedMotion();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);

  useEffect(() => {
    if (needsUsername) setShowUsernameDialog(true);
  }, [needsUsername]);

  // Adapt the mock decks into the `DeckLike` shape the Sidebar consumes. The
  // synthesized `cards` make Overview's "due decks" list match the mock `due`
  // counts through the shared `selectDueDecks` predicate (R15.3, R15.4).
  const sidebarDecks: DeckLike[] = useMemo(
    () =>
      mockDecks.map((deck) => ({
        id: String(deck.id),
        name: deck.name,
        cards: [{ nextReview: deck.due > 0 ? PAST_REVIEW : FUTURE_REVIEW }],
      })),
    [],
  );

  const totalDue = totals.new + totals.learn + totals.due;

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* ── Left sidebar ───────────────────────────── */}
      <Sidebar
        collapsed={navCollapsed}
        onToggleCollapse={() => setNavCollapsed((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        decks={sidebarDecks}
        selectedDeckId={selectedDeckId}
        onSelectDeck={(id) => {
          setSelectedDeckId(id);
          setMobileNavOpen(false);
        }}
      />

      {/* ── Main column ────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-sm font-semibold">Decks</h1>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl space-y-8 p-4 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key="decks"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-8"
              >
                <DecksView totalDue={totalDue} />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Self-contained AI assistant — manages its own open/close (R17–R19). */}
      <AssistantBubble />

      {/* Settings surface — opened from the sidebar Settings entry (R16.1, R16.3). */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Onboarding — shown while the user still needs a username (R8). */}
      <OnboardingStep open={showUsernameDialog} onOpenChange={setShowUsernameDialog} />
    </div>
  );
}

/* ── Decks view ───────────────────────────────── */
function DecksView({ totalDue }: { totalDue: number }) {
  const stats = [
    { label: "New", count: totals.new, color: "text-state-new", ring: "ring-state-new/20", bg: "bg-state-new/10" },
    { label: "Learning", count: totals.learn, color: "text-state-learn", ring: "ring-state-learn/20", bg: "bg-state-learn/10" },
    { label: "Due", count: totals.due, color: "text-state-due", ring: "ring-state-due/20", bg: "bg-state-due/10" },
  ];

  return (
    <>
      {/* Hero — review CTA on the card-stack motif */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/12 via-card to-card p-6 md:p-8">
        {/* layered card accent */}
        <div aria-hidden className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 md:block">
          <div className="relative h-36 w-28">
            <div className="absolute inset-0 rotate-6 rounded-2xl border border-primary/30 bg-primary/10" />
            <div className="absolute inset-0 rotate-3 rounded-2xl border border-primary/40 bg-card" />
            <div className="absolute inset-0 rounded-2xl border border-primary/50 bg-gradient-to-br from-primary/30 to-primary/5 stack-glow" />
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="label-mono mb-2">Today's review</p>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {totalDue > 0 ? (
              <>
                <span className="font-mono tabular-nums text-primary">{totalDue}</span> cards ready
              </>
            ) : (
              "All caught up"
            )}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {totalDue > 0
              ? `Across ${mockDecks.length} decks. Keep your streak alive.`
              : "Nothing due right now. Add a deck or get ahead."}
          </p>
          <Button className="mt-5 h-11 gap-2 rounded-xl px-6 font-semibold shadow-lg shadow-primary/25" disabled={totalDue === 0}>
            <Play className="h-4 w-4 fill-current" />
            Start review
          </Button>
        </div>
      </section>

      {/* stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn("rounded-2xl border border-border/60 p-4 ring-1 ring-inset", s.bg, s.ring)}
          >
            <p className="label-mono">{s.label}</p>
            <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", s.color)}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* deck list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Your decks
            <span className="label-mono">{mockDecks.length}</span>
          </h3>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-lg">
            <Plus className="h-4 w-4" />
            New deck
          </Button>
        </div>

        <div className="space-y-2">
          {mockDecks.map((deck) => (
            <button
              key={deck.id}
              className="group flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{deck.name}</p>
                <p className="label-mono mt-0.5 normal-case tracking-normal">Last studied {deck.lastStudied}</p>
              </div>
              <div className="hidden items-center gap-3 font-mono text-xs tabular-nums sm:flex">
                <span className="w-6 text-right text-state-new">{deck.newCards}</span>
                <span className="w-6 text-right text-state-learn">{deck.learning}</span>
                <span className="w-6 text-right text-state-due">{deck.due}</span>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
