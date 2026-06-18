import { useMemo } from "react";
import {
  Settings,
  X,
  PanelLeftClose,
  PanelLeft,
  Play,
  Layers,
  Plus,
} from "lucide-react";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import type { UserResponse } from "@/lib/api";
import { selectDueDecks, type DeckLike } from "@/lib/due-decks";

export interface SidebarProps {
  /** Whether the sidebar is collapsed to its narrow rail width. */
  collapsed: boolean;
  /** Toggles the collapsed state of the whole sidebar (R13.3, R13.4). */
  onToggleCollapse: () => void;
  /** Opens the Settings surface (R16.1). */
  onOpenSettings: () => void;
  /** Whether the mobile drawer is open. */
  mobileOpen?: boolean;
  /** Closes the mobile drawer (scrim / close button). */
  onCloseMobile?: () => void;
  /**
   * Optional user override. When omitted the sidebar reads the user from
   * `useAuth`. The footer shows `username#discriminator`, never the email
   * (R12.1, R12.2).
   */
  user?: UserResponse | null;
  /**
   * The full list of the user's decks. The Decks section lists all of them
   * (R15.5); the Overview section lists only the due ones via `selectDueDecks`
   * (R15.3, R15.4). Each deck carries the `cards[].nextReview` schedule used to
   * evaluate due-ness.
   */
  decks?: DeckLike[];
  /** The currently selected deck id, used to highlight the active row. */
  selectedDeckId?: string | null;
  /** Invoked when a deck row is activated. */
  onSelectDeck?: (deckId: string) => void;
  /** Invoked by the single "New deck" control in the Decks section (R15.6). */
  onCreateDeck?: () => void;
  /** Invoked by the Review entry — the topmost Overview item (R15.2, R14.1). */
  onReview?: () => void;
}

/**
 * Dashboard side navigation.
 *
 * Layout (top → bottom):
 *   - Header: Logo on the left, collapse control in the top-right corner,
 *     horizontally opposite the Logo (R13.1, R13.2).
 *   - Navigation area:
 *       OVERVIEW (R15.1, above Decks) — Review first (R15.2), then only the
 *         due decks (R15.3); nothing below Review when none are due (R15.4);
 *         no create control (R15.7).
 *       DECKS — every deck (R15.5) plus the single "New deck" control (R15.6).
 *     There is no standalone "Review" button anywhere else (R14.1).
 *   - Settings entry directly above the username footer (R16.1).
 *   - Footer: `username#discriminator`, never the email, with a neutral
 *     placeholder while the username has not yet loaded (R12.1–R12.3). No
 *     logout control lives in the sidebar (R11.3).
 */
export function Sidebar({
  collapsed,
  onToggleCollapse,
  onOpenSettings,
  mobileOpen = false,
  onCloseMobile,
  user: userProp,
  decks = [],
  selectedDeckId = null,
  onSelectDeck,
  onCreateDeck,
  onReview,
}: SidebarProps) {
  const auth = useAuth();
  const user = userProp !== undefined ? userProp : auth.user;

  // R12.1/R12.2: show the username (never the email). R12.3: until the
  // username is available, render a neutral placeholder rather than the email.
  const hasUsername = Boolean(user?.username);
  const displayName = hasUsername
    ? `${user!.username}#${user!.discriminator}`
    : null;
  const initial = hasUsername ? user!.username!.charAt(0).toUpperCase() : null;

  // Due membership is derived from the deck data. Recomputing in a memo keyed
  // on `decks` means it is re-evaluated on load/refresh and whenever the deck
  // data changes — a re-render reflects transitions immediately (R15.8–R15.10).
  const dueDecks = useMemo(() => selectDueDecks(decks), [decks]);

  return (
    <>
      {/* mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl transition-all duration-300 md:static md:translate-x-0",
          collapsed ? "w-[4.5rem]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* ── Header: Logo (left) + collapse control (top-right) ── */}
        <div className="flex h-16 items-center justify-between px-4">
          {collapsed ? (
            <Logo showText={false} className="mx-auto" />
          ) : (
            <Logo />
          )}

          {/* collapse toggle (desktop) — top-right, opposite the Logo (R13.1) */}
          <Button
            variant="ghost"
            size="icon"
            className={cn("hidden md:inline-flex", collapsed && "mx-auto")}
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>

          {/* mobile drawer close */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* ── Navigation area: Overview (above) + Decks (below) (R15.1) ── */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {/* OVERVIEW — Review first, then only due decks (R15.2–R15.4, R15.7) */}
          <section className="space-y-1">
            {!collapsed && (
              <p className="label-mono px-3 pb-1">Overview</p>
            )}

            {/* Review — topmost Overview item; the only "Review" entry (R15.2, R14.1) */}
            <NavRow
              icon={Play}
              label="Review"
              collapsed={collapsed}
              onClick={onReview}
              iconClassName="fill-current"
            />

            {/* Only the due decks; renders nothing when none are due (R15.3, R15.4) */}
            {dueDecks.map((deck) => (
              <NavRow
                key={`overview-${deck.id}`}
                icon={Layers}
                label={deck.name}
                collapsed={collapsed}
                active={deck.id === selectedDeckId}
                onClick={() => onSelectDeck?.(deck.id)}
              />
            ))}
          </section>

          {/* DECKS — all decks (R15.5) + single "New deck" control (R15.6) */}
          <section className="space-y-1">
            {!collapsed && <p className="label-mono px-3 pb-1">Decks</p>}

            {decks.map((deck) => (
              <NavRow
                key={`decks-${deck.id}`}
                icon={Layers}
                label={deck.name}
                collapsed={collapsed}
                active={deck.id === selectedDeckId}
                onClick={() => onSelectDeck?.(deck.id)}
              />
            ))}

            {/* The single deck-creation control (R15.6); none in Overview (R15.7) */}
            <NavRow
              icon={Plus}
              label="New deck"
              collapsed={collapsed}
              onClick={onCreateDeck}
            />
          </section>
        </nav>

        {/* ── Settings entry — directly above the username footer (R16.1) ── */}
        <div className="px-3 pb-1">
          <button
            onClick={onOpenSettings}
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && "Settings"}
          </button>
        </div>

        {/* ── User footer — username only, no logout (R11.3, R12.1–R12.3) ── */}
        <div className="border-t border-border/50 p-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl px-2 py-2",
              collapsed && "justify-center px-0",
            )}
          >
            {hasUsername ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-semibold text-primary-foreground">
                {initial}
              </div>
            ) : (
              // neutral placeholder avatar while the username loads (R12.3)
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
            )}

            {!collapsed &&
              (hasUsername ? (
                <p className="flex-1 truncate font-mono text-xs">{displayName}</p>
              ) : (
                // neutral placeholder, never the email (R12.2, R12.3)
                <div
                  className="h-3 flex-1 animate-pulse rounded bg-muted"
                  aria-label="Loading username"
                />
              ))}
          </div>
        </div>
      </aside>
    </>
  );
}

interface NavRowProps {
  icon: typeof Layers;
  label: string;
  collapsed: boolean;
  active?: boolean;
  onClick?: () => void;
  iconClassName?: string;
}

/** A single sidebar navigation row, rendering icon-only when collapsed. */
function NavRow({
  icon: Icon,
  label,
  collapsed,
  active = false,
  onClick,
  iconClassName,
}: NavRowProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          active && "text-primary",
          iconClassName,
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
