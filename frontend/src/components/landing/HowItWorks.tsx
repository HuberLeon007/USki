import { motion, useReducedMotion } from "motion/react";
import { Layers, Zap, MessageCircle } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Layers,
    title: "Einfach verwalten, effektiv lernen",
    description:
      "Erstelle Decks, organisiere deine Karteikarten und behalte deinen Fortschritt im Blick. Alles an einem Ort.",
  },
  {
    number: "02",
    icon: Zap,
    title: "Importiere & lerne smarter",
    description:
      "Importiere Karteikarten aus anderen Quellen. FSRS passt deinen Lernplan automatisch an - die Magie hinter dem Lernerfolg.",
  },
  {
    number: "03",
    icon: MessageCircle,
    title: "KI beantwortet deine Fragen",
    description:
      "Wenn du nicht weiter weißt, frag den KI-Assistenten. Er erklärt Zusammenhänge, gibt Beispiele und hilft dir beim Verstehen.",
  },
];

export function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how-it-works" className="bg-muted/50 px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            So funktioniert USki
          </h2>
          <p className="mx-auto mt-4 max-w-[50ch] text-muted-foreground">
            In drei einfachen Schritten zum Lernerfolg.
          </p>
        </motion.div>

        <div className="relative mt-16 space-y-8 md:space-y-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6"
            >
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-lg font-bold text-white sm:size-16">
                {step.number}
              </div>
              <div className="flex-1 rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="mb-2 flex items-center gap-2">
                  <step.icon className="size-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
