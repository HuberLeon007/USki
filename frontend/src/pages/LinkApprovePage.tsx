import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Loader2, Check, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { linkApprove, ApiError, SessionExpiredError } from "@/lib/api";

/**
 * Approve a cross-device sign-in (the QR target). Opened on an already
 * signed-in device by scanning the QR shown on a signed-out device. Approving
 * mints a fresh session for that other device. If not signed in, we bounce to
 * login first (the scanner is expected to be the trusted, logged-in phone).
 */
export default function LinkApprovePage() {
  const [params] = useSearchParams();
  const code = params.get("code") ?? "";
  const { accessToken, loading, endSession } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  async function approve() {
    setState("working");
    setError(null);
    try {
      await linkApprove(code);
      setState("done");
    } catch (err) {
      if (err instanceof SessionExpiredError) { endSession(); return; }
      setState("error");
      setError(err instanceof ApiError ? err.message : "Could not approve this device.");
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border border-border/70 bg-card/80 p-8 text-center backdrop-blur-xl"
      >
        <Link to="/" aria-label="USki home" className="mb-6 inline-flex">
          <Logo />
        </Link>

        {state === "done" ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Check className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold">Device approved</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              The other device is signing in now. You can close this page.
            </p>
            <Button className="mt-6 h-10 w-full rounded-xl" onClick={() => navigate("/dashboard")}>
              Back to USki
            </Button>
          </>
        ) : !code ? (
          <>
            <h1 className="text-lg font-semibold">Invalid link</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">This sign-in link is missing its code.</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MonitorSmartphone className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold">Sign in on another device?</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Approve only if you just started a sign-in on a device you trust.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-background/40 p-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Your account stays signed in here too.
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <Button
              className="mt-5 h-11 w-full rounded-xl font-semibold"
              disabled={state === "working"}
              onClick={approve}
            >
              {state === "working" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve sign-in"}
            </Button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="mt-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Not me, cancel
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
