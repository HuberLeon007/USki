import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ChatPanel } from "@/components/chat";

export default function DashboardPage() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem("uski-onboarded") !== "true";
  });
  const [chatOpen, setChatOpen] = useState(false);

  const handleOnboardingComplete = () => {
    localStorage.setItem("uski-onboarded", "true");
    setShowOnboarding(false);
  };

  return (
    <DashboardLayout>
      <div className="flex gap-6">
        <div className="flex-1">
          {showOnboarding ? (
            <OnboardingWizard onComplete={handleOnboardingComplete} />
          ) : (
            <EmptyState onCreateDeck={() => {}} />
          )}
        </div>

        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="hidden shrink-0 overflow-hidden lg:block"
            >
              <ChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transition-transform hover:scale-105"
        aria-label={chatOpen ? "Chat schließen" : "Chat öffnen"}
      >
        <MessageCircle className="size-5" />
      </button>
    </DashboardLayout>
  );
}
