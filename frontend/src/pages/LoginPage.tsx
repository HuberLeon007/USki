import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { Moon, Sun, ArrowLeft } from "lucide-react";
import { sendOtp, verifyOtp, getMe, tokenStorage, ApiError } from "@/lib/api";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import { EmailStep } from "@/components/auth/EmailStep";
import { OtpStep, type OtpStatus, type OtpErrorKind } from "@/components/auth/OtpStep";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { CardStackBackdrop } from "@/components/CardStackBackdrop";
import { Logo } from "@/components/Logo";
import { createSocialBroker, getAppMode, socialErrorMessage } from "@/lib/social/create-broker";
import { shouldEnforceEmailSecondFactor } from "@/lib/two-factor";
import type { Provider } from "@/lib/social/types";

type Step = "email" | "otp" | "twofa";

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

  // Email-OTP second factor (R: 2FA). When a social login belongs to a user
  // who enabled 2FA (prod only), we gate completion behind a second email code:
  // the first-factor session is discarded and a fresh session is minted by the
  // second-factor verifyOtp, so we never stay signed in before it passes.
  const [twofaEmail, setTwofaEmail] = useState("");
  const [twofaStatus, setTwofaStatus] = useState<OtpStatus>("idle");
  const [twofaErrorKind, setTwofaErrorKind] = useState<OtpErrorKind>(null);
  const [twofaPending, setTwofaPending] = useState<Awaited<ReturnType<typeof verifyOtp>> | null>(null);

  // Social login: which provider button is mid-flight, and the English error to
  // show after a failure (cancellation shows nothing). The OTP email step stays
  // usable throughout (Requirement 11.2, 11.3, 11.5).
  const [socialLoading, setSocialLoading] = useState<Provider | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);

  const otpBusy = otpStatus === "verifying" || otpStatus === "verified";
  const twofaBusy = twofaStatus === "verifying" || twofaStatus === "verified";

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

  // Second-factor OTP entry (social + 2FA). Reuses the OTP phase machine.
  async function handleTwofaSubmit(code: string) {
    setError(null);
    setTwofaErrorKind(null);
    setTwofaStatus("verifying");
    try {
      const result = await verifyOtp(twofaEmail, code);
      setTwofaPending(result);
      setTwofaStatus("verified");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setTwofaErrorKind("invalid");
        setError("Wrong code. Please try again.");
      } else {
        setTwofaErrorKind("network");
        setError("Verification failed. Please try again.");
      }
      setTwofaStatus("error");
    }
  }

  function handleTwofaComplete() {
    if (twofaPending) {
      setSession(
        twofaPending.access_token,
        twofaPending.refresh_token,
        twofaPending.user_id,
        twofaPending.email,
        twofaPending.needs_username,
      );
    }
    navigate("/dashboard", { replace: true });
  }

  function handleTwofaBack() {
    // Abandon the gated login entirely; no session was ever installed.
    tokenStorage.clear();
    setTwofaPending(null);
    setTwofaStatus("idle");
    setTwofaErrorKind(null);
    setError(null);
    setStep("email");
  }

  /**
   * Start a social login for the chosen provider through the AuthBroker seam.
   *
   * - `session` -> install the session exactly like OTP (auth-context.setSession
   *   persists tokens via tokenStorage and the user lands on the same post-login
   *   destination; onboarding runs on the dashboard when needs_username).
   * - `redirecting` -> the browser is navigating to the provider; keep the
   *   button busy until the page unloads.
   * - `cancelled` -> return to the interactive LoginPage with the OTP step still
   *   usable, no error.
   * - thrown SocialLoginError -> show an English message; OTP step stays usable
   *   (Requirement 2.4, 2.5, 4.3, 8.4, 11.4, 11.5).
   */
  async function handleSocialSelect(provider: Provider) {
    setSocialError(null);
    setSocialLoading(provider);
    try {
      const broker = await createSocialBroker();
      const outcome = await broker.startSocialLogin(provider);
      if (outcome.kind === "session") {
        const s = outcome.session;
        // Read the account's 2FA preference + email. We must query /me, which
        // needs a token, so the first-factor tokens are stored just long enough
        // to read the profile, then cleared if a second factor is required.
        tokenStorage.set(s.access_token, s.refresh_token);
        let twoFa = false;
        let email = s.email;
        try {
          const me = await getMe();
          twoFa = me.two_factor_email === true;
          email = me.email ?? s.email;
        } catch {
          /* treat an unreadable profile as no 2FA */
        }
        if (shouldEnforceEmailSecondFactor(getAppMode(), twoFa, email)) {
          // Discard the first-factor session: stay signed out until the second
          // email code passes (a refresh mid-flow must not bypass the gate).
          tokenStorage.clear();
          setTwofaEmail(email as string);
          setTwofaStatus("idle");
          setTwofaErrorKind(null);
          setError(null);
          try {
            await sendOtp(email as string);
          } catch {
            /* non-fatal: the user can use Resend on the next screen */
          }
          setSocialLoading(null);
          setStep("twofa");
          return;
        }
        // No second factor: complete exactly like the OTP path.
        setSession(s.access_token, s.refresh_token, s.user_id, s.email, s.needs_username);
        navigate("/dashboard", { replace: true });
        return;
      }
      if (outcome.kind === "redirecting") {
        // Full-page navigation to the provider is underway; stay in the loading
        // state until the document unloads.
        return;
      }
      // cancelled: no session, no error — restore the interactive state.
      setSocialLoading(null);
    } catch (err) {
      setSocialError(socialErrorMessage(err));
      setSocialLoading(null);
    }
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
                {(step === "otp" || step === "twofa") && (
                  <button
                    onClick={step === "twofa" ? handleTwofaBack : handleBack}
                    disabled={loading || otpBusy || twofaBusy}
                    className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}
                <h1 className="text-xl font-semibold tracking-tight">
                  {step === "email"
                    ? "Sign in to USki"
                    : step === "twofa"
                      ? "Two-step verification"
                      : "Check your email"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {step === "email"
                    ? "We'll email you a one-time code. No password needed."
                    : step === "twofa"
                      ? "Enter the code we emailed to finish signing in."
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
              ) : step === "twofa" ? (
                <OtpStep
                  email={twofaEmail}
                  onSubmit={handleTwofaSubmit}
                  onResend={() => sendOtp(twofaEmail)}
                  onBack={handleTwofaBack}
                  status={twofaStatus}
                  error={error}
                  errorKind={twofaErrorKind}
                  onSuccessComplete={handleTwofaComplete}
                />
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

          {/* Social sign-in lives with the email step and is hidden during OTP
              entry so the two flows never compete for attention (R1.1, R11.1). */}
          {step === "email" && (
            <div className="mt-6">
              <SocialButtons
                onSelect={handleSocialSelect}
                loadingProvider={socialLoading}
                disabled={loading}
                error={socialError}
              />
            </div>
          )}
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
