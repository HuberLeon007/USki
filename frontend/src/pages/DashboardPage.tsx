import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Menu, Plus, ChevronRight, Layers, Users, Loader2, FolderPlus, Folder } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SettingsDialog } from "@/components/dashboard/SettingsDialog";
import { AssistantBubble } from "@/components/dashboard/assistant/AssistantBubble";
import { OnboardingStep } from "@/components/auth/OnboardingStep";
import { NewDeckDialog } from "@/components/decks/NewDeckDialog";
import type { DeckLike } from "@/lib/due-decks";
import {
  listDecks, listSharedDecks, listGroups, createGroup, dueCards,
  listNotifications, markNotificationsSeen,
  type Deck, type DeckGroup,
} from "@/lib/api";

const PAST = new Date(Date.now() - 3600_000).toISOString();

export default function DashboardPage() {
  const { needsUsername } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);

  const [decks, setDecks] = useState<Deck[]>([]);
  const [shared, setShared] = useState<Deck[]>([]);
  const [groups, setGroups] = useState<DeckGroup[]>([]);
  const [dueMap, setDueMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [newDeckGroup, setNewDeckGroup] = useState<string | null | undefined>(undefined); // undefined=closed
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [d, s, g] = await Promise.all([listDecks(), listSharedDecks(), listGroups()]);
      setDecks(d); setShared(s); setGroups(g);
      const due = await Promise.all(
        d.map(async (deck) => [deck.id, (await dueCards(deck.id).catch(() => [])).length] as const),
      );
      setDueMap(Object.fromEntries(due));
    } catch {
      /* session expiry handled in api layer */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (needsUsername) setShowUsernameDialog(true); }, [needsUsername]);

  useEffect(() => {
    listNotifications()
      .then((ns) => {
        if (ns.length) {
          ns.forEach((n) => toast(n.message));
          markNotificationsSeen(ns.map((n) => n.id)).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Sidebar: Overview lists due decks (cards carry a PAST nextReview when due).
  const sidebarDecks: DeckLike[] = useMemo(
    () => decks.map((d) => ({
      id: d.id,
      name: d.title,
      cards: (dueMap[d.id] ?? 0) > 0 ? [{ nextReview: PAST }] : [],
    })),
    [decks, dueMap],
  );

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

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <Sidebar
        collapsed={navCollapsed}
        onToggleCollapse={() => setNavCollapsed((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        decks={sidebarDecks}
        onSelectDeck={(id) => { navigate(`/decks/${id}`); setMobileNavOpen(false); }}
        onCreateDeck={() => setNewDeckGroup(null)}
        onReview={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-sm font-semibold">Overview</h1>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => setCreatingFolder(true)}>
            <FolderPlus className="h-4 w-4" /> <span className="hidden sm:inline">New folder</span>
          </Button>
          <Button size="sm" className="gap-1.5 rounded-lg font-semibold" onClick={() => setNewDeckGroup(null)}>
            <Plus className="h-4 w-4" /> New deck
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl space-y-8 p-4 md:p-8">
            {loading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key="content"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-8"
                >
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
                    const inGroup = decks.filter((d) => d.group_id === g.id);
                    return (
                      <DeckGrid
                        key={g.id}
                        title={g.name}
                        icon={<Folder className="h-4 w-4 text-muted-foreground" />}
                        decks={inGroup}
                        dueMap={dueMap}
                        onOpen={(id) => navigate(`/decks/${id}`)}
                        empty="Empty folder."
                        onCreate={() => setNewDeckGroup(g.id)}
                      />
                    );
                  })}

                  <DeckGrid
                    title={groups.length ? "Ungrouped" : "All decks"}
                    decks={ungrouped}
                    dueMap={dueMap}
                    onOpen={(id) => navigate(`/decks/${id}`)}
                    empty="No decks yet. Create your first one."
                    onCreate={() => setNewDeckGroup(null)}
                  />

                  {shared.length > 0 && (
                    <DeckGrid
                      title="Shared with you"
                      icon={<Users className="h-4 w-4 text-muted-foreground" />}
                      decks={shared}
                      dueMap={dueMap}
                      onOpen={(id) => navigate(`/decks/${id}`)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      <AssistantBubble />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <OnboardingStep open={showUsernameDialog} onOpenChange={setShowUsernameDialog} />
      <NewDeckDialog
        open={newDeckGroup !== undefined}
        onOpenChange={(o) => { if (!o) setNewDeckGroup(undefined); }}
        groupId={newDeckGroup ?? null}
        onCreated={(d) => { setNewDeckGroup(undefined); navigate(`/decks/${d.id}`); }}
      />
    </div>
  );
}

function DeckGrid({
  title, decks, onOpen, empty, onCreate, icon, dueMap,
}: {
  title: string;
  decks: Deck[];
  onOpen: (id: string) => void;
  empty?: string;
  onCreate?: () => void;
  icon?: React.ReactNode;
  dueMap: Record<string, number>;
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
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {decks.map((d) => {
            const due = dueMap[d.id] ?? 0;
            return (
              <button
                key={d.id}
                onClick={() => onOpen(d.id)}
                className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.title}</p>
                  {d.description && <p className="truncate text-xs text-muted-foreground">{d.description}</p>}
                </div>
                {due > 0 && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs tabular-nums text-primary">
                    {due} due
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
