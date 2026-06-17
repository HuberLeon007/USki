import { BookOpen, Brain, Sparkles, Share2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: BookOpen,
    title: "Flashcard Decks",
    description:
      "Create and manage decks for any subject. Import existing flashcards from other sources.",
    accent: "bg-primary/10 text-primary",
  },
  {
    icon: Brain,
    title: "FSRS Algorithm",
    description:
      "FSRS adapts your study plan automatically. You learn exactly what you need, when you need it.",
    accent: "bg-primary/10 text-primary",
  },
  {
    icon: Sparkles,
    title: "AI Assistant",
    description:
      "Ask the AI assistant. It explains concepts, gives examples, and helps you understand.",
    accent: "bg-primary/10 text-primary",
  },
  {
    icon: Share2,
    title: "Share & Collaborate",
    description:
      "Share decks with friends and classmates. Learning together is more fun.",
    accent: "bg-primary/10 text-primary",
  },
];

export function Features() {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12"
      >
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Everything you need to learn
        </h2>
      </motion.div>
      <div className="grid gap-5 sm:grid-cols-2">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={reduce ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{
              duration: 1.0,
              delay: index * 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <Card className="h-full border-border/60 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <CardContent className="flex gap-4 p-6">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                    feature.accent,
                  )}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
