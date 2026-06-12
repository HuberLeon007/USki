import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/app/providers";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [deckName, setDeckName] = useState("");

  const username = user?.email?.split("@")[0] ?? "User";

  const steps = [
    {
      title: `Willkommen bei USki, ${username}!`,
      subtitle: "Lass uns dein erstes Deck erstellen.",
      content: (
        <Button
          className="mt-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white"
          onClick={() => setStep(1)}
        >
          Los geht&apos;s
          <ArrowRight className="ml-2 size-4" />
        </Button>
      ),
    },
    {
      title: "Dein erstes Deck",
      subtitle: "Gib deinem Deck einen Namen.",
      content: (
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deck-name">Deck-Name</Label>
            <Input
              id="deck-name"
              placeholder="z.B. Biologie Klasse 8"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white"
              onClick={() => setStep(2)}
              disabled={!deckName.trim()}
            >
              Deck erstellen
            </Button>
            <Button variant="ghost" onClick={() => setStep(2)}>
              Überspringen
            </Button>
          </div>
        </div>
      ),
    },
    {
      title: "Alles bereit!",
      subtitle:
        "Dein Deck ist erstellt. Füge jetzt Karteikarten hinzu oder starte mit dem Lernen.",
      content: (
        <Button
          className="mt-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white"
          onClick={onComplete}
        >
          <Check className="mr-2 size-4" />
          Zum Dashboard
        </Button>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div className="flex items-center justify-center py-12">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="mx-auto max-w-md p-8 text-center">
            <div className="mb-6 flex justify-center gap-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    i <= step
                      ? "bg-gradient-to-r from-blue-500 to-purple-500"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <h2 className="text-2xl font-bold">{current.title}</h2>
            <p className="mt-2 text-muted-foreground">{current.subtitle}</p>
            {current.content}
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
