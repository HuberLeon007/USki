import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  Sparkles,
  Layers,
  Play,
  Settings,
  LayoutDashboard,
  Users,
  FolderSearch,
  Search,
  Send,
  Folder,
  LayoutGrid,
  List,
  X,
  ChevronDown,
  Maximize2,
  Minimize2,
  MousePointer2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DeckBadge, deckColorFor } from "@/lib/deck-icons";
import { StateCounts } from "@/lib/state-counts";

/**
 * HeroDemo — a self-contained, client-only 16:9 mock of the USki dashboard (R3).
 * When the whole frame scrolls into view it (1) fades its UI in, then (2) plays a
 * short NON-interactive intro: a fake cursor opens Sero from its notification
 * bubble and docks it. Afterwards it's fully interactive (switch views, resize /
 * minimize Sero). No backend, no routing, only demo constants.
 */

type DemoView = "overview" | "decks" | "browse" | "shared";
type SeroState = "bubble" | "window" | "docked";

interface DemoDeck {
  id: number;
  name: string;
  icon: string;
  color: string;
  nw: number;
  ln: number;
  du: number;
  total: number;
  group: string | null;
}

const DEMO_DECKS: readonly DemoDeck[] = [
  { id: 1, name: "Biology · Grade 10", icon: "leaf", color: "emerald", nw: 4, ln: 2, du: 5, total: 42, group: "Science" },
  { id: 2, name: "Chemistry · Bonds", icon: "flask", color: "blue", nw: 0, ln: 1, du: 0, total: 24, group: "Science" },
  { id: 3, name: "History · WWII", icon: "landmark", color: "amber", nw: 2, ln: 1, du: 2, total: 31, group: null },
  { id: 4, name: "English Vocabulary", icon: "languages", color: "rose", nw: 3, ln: 1, du: 4, total: 58, group: null },
  { id: 5, name: "Geography · Capitals", icon: "globe", color: "cyan", nw: 0, ln: 0, du: 0, total: 19, group: null },
];

const ready = (d: DemoDeck) => d.nw + d.ln + d.du;
const dueDecks = DEMO_DECKS.filter((d) => ready(d) > 0);
const remaining = dueDecks.reduce((s, d) => s + ready(d), 0); // 25
const DEMO_DONE = 10;
const startTotal = DEMO_DONE + remaining; // 35
const pct = Math.round((DEMO_DONE / startTotal) * 100);
const AGG = {
  nw: DEMO_DECKS.reduce((s, d) => s + d.nw, 0),
  ln: DEMO_DECKS.reduce((s, d) => s + d.ln, 0),
  du: DEMO_DECKS.reduce((s, d) => s + d.du, 0),
};
const COLOR_BY_NAME: Record<string, string> = Object.fromEntries(DEMO_DECKS.map((d) => [d.name, d.color]));

const DEMO_SUGGESTIONS = [
  "Explain photosynthesis simply",
  "What caused World War II?",
  "Difference between mitosis and meiosis?",
] as const;
const DEMO_REPLIES: Record<string, string> = {
  "Explain photosynthesis simply":
    "Plants turn sunlight, water, and CO₂ into sugar and oxygen. Light is the energy, leaves are the factory.",
  "What caused World War II?":
    "Mainly unresolved tensions after WWI, the economic crisis of the 1930s, and aggressive expansion by the Axis powers.",
  "Difference between mitosis and meiosis?":
    "Mitosis makes two identical cells for growth; meiosis makes four genetically varied cells for reproduction.",
};

const NAV: { id: DemoView; label: string; icon: typeof Layers }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "decks", label: "Decks", icon: Layers },
  { id: "browse", label: "Browse", icon: FolderSearch },
  { id: "shared", label: "Shared", icon: Users },
];

const DOCK_DEFAULT = 240;
const WIN_MIN_W = 220;
const WIN_MIN_H = 240;

