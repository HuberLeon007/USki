import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, BookOpen, RotateCcw, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.3 } },
};

const fadeUp = (reduce: boolean) => ({
  hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] } },
});

const decks = [
  { name: "Biology Grade 10", new: 5, learn: 4, due: 14 },
  { name: "History - WW2", new: 0, learn: 2, due: 8 },
  { name: "English Vocabulary", new: 7, learn: 2, due: 13 },
];

const totals = {
  new: decks.reduce((s, d) => s + d.new, 0),
  learn: decks.reduce((s, d) => s + d.learn, 0),
  due: decks.reduce((s, d) => s + d.due, 0),
};
const grandTotal = totals.new + totals.learn + totals.due;

const categories = [
  { icon: BookOpen, label: "New", count: totals.new, color: "text-blue-400", bg: "bg-blue-400/10" },
  { icon: RotateCcw, label: "Learn", count: totals.learn, color: "text-amber-400", bg: "bg-amber-400/10" },
  { icon: GraduationCap, label: "Due", count: totals.due, color: "text-primary", bg: "bg-primary/10" },
];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(263_60%_60%_/_0.12),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_50%,hsl(263_60%_60%_/_0.06),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-24 pb-20 md:pt-32 md:pb-28">
        <div className="grid gap-16 md:grid-cols-2 md:items-center">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-8"
          >
            <motion.div variants={fadeUp(reduce)} className="space-y-4">
              <div className="flex items-center gap-4">
                <img src="/logo.png" alt="USki" className="h-16 w-16 rounded-2xl md:h-20 md:w-20 lg:h-24 lg:w-24" />
                <motion.h1
                  className="text-6xl font-bold tracking-tighter leading-[0.9] md:text-7xl lg:text-8xl"
                  initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1.0, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="text-primary">US</span>
                  <span className="text-foreground">ki</span>
                </motion.h1>
              </div>

              <motion.p
                className="text-xl md:text-2xl text-muted-foreground font-medium tracking-tight max-w-[18ch]"
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                Learn smarter, not harder
              </motion.p>
            </motion.div>

            <motion.p
              variants={fadeUp(reduce)}
              className="text-base text-muted-foreground leading-relaxed max-w-[44ch]"
            >
              Create flashcards, study with FSRS, and get AI support. All in one place.
            </motion.p>

            <motion.div variants={fadeUp(reduce)} className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
              >
                <Link to="/login">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-2xl shadow-primary/5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm font-semibold">Today&apos;s Review</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{grandTotal} cards</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {categories.map((cat, i) => (
                    <motion.div
                      key={cat.label}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 1.0 + i * 0.2 }}
                      className={`rounded-lg ${cat.bg} p-3 text-center transition-transform hover:scale-[1.02]`}
                    >
                      <cat.icon className={`h-4 w-4 mx-auto mb-1.5 ${cat.color}`} />
                      <div className={`text-lg font-bold tabular-nums ${cat.color}`}>{cat.count}</div>
                      <div className="text-[10px] text-muted-foreground font-medium">{cat.label}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Daily progress</span>
                    <span>{Math.round(grandTotal * 0.36)} / {grandTotal}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <motion.div
                      className="h-2 rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: "36%" }}
                      transition={{ duration: 1.5, delay: 1.6, ease: "easeOut" }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  {decks.map((deck, i) => (
                    <motion.div
                      key={deck.name}
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.7, delay: 1.4 + i * 0.18 }}
                      className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
                    >
                      <span className="text-xs font-medium">{deck.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-right text-[11px] text-blue-400 font-medium">{deck.new}</span>
                        <span className="w-8 text-right text-[11px] text-amber-400 font-medium">{deck.learn}</span>
                        <span className="w-8 text-right text-[11px] text-primary font-medium">{deck.due}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-xl bg-primary/10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
