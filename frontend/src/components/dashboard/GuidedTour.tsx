import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { MousePointer2, X, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * One stop on the guided tour. `target` is a CSS selector for the element to
 * spotlight; when null the step is centered (intro / outro). `spotlightPadding`
 * widens the cutout around the element. `onEnter` runs when the step becomes
 * active (e.g. switch the dashboard to a given view so its target exists).
 */
export interface TourStep {
  title: string;
  body: string;
  target?: string | null;
  spotlightPadding?: number;
  onEnter?: () => void;
}

interface GuidedTourProps {
  steps: TourStep[];
  /** Called when the tour is skipped or finished (persist "seen"). */
  onClose: () => void;
  /** Called when the user completes the final step via its primary action. */
  onFinish?: () => void;
  finishLabel?: string;
  /** Optional secondary action on the final step (e.g. "Create a deck"). */
  onFinishSecondary?: () => void;
  finishSecondaryLabel?: string;
}

interface Box { top: number; left: number; width: number; height: number; }

const PAD = 8;

/**
 * Interactive product tour: a dimmed overlay with a spotlight cutout around the
 * current target, an animated hand cursor that glides to it, and a tooltip card
 * with Back / Next / Skip controls. Pure presentation over a list of
 * {@link TourStep}s; it knows nothing about the dashboard beyond the selectors
 * and callbacks it is handed. Honors reduced motion (cursor and reveals become
 * instant). Rendered in a portal on document.body so it floats above all UI.
 */
export function GuidedTour({ steps, onClose, onFinish, finishLabel = "Finish", onFinishSecondary, finishSecondaryLabel }: GuidedTourProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Run the step's side effect (e.g. switch view) when it becomes active.
  useEffect(() => {
    step?.onEnter?.();
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = useCallback(() => {
    if (!step?.target) { setBox(null); return; }
    const el = document.querySelector(step.target) as HTMLElement | null;
    // Target not laid out yet (e.g. a view switch is still settling): keep the
    // previous spotlight instead of flashing the full-screen dim. This is what
    // made Next-then-Back feel glitchy.
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = step.spotlightPadding ?? PAD;
    setBox({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
  }, [step]);

  // Measure after the step's onEnter has had a chance to lay things out, and on
  // resize / scroll so the spotlight tracks the target. (Repositioning, not an
  // animation loop.)
  useLayoutEffect(() => {
    measure();
    const t = setTimeout(measure, 360);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  // Esc skips the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const next = () => (isLast ? (onFinish ?? onClose)() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Viewport-centered fallback when there is no target (intro / outro).
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const center = { x: vw / 2, y: vh / 2 };

  // Tooltip + cursor anchor points.
  const anchor = box
    ? { x: box.left + box.width / 2, y: box.top + box.height }
    : center;
  // Place the tooltip below the target when there's room, otherwise above.
  const below = !box || anchor.y + 200 < vh;
  const cursorTarget = box
    ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    : center;

  const overlay = (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-label="Product tour" aria-modal="true">
      {/* Dim layer with a spotlight cutout (huge box-shadow spread = the dim). */}
      <AnimatePresence mode="wait">
        {box ? (
          <motion.div
            key="spot"
            className="pointer-events-none absolute rounded-2xl"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1, top: box.top, left: box.left, width: box.width, height: box.height }}
            transition={{ duration: reduce ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
              outline: "2px solid hsl(263 70% 65% / 0.9)",
            }}
          />
        ) : (
          <motion.div
            key="dim"
            className="absolute inset-0 bg-black/60"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Pulsing ring around the spotlight to draw the eye to the target. */}
      {box && !reduce && (
        <motion.div
          className="pointer-events-none absolute z-[205] rounded-2xl border-2 border-primary"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          animate={{ boxShadow: ["0 0 0 0 hsl(263 70% 65% / 0.55)", "0 0 0 12px hsl(263 70% 65% / 0)"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      {/* Click-catcher so the rest of the app isn't interactable mid-tour. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Animated hand cursor gliding to the target. White with a dark shadow so
          it stays visible on both the dark dim and the purple primary buttons.
          Only shown when there's an actual target to point at — on centered
          intro/outro steps it would just sit behind the tooltip card. */}
      {!reduce && box && (
        <motion.div
          className="pointer-events-none absolute z-[210] text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
          initial={false}
          animate={{ x: cursorTarget.x, y: cursorTarget.y }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          <motion.div
            animate={{ scale: [1, 0.82, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          >
            <MousePointer2 className="h-7 w-7 -translate-x-1 -translate-y-1 fill-white" strokeWidth={1.75} />
          </motion.div>
        </motion.div>
      )}

      {/* Tooltip card, anchored to the target (or centered). */}
      <motion.div
        key={index}
        className="absolute z-[220] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-card p-5 shadow-2xl"
        initial={reduce ? false : { opacity: 0, y: below ? 10 : -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={
          box
            ? {
                top: below ? Math.min(anchor.y + 14, vh - 220) : undefined,
                bottom: below ? undefined : Math.max(vh - box.top + 14, 16),
                left: Math.max(16, Math.min(anchor.x - 176, vw - 368)),
              }
            : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
        }
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Skip tour"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="label-mono mb-1 text-primary">
          Step {index + 1} of {steps.length}
        </p>
        <h2 className="text-base font-semibold">{step.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        {/* Progress dots. */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === index ? "w-5 bg-primary" : "w-1.5 bg-muted")
              }
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg" onClick={back}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {isLast && onFinishSecondary && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                onClick={onFinishSecondary}
              >
                {finishSecondaryLabel}
              </Button>
            )}
            <Button size="sm" className="h-9 gap-1.5 rounded-lg font-semibold" onClick={next}>
              {isLast ? finishLabel : "Next"}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(overlay, document.body);
}
