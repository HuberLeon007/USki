import { motion, useReducedMotion } from "motion/react";
import { BookPlus, Repeat, MessageCircleQuestion } from "lucide-react";

const steps = [
  {
    icon: BookPlus,
    title: "Create your decks",
    description:
      "Build flashcard decks for any subject. Organize everything in one place.",
  },
  {
    icon: Repeat,
    title: "Study smarter with FSRS",
    description:
      "The algorithm schedules your reviews. You learn more efficiently in less time.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Ask AI when stuck",
    description:
      "The AI assistant explains connections, gives examples, and helps you understand.",
  },
];

export function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.7 }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        className="mb-16"
      >
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          How USki works
        </h2>
      </motion.div>
      <div className="grid gap-12 md:grid-cols-3">
        {steps.map((step, index) => (
          <motion.div
            key={step.title}
            initial={reduce ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{
              duration: 1.0,
              delay: index * 0.25,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="space-y-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <step.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[40ch]">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
