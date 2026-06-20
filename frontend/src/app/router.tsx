import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context";
import { useIsMobile } from "@/lib/use-is-mobile";
import { CookieConsent } from "@/components/CookieConsent";
import type { ReactNode } from "react";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const AuthCallbackPage = lazy(() => import("@/pages/AuthCallbackPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const DeckDetailPage = lazy(() => import("@/pages/DeckDetailPage"));
const DownloadPage = lazy(() => import("@/pages/DownloadPage"));
const ImpressumPage = lazy(() => import("@/pages/ImpressumPage"));
const DatenschutzPage = lazy(() => import("@/pages/DatenschutzPage"));

/** Routes reachable on phones too (legal pages must stay accessible everywhere). */
const MOBILE_ALLOWED = new Set(["/download", "/legal", "/privacy"]);

function LoadingSpinner() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent" />
    </div>
  );
}

/**
 * Resets the window scroll to the top on every route change. Without this, a
 * client-side navigation keeps the previous scroll offset, so opening a legal
 * page (or returning to the landing page) could land mid-document. Smooth-scroll
 * preferences are respected; reduced-motion users get an instant jump.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

/**
 * On phones the desktop web app is not usable, so every route except the
 * download page redirects to it. Desktop/tablet are unaffected.
 */
function MobileGate({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  if (isMobile && !MOBILE_ALLOWED.has(pathname)) return <Navigate to="/download" replace />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { accessToken, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { accessToken, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (accessToken) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ScrollToTop />
      <MobileGate>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/decks/:deckId" element={<ProtectedRoute><DeckDetailPage /></ProtectedRoute>} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/legal" element={<ImpressumPage />} />
          <Route path="/privacy" element={<DatenschutzPage />} />
          {/* Legacy German paths kept as redirects so old links still resolve. */}
          <Route path="/impressum" element={<Navigate to="/legal" replace />} />
          <Route path="/datenschutz" element={<Navigate to="/privacy" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MobileGate>
      <CookieConsent />
    </Suspense>
  );
}
