import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Ambient layered-flashcard backdrop — the USki signature motif.
 * Three offset translucent cards drift slowly behind the foreground.
 * Purely decorative; hidden from assistive tech and frozen under
 * prefers-reduced-motion.
 */
export function CardStackBackdrop({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  // Cards render in landscape (width > height) on all viewports. The
  // `max-sm:portrait:*` stacked variants map to the CSS media query
  // `(max-width: 640px) and (orientation: portrait)`, switching to portrait
  // dimensions only on mobile portrait. Because this is pure CSS, rotating the
  // device to landscape re-evaluates the media query and restores the landscape
  // layout automatically — no JS resize listener required.
  const cards = [
    {
      drift: "animate-drift-a",
      pos: "-left-10 top-1/4 -rotate-12",
      size: "h-44 w-56 max-sm:portrait:h-56 max-sm:portrait:w-44",
      tint: "from-primary/20 to-primary/5",
    },
    {
      drift: "animate-drift-b",
      pos: "right-0 top-1/3 rotate-6",
      size: "h-48 w-64 max-sm:portrait:h-64 max-sm:portrait:w-48",
      tint: "from-state-new/15 to-transparent",
    },
    {
      drift: "animate-drift-c",
      pos: "left-1/3 bottom-10 -rotate-3",
      size: "h-40 w-52 max-sm:portrait:h-52 max-sm:portrait:w-40",
      tint: "from-primary/10 to-transparent",
    },
  ];

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* soft violet glow anchor */}
      <div className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      {cards.map((c, i) => (
        <div
          key={i}
          className={cn(
            "absolute rounded-2xl border border-border/60 bg-gradient-to-br backdrop-blur-sm",
            c.pos,
            c.size,
            c.tint,
            !reduce && c.drift,
          )}
          style={{ boxShadow: "0 24px 60px -24px hsl(263 70% 40% / 0.4)" }}
        >
          {/* faux card content lines */}
          <div className="space-y-2 p-4 opacity-40">
            <div className="h-2 w-2/3 rounded-full bg-foreground/30" />
            <div className="h-2 w-1/2 rounded-full bg-foreground/20" />
          </div>
        </div>
      ))}

      {/* grain/vignette to keep it premium and quiet */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background" />
    </div>
  );
}
