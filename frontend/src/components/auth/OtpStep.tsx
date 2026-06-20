import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const RESEND_SECONDS = 60; // A3 — default resend cooldown

/**
 * Ordered OTP phase machine (R7).
 *
 *   idle → verifying → green → spinner → checkmark → transition
 *                          ↘ error (wrong code / network failure)
 *
 * The success phases (green → spinner → checkmark → transition) advance via
 * `motion` `onAnimationComplete` callbacks rather than racing timers, so each
 * stage is guaranteed to finish before the next begins and before navigation
 * (R7.5). `onSuccessComplete` is invoked only after `transition` completes.
 */
type OtpPhase =
  | "idle"
  | "verifying"
  | "green"
  | "spinner"
  | "checkmark"
  | "transition"
  | "error";

/** Verification status owned by `LoginPage` and used to drive the phase machine. */
export type OtpStatus = "idle" | "verifying" | "verified" | "error";

/** Distinguishes a wrong code (clear digits) from a network/service error (retain digits). */
export type OtpErrorKind = "invalid" | "network" | null;

interface OtpStepProps {
  email: string;
  onSubmit: (code: string) => void;
  onResend: () => Promise<void>;
  onBack: () => void;
  /** Verification status from `LoginPage.verifyOtp`. */
  status: OtpStatus;
  error: string | null;
  /** Whether the current error is a wrong code (clear digits) or a network error (retain digits). */
  errorKind?: OtpErrorKind;
  /** Called once, only after the green → spinner → checkmark → transition sequence completes (R7.4/R7.5). */
  onSuccessComplete: () => void;
}

