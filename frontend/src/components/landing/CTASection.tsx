import { Link } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowRight, Sparkles, Download } from "lucide-react";

export function CTASection() {
  const reduce = useReducedMotion();

  // Staggered reveal for the inner content (badge -> heading -> sub -> button).
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28, scale: 0.985 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card px-8 py-20 text-center shadow-2xl shadow-primary/5 md:px-16"
      >
        {/* Drifting aurora glow — two soft blobs slowly orbiting behind the text. */}
        {!reduce && (
          <>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl"
              animate={{ x: [0, 60, 0], y: [0, 40, 0], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl"
              animate={{ x: [0, -50, 0], y: [0, -30, 0], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        {/* Static base wash so reduced-motion users still get depth. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,hsl(263_60%_60%_/_0.12),transparent)]" />
        {/* Top hairline highlight. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.5 }}
          className="relative space-y-6"
        >
          <motion.span
            variants={item}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Free forever to start
          </motion.span>

          <motion.h2
            variants={item}
            className="text-3xl font-bold tracking-tight md:text-5xl lg:text-6xl"
          >
            Ready to learn smarter?
          </motion.h2>

          <motion.p
            variants={item}
            className="mx-auto max-w-[42ch] text-lg text-muted-foreground"
          >
            Start for free. No credit card required.
          </motion.p>

          <motion.div variants={item}>
            <motion.div
              whileHover={reduce ? undefined : { scale: 1.04 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="inline-block"
            >
              <Link
                to="/login"
                className="group/btn relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                {/* Sheen sweep on hover. */}
                {!reduce && (
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full"
                  />
                )}
                <span className="relative">Get started for free</span>
                <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>

          <motion.div variants={item}>
            <a
              href="/uski.apk"
              download
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-6 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              <Download className="h-4 w-4" />
              Download the Android app (APK)
            </a>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
