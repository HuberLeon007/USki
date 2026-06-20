import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context";
import { useIsMobile } from "@/lib/use-is-mobile";
import type { ReactNode } from "react";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const DeckDetailPage = lazy(() => import("@/pages/DeckDetailPage"));
const DownloadPage = lazy(() => import("@/pages/DownloadPage"));

function LoadingSpinner() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent" />
    </div>
  );
}

/**
 * On phones the desktop web app is not usable, so every route except the
 * download page redirects to it. Desktop/tablet are unaffected.
 */
function MobileGate({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  if (isMobile && pathname !== "/download") return <Navigate to="/download" replace />;
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
      <MobileGate>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/decks/:deckId" element={<ProtectedRoute><DeckDetailPage /></ProtectedRoute>} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MobileGate>
    </Suspense>
  );
}
