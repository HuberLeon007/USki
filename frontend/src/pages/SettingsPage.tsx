import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "motion/react";
import {
  Loader2,
  Check,
  X,
  AtSign,
  Moon,
  Sun,
  LogOut,
  ArrowLeft,
  User,
  Palette,
  ShieldCheck,
  Sparkles,
  Compass,
  Monitor,
  MapPin,
  KeyRound,
  Plus,
  Trash2,
  Loader2 as Spinner,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/app/auth-context";
import { isAiEnabled, setAiEnabled } from "@/lib/ai-pref";
import {
  changeUsernameFull,
  checkUsername,
  getMe,
  getTwoFactor,
  setTwoFactor,
  listSessions,
  revokeSessionById,
  revokeOtherSessions,
  listPasskeys,
  registerPasskey,
  deletePasskey,
  ApiError,
  SessionExpiredError,
  type UserResponse,
  type SessionInfo,
  type PasskeyInfo,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/** The settings sections, rendered as a left rail (desktop) / top row (mobile). */
type Tab = "account" | "appearance" | "assistant" | "security";

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "assistant", label: "Assistant", icon: Sparkles },
  { id: "security", label: "Security", icon: ShieldCheck },
];

/** 3-20 lowercase alphanumeric - same rule as onboarding (R9.2). */
function isValidUsername(value: string): boolean {
  return value.length >= 3 && value.length <= 20 && /^[a-z0-9]+$/.test(value);
}

/**
 * Dedicated full-page settings surface with a tabbed left rail. Replaces the
 * old SettingsDialog: account (username), appearance (theme), security
 * (email-OTP 2FA), and session controls each live in their own section.
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, endSession } = useAuth();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Tab>("account");

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-sm font-semibold">Settings</h1>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-8">
        {/* Tab rail: left column on desktop, horizontal scroller on mobile. */}
        <nav
          className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col"
          aria-label="Settings sections"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={cn(
                "group flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                tab === id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4.5 w-4.5 shrink-0", tab === id && "text-primary")} />
              {label}
            </button>
          ))}
        </nav>

        {/* Panel */}
        <motion.div
          key={tab}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0 flex-1"
        >
          {tab === "account" && (
            <AccountPanel user={user} endSession={endSession} />
          )}
          {tab === "appearance" && <AppearancePanel />}
          {tab === "assistant" && <AssistantPanel />}
          {tab === "security" && (
            <div className="space-y-6">
              <SecurityPanel endSession={endSession} />
              <PasskeysPanel endSession={endSession} />
              <SessionsPanel endSession={endSession} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/** A titled card section used by every panel. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Username editing + logout. Mirrors the old SettingsDialog account logic. */
function AccountPanel({
  user,
  endSession,
}: {
  user: UserResponse | null;
  endSession: () => void;
}) {
  const { setNeedsUsername } = useAuth();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(user);
  const [username, setUsernameValue] = useState(user?.username ?? "");
  const [disc, setDisc] = useState(user?.discriminator ?? "");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setCurrentUser(user);
    setUsernameValue(user?.username ?? "");
    setDisc(user?.discriminator ?? "");
  }, [user]);

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
    if (!isValidUsername(username)) {
      setError("Username must be 3-20 lowercase letters or numbers.");
      return;
    }
    const discValid = /^\d{4}$/.test(disc);
    const usernameUnchanged = username === (currentUser?.username ?? "");
    const discUnchanged = disc === (currentUser?.discriminator ?? "");
    if (usernameUnchanged && discUnchanged) return;
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
      const updated = await changeUsernameFull(username, discValid ? disc : undefined);
      let next = updated;
      try {
        next = await getMe();
      } catch {
        /* PATCH payload already reflects the change */
      }
      setCurrentUser(next);
      setUsernameValue(next.username ?? username);
      setDisc(next.discriminator ?? "");
      setNeedsUsername(false);
      setAvailable(null);
      setSuccess(true);
    } catch (err) {
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

  const unchanged =
    username === (currentUser?.username ?? "") && disc === (currentUser?.discriminator ?? "");
  const valid = isValidUsername(username);
  const canSubmit = valid && !unchanged && available !== false && !loading;

  return (
    <div className="space-y-6">
      <Section title="Username" description="Your handle and optional 4-digit discriminator.">
        <div className="mb-3 flex items-center justify-between">
          <Label className="label-mono">Current</Label>
          {currentUser?.username ? (
            <span className="font-mono text-xs">
              <span className="text-muted-foreground">@</span>
              <span className="text-foreground">{currentUser.username}</span>
              {currentUser.discriminator && (
                <span className="text-muted-foreground">#{currentUser.discriminator}</span>
              )}
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">-</span>
          )}
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
              ? "Already taken - try another."
              : "3-20 characters; lowercase letters and numbers"}
          </p>

          <div className="flex items-center gap-2">
            <Label htmlFor="settings-disc" className="text-xs text-muted-foreground">
              Discriminator (optional, 4 digits)
            </Label>
            <input
              id="settings-disc"
              inputMode="numeric"
              value={disc}
              onChange={(e) => {
                setDisc(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError(null);
                setSuccess(false);
              }}
              placeholder="0427"
              className="h-9 w-20 rounded-lg border border-input bg-background/60 px-2 text-center font-mono text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
              maxLength={4}
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && !error && <p className="text-sm text-emerald-500">Username updated.</p>}

          <Button type="submit" className="h-10 rounded-xl font-semibold" disabled={!canSubmit}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save username"
            )}
          </Button>
        </form>
      </Section>

      <Section title="Session" description="Sign out on this device.">
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-2 rounded-xl text-destructive hover:text-destructive"
          onClick={endSession}
        >
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </Section>

      <Section title="Product tour" description="Replay the guided walkthrough of the app.">
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-2 rounded-xl"
          onClick={() => {
            const uid = user?.id ?? "anon";
            try { localStorage.removeItem(`uski.tour.done.${uid}`); } catch { /* ignore */ }
            navigate("/dashboard");
          }}
        >
          <Compass className="h-4 w-4" /> Replay tour
        </Button>
      </Section>
    </div>
  );
}

