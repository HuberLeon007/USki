import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <section className="px-4 py-24">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 p-8 text-center sm:p-12"
      >
        <h2 className="text-2xl font-bold text-white sm:text-4xl">
          Bereit smarter zu lernen?
        </h2>
        <p className="mx-auto mt-4 max-w-[40ch] text-white/80">
          Kostenlos. Keine Kreditkarte erforderlich.
        </p>
        <Button
          size="lg"
          className="mt-8 bg-white text-blue-600 hover:bg-white/90"
          onClick={() => navigate("/login")}
        >
          Jetzt kostenlos starten
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </motion.div>
    </section>
  );
}
