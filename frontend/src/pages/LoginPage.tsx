import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { Moon, Sun, ArrowLeft } from "lucide-react";
import { sendOtp, verifyOtp, ApiError } from "@/lib/api";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import { EmailStep } from "@/components/auth/EmailStep";
import { OtpStep, type OtpStatus, type OtpErrorKind } from "@/components/auth/OtpStep";
import { CardStackBackdrop } from "@/components/CardStackBackdrop";
import { Logo } from "@/components/Logo";

type Step = "email" | "otp";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const reduce = useReducedMotion();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // OTP verification status drives the OtpStep success-animation phase machine (R7).
  const [otpStatus, setOtpStatus] = useState<OtpStatus>("idle");
  const [otpErrorKind, setOtpErrorKind] = useState<OtpErrorKind>(null);
  // Verified tokens, held until the success animation finishes (so the auth
  // state flip does not trigger an instant redirect before the animation plays).
  const [pending, setPending] = useState<Awaited<ReturnType<typeof verifyOtp>> | null>(null);

  const otpBusy = otpStatus === "verifying" || otpStatus === "verified";

  async function handleEmailSubmit(emailValue: string) {
    setLoading(true);
    setError(null);
    setEmail(emailValue);
    try {
      await sendOtp(emailValue);
      setOtpStatus("idle");
      setOtpErrorKind(null);
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(code: string) {
    setError(null);
    setOtpErrorKind(null);
    setOtpStatus("verifying");
    try {
      const result = await verifyOtp(email, code);
      // Hold the tokens — do NOT authenticate yet. Authenticating now would flip
      // the app to a signed-in state and redirect instantly, skipping the success
      // animation. We persist the session only in onSuccessComplete (R7.4/R7.5).
      setPending(result);
      setOtpStatus("verified");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // R7.6: wrong code → error feedback, clear digits, no success animation.
        setOtpErrorKind("invalid");
        setError("Wrong code. Please try again.");
      } else {
        // R7.7: network/service error → error feedback, retain digits, no success animation.
        setOtpErrorKind("network");
        setError("Verification failed. Please try again.");
      }
      setOtpStatus("error");
    }
  }

  // Invoked by OtpStep only after green → spinner → checkmark → transition completes (R7.4/R7.5).
  function handleSuccessComplete() {
    if (pending) {
      setSession(
        pending.access_token,
        pending.refresh_token,
        pending.user_id,
        pending.email,
        pending.needs_username,
      );
    }
    navigate("/dashboard", { replace: true });
  }

  function handleBack() {
    setStep("email");
    setError(null);
    setOtpStatus("idle");
    setOtpErrorKind(null);
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4">
      <CardStackBackdrop />

      <div className="absolute right-4 top-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[28rem]"
      >
        <div className="mb-8 flex flex-col items-center gap-5 text-center">
          <Link to="/" aria-label="USki home">
            <Logo imgClassName="h-20 w-20" textClassName="text-4xl" />
          </Link>
        </div>

        {/* Auth surface — a single raised card, the focal layer of the stack */}
        <div className="rounded-2xl border border-border/70 bg-card/80 p-8 backdrop-blur-xl stack-glow sm:p-9">
          <div className="mb-6 space-y-1.5">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {step === "otp" && (
                  <button
                    onClick={handleBack}
                    disabled={loading || otpBusy}
                    className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}
                <h1 className="text-xl font-semibold tracking-tight">
                  {step === "email" ? "Sign in to USki" : "Check your email"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {step === "email"
                    ? "We'll email you a one-time code. No password needed."
                    : "Enter the 6-digit code we just sent you."}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, x: step === "otp" ? 16 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: step === "otp" ? -16 : 16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === "email" ? (
                <EmailStep onSubmit={handleEmailSubmit} loading={loading} error={error} />
              ) : (
                <OtpStep
                  email={email}
                  onSubmit={handleOtpSubmit}
                  onResend={() => sendOtp(email)}
                  onBack={handleBack}
                  status={otpStatus}
                  error={error}
                  errorKind={otpErrorKind}
                  onSuccessComplete={handleSuccessComplete}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Back to home
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