export function OtpStep({
  email,
  onSubmit,
  onResend,
  status,
  error,
  errorKind = null,
  onSuccessComplete,
}: OtpStepProps) {
  const reduce = useReducedMotion();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [phase, setPhase] = useState<OtpPhase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevStatusRef = useRef<OtpStatus>(status);

  const inSuccess =
    phase === "green" || phase === "spinner" || phase === "checkmark" || phase === "transition";
  const busy = status === "verifying" || inSuccess;

  // Animation durations (R7). Reduced motion collapses them to near-instant
  // while preserving ordering — callbacks still fire so the sequence completes.
  const dur = reduce
    ? { green: 0.01, spinner: 0.01, check: 0.01, transition: 0.01 }
    : { green: 0.35, spinner: 0.9, check: 0.5, transition: 0.45 };

  // R6.1/R6.2/R6.3: tick the countdown down to zero, then stop.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  // Drive the phase machine from the verification status owned by LoginPage.
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (status === "verifying") {
      setPhase("verifying");
    } else if (status === "idle") {
      setPhase("idle");
    } else if (status === "error") {
      setPhase("error");
      // R7.6: wrong code → clear digits. R7.7: network/service error → retain digits.
      if (prev !== "error" && errorKind !== "network") {
        setDigits(["", "", "", "", "", ""]);
        requestAnimationFrame(() => inputRefs.current[0]?.focus());
      }
    } else if (status === "verified") {
      // R7.1: begin the success sequence once. Guard against restarts on re-render.
      if (prev !== "verified") setPhase("green");
    }
    prevStatusRef.current = status;
  }, [status, errorKind]);

  async function handleResend() {
    if (secondsLeft > 0 || resending || busy) return;
    setResending(true);
    setResendError(null);
    try {
      await onResend();
      setSecondsLeft(RESEND_SECONDS); // R6.4: restart countdown on success
    } catch {
      // R6.5: show an error and keep the control enabled (do not restart countdown)
      setResendError("Couldn't resend the code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  function commit(next: string[]) {
    if (next.every((d) => d !== "")) {
      setPhase("verifying");
      onSubmit(next.join(""));
    }
  }

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    if (phase === "error") setPhase("idle");
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    commit(next);
  }

  function handleKeyDown(index: number, e: KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted.length) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]!;
    setDigits(next);
    if (phase === "error") setPhase("idle");
    const nextEmpty = next.findIndex((d) => d === "");
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    commit(next);
  }

  const boxState = inSuccess
    ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-400"
    : phase === "error"
      ? "border-destructive/70 bg-destructive/10 text-destructive"
      : "border-input bg-background/60 text-foreground";

  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <motion.div
            key={index}
            initial={false}
            animate={
              phase === "error"
                ? { x: [0, -5, 5, -5, 5, 0], transition: { duration: 0.4, delay: index * 0.04 } }
                : phase === "green"
                  ? {
                      scale: [1, 1.12, 1],
                      transition: { type: "spring", stiffness: 400, damping: 12, delay: index * 0.05 },
                    }
                  : {}
            }
          >
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              aria-label={`Digit ${index + 1}`}
              className={cn(
                "h-13 w-11 rounded-xl border text-center text-lg font-semibold transition-all duration-200 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed sm:w-12",
                "h-[3.25rem]",
                boxState,
              )}
              disabled={busy}
              autoFocus={index === 0}
            />
          </motion.div>
        ))}
      </div>

      {/* Success animation sequence (R7.1–R7.5). Each stage advances on
          onAnimationComplete, never on a timer racing the UI. The reserved
          height collapses while idle so there's no large empty gap. */}
      <div
        className={cn(
          "flex items-center justify-center gap-2 text-emerald-400 transition-[height] duration-200",
          phase === "idle" ? "h-1" : "h-10",
        )}
      >
        {inSuccess ? (
          <>
            {/* R7.1: green confirmation; advance to the single spinner. */}
            {phase === "green" && (
              <motion.span
                key="green-driver"
                className="block h-3 w-3 rounded-full bg-emerald-400"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: dur.green }}
                onAnimationComplete={() => setPhase("spinner")}
              />
            )}

            {/* R7.2: exactly one spinning circle (600–1200ms), then the checkmark. */}
            {phase === "spinner" && (
              <motion.svg
                key="spinner"
                width="34"
                height="34"
                viewBox="0 0 24 24"
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: dur.spinner, ease: "linear" }}
                onAnimationComplete={() => setPhase("checkmark")}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.2"
                  strokeWidth="2.5"
                />
                <path
                  d="M12 3 a9 9 0 0 1 9 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </motion.svg>
            )}

            {/* R7.3: exactly one drawn checkmark via pathLength (300–800ms),
                then advance to the step transition (R7.4). */}
            {(phase === "checkmark" || phase === "transition") && (
              <svg width="34" height="34" viewBox="0 0 24 24" aria-label="Verified">
                <motion.path
                  d="M5 12.5 L10 17.5 L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: dur.check, ease: "easeOut" }}
                  onAnimationComplete={() => setPhase((p) => (p === "checkmark" ? "transition" : p))}
                />
              </svg>
            )}

            {/* R7.4/R7.5: the step transition; only now is navigation released. */}
            {(phase === "checkmark" || phase === "transition") && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="text-sm font-medium text-emerald-400"
              >
                Success! Redirecting…
              </motion.span>
            )}
            {phase === "transition" && (
              <motion.span
                key="transition-driver"
                className="sr-only"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: dur.transition }}
                onAnimationComplete={onSuccessComplete}
              />
            )}
          </>
        ) : (
          <AnimatePresence mode="wait">
            {phase === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-sm text-destructive"
              >
                <X className="h-4 w-4" /> {error ?? "Wrong code. Try again."}
              </motion.div>
            )}
            {phase === "verifying" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Sent to <span className="font-medium text-foreground">{email}</span>
      </p>

      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={handleResend}
          disabled={secondsLeft > 0 || resending || busy}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:text-muted-foreground"
        >
          {resending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resending…
            </>
          ) : secondsLeft > 0 ? (
            `Resend code in ${secondsLeft}s`
          ) : (
            "Resend code"
          )}
        </button>
        {resendError && (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <X className="h-3.5 w-3.5" /> {resendError}
          </span>
        )}
      </div>
    </div>
  );
}
