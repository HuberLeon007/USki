import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendOtp } from "@/lib/api";
import { toast } from "sonner";

interface EmailStepProps {
  onCodeSent: (email: string) => void;
}

export function EmailStep({ onCodeSent }: EmailStepProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Bitte gib deine E-Mail ein.");
      return;
    }

    setIsLoading(true);
    try {
      await sendOtp(email);
      onCodeSent(email);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.";
      toast.error(message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          type="email"
          placeholder="name@beispiel.de"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          disabled={isLoading}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Wird gesendet...
          </>
        ) : (
          "Code senden"
        )}
      </Button>
    </form>
  );
}
