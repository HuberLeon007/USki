import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-24 md:pb-24 md:pt-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center lg:text-left"
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Lerne smarter, nicht härter
          </h1>
          <p className="mx-auto mt-6 max-w-[50ch] text-lg text-muted-foreground lg:mx-0">
            Erstelle Karteikarten, lerne mit dem FSRS-Algorithmus und lass dich
            von der KI unterstützen. Alles in einer App.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
              onClick={() => navigate("/login")}
            >
              Jetzt kostenlos starten
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <button
              onClick={() =>
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
              }
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Mehr erfahren
              <ChevronDown className="size-4" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-lg lg:max-w-none"
        >
          <div className="relative">
            <div className="rounded-t-xl border border-border bg-card p-2 shadow-2xl">
              <div className="aspect-[16/10] overflow-hidden rounded-md bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/5">
                <div className="flex h-full">
                  <div className="hidden w-1/4 border-r border-border/50 bg-muted/50 p-3 sm:block">
                    <div className="mb-3 h-3 w-12 rounded bg-muted-foreground/20" />
                    <div className="space-y-2">
                      <div className="h-2.5 w-full rounded bg-muted-foreground/15" />
                      <div className="h-2.5 w-3/4 rounded bg-muted-foreground/10" />
                      <div className="h-2.5 w-full rounded bg-muted-foreground/15" />
                    </div>
                  </div>
                  <div className="flex-1 p-4">
                    <div className="mb-4 h-3 w-1/3 rounded bg-muted-foreground/20" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-16 rounded-md bg-muted-foreground/10" />
                      <div className="h-16 rounded-md bg-muted-foreground/10" />
                      <div className="h-16 rounded-md bg-muted-foreground/10" />
                      <div className="h-16 rounded-md bg-muted-foreground/10" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-auto h-3 w-[92%] rounded-b-lg border border-t-0 border-border bg-muted shadow-lg" />
            <div className="mx-auto h-1.5 w-[40%] rounded-b-md bg-muted-foreground/20" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
