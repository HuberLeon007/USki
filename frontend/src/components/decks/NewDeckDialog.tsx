import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createDeck, type Deck } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string | null;
  onCreated: (deck: Deck) => void;
}

export function NewDeckDialog({ open, onOpenChange, groupId, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 1) return;
    setLoading(true);
    setError(null);
    try {
      const deck = await createDeck({ title: title.trim(), description, group_id: groupId ?? null });
      onCreated(deck);
      setTitle("");
      setDescription("");
      onOpenChange(false);
    } catch {
      setError("Could not create deck. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New deck</DialogTitle>
          <DialogDescription>Create a deck to hold your flashcards.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="deck-title">Title</Label>
            <input
              id="deck-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Biology · Grade 10"
              className="h-11 rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="deck-desc">Description (optional)</Label>
            <input
              id="deck-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-11 rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !title.trim()} className="h-11 rounded-xl font-semibold">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create deck"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
