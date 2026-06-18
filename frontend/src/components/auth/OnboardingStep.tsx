import { useState, useEffect, useRef, type FormEvent } from "react";
import { motion } from "motion/react";
import { Loader2, Check, X, Sparkles, AtSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/app/auth-context";
import {
  setUsername,
  checkUsername,
  deriveUsernameFromEmail,
  ApiError,
  SessionExpiredError,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface OnboardingStepProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Onboarding step shown when a first-time user has no username yet.
 *
 * It keeps the claim UI (username field + live availability via `checkUsername`,
 * submit via `setUsername`) and an always-present skip control (R8.1).
 *
 * On SKIP, a username is DERIVED from the user's email
 * (`deriveUsernameFromEmail`) and ASSIGNED through `setUsername` so onboarding
 * truly completes — there is no "skip without assigning" path. Because
 * `needs_username` is derived from username presence on the backend, assigning
 * a username (by claim OR skip) means onboarding is never shown again on
 * subsequent logins (R8.2, R8.3, R8.4). The `user####` fallback for short or
 * empty local parts is handled inside `deriveUsernameFromEmail` (R8.5, R8.6).
 *
 * Both `checkUsername`/`setUsername` are authenticated (`requireAuth`). When the
 * session can no longer be recovered, `apiFetch` throws `SessionExpiredError`;
 * we then route the user back to the Login email step via `endSession()` (R1.3).
 */
export function OnboardingStep({ open, onOpenChange }: OnboardingStepProps) {
  const { user, setNeedsUsername, endSession } = useAuth();
  const [username, setUsernameValue] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open && user?.email) {
      const derived = deriveUsernameFromEmail(user.email);
      setSuggestion(derived);
      setUsernameValue(derived);
      setAvailable(null);
      setError(null);
    }
  }, [open, user?.email]);

  useEffect(() => {
    if (username.length < 3) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    setAvailable(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkUsername(username);
        setAvailable(result.available);
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          endSession();
          return;
        }
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [username, endSession]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (username.length < 3 || available === false) return;
    setLoading(true);
    setError(null);
    try {
      await setUsername(username);
      // Username assigned → needs_username becomes false → onboarding is never
      // shown again (R8.4).
      setNeedsUsername(false);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        endSession();
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setError("That username is taken. Try another.");
        setAvailable(false);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * Skip onboarding by DERIVING and ASSIGNING a username from the user's email
   * (R8.2). The derivation (including the `user####` fallback) lives in
   * `deriveUsernameFromEmail` (R8.5, R8.6). Submitting via `setUsername`
   * completes onboarding so it is not shown again (R8.3, R8.4).
   */
  async function handleSkip() {
    if (!user?.email) return;
    setSkipping(true);
    setError(null);
    try {
      const derived = deriveUsernameFromEmail(user.email);
      await setUsername(derived);
      setNeedsUsername(false);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        endSession();
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        // Extremely unlikely for a derived name, but surface a retry path
        // rather than leaving the user stuck.
        setError("Couldn't assign a default username. Please pick one.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSkipping(false);
    }
  }

  const isValid = username.length >= 3 && username.length <= 20 && /^[a-z0-9]+$/.test(username);
  const busy = loading || skipping;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden border-border/70 bg-card/95 p-0 backdrop-blur-xl sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Agent greeting header */}
        <DialogHeader className="space-y-0 px-7 pt-7 text-left">
          <div className="flex items-start gap-3.5">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/30"
            >
              <Sparkles className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-400" />
            </motion.div>
            <div className="space-y-1 pt-0.5">
              <p className="label-mono">USki Assistant</p>
              <DialogTitle className="text-lg font-semibold leading-tight">
                Welcome aboard — let's pick your handle.
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="mt-3 text-sm text-muted-foreground">
            This is how other learners will find you. You can change it anytime in settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-7 pb-7 pt-5">
          <div className="space-y-2">
            <Label htmlFor="username-onboarding" className="label-mono">
              Username
            </Label>
            <div className="group relative">
              <AtSign className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                id="username-onboarding"
                type="text"
                placeholder="leonhuber"
                value={username}
                onChange={(e) =>
                  setUsernameValue(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
                }
                className="h-12 w-full rounded-xl border border-input bg-background/60 pl-10 pr-10 text-sm transition-all placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                maxLength={20}
                minLength={3}
                autoFocus
                disabled={busy}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!checking && available === true && <Check className="h-4 w-4 text-emerald-400" />}
                {!checking && available === false && <X className="h-4 w-4 text-destructive" />}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "text-xs",
                  available === false ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {available === false
                  ? "Already taken — try another."
                  : suggestion && username === suggestion
                    ? `Suggested from your email`
                    : "3–20 characters · lowercase letters and numbers"}
              </p>
              {isValid && available !== false && (
                <span className="font-mono text-xs text-muted-foreground">
                  {username}<span className="text-primary">#0000</span>
                </span>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="submit"
              className="h-11 w-full rounded-xl font-semibold shadow-lg shadow-primary/20"
              disabled={busy || !isValid || available === false}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Claim username"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-full text-sm text-muted-foreground"
              onClick={handleSkip}
              disabled={busy}
            >
              {skipping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Setting up…
                </>
              ) : (
                "I'll do this later"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
