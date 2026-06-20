import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DECK_ICON_KEYS, deckIconFor, DECK_COLOR_KEYS, deckColorFor, DeckBadge } from "@/lib/deck-icons";
import { createDeck, ApiError, type Deck } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string | null;
  onCreated: (deck: Deck) => void;
}

export function NewDeckDialog({ open, onOpenChange, groupId, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string>("violet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 1) return;
    setLoading(true);
    setError(null);
    try {
      const deck = await createDeck({ title: title.trim(), description, group_id: groupId ?? null, icon, color });
      onCreated(deck);
      setTitle("");
      setDescription("");
      setIcon(null);
      setColor("violet");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("You already have a deck with this name.");
      } else {
        setError("Could not create deck. Please try again.");
      }
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
          <div className="flex flex-col gap-3">
            <Label>Appearance</Label>
            {/* Live preview */}
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
              <DeckBadge icon={icon} color={color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{title.trim() || "New deck"}</p>
                <p className="truncate text-xs text-muted-foreground">{description || "Preview"}</p>
              </div>
            </div>

            {/* Color */}
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
                      className={cn(
                        "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                        c.swatch,
                        active ? "scale-110 ring-foreground/50" : "ring-transparent hover:ring-foreground/25",
                      )}
                    />
                  );
                })}
              </div>
            </div>

            {/* Icon */}
            <div className="space-y-1.5">
              <p className="label-mono">Icon</p>
              <div className="grid grid-cols-6 gap-2">
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
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-xl border transition-all",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/50 text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Ico className="h-[18px] w-[18px]" />
                    </button>
                  );
                })}
              </div>
            </div>
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
