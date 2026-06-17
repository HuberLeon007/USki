import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OtpStepProps {
  email: string;
  onSubmit: (code: string) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}

export function OtpStep({ email, onSubmit, onBack, loading, error }: OtpStepProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [animState, setAnimState] = useState<"idle" | "success" | "error">("idle");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      setAnimState("error");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      const timer = setTimeout(() => setAnimState("idle"), 1200);
      prevErrorRef.current = error;
      return () => clearTimeout(timer);
    }
    if (!error) {
      prevErrorRef.current = null;
    }
  }, [error]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    if (animState !== "idle") setAnimState("idle");
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newDigits.every((d) => d !== "")) {
      onSubmit(newDigits.join(""));
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;
    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i]!;
    }
    setDigits(newDigits);
    if (animState !== "idle") setAnimState("idle");
    const nextEmpty = newDigits.findIndex((d) => d === "");
    const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
    inputRefs.current[focusIndex]?.focus();
    if (newDigits.every((d) => d !== "")) {
      onSubmit(newDigits.join(""));
    }
  }

  function getBoxColor(index: number): string {
    if (animState === "success") {
      return "border-green-500 bg-green-500/10 text-green-500";
    }
    if (animState === "error") {
      return "border-destructive bg-destructive/10 text-destructive";
    }
    return "border-input bg-background text-foreground";
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to{" "}
        <span className="font-medium text-foreground">{email}</span>.
      </p>
      <div className="flex justify-center gap-2.5">
        {digits.map((digit, index) => (
          <motion.div
            key={index}
            initial={false}
            animate={
              animState === "error"
                ? { x: [0, -4, 4, -4, 4, 0], transition: { duration: 0.4, delay: index * 0.05 } }
                : animState === "success"
                  ? { scale: [1, 1.1, 1], transition: { duration: 0.3, delay: index * 0.06 } }
                  : {}
            }
          >
            <input
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={`h-12 w-12 rounded-lg border-2 text-center text-lg font-semibold ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${getBoxColor(index)}`}
              disabled={loading || animState === "success"}
              autoFocus={index === 0}
              style={{ transitionDelay: `${index * 60}ms` }}
            />
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {animState === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 text-sm text-destructive"
          >
            <X className="h-4 w-4" />
            <span>Wrong code. Try again.</span>
          </motion.div>
        )}
        {animState === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 text-sm text-green-500"
          >
            <Check className="h-4 w-4" />
            <span>Verified!</span>
          </motion.div>
        )}
        {loading && animState === "idle" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying...
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="ghost"
        className="w-full text-sm text-muted-foreground hover:text-foreground"
        onClick={onBack}
        disabled={loading || animState === "success"}
        type="button"
      >
        Use a different email
      </Button>
    </div>
  );
}
