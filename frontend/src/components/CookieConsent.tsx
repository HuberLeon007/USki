import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Cookie, X } from "lucide-react";

const CONSENT_KEY = "uski.cookie.consent.v2";

function hasConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    // localStorage unavailable (e.g. privacy mode): treat as not yet consented.
    return false;
  }
}

/**
 * Compact, unobtrusive cookie/local-storage notice pinned to the bottom-right.
 * USki only uses technically necessary local storage (no tracking), so this is
 * an acknowledgement rather than a gate. Mounted app-wide; once dismissed or
 * accepted it never shows again.
 */
export function CookieConsent() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);

  // Check persisted consent after mount to avoid SSR/hydration mismatches.
  useEffect(() => {
    if (!hasConsented()) setVisible(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {
      // Ignore write failures; banner simply reappears next session.
    }
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label="Local storage notice"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 right-4 z-[100] w-[min(20rem,calc(100vw-2rem))]"
        >
          <div className="relative flex items-start gap-3 rounded-2xl border border-border/70 bg-card/90 p-3.5 pr-9 shadow-xl shadow-black/10 backdrop-blur-xl">
            <span
              aria-hidden
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <Cookie className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs leading-relaxed text-muted-foreground">
                We only use essential local storage for login and settings. No tracking, no ads.{" "}
                <Link
                  to="/privacy"
                  className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Learn more
                </Link>
                .
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Got it
              </button>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss notice"
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
