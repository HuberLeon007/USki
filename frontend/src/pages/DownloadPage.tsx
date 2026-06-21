import { motion, useReducedMotion } from "motion/react";
import { Download, Monitor, Smartphone, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/**
 * Real APK URL, injected at build time via VITE_APK_URL (e.g. an EAS build
 * artifact link or a file served from /public). When unset, no download is
 * offered - we never serve the SPA's index.html disguised as an .apk.
 */
const APK_URL = import.meta.env.VITE_APK_URL as string | undefined;

/**
 * Mobile gateway. The desktop web app is not usable on phones, so phone visitors
 * land here to get the native app. Shows a real download only when an APK has
 * actually been published; otherwise a clear "coming soon" state.
 */
export default function DownloadPage() {
  const reduce = useReducedMotion();
  const available = Boolean(APK_URL);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent" />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-7"
      >
        <Logo imgClassName="h-14 w-14" textClassName="text-2xl" />

        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Smartphone className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">USki is built for the app on phones</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {available
              ? "The web version runs on desktop and tablet. On your phone, install the native app for the full experience."
              : "The web version runs on desktop and tablet. The Android app is on the way - it isn't published yet."}
          </p>
        </div>

        {available ? (
          <a href={APK_URL} download className="w-full">
            <Button className="w-full gap-2 rounded-2xl text-base font-semibold" style={{ height: "3.25rem" }}>
              <Download className="h-5 w-5" /> Download the app
            </Button>
          </a>
        ) : (
          <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-4 py-3.5 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" /> Android app coming soon
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Monitor className="h-4 w-4" />
          <span>On a computer? Open USki at this address in your browser.</span>
        </div>
      </motion.div>
    </div>
  );
}
