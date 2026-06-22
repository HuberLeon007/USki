import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useReducedMotion, motion } from "motion/react";
import { useAuth } from "@/app/auth-context";
import { createSupabaseBroker } from "@/lib/social/create-broker";
import { recordSession } from "@/lib/api";
import { Logo } from "@/components/Logo";

/**
 * OAuth callback page (social-login), mounted at `/auth/callback`.
 *
 * After a provider returns the user here, Supabase has exchanged the code and
 * established a session. This page reads that session through the
 * `SupabaseOAuthAdapter`, installs it via the unchanged `auth-context.setSession`
 * (so tokens persist through `tokenStorage` exactly like an OTP session), then
 * reconciles `needs_username` against the backend `/auth/me` via `refreshUser`
 * before routing onward to the shared post-login destination. The dashboard
 * surfaces the onboarding step when a username is still required
 * (Requirement 2.4, 2.5, 4.3, 8.2, 8.4).
 *
 * A cancelled authorization or any failure routes the user back to `/login`
 * with the interactive OTP step intact (Requirement 11.4, 11.5).
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setSession, refreshUser } = useAuth();
  const reduce = useReducedMotion();
  // React runs effects twice under StrictMode in dev; process the callback once.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    let cancelled = false;
    (async () => {
      try {
        const broker = createSupabaseBroker();
        const outcome = await broker.handleOAuthCallback();
        if (cancelled) return;

        if (outcome.kind === "session") {
          const s = outcome.session;
          setSession(s.access_token, s.refresh_token, s.user_id, s.email, s.needs_username);
          // OAuth completes client-side via Supabase, so record the device/
          // session explicitly (IP + map + login alert). Best-effort.
          void recordSession(s.refresh_token).catch(() => {});
          // Reconcile needs_username against the backend so onboarding gating
          // reflects the authoritative profile, not just session metadata.
          await refreshUser();
          if (cancelled) return;
          navigate("/dashboard", { replace: true });
          return;
        }

        // cancelled: no session was established; return to the login page.
        navigate("/login", { replace: true });
      } catch {
        // Any failure (provider error, unconfigured provider) returns the user
        // to the interactive login page where the OTP step remains usable.
        if (!cancelled) navigate("/login", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, setSession, refreshUser]);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-4">
      <Logo imgClassName="h-16 w-16" textClassName="text-3xl" />
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <motion.span
          className="block h-5 w-5 rounded-full border-2 border-muted-foreground border-t-transparent"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={reduce ? undefined : { duration: 0.8, ease: "linear", repeat: Infinity }}
          aria-hidden="true"
        />
        Completing sign-in…
      </div>
    </div>
  );
}
