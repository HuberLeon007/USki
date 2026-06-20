import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Share2, Plus, Pencil, Trash2, Loader2, GripVertical, Settings2, Image as ImageIcon, Check, ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  RichTextProvider, RichTextToolbar, RichTextField,
} from "@/components/editor/RichTextEditor";
import { ReviewSession } from "@/components/review/ReviewSession";
import { ShareDialog } from "@/components/decks/ShareDialog";
import { AssistantBubble } from "@/components/dashboard/assistant/AssistantBubble";
import { SelectMenu } from "@/components/ui/select-menu";
import { useAuth } from "@/app/auth-context";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft-store";
import { cn } from "@/lib/utils";
import {
  DECK_ICON_KEYS, deckIconFor, DECK_COLOR_KEYS, deckColorFor, DeckBadge,
} from "@/lib/deck-icons";
import {
  ApiError,
  listCards, createCard, updateCard, deleteCard, deleteDeck, getDeck, updateDeck, listGroups, reorderCards,
  setBidirectional, resetProgress, reviewStats, type Card, type Deck, type DeckGroup, type ReviewStats,
} from "@/lib/api";

type Mode = "study" | "manage" | "review" | "custom" | "settings" | "editor";

interface DraftShape {
  front?: string;
  back?: string;
  groupLabel?: string;
  groupColor?: string;
  makeReverse?: boolean;
}

