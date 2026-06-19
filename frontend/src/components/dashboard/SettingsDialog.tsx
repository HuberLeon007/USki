import { useState, useEffect, useRef, type FormEvent } from "react";
import { useTheme } from "next-themes";
import { Loader2, Check, X, AtSign, Moon, Sun, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/app/auth-context";
import {
  changeUsernameFull,
  checkUsername,
  getMe,
  ApiError,
  SessionExpiredError,
  type UserResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 3–20 lowercase alphanumeric — same rule as onboarding (R9.2). */
function isValidUsername(value: string): boolean {
  return value.length >= 3 && value.length <= 20 && /^[a-z0-9]+$/.test(value);
}

/** Renders `username#discriminator`, or a neutral placeholder while unknown. */
function formatHandle(user: UserResponse | null): string {
  if (!user?.username) return "—";
  return user.discriminator ? `${user.username}#${user.discriminator}` : user.username;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user, setNeedsUsername, endSession } = useAuth();
  const { theme, setTheme } = useTheme();

  // The locally tracked user so the displayed handle updates after a change
  // without depending on a context refresh round-trip.
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(user);
  const [username, setUsernameValue] = useState("");
  const [disc, setDisc] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Keep the local copy in sync with context whenever the dialog opens or the
  // context user changes, and seed the edit field with the current handle.
  useEffect(() => {
    if (open) {
      setCurrentUser(user);
      setUsernameValue(user?.username ?? "");
      setDisc(user?.discriminator ?? "");
      setAvailable(null);
      setError(null);
      setSuccess(false);
    }
  }, [open, user]);

  // Live availability check (debounced). A value equal to the current username
  // or one that fails validation is not checked.
  useEffect(() => {
    const unchanged = username === (currentUser?.username ?? "");
    if (!isValidUsername(username) || unchanged) {
      setChecking(false);
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
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          endSession();
          return;
        }
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [username, currentUser?.username, endSession]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(false);
    // R9.3: invalid input shows an inline error and is not submitted.
    if (!isValidUsername(username)) {
      setError("Username must be 3–20 lowercase letters or numbers.");
      return;
    }
    const discValid = /^\d{4}$/.test(disc);
    const usernameUnchanged = username === (currentUser?.username ?? "");
    const discUnchanged = disc === (currentUser?.discriminator ?? "");
    if (usernameUnchanged && discUnchanged) {
      return;
    }
    if (disc && !discValid) {
      setError("Discriminator must be exactly 4 digits.");
      return;
    }
    if (available === false) {
      setError("That username is taken. Try another.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // R9.4: update and read back the new username/discriminator.
      const updated = await changeUsernameFull(username, discValid ? disc : undefined);
      // Prefer the freshest server state; fall back to the PATCH payload.
      let next = updated;
      try {
        next = await getMe();
      } catch {
        // Non-fatal: the PATCH payload already reflects the change.
      }
      setCurrentUser(next);
      setUsernameValue(next.username ?? username);
      setDisc(next.discriminator ?? "");
      setNeedsUsername(false);
      setAvailable(null);
      setSuccess(true); // R9.5: surface the updated value.
    } catch (err) {
      // R9.6: on error, show a message and keep the previous username.
      if (err instanceof SessionExpiredError) {
        endSession();
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setError("That username is taken. Try another.");
        setAvailable(false);
      } else {
        setError("Could not update username. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    // R11.1/R11.2: clear tokens and return to the login page.
    endSession();
    onOpenChange(false);
  }

  const handle = formatHandle(currentUser);
  const unchanged = username === (currentUser?.username ?? "") && disc === (currentUser?.discriminator ?? "");
  const valid = isValidUsername(username);
  const canSubmit = valid && !unchanged && available !== false && !loading;
  const isDark = theme === "dark";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/70 bg-card/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold">Settings</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Manage your username, appearance, and session.
          </DialogDescription>
        </DialogHeader>

        {/* Username section (R9) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="label-mono">Username</Label>
            <span className="font-mono text-xs text-muted-foreground">{handle}</span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="group relative">
              <AtSign className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                id="settings-username"
                type="text"
                placeholder="leonhuber"
                value={username}
                onChange={(e) => {
                  setUsernameValue(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                  setError(null);
                  setSuccess(false);
                }}
                className="h-11 w-full rounded-xl border border-input bg-background/60 pl-10 pr-10 text-sm transition-all placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                maxLength={20}
                minLength={3}
                disabled={loading}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!checking && available === true && <Check className="h-4 w-4 text-emerald-400" />}
                {!checking && available === false && <X className="h-4 w-4 text-destructive" />}
              </div>
            </div>

            <p
              className={cn(
                "text-xs",
                available === false ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {available === false
                ? "Already taken — try another."
                : "3–20 characters · lowercase letters and numbers"}
            </p>

            <div className="flex items-center gap-2">
              <Label htmlFor="settings-disc" className="text-xs text-muted-foreground">
                Discriminator (optional, 4 digits)
              </Label>
              <input
                id="settings-disc"
                inputMode="numeric"
                value={disc}
                onChange={(e) => { setDisc(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(null); setSuccess(false); }}
                placeholder="0427"
                className="h-9 w-20 rounded-lg border border-input bg-background/60 px-2 text-center font-mono text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
                maxLength={4}
                disabled={loading}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && !error && (
              <p className="text-sm text-emerald-500">Username updated.</p>
            )}

            <Button
              type="submit"
              className="h-10 w-full rounded-xl font-semibold"
              disabled={!canSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save username"
              )}
            </Button>
          </form>
        </section>

        <Separator className="bg-border/60" />

        {/* Theme section (R10) — the only theme control in the authenticated app. */}
        <section className="space-y-3">
          <Label className="label-mono">Appearance</Label>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {isDark ? "Dark mode" : "Light mode"}
            </p>
            <div className="inline-flex rounded-xl border border-input bg-background/60 p-1">
              <Button
                type="button"
                variant={isDark ? "ghost" : "secondary"}
                size="sm"
                className="h-8 gap-1.5 rounded-lg px-3"
                aria-pressed={!isDark}
                onClick={() => setTheme("light")}
              >
                <Sun className="h-4 w-4" /> Light
              </Button>
              <Button
                type="button"
                variant={isDark ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 rounded-lg px-3"
                aria-pressed={isDark}
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4" /> Dark
              </Button>
            </div>
          </div>
        </section>

        <Separator className="bg-border/60" />

        {/* Logout section (R11) */}
        <section>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full gap-2 rounded-xl text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  );
}
