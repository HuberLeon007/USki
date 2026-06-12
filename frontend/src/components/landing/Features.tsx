import { motion, useReducedMotion } from "motion/react";
import { BookOpen, Brain, Sparkles, Share2 } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Karteikarten-Decks",
    description:
      "Erstelle und verwalte Decks für jedes Fach. Importiere bestehende Karteikarten aus anderen Quellen.",
  },
  {
    icon: Brain,
    title: "FSRS-Lernalgorithmus",
    description:
      "Die Magie hinter dem Lernerfolg. FSRS passt deinen Lernplan automatisch an - du lernst genau das, was du brauchst.",
  },
  {
    icon: Sparkles,
    title: "KI-Assistent",
    description:
      "Stuck? Frag den KI-Assistenten. Er erklärt, gibt Beispiele und hilft wenn du nicht weiter weißt.",
  },
  {
    icon: Share2,
    title: "Teilen & Zusammenarbeiten",
    description:
      "Teile Decks mit Freunden und Mitschülern. Gemeinsam lernen macht mehr Spaß.",
  },
];

export function Features() {
  const reduce = useReducedMotion();
  return (
    <section id="features" className="px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Alles was du zum Lernen brauchst
          </h2>
          <p className="mx-auto mt-4 max-w-[50ch] text-muted-foreground">
            USki bietet dir alle Werkzeuge für effektives Lernen an einem Ort.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`group rounded-xl border border-border p-6 transition-all hover:shadow-lg ${
                i % 2 === 1 ? "bg-muted/50" : "bg-card"
              }`}
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                <feature.icon className="size-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
