import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Menu, Plus, Layers, Users, Loader2, FolderPlus, Folder, Play, Download, Search, Image as ImageIcon, LayoutGrid, List, X as XIcon, Trash2, ChevronDown, ArrowLeftRight, Bell } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sidebar, type DashboardView } from "@/components/dashboard/Sidebar";
import { AssistantBubble } from "@/components/dashboard/assistant/AssistantBubble";
import { OnboardingStep } from "@/components/auth/OnboardingStep";
import { NewDeckDialog } from "@/components/decks/NewDeckDialog";
import { ImportDialog } from "@/components/decks/ImportDialog";
import { DeckBadge } from "@/lib/deck-icons";
import { StateCounts } from "@/lib/state-counts";
import {
  listDecks, listSharedDecks, listGroups, createGroup, reviewStats,
  listNotifications, markNotificationsSeen, getDeckAccess, browseCards,
  outgoingShares, leaveSharedDeck, revokeShare, redeemInvite, ApiError,
  type Deck, type DeckGroup, type DeckAccess, type BrowseCard, type ReviewStats, type OutgoingShare, type Notification,
} from "@/lib/api";

export default function DashboardPage() {
  const { needsUsername, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reduce = useReducedMotion();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [assistantReserved, setAssistantReserved] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const redeemedRef = useRef<Set<string>>(new Set());

  const [view, setView] = useState<DashboardView>(() => {
    try { return (sessionStorage.getItem("uski.view") as DashboardView) || "overview"; }
    catch { return "overview"; }
  });
  // Remember the active view so returning from a deck lands back here (R: back nav).
  useEffect(() => { try { sessionStorage.setItem("uski.view", view); } catch { /* ignore */ } }, [view]);
  const search = "";

  const [decks, setDecks] = useState<Deck[]>([]);
  const [shared, setShared] = useState<Deck[]>([]);
  const [sharedAccess, setSharedAccess] = useState<Record<string, DeckAccess>>({});
  const [groups, setGroups] = useState<DeckGroup[]>([]);
  const [dueMap, setDueMap] = useState<Record<string, number>>({});
  const [statsMap, setStatsMap] = useState<Record<string, ReviewStats>>({});
  const [loading, setLoading] = useState(true);

  const [newDeckGroup, setNewDeckGroup] = useState<string | null | undefined>(undefined);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [browseList, setBrowseList] = useState<BrowseCard[] | null>(null);
  const [deckView, setDeckView] = useState<"grid" | "list">("grid");
  const [outgoing, setOutgoing] = useState<OutgoingShare[]>([]);
  // Pending destructive share action awaiting confirmation (one-time & final).
  const [confirm, setConfirm] = useState<
    | { kind: "leave"; deckId: string; title: string }
    | { kind: "revoke"; deckId: string; granteeId: string; title: string; grantee: string }
    | null
  >(null);

  // Load all cards when entering Browse (lazy).
  useEffect(() => {
    if (view === "browse" && browseList === null) {
      browseCards().then(setBrowseList).catch(() => setBrowseList([]));
    }
  }, [view, browseList]);

  const refresh = useCallback(async () => {
    try {
      const [d, s, g] = await Promise.all([listDecks(), listSharedDecks(), listGroups()]);
      setDecks(d); setShared(s); setGroups(g);
      outgoingShares().then(setOutgoing).catch(() => setOutgoing([]));
      // Access info (from whom / which permission) for the Shared view.
      Promise.all(s.map(async (deck) => [deck.id, await getDeckAccess(deck.id).catch(() => null)] as const))
        .then((entries) => setSharedAccess(Object.fromEntries(entries.filter((e) => e[1]) as [string, DeckAccess][])))
        .catch(() => {});
      const stats = await Promise.all(
        d.map(async (deck) => [deck.id, await reviewStats(deck.id).catch(() => null)] as const),
      );
      const sm: Record<string, ReviewStats> = {};
      const dm: Record<string, number> = {};
      for (const [id, s] of stats) {
        if (s) { sm[id] = s; dm[id] = s.new + s.learning + s.due; }
        else dm[id] = 0;
      }
      setStatsMap(sm); setDueMap(dm);
    } catch {
      /* session expiry handled in api layer */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { refreshUser(); }, [refreshUser]);
  useEffect(() => { if (needsUsername) setShowUsernameDialog(true); }, [needsUsername]);

  // Redeem a deck-invite link (?invite=CODE) once on load, then strip the param.
  useEffect(() => {
    const code = searchParams.get("invite");
    if (!code || redeemedRef.current.has(code)) return;
    redeemedRef.current.add(code); // guard against StrictMode double-invoke
    setSearchParams((p) => { p.delete("invite"); return p; }, { replace: true });
    redeemInvite(code)
      .then(() => { toast.success("Deck added to your shared decks"); refresh(); })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "This invite link is invalid or already used."));
  }, [searchParams, setSearchParams, refresh]);

  useEffect(() => {
    const load = () => listNotifications().then(setNotifications).catch(() => {});
    load();
    // Interim live updates until Supabase Realtime is wired (poll every 25s).
    const t = setInterval(load, 25000);
    return () => clearInterval(t);
  }, []);

  const dueTotal = useMemo(() => Object.values(dueMap).reduce((a, b) => a + b, 0), [dueMap]);
  const dueDecks = useMemo(() => decks.filter((d) => (dueMap[d.id] ?? 0) > 0), [decks, dueMap]);
  const totals = useMemo(() => {
    let nw = 0, ln = 0, du = 0, dn = 0;
    for (const s of Object.values(statsMap)) { nw += s.new; ln += s.learning; du += s.due; dn += s.done; }
    return { new: nw, learning: ln, due: du, done: dn };
  }, [statsMap]);

  const dueContext = useMemo(() => {
    const list = dueDecks.map((d) => `${d.title} (${dueMap[d.id]})`).slice(0, 4).join(", ");
    return dueTotal ? `${dueTotal} cards due in: ${list}` : "";
  }, [dueDecks, dueMap, dueTotal]);

  const q = search.trim().toLowerCase();
  const matches = (s: string) => !q || s.toLowerCase().includes(q);

  async function addFolder() {
    const name = folderName.trim();
    if (!name) { setCreatingFolder(false); return; }
    try {
      const g = await createGroup({ name });
      setGroups((gs) => [...gs, g]);
    } finally {
      setFolderName(""); setCreatingFolder(false);
    }
  }

  const ungrouped = decks.filter((d) => !d.group_id);
  const title = view === "overview" ? "Overview" : view === "decks" ? "All decks" : view === "browse" ? "Browse" : "Shared";

  async function runConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === "leave") {
        await leaveSharedDeck(confirm.deckId);
        setShared((xs) => xs.filter((x) => x.id !== confirm.deckId));
        toast.success("Removed from your shared decks");
      } else {
        await revokeShare(confirm.deckId, confirm.granteeId);
        setOutgoing((xs) => xs.filter((x) => !(x.deck_id === confirm.deckId && x.grantee_id === confirm.granteeId)));
        toast.success("Access revoked");
      }
    } catch {
      toast.error("Could not complete that. Try again.");
    } finally {
      setConfirm(null);
    }
  }

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <Sidebar
        collapsed={navCollapsed}
        onToggleCollapse={() => setNavCollapsed((v) => !v)}
        onOpenSettings={() => navigate("/settings")}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        view={view}
        onSelectView={(v) => { setView(v); setMobileNavOpen(false); }}
      />

      <div
        className="flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-out lg:[padding-right:var(--assistant-reserved,0px)]"
        style={{ ["--assistant-reserved" as string]: `${assistantReserved}px` }}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-sm font-semibold">{title}</h1>
          {view === "decks" && (
            <>
              <div className="mr-1 hidden items-center rounded-lg border border-border/60 p-0.5 sm:flex" role="group" aria-label="Deck layout">
                <button
                  type="button"
                  onClick={() => setDeckView("grid")}
                  aria-label="Grid view"
                  aria-pressed={deckView === "grid"}
                  className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    deckView === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeckView("list")}
                  aria-label="List view"
                  aria-pressed={deckView === "list"}
                  className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    deckView === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => setImportOpen(true)}>
                <Download className="h-4 w-4" /> <span className="hidden sm:inline">Import</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => setCreatingFolder(true)}>
                <FolderPlus className="h-4 w-4" /> <span className="hidden sm:inline">New folder</span>
              </Button>
              <Button size="sm" className="gap-1.5 rounded-lg font-semibold" onClick={() => setNewDeckGroup(null)}>
                <Plus className="h-4 w-4" /> New deck
              </Button>
            </>
          )}
          <NotificationBell
            notifications={notifications}
            onOpen={() => {
              const unseen = notifications.filter((n) => !n.seen).map((n) => n.id);
              if (unseen.length) {
                markNotificationsSeen(unseen).catch(() => {});
                setNotifications((ns) => ns.map((n) => ({ ...n, seen: true })));
              }
            }}
          />
        </header>

        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-4xl space-y-8 p-4 md:p-8">
            {loading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-8"
                >
                  {view === "overview" && (
                    <OverviewPanel
                      dueTotal={dueTotal}
                      totals={totals}
                      dueDecks={dueDecks}
                      statsMap={statsMap}
                      onOpenDeck={(id) => navigate(`/decks/${id}`)}
                      onStudy={(id) => navigate(`/decks/${id}?study=1`)}
                      onBrowseDecks={() => setView("decks")}
                    />
                  )}

                  {view === "decks" && (
                    <>
                      {creatingFolder && (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") addFolder(); if (e.key === "Escape") setCreatingFolder(false); }}
                            placeholder="Folder name"
                            className="h-10 flex-1 rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
                          />
                          <Button onClick={addFolder} className="h-10 rounded-xl">Add</Button>
                          <Button variant="ghost" onClick={() => setCreatingFolder(false)} className="h-10">Cancel</Button>
                        </div>
                      )}

                      {groups.map((g) => {
                        const inGroup = decks.filter((d) => d.group_id === g.id && matches(d.title));
                        if (q && inGroup.length === 0 && !matches(g.name)) return null;
                        return (
                          <DeckGrid
                            key={g.id}
                            title={g.name}
                            icon={<Folder className="h-4 w-4 text-muted-foreground" />}
                            decks={inGroup}
                            statsMap={statsMap}
                            view={deckView}
                            onOpen={(id) => navigate(`/decks/${id}`)}
                            empty="Empty folder."
                            onCreate={() => setNewDeckGroup(g.id)}
                          />
                        );
                      })}

                      <DeckGrid
                        title={groups.length ? "Ungrouped" : "All decks"}
                        decks={ungrouped.filter((d) => matches(d.title))}
                        statsMap={statsMap}
                        view={deckView}
                        onOpen={(id) => navigate(`/decks/${id}`)}
                        empty={q ? "No decks match your search." : "No decks yet. Create your first one."}
                        onCreate={() => setNewDeckGroup(null)}
                      />
                    </>
                  )}

                  {view === "browse" && (
                    <BrowsePanel
                      cards={browseList}
                      onOpen={(id) => navigate(`/decks/${id}`)}
                    />
                  )}

                  {view === "shared" && (
                    <SharedPanel
                      incoming={shared.filter((d) => matches(d.title))}
                      access={sharedAccess}
                      outgoing={outgoing.filter((o) => matches(o.deck_title))}
                      onOpen={(id) => navigate(`/decks/${id}`)}
                      onLeave={(d) => setConfirm({ kind: "leave", deckId: d.id, title: d.title })}
                      onRevoke={(o) => setConfirm({ kind: "revoke", deckId: o.deck_id, granteeId: o.grantee_id, title: o.deck_title, grantee: o.grantee ?? "this user" })}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      <AssistantBubble dueContext={dueContext} onReservedWidthChange={setAssistantReserved} />
      <OnboardingStep open={showUsernameDialog} onOpenChange={setShowUsernameDialog} />
      <NewDeckDialog
        open={newDeckGroup !== undefined}
        onOpenChange={(o) => { if (!o) setNewDeckGroup(undefined); }}
        groupId={newDeckGroup ?? null}
        onCreated={(d) => { setNewDeckGroup(undefined); navigate(`/decks/${d.id}`); }}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(r) => { toast.success(`Imported ${r.imported} cards into "${r.title}"`); refresh(); setBrowseList(null); navigate(`/decks/${r.deck_id}`); }}
      />

      {/* One-time, final share action confirmation (leave / revoke). */}
      <Dialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.kind === "leave" ? "Remove shared deck?" : "Revoke access?"}</DialogTitle>
            <DialogDescription>
              {confirm?.kind === "leave"
                ? `"${confirm?.title}" will be removed from your shared decks. This is final — you'd need a new invite to get it back.`
                : `${confirm && confirm.kind === "revoke" ? confirm.grantee : ""} will lose access to "${confirm?.title}". This is final — you'd have to share it again.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="gap-1.5" onClick={runConfirm}>
              <Trash2 className="h-4 w-4" /> {confirm?.kind === "leave" ? "Remove" : "Revoke"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverviewPanel({
  dueTotal, totals, dueDecks, statsMap, onOpenDeck, onStudy, onBrowseDecks,
}: {
  dueTotal: number;
  totals: { new: number; learning: number; due: number; done: number };
  dueDecks: Deck[];
  statsMap: Record<string, ReviewStats>;
  onOpenDeck: (id: string) => void;
  onStudy: (id: string) => void;
  onBrowseDecks: () => void;
}) {
  const done = totals.done;
  const toGo = dueTotal;                 // cards still ready right now
  const startTotal = done + toGo;        // frozen day total (done + remaining)
  const pct = startTotal > 0 ? Math.round((done / startTotal) * 100) : 0;

  const reduce = useReducedMotion();
  const [celebrate, setCelebrate] = useState(false);
  const prevPct = useRef(pct);
  // Confetti when the day's pile is fully cleared (>0 cards → all done).
  useEffect(() => {
    if (startTotal > 0 && pct === 100) {
      const key = `uski.celebrated.${new Date().toISOString().slice(0, 10)}`;
      const justFinished = prevPct.current < 100;
      let already = false;
      try { already = sessionStorage.getItem(key) === "1"; } catch { /* ignore */ }
      if (justFinished || !already) {
        try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
        setCelebrate(true);
        const t = setTimeout(() => setCelebrate(false), 3200);
        prevPct.current = pct;
        return () => clearTimeout(t);
      }
    }
    prevPct.current = pct;
  }, [pct, startTotal]);

  const [showAll, setShowAll] = useState(false);
  const LIMIT = 4;
  const primary = dueDecks.slice(0, LIMIT);
  const extra = dueDecks.slice(LIMIT);

  const renderCard = (d: Deck) => {
    const s = statsMap[d.id];
    return (
      <div key={d.id} className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
        <button onClick={() => onOpenDeck(d.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <DeckBadge icon={d.icon} color={d.color} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{d.title}</p>
            <StateCounts nw={s?.new ?? 0} ln={s?.learning ?? 0} du={s?.due ?? 0} className="mt-0.5" />
          </div>
        </button>
        <Button size="sm" className="shrink-0 gap-1.5 rounded-lg" onClick={() => onStudy(d.id)}>
          <Play className="h-3.5 w-3.5 fill-current" /> Study
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {celebrate && !reduce && <Confetti />}
      <section className="rounded-2xl border border-border/60 bg-card/60 p-6">
        <p className="label-mono">Today's review</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {toGo > 0 ? (
            <>
              <span className="font-mono tabular-nums text-primary">{toGo}</span> cards to review
            </>
          ) : startTotal > 0 ? (
            "You're all caught up for today."
          ) : (
            "Nothing scheduled right now."
          )}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {toGo > 0 ? "Pick a deck below to keep going." : "Come back tomorrow for your next batch."}
        </p>

        {/* Aggregate breakdown — three labeled boxes (New / Review / Due), above the bar. */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "New", count: totals.new, color: "text-state-new", bg: "bg-state-new/10", ring: "ring-state-new/25" },
            { label: "Review", count: totals.learning, color: "text-state-learn", bg: "bg-state-learn/10", ring: "ring-state-learn/25" },
            { label: "Due", count: totals.due, color: "text-state-due", bg: "bg-state-due/10", ring: "ring-state-due/25" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-2xl p-4 text-center ring-1 ring-inset", s.bg, s.ring)}>
              <div className={cn("font-mono text-2xl font-bold tabular-nums", s.color)}>{s.count}</div>
              <div className="mt-0.5 text-xs font-medium text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress: done out of the frozen day total. */}
        <div className="mt-5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Today's review progress">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span><span className="font-mono tabular-nums text-foreground">{done}</span> of <span className="font-mono tabular-nums text-foreground">{startTotal}</span> done</span>
            <span className="font-mono tabular-nums text-foreground">{pct}%</span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Play className="h-4 w-4 fill-current text-primary" /> Today's decks
          <span className="label-mono">{dueDecks.length}</span>
        </h3>
        {dueDecks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <p className="text-sm text-muted-foreground">Nothing scheduled. Browse <button onClick={onBrowseDecks} className="text-primary underline-offset-2 hover:underline">all decks</button>.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {primary.map(renderCard)}
            </div>
            <AnimatePresence initial={false}>
              {showAll && extra.length > 0 && (
                <motion.div
                  key="extra-decks"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                    {extra.map(renderCard)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {extra.length > 0 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {showAll ? "Show less" : `See all decks (${dueDecks.length})`}
                <ChevronDown className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")} />
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function DeckGrid({
  title, decks, onOpen, empty, onCreate, icon, statsMap, view = "grid",
}: {
  title: string;
  decks: Deck[];
  onOpen: (id: string) => void;
  empty?: string;
  onCreate?: () => void;
  icon?: React.ReactNode;
  statsMap: Record<string, ReviewStats>;
  view?: "grid" | "list";
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          {icon ?? <Layers className="h-4 w-4 text-muted-foreground" />}
          {title}
          <span className="label-mono">{decks.length}</span>
        </h3>
        {onCreate && (
          <Button size="sm" variant="ghost" className="gap-1.5 rounded-lg" onClick={onCreate}>
            <Plus className="h-4 w-4" /> Deck
          </Button>
        )}
      </div>
      {decks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">{empty}</p>
        </div>
      ) : view === "list" ? (
        // List: title left (truncates with …), card count centered, due colors right.
        <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60">
          {decks.map((d) => {
            const s = statsMap[d.id];
            return (
              <button
                key={d.id}
                onClick={() => onOpen(d.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/50 sm:grid-cols-[minmax(0,1fr)_6rem_auto]"
              >
                <span className="min-w-0 truncate text-sm font-medium">{d.title}</span>
                <span className="hidden text-center text-xs tabular-nums text-muted-foreground sm:block">{(s?.total ?? 0)} cards</span>
                <StateCounts nw={s?.new ?? 0} ln={s?.learning ?? 0} du={s?.due ?? 0} className="justify-self-end" />
              </button>
            );
          })}
        </div>
      ) : (
        // Grid: colored pictogram, title, due-color breakdown.
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {decks.map((d) => {
            const s = statsMap[d.id];
            return (
              <button
                key={d.id}
                onClick={() => onOpen(d.id)}
                className="group relative flex items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-primary/5"
              >
                <DeckBadge icon={d.icon} color={d.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.title}</p>
                  {d.description
                    ? <p className="truncate text-xs text-muted-foreground">{d.description}</p>
                    : <span className="text-xs text-muted-foreground tabular-nums">{s?.total ?? 0} cards</span>}
                </div>
                <StateCounts nw={s?.new ?? 0} ln={s?.learning ?? 0} du={s?.due ?? 0} className="shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SharedPanel({
  incoming, access, outgoing, onOpen, onLeave, onRevoke,
}: {
  incoming: Deck[];
  access: Record<string, DeckAccess>;
  outgoing: OutgoingShare[];
  onOpen: (id: string) => void;
  onLeave: (deck: Deck) => void;
  onRevoke: (share: OutgoingShare) => void;
}) {
  return (
    <div className="space-y-8">
      {/* ── Shared with you — decks others granted you (remove = leave, final) ── */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" /> Shared with you
          <span className="label-mono">{incoming.length}</span>
        </h3>
        {incoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <p className="text-sm text-muted-foreground">No decks shared with you yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {incoming.map((d) => {
              const a = access[d.id];
              return (
                <div key={d.id} className="group relative flex items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4">
                  {/* Hover red X (top-right) → confirm → remove my access (one-time). */}
                  <button
                    onClick={() => onLeave(d)}
                    aria-label={`Remove "${d.title}" from shared with you`}
                    title="Remove from your shared decks"
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => onOpen(d.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                    <DeckBadge icon={d.icon} color={d.color} />
                    <div className="min-w-0 flex-1 pr-6">
                      <p className="truncate text-sm font-semibold">{d.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a ? `from ${a.owner ?? "?"} · ${a.permission}` : "shared deck"}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Shared by you — your decks granted to others (revoke = final) ── */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" /> Shared with others
          <span className="label-mono">{outgoing.length}</span>
        </h3>
        {outgoing.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <p className="text-sm text-muted-foreground">You haven't shared any decks yet. Open a deck to invite someone.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {outgoing.map((o) => (
              <div key={`${o.deck_id}:${o.grantee_id}`} className="group relative flex items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4">
                <button
                  onClick={() => onRevoke(o)}
                  aria-label={`Revoke access of ${o.grantee ?? "user"} to "${o.deck_title}"`}
                  title="Revoke access"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <XIcon className="h-4 w-4" />
                </button>
                <button onClick={() => onOpen(o.deck_id)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 pr-6">
                    <p className="truncate text-sm font-semibold">{o.deck_title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{o.grantee ?? "?"}</span> · {o.permission}
                    </p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BrowsePanel({
  cards, onOpen,
}: {
  cards: BrowseCard[] | null;
  onOpen: (deckId: string) => void;
}) {
  const [query, setQuery] = useState("");

  if (cards === null) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  // Plain-text preview keeps the browse list dense and reliably single-line
  // (rich HTML is rendered in full on the deck page). DOMParser decodes entities.
  const plain = (html: string) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  };

  const q = query.trim().toLowerCase();
  // Collapse linked siblings (bidirectional notes) so each note appears once.
  const noteSeen = new Set<string>();
  const noteCounts = new Map<string, number>();
  for (const c of cards) if (c.note_id) noteCounts.set(c.note_id, (noteCounts.get(c.note_id) ?? 0) + 1);
  const rows = cards
    .filter((c) => {
      if (!c.note_id) return true;
      if (c.card_type === "reverse") return false; // represented by its basic sibling
      if (noteSeen.has(c.note_id)) return false;
      noteSeen.add(c.note_id);
      return true;
    })
    .map((c) => ({
      card: c,
      front: plain(c.front_html),
      back: plain(c.back_html),
      hasImg: /<img/i.test(c.front_html) || /<img/i.test(c.back_html),
      bidir: Boolean(c.note_id) && (noteCounts.get(c.note_id!) ?? 0) > 1,
    }))
    .filter((r) =>
      !q || r.front.toLowerCase().includes(q) || r.back.toLowerCase().includes(q) ||
      r.card.deck_title.toLowerCase().includes(q) || (r.card.group_label ?? "").toLowerCase().includes(q),
    );

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        All cards <span className="label-mono">{rows.length}</span>
      </h3>

      {/* Search lives on the page (under the heading), not in the sidebar nav. */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all cards…"
          aria-label="Search all cards"
          className="h-11 w-full rounded-xl border border-input bg-background/60 pl-9 pr-3 text-sm outline-none transition-colors focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">{q ? "No cards match." : "No cards yet."}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60">
          {/* table header — same grid template as the rows so columns align */}
          <div className="grid grid-cols-3 items-center gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Deck</span>
            <span>Front</span>
            <span className="hidden sm:block">Back</span>
          </div>
          <div className="divide-y divide-border/40">
            {rows.map(({ card: c, front, back, hasImg, bidir }) => {
              return (
              <button
                key={c.id}
                onClick={() => onOpen(c.deck_id)}
                className="grid w-full grid-cols-3 items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/50"
                title={`${front} — ${back}`}
              >
                <span className="truncate justify-self-start rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {c.deck_title}
                </span>
                <span className="min-w-0 truncate text-sm">{front || "—"}</span>
                <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
                  <span className="min-w-0 truncate text-sm text-muted-foreground">{back || "—"}</span>
                  {bidir && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 text-[10px] font-medium text-primary" title="Studied both directions">
                      <ArrowLeftRight className="h-3 w-3" /> both
                    </span>
                  )}
                  {hasImg && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </span>
              </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

/** Celebratory confetti (no deps). Skipped under reduced motion. */
function Confetti() {
  const COLORS = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#e879f9", "#38bdf8"];
  const pieces = Array.from({ length: 70 });
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((_, i) => {
        const startX = 50 + (Math.random() * 60 - 30);   // burst from the upper-center
        const driftX = Math.random() * 44 - 22;           // sideways drift in vw
        const delay = Math.random() * 0.5;
        const dur = 2.2 + Math.random() * 1.6;
        const spin = Math.random() * 1080 - 540;
        const w = 7 + Math.random() * 8;
        const round = Math.random() > 0.55;               // mix rectangles + dots
        const color = COLORS[i % COLORS.length];
        return (
          <motion.span
            key={i}
            initial={{ top: "-8%", left: `${startX}vw`, opacity: 0, rotate: 0, scale: 0.6 }}
            animate={{
              top: "108%",
              left: `${startX + driftX}vw`,
              opacity: [0, 1, 1, 0.9, 0],
              rotate: spin,
              scale: 1,
            }}
            transition={{ duration: dur, delay, ease: [0.2, 0.6, 0.4, 1], times: [0, 0.08, 0.5, 0.85, 1] }}
            style={{
              position: "absolute",
              width: round ? w * 0.7 : w,
              height: round ? w * 0.7 : w * 0.42,
              background: color,
              borderRadius: round ? "9999px" : 2,
            }}
          />
        );
      })}
    </div>
  );
}

/** Header bell: unread count + dropdown of recent notifications (e.g. someone
 *  joined your shared deck). Marks them seen when opened. */
function NotificationBell({ notifications, onOpen }: { notifications: Notification[]; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.seen).length;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (next) onOpen(); }}
        aria-label={unread ? `${unread} new notifications` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl">
            <p className="label-mono px-3 pb-1 pt-2.5">Notifications</p>
            {notifications.length === 0 ? (
              <p className="px-3 pb-3 pt-1 text-sm text-muted-foreground">You're all caught up.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto pb-1.5">
                {notifications.map((n) => (
                  <li key={n.id} className="px-3 py-2 text-sm text-foreground/90">{n.message}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
