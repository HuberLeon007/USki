import { useState, useEffect, useRef, type FormEvent } from "react";
import { Loader2, Check, X, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/app/auth-context";
import { setUsername, checkUsername, deriveUsernameFromEmail, ApiError } from "@/lib/api";

interface UsernameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UsernameDialog({ open, onOpenChange }: UsernameDialogProps) {
  const { user, setNeedsUsername } = useAuth();
  const [username, setUsernameValue] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open && user?.email) {
      const derived = deriveUsernameFromEmail(user.email);
      setSuggestion(derived);
      setUsernameValue(derived);
      setAvailable(null);
      setError(null);
    }
  }, [open, user?.email]);

  useEffect(() => {
    if (username.length < 3) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    setAvailable(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkUsername(username);
        setAvailable(result.available);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [username]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (username.length < 3 || available === false) return;
    setLoading(true);
    setError(null);
    try {
      await setUsername(username);
      setNeedsUsername(false);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("This username is already taken.");
        setAvailable(false);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    setNeedsUsername(false);
    onOpenChange(false);
  }

  const isValid = username.length >= 3 && username.length <= 20 && /^[a-z0-9]+$/.test(username);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">Welcome to USki!</DialogTitle>
          <DialogDescription>
            Choose a username. You can skip this and set it later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username-dialog">Username</Label>
            <div className="relative">
              <Input
                id="username-dialog"
                type="text"
                placeholder="leonhuber"
                value={username}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "");
                  setUsernameValue(val);
                }}
                className="pr-10"
                maxLength={20}
                minLength={3}
                autoFocus
                disabled={loading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!checking && available === true && <Check className="h-4 w-4 text-green-500" />}
                {!checking && available === false && <X className="h-4 w-4 text-destructive" />}
              </div>
            </div>
            {suggestion && username === suggestion && (
              <p className="text-xs text-muted-foreground">
                Suggested from your email: {suggestion}
              </p>
            )}
            {available === false && (
              <p className="text-xs text-destructive">
                This username is already taken.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              3-20 characters, lowercase letters and numbers only.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={loading || !isValid || available === false}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              "Save username"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm text-muted-foreground"
            onClick={handleSkip}
            disabled={loading}
          >
            Skip for now
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
