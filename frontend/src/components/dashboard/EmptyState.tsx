import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onCreateDeck: () => void;
}

export function EmptyState({ onCreateDeck }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <BookOpen className="mb-4 size-16 text-muted-foreground/50" />
      <h3 className="text-xl font-semibold">Noch keine Decks</h3>
      <p className="mt-2 text-muted-foreground">
        Erstelle dein erstes Deck um loszulegen.
      </p>
      <Button
        className="mt-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white"
        onClick={onCreateDeck}
      >
        Erstes Deck erstellen
      </Button>
    </div>
  );
}
