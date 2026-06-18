import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroDemo } from "@/components/landing/HeroDemo";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.18 } },
};

const fadeUp = (reduce: boolean) => ({
  hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
});

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Subtle primary-tinted glows — read as a faint accent in both themes */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(263_60%_60%_/_0.12),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_50%,hsl(263_60%_60%_/_0.05),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-24 pb-20 md:pt-28 md:pb-24">
        {/* Headline column — centered above the dashboard preview */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-3xl space-y-7 text-center"
        >
          <motion.div variants={fadeUp(reduce)} className="space-y-5">
            <div className="flex items-center justify-center gap-4">
              <img
                src="/logo.png"
                alt="USki"
                className="h-14 w-14 rounded-2xl md:h-16 md:w-16"
              />
              <motion.h1
                className="text-5xl font-bold tracking-tighter leading-[0.9] md:text-6xl lg:text-7xl"
                initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="text-primary">US</span>
                <span className="text-foreground">ki</span>
              </motion.h1>
            </div>

            <motion.p
              className="mx-auto max-w-[24ch] text-xl font-medium tracking-tight text-muted-foreground md:text-2xl"
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              Learn smarter, not harder
            </motion.p>
          </motion.div>

          <motion.p
            variants={fadeUp(reduce)}
            className="mx-auto max-w-[48ch] text-base leading-relaxed text-muted-foreground"
          >
            Create flashcards, study with FSRS, and get AI support. All in one place.
          </motion.p>

          <motion.div
            variants={fadeUp(reduce)}
            className="flex justify-center"
          >
            <Button
              asChild
              size="lg"
              className="bg-primary px-8 text-primary-foreground hover:bg-primary/90"
            >
              <Link to="/login">
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Interactive dashboard preview (client-only mock) */}
        <div className="mx-auto mt-16 max-w-5xl md:mt-20">
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}
