import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface EmailStepProps {
  onSubmit: (email: string) => void;
  loading: boolean;
  error: string | null;
}

export function EmailStep({ onSubmit, loading, error }: EmailStepProps) {
  const [email, setEmail] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (email.trim()) onSubmit(email.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="label-mono">
          Email address
        </Label>
        <div className="group relative">
          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-xl border border-input bg-background/60 pl-10 pr-3 text-sm transition-all placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
            required
            autoFocus
            disabled={loading}
          />
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <Button
        type="submit"
        className="group h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30"
        disabled={loading || !email.trim()}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending code…
          </>
        ) : (
          <>
            Continue
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  );
}
