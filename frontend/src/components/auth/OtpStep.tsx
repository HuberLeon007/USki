import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { verifyOtp, sendOtp } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface OtpStepProps {
  email: string;
  onBack: () => void;
}

export function OtpStep({ email, onBack }: OtpStepProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Bitte gib den 6-stelligen Code ein.");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const result = await verifyOtp(email, code);
      await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
    } catch {
      toast.error("Verifizierung fehlgeschlagen.");
      setError("Falscher Code, bitte erneut versuchen.");
      setCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await sendOtp(email);
      toast.success("Code erneut gesendet.");
    } catch {
      toast.error("Fehler beim Senden des Codes.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Verifiziere...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Label>Code eingeben</Label>
        <p className="text-sm text-muted-foreground">
          Wir haben einen 6-stelligen Code an{" "}
          <span className="font-medium text-foreground">{email}</span> gesendet.
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={handleVerify}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}

      <Button
        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
        onClick={handleVerify}
        disabled={code.length !== 6}
      >
        Verifizieren
      </Button>

      <div className="flex flex-col items-center gap-2 text-sm">
        <button
          type="button"
          onClick={handleResend}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Code erneut senden
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Andere E-Mail verwenden
        </button>
      </div>
    </div>
  );
}
