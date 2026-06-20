import { useState } from "react";
import { toast } from "sonner";
import { Database, Loader2 } from "lucide-react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { CTASection } from "@/components/landing/CTASection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { tokenStorage, wipeDatabaseDev } from "@/lib/api";

export default function LandingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <Hero />
        <div className="mx-auto max-w-6xl px-4">
          <div className="h-px bg-border/60" />
        </div>
        <Features />
        <div className="mx-auto max-w-6xl px-4">
          <div className="h-px bg-border/60" />
        </div>
        <HowItWorks />
        <div className="mx-auto max-w-6xl px-4">
          <div className="h-px bg-border/60" />
        </div>
        <CTASection />
      </main>
      <LandingFooter />
      {import.meta.env.DEV && <DevWipeButton />}
    </div>
  );
}

/** Dev-only: nuke the entire database (all users + their data) and sign out. */
function DevWipeButton() {
  const [busy, setBusy] = useState(false);
  async function wipe() {
    if (!window.confirm("DEV: wipe the ENTIRE database (all users + data)? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await wipeDatabaseDev();
      tokenStorage.clear();
      toast.success(`Database wiped (${res.deleted_users} users removed).`);
    } catch {
      toast.error("Wipe failed (is the backend in dev mode?).");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={wipe}
      disabled={busy}
      title="DEV ONLY — wipe database"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive shadow-lg backdrop-blur transition-colors hover:bg-destructive/20 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
      Wipe DB (dev)
    </button>
  );
}
