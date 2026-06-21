import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, MousePointerClick, ChevronDown, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { HeroDemo } from "@/components/landing/HeroDemo";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.16, delayChildren: 0.1 } },
};

const fadeUp = (reduce: boolean) => ({
  hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
});

function scrollToPreview() {
  const hero = document.getElementById("hero");
  if (!hero) {
    document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  // Scroll so the END of the hero (card-background) section lands right under the
  // sticky navbar — i.e. the hero/preview boundary sits at the navbar's bottom.
  const nav = document.querySelector("nav")?.offsetHeight ?? 64;
  const top = hero.offsetTop + hero.offsetHeight - nav;
  window.scrollTo({ top, behavior: "smooth" });
}

/**
 * Ambient flashcard field behind the hero — the USki signature motif (same
 * language as the login backdrop). Cards sit around the edges, drift slowly,
 * and stay quiet behind a center scrim + vignette so the headline reads clean.
 */
function HeroCards({ reduce }: { reduce: boolean }) {
  const cards = [
    { pos: "left-[4%] top-[15%] -rotate-12", size: "h-40 w-52", tint: "from-primary/20 to-primary/5", drift: "animate-drift-a", delay: "0s" },
    { pos: "right-[5%] top-[11%] rotate-6", size: "h-44 w-56", tint: "from-state-new/15 to-transparent", drift: "animate-drift-b", delay: "-3s" },
    { pos: "left-[-3%] top-[45%] rotate-6", size: "h-36 w-48", tint: "from-state-learn/14 to-transparent", drift: "animate-drift-c", delay: "-1.5s" },
    { pos: "right-[-2%] top-[40%] -rotate-3", size: "h-40 w-52", tint: "from-primary/12 to-transparent", drift: "animate-drift-a", delay: "-5s" },
    { pos: "left-[12%] bottom-[10%] rotate-3", size: "h-36 w-48", tint: "from-state-due/14 to-transparent", drift: "animate-drift-b", delay: "-2.2s" },
    { pos: "right-[10%] bottom-[13%] -rotate-6", size: "h-44 w-56", tint: "from-primary/15 to-transparent", drift: "animate-drift-c", delay: "-4s" },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft violet depth glow */}
      <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]" />

      {cards.map((c, i) => (
        <div
          key={i}
          className={cn(
            "absolute rounded-2xl border border-border/50 bg-gradient-to-br opacity-70 backdrop-blur-sm md:opacity-100",
            c.pos,
            c.size,
            c.tint,
            !reduce && c.drift,
          )}
          style={{ boxShadow: "0 24px 60px -28px hsl(263 70% 40% / 0.4)", animationDelay: c.delay }}
        >
          <div className="space-y-2 p-4 opacity-40">
            <div className="h-2 w-2/3 rounded-full bg-foreground/30" />
            <div className="h-2 w-1/2 rounded-full bg-foreground/20" />
            <div className="h-2 w-1/3 rounded-full bg-foreground/15" />
          </div>
        </div>
      ))}

      {/* center scrim keeps the headline calm; vignette fades the edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_42%_at_50%_45%,var(--color-background)_25%,transparent_75%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background" />
    </div>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();

  return (
    <>
      {/* ── Full-height centered intro ─────────────────────────── */}
      <section id="hero" className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4">
        <HeroCards reduce={!!reduce} />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          {/* logo + wordmark */}
          <motion.div variants={fadeUp(reduce)} className="flex items-center gap-4">
            <motion.img
              src="/logo.png"
              alt="USki"
              className="h-16 w-16 rounded-2xl md:h-20 md:w-20"
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.7, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            />
            <h1 className="text-6xl font-bold tracking-tighter leading-[0.9] md:text-7xl lg:text-8xl">
              <span className="text-primary">US</span>
              <span className="text-foreground">ki</span>
            </h1>
          </motion.div>

          {/* slogan */}
          <motion.p
            variants={fadeUp(reduce)}
            className="mt-7 text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
          >
            Learn smart, not hard.
          </motion.p>

          {/* subtext — second sentence on its own line */}
          <motion.p
            variants={fadeUp(reduce)}
            className="mt-4 max-w-[46ch] text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Create flashcards, study with FSRS, and get AI support.
            <br />
            All in one place.
          </motion.p>

          {/* actions — on desktop: preview + get started; on phones the desktop
              preview is useless, so we funnel straight to the native app. */}
          <motion.div variants={fadeUp(reduce)} className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            {isMobile ? (
              <Button
                asChild
                size="lg"
                className="w-full gap-2 rounded-xl bg-primary px-8 text-primary-foreground hover:bg-primary/90"
              >
                <Link to="/download">
                  <Smartphone className="h-4 w-4" />
                  Get the app
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={scrollToPreview}
                  className="gap-2 rounded-xl border-border/70 bg-card/40 px-7 backdrop-blur-sm hover:bg-accent"
                >
                  <MousePointerClick className="h-4 w-4" />
                  Try interactive preview
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="gap-2 rounded-xl bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                >
                  <Link to="/login">
                    Get started for free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* scroll hint (desktop only — phones have nothing below to preview) */}
        {!reduce && !isMobile && (
          <motion.button
            type="button"
            onClick={scrollToPreview}
            aria-label="Scroll to preview"
            className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-muted-foreground/70 transition-colors hover:text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 8, 0] }}
            transition={{ opacity: { delay: 1.2, duration: 0.6 }, y: { delay: 1.2, duration: 1.8, repeat: Infinity, ease: "easeInOut" } }}
          >
            <ChevronDown className="h-6 w-6" />
          </motion.button>
        )}
      </section>

      {/* ── Interactive dashboard preview (desktop only) ── */}
      {!isMobile && (
        <section id="preview" className="relative overflow-hidden px-4 pb-24 pt-10 md:pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,hsl(263_60%_60%_/_0.07),transparent)]" />
          <div className="relative mx-auto max-w-5xl">
            <HeroDemo />
          </div>
        </section>
      )}
    </>
  );
}