/** Theme switch - the only theme control in the authenticated app (R10). */
function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Section title="Appearance" description="Choose how USki looks on this device.">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{isDark ? "Dark mode" : "Light mode"}</p>
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
    </Section>
  );
}

/** Turn the Sero AI assistant on or off for this account (local preference). */
function AssistantPanel() {
  const { user } = useAuth();
  const uid = user?.id ?? "anon";
  const [enabled, setEnabled] = useState<boolean>(() => isAiEnabled(uid));

  useEffect(() => { setEnabled(isAiEnabled(uid)); }, [uid]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setAiEnabled(uid, next);
  }

  return (
    <Section
      title="AI assistant"
      description="Sero gives study help and answers questions about your decks."
    >
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/40 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Show Sero</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {enabled
              ? "On - the assistant is available across the app."
              : "Off - no assistant, greeting, or AI features are shown."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle the AI assistant"
          onClick={toggle}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
            enabled ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200",
              enabled ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>
    </Section>
  );
}

/** Email-OTP second factor toggle, backed by GET/PATCH /api/auth/2fa. */
function SecurityPanel({ endSession }: { endSession: () => void }) {
  const { refreshUser } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTwoFactor()
      .then((r) => {
        if (!cancelled) setEnabled(r.enabled);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          endSession();
          return;
        }
        if (!cancelled) {
          setEnabled(false);
          setError("Could not load your 2FA setting.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [endSession]);

  const toggle = useCallback(async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    // Optimistic flip so the switch feels instant; revert on failure.
    setEnabled(next);
    try {
      const result = await setTwoFactor(next);
      setEnabled(result.enabled);
      refreshUser();
    } catch (err) {
      setEnabled(!next);
      if (err instanceof SessionExpiredError) {
        endSession();
        return;
      }
      setError("Could not update 2FA. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [enabled, saving, refreshUser, endSession]);

  const loading = enabled === null;
  const on = enabled === true;

  return (
    <Section
      title="Two-factor authentication"
      description="Add an email one-time code as a second step when signing in."
    >
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/40 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Email verification code</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading
              ? "Loading..."
              : on
                ? "On - we'll email a code at sign-in."
                : "Off - sign in with one step only."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Toggle email two-factor authentication"
          disabled={loading || saving}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60",
            on ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200",
              on ? "translate-x-6" : "translate-x-1",
            )}
          />
          {saving && (
            <Loader2 className="absolute -right-6 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </Section>
  );
}

/** Relative "time ago" label for a session's last-active timestamp. */
function timeAgo(iso: string | null): string {
  if (!iso) return "recently";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "recently";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** One device row: device, location, last active, optional map, sign-out. */
function SessionRow({ s, busy, onSignOut }: { s: SessionInfo; busy: boolean; onSignOut: () => void }) {
  const location = s.city && s.country ? `${s.city}, ${s.country}` : s.country || (s.ip ? "Unknown location" : "Local network");
  const hasGeo = s.lat != null && s.lon != null;
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Monitor className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              {s.device ?? "Unknown device"}
              {s.current && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                  This device
                </span>
              )}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {location}
              {s.ip ? ` · ${s.ip}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Last active {timeAgo(s.last_seen_at)}</p>
          </div>
        </div>
        {!s.current && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            onClick={onSignOut}
          >
            {busy ? <Spinner className="h-4 w-4 animate-spin" /> : "Sign out"}
          </Button>
        )}
      </div>
      {hasGeo ? (
        <iframe
          title={`Map for ${s.device ?? "device"}`}
          loading="lazy"
          className="mt-3 h-56 w-full rounded-lg border border-border/40"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${(s.lon as number) - 0.05}%2C${(s.lat as number) - 0.05}%2C${(s.lon as number) + 0.05}%2C${(s.lat as number) + 0.05}&layer=mapnik&marker=${s.lat}%2C${s.lon}`}
        />
      ) : (
        <div className="mt-3">
          <iframe
            title={`Map for ${s.device ?? "device"}`}
            loading="lazy"
            className="h-56 w-full rounded-lg border border-border/40 opacity-70"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-20%2C30%2C45%2C65&layer=mapnik"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Approximate — signed in from a local network, so there's no precise location to pin.
          </p>
        </div>
      )}
    </div>
  );
}

/** Devices & sessions list with per-device and bulk sign-out. */
function SessionsPanel({ endSession }: { endSession: () => void }) {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => {
        if (err instanceof SessionExpiredError) { endSession(); return; }
        setSessions([]);
        setError("Could not load your devices.");
      });
  }, [endSession]);

  useEffect(() => { load(); }, [load]);

  async function signOutOne(id: string) {
    setBusy(id);
    setError(null);
    try {
      await revokeSessionById(id);
      setSessions((xs) => (xs ?? []).filter((x) => x.id !== id));
    } catch (err) {
      if (err instanceof SessionExpiredError) { endSession(); return; }
      setError("Could not sign out that device.");
    } finally {
      setBusy(null);
    }
  }

  async function signOutOthers() {
    setBusy("others");
    setError(null);
    try {
      await revokeOtherSessions();
      setSessions((xs) => (xs ?? []).filter((x) => x.current));
    } catch (err) {
      if (err instanceof SessionExpiredError) { endSession(); return; }
      setError("Could not sign out other devices.");
    } finally {
      setBusy(null);
    }
  }

  const others = (sessions ?? []).filter((s) => !s.current).length;

  return (
    <Section
      title="Devices & sessions"
      description="Where you're signed in. Sign out anything you don't recognize."
    >
      {sessions === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions found.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionRow key={s.id} s={s} busy={busy === s.id} onSignOut={() => signOutOne(s.id)} />
          ))}
          {others > 0 && (
            <Button
              variant="outline"
              className="h-10 gap-2 rounded-xl text-destructive hover:text-destructive"
              disabled={busy === "others"}
              onClick={signOutOthers}
            >
              {busy === "others" ? <Spinner className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sign out all other devices
            </Button>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </Section>
  );
}

/** Register / list / remove passkeys (WebAuthn). */
function PasskeysPanel({ endSession }: { endSession: () => void }) {
  const [keys, setKeys] = useState<PasskeyInfo[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  const load = useCallback(() => {
    listPasskeys()
      .then(setKeys)
      .catch((err) => {
        if (err instanceof SessionExpiredError) { endSession(); return; }
        setKeys([]);
      });
  }, [endSession]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    const label = name.trim() || `Passkey ${new Date().toLocaleDateString()}`;
    setAdding(true);
    setError(null);
    try {
      await registerPasskey(label);
      setName("");
      setNaming(false);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) { endSession(); return; }
      // A user cancelling the native prompt throws too; keep the message soft.
      setError("Couldn't add a passkey. Your device may have cancelled or it's already registered.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError(null);
    try {
      await deletePasskey(id);
      setKeys((xs) => (xs ?? []).filter((k) => k.id !== id));
    } catch (err) {
      if (err instanceof SessionExpiredError) { endSession(); return; }
      setError("Could not remove that passkey.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      title="Passkeys"
      description="Sign in with your fingerprint, face, or device PIN. No password or code needed."
    >
      {!supported ? (
        <p className="text-sm text-muted-foreground">This device or browser doesn't support passkeys.</p>
      ) : (
        <div className="space-y-3">
          {keys === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No passkeys yet.</p>
          ) : (
            keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{k.name ?? "Passkey"}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {timeAgo(k.created_at)}
                      {k.last_used_at ? ` · last used ${timeAgo(k.last_used_at)}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove passkey"
                  disabled={busy === k.id}
                  onClick={() => remove(k.id)}
                >
                  {busy === k.id ? <Spinner className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))
          )}
          {naming ? (
            <div className="space-y-2 rounded-xl border border-border/50 bg-background/40 p-3">
              <label className="text-xs font-medium text-muted-foreground">Name this passkey</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setNaming(false); setName(""); } }}
                maxLength={48}
                placeholder="e.g. MacBook Touch ID, YubiKey"
                className="h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
              />
              <div className="flex gap-2">
                <Button className="h-10 flex-1 gap-2 rounded-xl font-semibold" disabled={adding} onClick={add}>
                  {adding ? <Spinner className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Create passkey
                </Button>
                <Button variant="ghost" className="h-10 rounded-xl" disabled={adding} onClick={() => { setNaming(false); setName(""); setError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button className="h-10 gap-2 rounded-xl font-semibold" onClick={() => { setError(null); setNaming(true); }}>
              <Plus className="h-4 w-4" />
              Add a passkey
            </Button>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </Section>
  );
}
