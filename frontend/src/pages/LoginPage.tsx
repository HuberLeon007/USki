import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { sendOtp, verifyOtp, ApiError } from "@/lib/api";
import { useAuth } from "@/app/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmailStep } from "@/components/auth/EmailStep";
import { OtpStep } from "@/components/auth/OtpStep";

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

  async function handleEmailSubmit(emailValue: string) {
    setLoading(true);
    setError(null);
    setEmail(emailValue);
    try {
      await sendOtp(emailValue);
      setStep("otp");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(code: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await verifyOtp(email, code);
      setSession(
        result.access_token,
        result.refresh_token,
        result.user_id,
        result.email,
        result.needs_username,
      );
      // Brief delay for success animation before navigating
      await new Promise((r) => setTimeout(r, 600));
      if (result.needs_username) {
        navigate("/setup-username", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Wrong code. Please try again.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("email");
    setError(null);
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
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
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <img src="/logo.png" alt="USki" className="h-10 w-10 rounded-xl" />
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-primary">US</span>ki
            </span>
          </Link>
        </div>
        <Card className="border-border/60 shadow-lg shadow-primary/5">
          <CardHeader className="text-center pb-2 pt-8">
            <CardTitle className="text-2xl">
              {step === "email" ? "Welcome to USki" : "Enter code"}
            </CardTitle>
            <CardDescription className="mt-1">
              {step === "email"
                ? "Enter your email to receive a sign-in code."
                : "Check your inbox."}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {step === "email" ? (
                  <EmailStep
                    onSubmit={handleEmailSubmit}
                    loading={loading}
                    error={error}
                  />
                ) : (
                  <OtpStep
                    email={email}
                    onSubmit={handleOtpSubmit}
                    onBack={handleBack}
                    loading={loading}
                    error={error}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
