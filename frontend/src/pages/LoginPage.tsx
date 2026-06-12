import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EmailStep } from "@/components/auth/EmailStep";
import { OtpStep } from "@/components/auth/OtpStep";

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="relative w-full max-w-md">
        <div className="absolute right-0 top-0">
          <ThemeToggle />
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-8 text-center">
            <Link to="/" className="text-2xl font-bold tracking-tight">
              USki
            </Link>
            {step === "email" && (
              <p className="mt-2 text-sm text-muted-foreground">
                Gib deine E-Mail ein, um einen Anmeldecode zu erhalten.
              </p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {step === "email" ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <EmailStep
                  onCodeSent={(e) => {
                    setEmail(e);
                    setStep("otp");
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <OtpStep email={email} onBack={() => setStep("email")} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Zurück zur Startseite
          </Link>
        </p>
      </div>
    </div>
  );
}
