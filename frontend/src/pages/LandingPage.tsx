import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { CTASection } from "@/components/landing/CTASection";
import { LandingFooter } from "@/components/landing/LandingFooter";

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
    </div>
  );
}