const GROUP_COLORS = [
  { name: "None", value: "" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Emerald", value: "#10b981" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Violet", value: "#8b5cf6" },
];

/** First non-empty line of card HTML as plain text (for dense list rows). */
function firstLine(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  return text;
}
function hasImage(html: string): boolean {
  return /<img/i.test(html);
}

export default function DeckDetailPage() {
  const { deckId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const uid = user?.id ?? "anon";

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [groups, setGroups] = useState<DeckGroup[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(params.get("study") ? "review" : "study");
  const [shareOpen, setShareOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customCfg, setCustomCfg] = useState<{ mode: "all" | "ahead"; days?: number }>({ mode: "all" });
  const [aheadDays, setAheadDays] = useState(3);

  // card editor
  const [editingId, setEditingId] = useState<string | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [makeReverse, setMakeReverse] = useState(false);
  const [bidirInitial, setBidirInitial] = useState(false);
  const [groupLabel, setGroupLabel] = useState("");
  const [groupColor, setGroupColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // Stable id for the in-progress draft (per deck + card; "new" for a new card).
  const draftId = (cardId: string | null) => `card:${deckId}:${cardId ?? "new"}`;

  // card list filter + drag
  const [filter, setFilter] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<"above" | "below" | null>(null);
  const reduce = useReducedMotion();
  // multi-select + bulk grouping (grouping now lives here, not in the editor)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLabel, setBulkLabel] = useState("");
  const [bulkColor, setBulkColor] = useState("");

  function loadStats() { reviewStats(deckId).then(setStats).catch(() => {}); }

  useEffect(() => {
    Promise.all([getDeck(deckId), listCards(deckId)])
      .then(([d, c]) => { setDeck(d); setCards(c); })
      .catch(() => navigate("/dashboard"))
      .finally(() => setLoading(false));
    listGroups().then(setGroups).catch(() => {});
    loadStats();
  }, [deckId, navigate]);

  // Back to wherever the user came from (browse / decks / overview), not always overview.
  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  }

  async function moveToGroup(groupId: string | null) {
    if (!deck) return;
    setDeck(await updateDeck(deckId, { group_id: groupId }));
  }

  function openNew() {
    setEditingId(null); setFront(""); setBack(""); setMakeReverse(false); setBidirInitial(false);
    setGroupLabel(""); setGroupColor(""); setSaveFailed(false); setMode("editor");
    // Restore an unsaved new-card draft, if any.
    loadDraft<DraftShape>(uid, draftId(null)).then((d) => {
      if (d) { setFront(d.front ?? ""); setBack(d.back ?? ""); setGroupLabel(d.groupLabel ?? ""); setGroupColor(d.groupColor ?? ""); setMakeReverse(Boolean(d.makeReverse)); }
    });
  }
  function openEdit(c: Card) {
    // Always edit the note's primary (basic) card; the reverse mirrors it.
    const rep = c.note_id ? (cards.find((x) => x.note_id === c.note_id && x.card_type === "basic") ?? c) : c;
    const bidir = Boolean(rep.note_id) && cards.some((x) => x.note_id === rep.note_id && x.id !== rep.id);
    setEditingId(rep.id); setFront(rep.front_html); setBack(rep.back_html);
    setMakeReverse(bidir); setBidirInitial(bidir);
    setGroupLabel(rep.group_label ?? ""); setGroupColor(rep.group_color ?? ""); setSaveFailed(false); setMode("editor");
    // Restore unsaved edits for this card, if any (overrides the loaded copy).
    loadDraft<DraftShape>(uid, draftId(rep.id)).then((d) => {
      if (d) { setFront(d.front ?? ""); setBack(d.back ?? ""); setGroupLabel(d.groupLabel ?? ""); setGroupColor(d.groupColor ?? ""); }
    });
  }

  async function save() {
    if (!front.trim()) return;
    setSaving(true);
    try {
      const g = { group_label: groupLabel.trim() || null, group_color: groupColor || null };
      if (editingId) {
        await updateCard(deckId, editingId, { front_html: front, back_html: back, ...g });
        if (makeReverse !== bidirInitial) {
          await setBidirectional(deckId, editingId, makeReverse);
        }
        setCards(await listCards(deckId)); // refresh (sibling added/removed/mirrored)
      } else {
        await createCard(deckId, {
          front_html: front, back_html: back, make_reverse: makeReverse,
          position: cards.length, ...g,
        });
        setCards(await listCards(deckId)); // reload (reverse card may be added)
      }
      // Saved -> the local draft is no longer needed.
      await clearDraft(uid, draftId(editingId));
      setSaveFailed(false);
      setMode("manage"); setEditingId(null); setFront(""); setBack("");
      loadStats();
    } catch {
      // Backend/DB unreachable: keep the encrypted draft, stay in the editor.
      setSaveFailed(true);
      toast.error("Couldn't reach the server. Your draft is saved locally and will retry.");
    } finally {
      setSaving(false);
    }
  }

  // Debounced encrypted autosave of the in-progress card while editing.
  useEffect(() => {
    if (mode !== "editor") return;
    if (!front.trim() && !back.trim()) return;
    const t = setTimeout(() => {
      saveDraft(uid, draftId(editingId), { front, back, groupLabel, groupColor, makeReverse });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, front, back, groupLabel, groupColor, makeReverse, editingId, uid, deckId]);

  // Auto-retry the save once the connection comes back (draft was kept locally).
  useEffect(() => {
    if (!saveFailed) return;
    const retry = () => { if (mode === "editor") { toast("Back online — saving your draft…"); void save(); } };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveFailed, mode]);

  // ---- drag & drop reorder (study order, top -> bottom) ----
  function clearDrag() { setDragId(null); setDragOverId(null); setDragOverPos(null); }

  function onDrop(targetRepId: string, pos: "above" | "below") {
    if (!dragId || dragId === targetRepId) { clearDrag(); return; }
    const from = noteGroups.findIndex((g) => g.rep.id === dragId);
    if (from < 0) { clearDrag(); return; }
    const moved = noteGroups[from]!;
    const without = noteGroups.filter((g) => g.rep.id !== dragId);
    const targetIdx = without.findIndex((g) => g.rep.id === targetRepId);
    if (targetIdx < 0) { clearDrag(); return; }
    const insertAt = pos === "below" ? targetIdx + 1 : targetIdx;
    const ng = [...without];
    ng.splice(insertAt, 0, moved);
    const newCards = ng.flatMap((g) => g.ids.map((id) => cards.find((c) => c.id === id)!));
    setCards(newCards);
    clearDrag();
    reorderCards(deckId, newCards.map((c) => c.id)).catch(() => {});
  }

  async function removeNote(ids: string[]) {
    await Promise.all(ids.map((id) => deleteCard(deckId, id)));
    setCards((cs) => cs.filter((c) => !ids.includes(c.id)));
    setSelected((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
    loadStats();
  }

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function applyBulkGroup() {
    const label = bulkLabel.trim() || null;
    const color = bulkColor || null;
    const ids = noteGroups.filter((g) => selected.has(g.rep.id)).flatMap((g) => g.ids);
    await Promise.all(ids.map((id) => updateCard(deckId, id, { group_label: label, group_color: color })));
    setCards(await listCards(deckId));
    setSelected(new Set()); setBulkOpen(false); setBulkLabel(""); setBulkColor("");
  }

  const selectedIds = () => noteGroups.filter((g) => selected.has(g.rep.id)).flatMap((g) => g.ids);

  async function bulkDelete() {
    const ids = selectedIds();
    if (!ids.length) return;
    await Promise.all(ids.map((id) => deleteCard(deckId, id)));
    setCards((cs) => cs.filter((c) => !ids.includes(c.id)));
    setSelected(new Set());
    loadStats();
  }

  async function bulkReset() {
    const ids = selectedIds();
    if (!ids.length) return;
    await resetProgress(deckId, ids);
    setSelected(new Set());
    loadStats();
    toast.success("Learning progress reset.");
  }

  function toggleSelectAll() {
    setSelected((s) => {
      if (s.size >= visibleGroups.length && visibleGroups.length > 0) return new Set();
      return new Set(visibleGroups.map((g) => g.rep.id));
    });
  }

  // Group linked siblings (bidirectional notes) so each note shows once.
  const noteGroups = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of cards) {
      const key = c.note_id ?? `solo:${c.id}`;
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    }
    return Array.from(map.values()).map((arr) => ({
      rep: arr.find((x) => x.card_type === "basic") ?? arr[0]!,
      bidir: arr.length > 1,
      ids: arr.map((x) => x.id),
    }));
  }, [cards]);

  const f = filter.trim().toLowerCase();
  const visibleGroups = noteGroups.filter(({ rep }) =>
    !f || rep.front_html.toLowerCase().includes(f) || rep.back_html.toLowerCase().includes(f) ||
    (rep.group_label ?? "").toLowerCase().includes(f),
  );

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  // Full-screen card editor (its own "page", not a new tab).
  if (mode === "editor") {
    return (
      <>
        <CardEditorScreen
          title={editingId ? "Edit card" : "New card"}
          front={front} back={back} onFront={setFront} onBack={setBack}
          showReverse={true} makeReverse={makeReverse} onMakeReverse={setMakeReverse}
          saving={saving} canSave={Boolean(front.trim())}
          onCancel={() => { void clearDraft(uid, draftId(editingId)); setSaveFailed(false); setMode("manage"); setEditingId(null); }}
          onSave={save}
        />
        <AssistantBubble deckId={deckId} />
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{deck?.title}</h1>
        {groups.length > 0 && (
          <SelectMenu
            value={deck?.group_id ?? ""}
            onChange={(v) => moveToGroup(v || null)}
            ariaLabel="Move to folder"
            align="end"
            className="hidden w-40 sm:flex"
            options={[{ value: "", label: "No folder" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
          />
        )}
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShareOpen(true)}>
          <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
        </Button>
        <Button
          variant={mode === "settings" ? "secondary" : "ghost"}
          size="sm" className="gap-1.5"
          onClick={() => { setMode((m) => (m === "settings" ? "study" : "settings")); setParams({}); }}
        >
          <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Deck settings</span>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
        {(mode === "review" || mode === "custom") && (
          <ReviewSession
            deckId={deckId}
            custom={mode === "custom" ? customCfg : null}
            persist={mode === "review" || Boolean(deck?.custom_study_updates)}
            onClose={() => { setMode("study"); setParams({}); loadStats(); listCards(deckId).then(setCards); }}
          />
        )}

        {mode === "study" && (
          <StudyScreen
            stats={stats}
            total={cards.length}
            onStudy={() => setMode("review")}
            onCustom={() => setCustomOpen(true)}
            onManage={() => setMode("manage")}
          />
        )}

        {mode === "settings" && deck && (
          <DeckSettings
            deck={deck}
            onSaved={(d) => setDeck(d)}
            onManageCards={() => setMode("manage")}
            onDeleted={() => goBack()}
          />
        )}

        {mode === "manage" && (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search cards…"
                  className="h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none transition-all focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
                />
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={openNew}>
                <Plus className="h-4 w-4" /> New card
              </Button>
            </div>

            {/* Bulk selection bar: tick rows below, then group them together. */}
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
                <span className="text-sm font-medium">{selected.size} selected</span>
                <div className="flex-1" />
                {bulkOpen ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      autoFocus
                      value={bulkLabel}
                      onChange={(e) => setBulkLabel(e.target.value)}
                      placeholder="Group name"
                      className="h-8 w-36 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-primary/60"
                    />
                    <div className="flex items-center gap-1">
                      {GROUP_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setBulkColor(c.value)}
                          aria-label={c.name}
                          className={cn("h-5 w-5 rounded-full border-2", bulkColor === c.value ? "border-foreground" : "border-transparent")}
                          style={{ background: c.value || "transparent", boxShadow: c.value ? undefined : "inset 0 0 0 1px var(--border)" }}
                        />
                      ))}
                    </div>
                    <Button size="sm" className="h-8 rounded-lg" onClick={applyBulkGroup}>Apply</Button>
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setBulkOpen(false)}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg" onClick={() => setBulkOpen(true)}>Group…</Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={bulkReset}>Reset progress</Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={bulkDelete}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setSelected(new Set())}>Clear</Button>
                  </>
                )}
              </div>
            )}

            {visibleGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
                <p className="text-sm text-muted-foreground">{filter ? "No cards match." : "No cards yet. Add your first one."}</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-1.5">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={visibleGroups.length > 0 && selected.size >= visibleGroups.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  />
                  {selected.size > 0 ? (
                    <span className="text-xs font-medium text-foreground">{selected.size} selected</span>
                  ) : (
                    <span className="flex min-w-0 flex-col leading-tight" title="Tick rows to group, or drag the handle to reorder">
                      <span className="text-xs font-medium text-foreground">Select all</span>
                      <span className="truncate text-[11px] text-muted-foreground">Tick rows to group, or drag to reorder</span>
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border/40">
                  {visibleGroups.map(({ rep, bidir, ids }) => {
                    const fL = firstLine(rep.front_html), bL = firstLine(rep.back_html);
                    const isSel = selected.has(rep.id);
                    const isOver = dragOverId === rep.id && dragId !== null && dragId !== rep.id;
                    return (
                      <motion.div
                        key={rep.id}
                        layout={!reduce}
                        transition={reduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                        onDragOver={(e) => {
                          if (!dragId || filter) return;
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDragOverId(rep.id);
                          setDragOverPos(e.clientY < rect.top + rect.height / 2 ? "above" : "below");
                        }}
                        onDragLeave={() => setDragOverId((d) => (d === rep.id ? null : d))}
                        onDrop={() => onDrop(rep.id, dragOverPos ?? "above")}
                        className={cn(
                          "group relative flex items-center gap-2 px-3 py-2.5 transition-colors",
                          isSel ? "bg-primary/5" : "hover:bg-accent/40",
                          dragId === rep.id && "opacity-40",
                        )}
                      >
                        {isOver && dragOverPos === "above" && (
                          <span className="pointer-events-none absolute inset-x-0 -top-px z-10 h-0.5 bg-primary" aria-hidden />
                        )}
                        {isOver && dragOverPos === "below" && (
                          <span className="pointer-events-none absolute inset-x-0 -bottom-px z-10 h-0.5 bg-primary" aria-hidden />
                        )}
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(rep.id)}
                          aria-label="Select card"
                          className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                        />
                        {!filter && (
                          <span
                            draggable
                            onDragStart={() => setDragId(rep.id)}
                            onDragEnd={clearDrag}
                            title="Drag to reorder"
                            className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/50 hover:bg-accent hover:text-foreground active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        )}
                        <button onClick={() => openEdit(rep)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span className="flex min-w-0 flex-1 basis-0 items-center gap-1.5">
                            <span className="min-w-0 flex-1 truncate text-sm">{fL || "—"}</span>
                            {hasImage(rep.front_html) && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          </span>
                          <span className="flex min-w-0 flex-1 basis-0 items-center gap-1.5">
                            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{bL || "—"}</span>
                            {bidir && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 text-[10px] font-medium text-primary" title="Studied both directions">
                                <ArrowLeftRight className="h-3 w-3" /> both
                              </span>
                            )}
                            {rep.group_label && <span className="shrink-0 rounded px-1.5 text-[10px]" style={{ background: (rep.group_color ?? "#888") + "22", color: rep.group_color ?? undefined }}>{rep.group_label}</span>}
                            {hasImage(rep.back_html) && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          </span>
                        </button>
                        <div className="flex shrink-0 gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                          <button onClick={() => openEdit(rep)} aria-label="Edit card" className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => removeNote(ids)} aria-label="Delete card" className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} deckId={deckId} />
      <AssistantBubble deckId={deckId} />

      {/* Custom study: pick the set before starting. */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom study</DialogTitle>
            <DialogDescription>Study outside the normal schedule. Ratings here don't change your schedule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              onClick={() => { setCustomCfg({ mode: "all" }); setCustomOpen(false); setMode("custom"); }}
              className="flex w-full items-center gap-3 rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Play className="h-4 w-4 fill-current" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">All cards</span>
                <span className="block text-xs text-muted-foreground">Review every card in this deck, ignoring due dates.</span>
              </span>
            </button>
            <div className="rounded-xl border border-border/60 p-3">
              <p className="text-sm font-medium">Due within a few days</p>
              <p className="mb-3 text-xs text-muted-foreground">Pull cards that become due soon, to study ahead.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={aheadDays}
                  onChange={(e) => setAheadDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                  className="h-9 w-20 rounded-lg border border-input bg-background/60 px-2.5 text-sm outline-none focus-visible:border-primary/60"
                  aria-label="Days ahead"
                />
                <span className="text-sm text-muted-foreground">days</span>
                <div className="flex-1" />
                <Button size="sm" className="rounded-lg" onClick={() => { setCustomCfg({ mode: "ahead", days: aheadDays }); setCustomOpen(false); setMode("custom"); }}>
                  Start
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Full-screen card editor ──────────────────────────────────────────── */
function CardEditorScreen({
  title, front, back, onFront, onBack,
  showReverse, makeReverse, onMakeReverse, saving, canSave, onCancel, onSave,
}: {
  title: string;
  front: string; back: string; onFront: (v: string) => void; onBack: (v: string) => void;
  showReverse: boolean; makeReverse: boolean; onMakeReverse: (v: boolean) => void;
  saving: boolean; canSave: boolean; onCancel: () => void; onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Back to cards"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={saving || !canSave} className="rounded-xl font-semibold">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save"}
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-8">
          <RichTextProvider>
            <RichTextToolbar />
            <div className="space-y-1.5">
              <p className="label-mono">Front</p>
              <RichTextField value={front} onChange={onFront} placeholder="Question…" ariaLabel="Card front" />
            </div>
            <div className="space-y-1.5">
              <p className="label-mono">Back</p>
              <RichTextField value={back} onChange={onBack} placeholder="Answer…" ariaLabel="Card back" />
            </div>
          </RichTextProvider>

          {showReverse && (
            <button
              type="button"
              role="switch"
              aria-checked={makeReverse}
              onClick={() => onMakeReverse(!makeReverse)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                makeReverse ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-accent/40",
              )}
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", makeReverse ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                <ArrowLeftRight className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Both directions</span>
                <span className="block text-xs text-muted-foreground">One card, studied front to back and back to front. Each direction tracks its own schedule.</span>
              </span>
              <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", makeReverse ? "bg-primary" : "bg-muted")}>
                <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all", makeReverse ? "left-[1.125rem]" : "left-0.5")} />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Deck settings (edit appearance/title/desc after creation) ────────── */
function DeckSettings({
  deck, onSaved, onManageCards, onDeleted,
}: {
  deck: Deck;
  onSaved: (d: Deck) => void;
  onManageCards: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(deck.title);
  const [description, setDescription] = useState(deck.description ?? "");
  const [icon, setIcon] = useState<string | null>(deck.icon ?? null);
  const [color, setColor] = useState<string>(deck.color ?? "violet");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const d = await updateDeck(deck.id, { title: title.trim(), description, icon, color });
      onSaved(d);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1600);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (confirmText !== deck.title || deleting) return;
    setDeleting(true);
    try {
      await deleteDeck(deck.id);
    } catch (err) {
      // A 404 means the deck is already gone (e.g. a double submit) -> treat as
      // success and leave. Any other failure is surfaced and the dialog stays
      // open so the user can retry, instead of an uncaught promise rejection.
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.error("Could not delete the deck. Please try again.");
        setDeleting(false);
        return;
      }
    }
    toast.success("Deck deleted.");
    onDeleted();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="label-mono">Title</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <p className="label-mono">Description</p>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
        />
      </div>

      <div className="space-y-3">
        <p className="label-mono">Appearance</p>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
          <DeckBadge icon={icon} color={color} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{title.trim() || "Deck"}</p>
            <p className="truncate text-xs text-muted-foreground">{description || "Preview"}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="label-mono">Color</p>
          <div className="flex flex-wrap gap-2">
            {DECK_COLOR_KEYS.map((key) => {
              const c = deckColorFor(key);
              const active = color === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  aria-label={`Color ${key}`}
                  aria-pressed={active}
                  className={cn("h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all", c.swatch, active ? "scale-110 ring-foreground/50" : "ring-transparent hover:ring-foreground/25")}
                />
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="label-mono">Icon</p>
          <div className="flex flex-wrap gap-1.5">
            {DECK_ICON_KEYS.map((key) => {
              const Ico = deckIconFor(key);
              const active = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(active ? null : key)}
                  aria-label={`Icon ${key}`}
                  aria-pressed={active}
                  className={cn("flex h-11 w-11 items-center justify-center rounded-lg border transition-all",
                    active ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground")}
                >
                  <Ico className="h-6 w-6" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving || !title.trim()} className="rounded-xl font-semibold">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : savedTick ? <><Check className="h-4 w-4" /> Saved</> : "Save changes"}
        </Button>
        <Button variant="outline" onClick={onManageCards} className="rounded-xl">Manage cards</Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => { setConfirmText(""); setConfirmOpen(true); }} className="gap-1.5 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4" /> Delete deck
        </Button>
      </div>

      {/* Type-to-confirm deletion (replaces the native browser confirm). */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmText(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete deck?</DialogTitle>
            <DialogDescription>
              This permanently deletes the deck and all of its cards. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-semibold text-foreground">{deck.title}</span> to confirm deletion.
            </p>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              aria-label="Type the deck name to confirm deletion"
              placeholder={deck.title}
              className="h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus-visible:border-destructive/60 focus-visible:ring-4 focus-visible:ring-destructive/15"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setConfirmOpen(false); setConfirmText(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={confirmText !== deck.title || deleting}
              className="gap-1.5 rounded-xl"
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : <><Trash2 className="h-4 w-4" /> Delete deck</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudyScreen({
  stats, total, onStudy, onCustom, onManage,
}: {
  stats: ReviewStats | null;
  total: number;
  onStudy: () => void;
  onCustom: () => void;
  onManage: () => void;
}) {
  const ready = (stats?.new ?? 0) + (stats?.learning ?? 0) + (stats?.due ?? 0);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-8 py-10 text-center">
      <div className="grid w-full grid-cols-3 gap-3">
        <Stat label="New" value={stats?.new ?? 0} color="text-sky-500" />
        <Stat label="Learning" value={stats?.learning ?? 0} color="text-amber-500" />
        <Stat label="Due" value={stats?.due ?? 0} color="text-emerald-500" />
      </div>

      <Button onClick={onStudy} disabled={ready === 0} className="h-14 w-full rounded-2xl text-base font-semibold">
        <Play className="h-5 w-5 fill-current" /> {ready ? `Study now (${ready})` : "Nothing due"}
      </Button>

      <div className="flex w-full gap-2">
        <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={onCustom} disabled={total === 0}>
          Custom study
        </Button>
        <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={onManage}>
          Manage cards
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className={cn("font-mono text-2xl font-bold tabular-nums", color)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
