import { motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import type { SVGProps } from "react";
import type { Provider } from "@/lib/social/types";
import { cn } from "@/lib/utils";

/**
 * SocialButtons (social-login).
 *
 * Renders the three OAuth providers in a fixed order -- Google, then GitHub,
 * then Discord -- each with an English label ("Continue with <Provider>") and a
 * provider brand mark (Requirement 1.2, 1.3, 1.4, 1.5). The group is visually
 * separated from the OTP email step by an "or continue with" divider so the two
 * authentication paths read as distinct but adjacent (Requirement 1.1, 11.1).
 *
 * The component is presentational: it owns no auth logic. It exposes
 * {@link SocialButtonsProps.onSelect}, a per-button loading state, a global
 * disabled flag, and an English error string (Requirement 11.2, 11.3). Motion is
 * suppressed under a reduced-motion preference, consistent with `OtpStep`.
 */

interface ProviderButton {
  readonly id: Provider;
  readonly label: string;
  readonly Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

/** Brand glyphs are decorative; the visible English label carries the meaning. */
function GoogleIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function GitHubIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M12 1.5A10.5 10.5 0 0 0 8.68 22.02c.52.1.71-.23.71-.5l-.01-1.77c-2.92.63-3.54-1.41-3.54-1.41-.48-1.21-1.17-1.54-1.17-1.54-.95-.65.08-.64.08-.64 1.05.07 1.6 1.08 1.6 1.08.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.18 0-1.15.41-2.08 1.08-2.82-.11-.27-.47-1.34.1-2.78 0 0 .88-.28 2.88 1.07a10 10 0 0 1 5.24 0c2-1.35 2.88-1.07 2.88-1.07.57 1.44.21 2.51.1 2.78.68.74 1.08 1.67 1.08 2.82 0 4.02-2.46 4.9-4.8 5.16.38.33.71.97.71 1.96l-.01 2.9c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5Z" />
    </svg>
  );
}

function DiscordIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true" focusable="false" {...props}>
      <path d="M20.32 4.57A19.8 19.8 0 0 0 15.4 3.04a.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.26a18.3 18.3 0 0 0-5.42 0c-.17-.4-.41-.88-.63-1.26a.07.07 0 0 0-.08-.04A19.74 19.74 0 0 0 3.66 4.57a.07.07 0 0 0-.03.03C.53 9.18-.32 13.67.1 18.1a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .09-.03c.46-.63.87-1.29 1.22-1.99a.08.08 0 0 0-.04-.11c-.65-.25-1.27-.55-1.87-.89a.08.08 0 0 1-.01-.13c.13-.1.25-.2.37-.3a.07.07 0 0 1 .08-.01c3.92 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01c.12.1.24.2.37.3a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.77 1.36 1.22 1.99a.08.08 0 0 0 .09.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.05c.5-5.12-.84-9.57-3.54-13.5a.06.06 0 0 0-.03-.03ZM8.02 15.4c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.41-2.16 2.41Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.94 2.41-2.16 2.41Z" />
    </svg>
  );
}

/** Fixed render order required by Requirement 1.3: Google, GitHub, Discord. */
const PROVIDERS: readonly ProviderButton[] = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "github", label: "GitHub", Icon: GitHubIcon },
  { id: "discord", label: "Discord", Icon: DiscordIcon },
] as const;

export interface SocialButtonsProps {
  /** Called with the chosen provider when a button is activated. */
  onSelect: (provider: Provider) => void;
  /** The provider whose flow is currently in progress, or null when idle. */
  loadingProvider?: Provider | null;
  /** When true, all buttons are disabled (e.g. another auth step is busy). */
  disabled?: boolean;
  /** An English error string to display below the group, or null when none. */
  error?: string | null;
}

export function SocialButtons({
  onSelect,
  loadingProvider = null,
  disabled = false,
  error = null,
}: SocialButtonsProps) {
  const reduce = useReducedMotion();
  const anyLoading = loadingProvider !== null;

  return (
    <div className="space-y-4">
      {/* Divider visually separating the social group from the OTP email step. */}
      <div className="relative flex items-center" aria-hidden="true">
        <span className="h-px flex-1 bg-border/70" />
        <span className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          or continue with
        </span>
        <span className="h-px flex-1 bg-border/70" />
      </div>

      <div role="group" aria-label="Social sign-in options" className="flex flex-col gap-2.5">
        {PROVIDERS.map(({ id, label, Icon }, index) => {
          const isLoading = loadingProvider === id;
          return (
            <motion.button
              key={id}
              type="button"
              data-provider={id}
              onClick={() => onSelect(id)}
              disabled={disabled || anyLoading}
              aria-busy={isLoading}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.25, delay: 0.04 * index }}
              className={cn(
                "inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-input",
                "bg-background/60 px-4 text-sm font-medium text-foreground transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Icon className="h-5 w-5 shrink-0" />
              )}
              <span>Continue with {label}</span>
            </motion.button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