export function HeroDemo(): JSX.Element {
  const reduce = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<DemoView>("overview");
  const [sero, setSero] = useState<SeroState>("bubble");
  const [dockWidth, setDockWidth] = useState(DOCK_DEFAULT);
  const [win, setWin] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [notif, setNotif] = useState(true);
  const [phase, setPhase] = useState(0);
  const [started, setStarted] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; opacity: number }>({ x: 0, y: 0, opacity: 0 });

  // Intro only begins once the whole frame is in view (started). Reduced motion
  // skips straight to the docked, interactive end state.
  useEffect(() => {
    if (!started) return;
    if (reduce) {
      setSero("docked");
      setNotif(false);
      setInteractive(true);
      setPhase(6);
      return;
    }
    const t: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => t.push(setTimeout(fn, ms));
    at(800, () => setPhase(1));                                  // move to bubble
    at(2000, () => { setPhase(2); setNotif(false); });          // click pulse on bubble
    at(2500, () => setSero("window"));                          // ...action AFTER the click lands
    at(3500, () => setPhase(3));                                // move to dock button
    at(4500, () => setPhase(4));                                // click pulse on dock button
    at(5000, () => setSero("docked"));                          // ...action AFTER the click lands
    at(5500, () => setPhase(5));                                // cursor exits
    at(6200, () => { setPhase(6); setInteractive(true); });
    return () => t.forEach(clearTimeout);
  }, [started, reduce]);

  // Position the fake cursor by MEASURING the real target element so the click
  // always lands exactly on it (bubble, then the window's dock button).
  useEffect(() => {
    if (!started || reduce) return;
    const f = frameRef.current?.getBoundingClientRect();
    if (!f) return;
    const id = requestAnimationFrame(() => {
      let target: { x: number; y: number; opacity: number };
      if (phase <= 0) {
        target = { x: f.width * 0.14, y: f.height * 0.82, opacity: 0 }; // off, lower-left
      } else if (phase === 1 || phase === 2) {
        const b = bubbleRef.current?.getBoundingClientRect();
        target = b
          ? { x: b.left - f.left + b.width / 2, y: b.top - f.top + b.height / 2, opacity: 1 }
          : { x: f.width * 0.9, y: f.height * 0.84, opacity: 1 };
      } else if (phase === 3 || phase === 4) {
        const w = windowRef.current?.getBoundingClientRect();
        target = w
          ? { x: w.right - f.left - 50, y: w.top - f.top + 22, opacity: 1 } // dock button (header, 2nd from right)
          : { x: f.width * 0.82, y: f.height * 0.2, opacity: 1 };
      } else {
        target = { x: f.width * 1.15, y: f.height * 0.5, opacity: 0 }; // exit right
      }
      setCursorPos(target);
    });
    return () => cancelAnimationFrame(id);
  }, [phase, started, reduce]);

  // Initialise the floating window's rect the first time it opens: small, anchored
  // bottom-right (so it visually grows out of the bubble).
  useEffect(() => {
    if (sero !== "window" || win) return;
    const f = frameRef.current?.getBoundingClientRect();
    if (!f) return;
    const w = Math.max(WIN_MIN_W, Math.min(f.width * 0.34, f.width - 24));
    const h = Math.max(WIN_MIN_H, Math.min(f.height * 0.6, f.height - 24));
    setWin({ x: f.width - w - 16, y: f.height - h - 16, w, h });
  }, [sero, win]);

  // ── Sero window drag (header) ───────────────────────────────
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const onWinDown = (e: React.PointerEvent) => {
    if (!interactive || !win || (e.target as HTMLElement).closest("button")) return;
    dragRef.current = { px: e.clientX, py: e.clientY, ox: win.x, oy: win.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onWinMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !win) return;
    const f = frameRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(d.ox + (e.clientX - d.px), f.width - win.w));
    const y = Math.max(0, Math.min(d.oy + (e.clientY - d.py), f.height - win.h));
    setWin({ ...win, x, y });
  };
  const onWinUp = () => { dragRef.current = null; };

  // ── Sero window resize (Windows-style edges + corners, clamped to a min size) ──
  const winResizeRef = useRef<{ dir: string; px: number; py: number; x: number; y: number; w: number; h: number } | null>(null);
  const onWinResizeDown = (dir: string) => (e: React.PointerEvent) => {
    if (!interactive || !win) return;
    e.stopPropagation();
    winResizeRef.current = { dir, px: e.clientX, py: e.clientY, ...win };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onWinResizeMove = (e: React.PointerEvent) => {
    const r = winResizeRef.current;
    if (!r) return;
    const f = frameRef.current!.getBoundingClientRect();
    const dx = e.clientX - r.px, dy = e.clientY - r.py;
    let { x, y, w, h } = r;
    if (r.dir.includes("e")) w = Math.min(Math.max(WIN_MIN_W, r.w + dx), f.width - r.x);
    if (r.dir.includes("s")) h = Math.min(Math.max(WIN_MIN_H, r.h + dy), f.height - r.y);
    if (r.dir.includes("w")) { const nw = Math.min(Math.max(WIN_MIN_W, r.w - dx), r.x + r.w); w = nw; x = r.x + r.w - nw; }
    if (r.dir.includes("n")) { const nh = Math.min(Math.max(WIN_MIN_H, r.h - dy), r.y + r.h); h = nh; y = r.y + r.h - nh; }
    setWin({ x, y, w, h });
  };
  const onWinResizeUp = () => { winResizeRef.current = null; };

  // ── Sero docked resize (left edge) ──────────────────────────
  const resizing = useRef(false);
  const onResizeDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    resizing.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizing.current) return;
    const frame = frameRef.current!.getBoundingClientRect();
    const w = frame.right - e.clientX;
    setDockWidth(Math.max(210, Math.min(w, frame.width * 0.42)));
  };
  const onResizeUp = () => { resizing.current = false; };

  return (
    <motion.div
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 30, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      onViewportEnter={() => setStarted(true)}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
      aria-label="Interactive dashboard preview"
    >
      <div
        ref={frameRef}
        className="relative flex aspect-video w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/5"
      >
        {/* faux window chrome */}
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/50 bg-muted/40 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 text-[11px] font-medium text-muted-foreground">USki Dashboard</span>
        </div>

        {/* app row (relative so the docked panel can slide in over reserved padding) */}
        <div className="relative flex min-h-0 flex-1">
          {/* ── Left sidebar ───────── */}
          <aside className="z-10 flex w-48 shrink-0 flex-col border-r border-border/50 bg-card/80">
            <div className="flex h-11 items-center gap-2 px-3">
              <span className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
                <img src="/logo.png" alt="" className="h-5 w-5 rounded" />
                <span><span className="text-primary">US</span><span className="text-foreground">ki</span></span>
              </span>
            </div>

            <nav className="flex-1 space-y-1 px-2 py-2">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => interactive && setView(item.id)}
                    title={item.label}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                      active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                    <span className="flex-1 truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-border/50 p-2">
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-[10px] font-semibold text-primary-foreground">u</div>
                <span className="flex-1 truncate font-mono text-[11px] text-foreground">uski#0001</span>
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </aside>

          {/* ── Main (reserves padding for the docked panel; transitions smoothly) ── */}
          <div
            className="flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-out"
            style={{ paddingRight: sero === "docked" ? dockWidth : 0 }}
          >
            <header className="flex h-11 shrink-0 items-center border-b border-border/50 bg-background/80 px-4">
              <span className="text-xs font-semibold capitalize">{view === "decks" ? "All decks" : view}</span>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-gutter:stable]">
              {/* max-width keeps content from stretching when the nav/Sero are collapsed */}
              <div className="mx-auto w-full max-w-xl">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={view}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {view === "overview" && <OverviewMock />}
                    {view === "decks" && <DecksMock />}
                    {view === "browse" && <BrowseMock />}
                    {view === "shared" && <SharedMock />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </div>

          {/* ── Sero docked panel (slides in over the reserved padding) ── */}
          <AnimatePresence>
            {sero === "docked" && (
              <motion.aside
                key="docked"
                initial={{ x: reduce ? 0 : dockWidth }}
                animate={{ x: 0 }}
                exit={{ x: dockWidth }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                style={{ width: dockWidth }}
                className="absolute inset-y-0 right-0 z-20 flex flex-col border-l border-border/50 bg-card/95 backdrop-blur-xl"
              >
                <div
                  onPointerDown={onResizeDown}
                  onPointerMove={onResizeMove}
                  onPointerUp={onResizeUp}
                  className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize bg-transparent hover:bg-primary/30"
                />
                <SeroPanel onMinimize={() => interactive && setSero("bubble")} onUndock={() => interactive && setSero("window")} docked />
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* ── Sero floating window ─────────────── */}
        <AnimatePresence>
          {sero === "window" && win && (
            <motion.div
              ref={windowRef}
              key="window"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              style={{ left: win.x, top: win.y, width: win.w, height: win.h, transformOrigin: "bottom right" }}
              className="absolute z-30 flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl"
            >
              <SeroPanel
                onMinimize={() => interactive && setSero("bubble")}
                onUndock={() => interactive && setSero("docked")}
                onHeaderPointerDown={onWinDown}
                onHeaderPointerMove={onWinMove}
                onHeaderPointerUp={onWinUp}
              />
              {/* resize handles — edges + corners (Windows-style) */}
              {interactive && (
                <>
                  <div onPointerDown={onWinResizeDown("n")} onPointerMove={onWinResizeMove} onPointerUp={onWinResizeUp} className="absolute inset-x-2 top-0 h-1.5 cursor-ns-resize" />
                  <div onPointerDown={onWinResizeDown("s")} onPointerMove={onWinResizeMove} onPointerUp={onWinResizeUp} className="absolute inset-x-2 bottom-0 h-1.5 cursor-ns-resize" />
                  <div onPointerDown={onWinResizeDown("w")} onPointerMove={onWinResizeMove} onPointerUp={onWinResizeUp} className="absolute inset-y-2 left-0 w-1.5 cursor-ew-resize" />
                  <div onPointerDown={onWinResizeDown("e")} onPointerMove={onWinResizeMove} onPointerUp={onWinResizeUp} className="absolute inset-y-2 right-0 w-1.5 cursor-ew-resize" />
                  <div onPointerDown={onWinResizeDown("nw")} onPointerMove={onWinResizeMove} onPointerUp={onWinResizeUp} className="absolute left-0 top-0 h-3 w-3 cursor-nwse-resize" />
                  <div onPointerDown={onWinResizeDown("ne")} onPointerMove={onWinResizeMove} onPointerUp={onWinResizeUp} className="absolute right-0 top-0 h-3 w-3 cursor-nesw-resize" />
                  <div onPointerDown={onWinResizeDown("sw")} onPointerMove={onWinResizeMove} onPointerUp={onWinResizeUp} className="absolute bottom-0 left-0 h-3 w-3 cursor-nesw-resize" />
                  <div onPointerDown={onWinResizeDown("se")} onPointerMove={onWinResizeMove} onPointerUp={onWinResizeUp} className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize" />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Sero bubble ───────────────────────── */}
        <AnimatePresence>
          {sero === "bubble" && (
            <motion.button
              ref={bubbleRef}
              key="bubble"
              type="button"
              onClick={() => interactive && setSero("window")}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="absolute bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30"
              aria-label="Open Sero"
            >
              <Sparkles className="h-5 w-5" />
              <AnimatePresence>
                {notif && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.3 }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white ring-2 ring-card"
                  >
                    1
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Intro: block interaction + fake cursor ── */}
        {!interactive && <div className="absolute inset-0 z-40" aria-hidden />}
        {!reduce && started && (
          <motion.div
            className="pointer-events-none absolute left-0 top-0 z-50"
            initial={false}
            animate={{ x: cursorPos.x - 7, y: cursorPos.y - 5, opacity: cursorPos.opacity }}
            transition={{ duration: 0.85, ease: [0.45, 0, 0.2, 1] }}
          >
            {/* click ripple on the click phases */}
            <AnimatePresence>
              {(phase === 2 || phase === 4) && (
                <motion.span
                  key={`ripple-${phase}`}
                  className="absolute left-0 top-0 -ml-3 -mt-3 h-9 w-9 rounded-full bg-primary/40"
                  initial={{ scale: 0, opacity: 0.7 }}
                  animate={{ scale: 2.4, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
            <motion.div
              animate={phase === 2 || phase === 4 ? { scale: [1, 0.82, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
            >
              <MousePointer2 className="h-9 w-9 fill-foreground text-background drop-shadow-lg" strokeWidth={1.5} />
            </motion.div>
          </motion.div>
        )}
      </div>

      <div aria-hidden className="absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-2xl bg-primary/10" />
    </motion.div>
  );
}

/* ── Sero panel content (shared by window + docked) ── */
function SeroPanel({
  onMinimize,
  onUndock,
  docked,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
}: {
  onMinimize: () => void;
  onUndock: () => void;
  docked?: boolean;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
  onHeaderPointerMove?: (e: React.PointerEvent) => void;
  onHeaderPointerUp?: (e: React.PointerEvent) => void;
}) {
  const [reply, setReply] = useState<string | null>(null);
  return (
    <>
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        className={cn("flex h-11 shrink-0 items-center gap-2 border-b border-border/50 px-3", !docked && "cursor-grab active:cursor-grabbing")}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-semibold">Sero</span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onUndock} aria-label={docked ? "Float" : "Dock right"} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
            {docked ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={onMinimize} aria-label="Minimize" className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-gutter:stable]">
        <div className="rounded-xl rounded-tl-sm bg-accent/60 p-2.5 text-[11px] leading-relaxed text-foreground">
          Hey uski! You've got <span className="font-semibold text-primary">{remaining}</span> cards left today —
          you've got this. Want me to explain something from your due cards?
        </div>
        {reply && (
          <motion.div
            key={reply}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-2 rounded-xl rounded-tl-sm bg-accent/60 p-2.5 text-[11px] leading-relaxed text-foreground"
          >
            {reply}
          </motion.div>
        )}
        <div className="mt-3 space-y-1.5">
          {DEMO_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setReply(DEMO_REPLIES[s] ?? null)}
              className="w-full rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border/50 p-2.5">
        <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-2.5 py-1.5">
          <span className="flex-1 text-[11px] text-muted-foreground/70">Ask Sero…</span>
          <Send className="h-3.5 w-3.5 text-muted-foreground/70" />
        </div>
      </div>
    </>
  );
}

/* ── Overview ── */
function OverviewMock() {
  const [showAll, setShowAll] = useState(false);
  const primary = dueDecks.slice(0, 2);
  const extra = dueDecks.slice(2);

  const Card = (deck: DemoDeck) => (
    <div key={deck.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-2.5">
      <DeckBadge icon={deck.icon} color={deck.color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{deck.name}</p>
        <StateCounts nw={deck.nw} ln={deck.ln} du={deck.du} className="mt-0.5" />
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
        <Play className="h-3 w-3 fill-current" /> Study
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today's review</p>
        <h3 className="mt-1 text-lg font-bold tracking-tight">
          <span className="font-mono tabular-nums text-primary">{remaining}</span> cards to review
        </h3>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "New", count: AGG.nw, color: "text-state-new", bg: "bg-state-new/10", ring: "ring-state-new/25" },
            { label: "Review", count: AGG.ln, color: "text-state-learn", bg: "bg-state-learn/10", ring: "ring-state-learn/25" },
            { label: "Due", count: AGG.du, color: "text-state-due", bg: "bg-state-due/10", ring: "ring-state-due/25" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-xl p-2.5 text-center ring-1 ring-inset", s.bg, s.ring)}>
              <div className={cn("font-mono text-lg font-bold tabular-nums", s.color)}>{s.count}</div>
              <div className="text-[10px] font-medium text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span><span className="font-mono tabular-nums text-foreground">{DEMO_DONE}</span> of <span className="font-mono tabular-nums text-foreground">{startTotal}</span> done</span>
            <span className="font-mono tabular-nums text-foreground">{pct}%</span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold">
          <Play className="h-3.5 w-3.5 fill-current text-primary" /> Today's decks
          <span className="rounded-full bg-primary/15 px-1.5 font-mono text-[10px] tabular-nums text-primary">{dueDecks.length}</span>
        </h4>
        <div className="space-y-1.5">{primary.map(Card)}</div>
        <AnimatePresence initial={false}>
          {showAll && extra.length > 0 && (
            <motion.div
              key="extra"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5 pt-1.5">{extra.map(Card)}</div>
            </motion.div>
          )}
        </AnimatePresence>
        {extra.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mx-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            {showAll ? "Show less" : `See all decks (${dueDecks.length})`}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
          </button>
        )}
      </section>
    </div>
  );
}

/* ── Decks ── */
function DecksMock() {
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const science = DEMO_DECKS.filter((d) => d.group === "Science");
  const loose = DEMO_DECKS.filter((d) => d.group === null);

  const Grid = ({ decks }: { decks: readonly DemoDeck[] }) => (
    <div className="grid grid-cols-2 gap-1.5">
      {decks.map((deck) => (
        <div key={deck.id} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 p-2.5">
          <DeckBadge icon={deck.icon} color={deck.color} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold">{deck.name}</p>
            <span className="text-[10px] text-muted-foreground">{deck.total} cards</span>
          </div>
          <StateCounts nw={deck.nw} ln={deck.ln} du={deck.du} />
        </div>
      ))}
    </div>
  );

  const ListRows = ({ decks }: { decks: readonly DemoDeck[] }) => (
    <div className="divide-y divide-border/40 overflow-hidden rounded-lg border border-border/60">
      {decks.map((deck) => (
        <div key={deck.id} className="grid grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-2 px-2.5 py-1.5">
          <span className="min-w-0 truncate text-[11px] font-medium">{deck.name}</span>
          <span className="text-center text-[10px] tabular-nums text-muted-foreground">{deck.total} cards</span>
          <StateCounts nw={deck.nw} ln={deck.ln} du={deck.du} className="justify-self-end" />
        </div>
      ))}
    </div>
  );

  const Section = layout === "grid" ? Grid : ListRows;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" /> All decks
          <span className="rounded-full bg-primary/15 px-1.5 font-mono text-[10px] tabular-nums text-primary">{DEMO_DECKS.length}</span>
        </h4>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Folder className="h-3 w-3" /> New folder
          </span>
          <div className="flex items-center rounded-md border border-border/60 p-0.5">
            <button type="button" onClick={() => setLayout("grid")} aria-label="Grid view"
              className={cn("flex h-5 w-5 items-center justify-center rounded transition-colors", layout === "grid" ? "bg-accent text-foreground" : "text-muted-foreground")}>
              <LayoutGrid className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => setLayout("list")} aria-label="List view"
              className={cn("flex h-5 w-5 items-center justify-center rounded transition-colors", layout === "list" ? "bg-accent text-foreground" : "text-muted-foreground")}>
              <List className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
        <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold text-muted-foreground">
          <Folder className="h-3.5 w-3.5" /> Science
          <span className="rounded-full bg-primary/15 px-1.5 font-mono text-[10px] tabular-nums text-primary">{science.length}</span>
        </div>
        <Section decks={science} />
      </div>

      <div className="space-y-1.5">
        <div className="px-0.5 text-[11px] font-semibold text-muted-foreground">Ungrouped</div>
        <Section decks={loose} />
      </div>
    </div>
  );
}

/* ── Browse — deck badge colored by the deck's color ── */
function BrowseMock() {
  const cards = [
    { deck: "Biology · Grade 10", front: "What is photosynthesis?", back: "Light → sugar + O₂" },
    { deck: "History · WWII", front: "When did WWII begin?", back: "1939" },
    { deck: "English Vocabulary", front: "ubiquitous", back: "present everywhere" },
    { deck: "Chemistry · Bonds", front: "What is an ionic bond?", back: "Electron transfer" },
    { deck: "Geography · Capitals", front: "Capital of Japan?", back: "Tokyo" },
  ];
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold">
        All cards
        <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 font-mono text-[10px] tabular-nums text-primary">{cards.length}</span>
      </h4>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <div className="flex h-8 items-center rounded-lg border border-input bg-background/60 pl-8 pr-2 text-[11px] text-muted-foreground/70">
          Search all cards…
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="grid grid-cols-3 gap-2 border-b border-border/60 bg-muted/40 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Deck</span><span>Front</span><span>Back</span>
        </div>
        <div className="divide-y divide-border/40">
          {cards.map((c) => {
            const dc = deckColorFor(COLOR_BY_NAME[c.deck]);
            return (
              <div key={c.front} className="grid grid-cols-3 items-center gap-2 px-2.5 py-1.5">
                <span className={cn("truncate justify-self-start rounded px-1.5 py-0.5 text-[10px] font-medium", dc.bg, dc.text)}>{c.deck}</span>
                <span className="min-w-0 truncate text-[11px]">{c.front}</span>
                <span className="min-w-0 truncate text-[11px] text-muted-foreground">{c.back}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Shared ── */
function SharedMock() {
  const withYou = [
    { name: "Spanish A2 · Verbs", icon: "languages", color: "rose", from: "maria#0420", perm: "view" },
    { name: "Physics · Mechanics", icon: "atom", color: "cyan", from: "leon#1337", perm: "edit" },
  ];
  const withOthers = [{ name: "Biology · Grade 10", to: "anna#0007", perm: "view" }];
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold">
          <Users className="h-3.5 w-3.5 text-muted-foreground" /> Shared with you
          <span className="rounded-full bg-primary/15 px-1.5 font-mono text-[10px] tabular-nums text-primary">{withYou.length}</span>
        </h4>
        <div className="space-y-1.5">
          {withYou.map((d) => (
            <div key={d.name} className="group relative flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 p-2.5">
              <X className="absolute right-2 top-2 h-3 w-3 text-muted-foreground/50" />
              <DeckBadge icon={d.icon} color={d.color} size="sm" />
              <div className="min-w-0 flex-1 pr-4">
                <p className="truncate text-[11px] font-semibold">{d.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">from {d.from} · {d.perm}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold">
          <Users className="h-3.5 w-3.5 text-muted-foreground" /> Shared with others
          <span className="rounded-full bg-primary/15 px-1.5 font-mono text-[10px] tabular-nums text-primary">{withOthers.length}</span>
        </h4>
        <div className="space-y-1.5">
          {withOthers.map((d) => (
            <div key={d.name} className="group relative flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 p-2.5">
              <X className="absolute right-2 top-2 h-3 w-3 text-muted-foreground/50" />
              <DeckBadge icon="leaf" color="emerald" size="sm" />
              <div className="min-w-0 flex-1 pr-4">
                <p className="truncate text-[11px] font-semibold">{d.name}</p>
                <p className="truncate text-[10px] text-muted-foreground"><span className="font-mono">{d.to}</span> · {d.perm}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
