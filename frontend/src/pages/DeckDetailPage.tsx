import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Share2, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextEditor, RichTextView } from "@/components/editor/RichTextEditor";
import { ReviewSession } from "@/components/review/ReviewSession";
import { ShareDialog } from "@/components/decks/ShareDialog";
import {
  listCards, createCard, updateCard, deleteCard, getDeck, updateDeck, listGroups,
  type Card, type Deck, type DeckGroup,
} from "@/lib/api";

export default function DeckDetailPage() {
  const { deckId = "" } = useParams();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [groups, setGroups] = useState<DeckGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getDeck(deckId), listCards(deckId)])
      .then(([d, c]) => { setDeck(d); setCards(c); })
      .catch(() => navigate("/dashboard"))
      .finally(() => setLoading(false));
    listGroups().then(setGroups).catch(() => {});
  }, [deckId, navigate]);

  async function moveToGroup(groupId: string | null) {
    if (!deck) return;
    const updated = await updateDeck(deckId, { group_id: groupId });
    setDeck(updated);
  }

  function openNew() {
    setEditingId(null); setFront(""); setBack(""); setFormOpen(true);
  }
  function openEdit(card: Card) {
    setEditingId(card.id); setFront(card.front_html); setBack(card.back_html); setFormOpen(true);
  }

  async function save() {
    if (!front.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateCard(deckId, editingId, { front_html: front, back_html: back });
        setCards((cs) => cs.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const created = await createCard(deckId, { front_html: front, back_html: back });
        setCards((cs) => [...cs, created]);
      }
      setFormOpen(false); setFront(""); setBack(""); setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await deleteCard(deckId, id);
    setCards((cs) => cs.filter((c) => c.id !== id));
  }

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{deck?.title}</h1>
        {groups.length > 0 && (
          <select
            value={deck?.group_id ?? ""}
            onChange={(e) => moveToGroup(e.target.value || null)}
            aria-label="Move to folder"
            className="hidden h-9 rounded-lg border border-input bg-background/60 px-2 text-sm sm:block"
          >
            <option value="">No folder</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShareOpen(true)}>
          <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
        </Button>
        <Button size="sm" className="gap-1.5 rounded-lg font-semibold" onClick={() => setReviewing(true)} disabled={cards.length === 0}>
          <Play className="h-4 w-4 fill-current" /> Review
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
        {reviewing ? (
          <ReviewSession deckId={deckId} onClose={() => setReviewing(false)} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">{cards.length} cards</h2>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={openNew}>
                <Plus className="h-4 w-4" /> New card
              </Button>
            </div>

            {formOpen && (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                <p className="label-mono">Front</p>
                <RichTextEditor value={front} onChange={setFront} placeholder="Question…" ariaLabel="Card front" />
                <p className="label-mono">Back</p>
                <RichTextEditor value={back} onChange={setBack} placeholder="Answer…" ariaLabel="Card back" />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                  <Button onClick={save} disabled={saving || !front.trim()} className="rounded-xl font-semibold">
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editingId ? "Update card" : "Add card"}
                  </Button>
                </div>
              </div>
            )}

            {cards.length === 0 && !formOpen ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
                <p className="text-sm text-muted-foreground">No cards yet. Add your first one.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cards.map((c) => (
                  <div key={c.id} className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                    <div className="min-w-0 flex-1">
                      <RichTextView html={c.front_html} className="text-sm font-medium" />
                      <div className="mt-1 border-t border-border/40 pt-1">
                        <RichTextView html={c.back_html} className="text-sm text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => openEdit(c)} aria-label="Edit card" className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(c.id)} aria-label="Delete card" className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} deckId={deckId} />
    </div>
  );
}
