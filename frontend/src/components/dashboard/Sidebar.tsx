import {
  Settings,
  X,
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  Layers,
  Users,
  FolderSearch,
} from "lucide-react";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import type { UserResponse } from "@/lib/api";

/** Top-level dashboard views (R: only top-level items in the nav, no per-deck rows). */
export type DashboardView = "overview" | "decks" | "shared" | "browse";

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  user?: UserResponse | null;

  /** Active top-level view. */
  view: DashboardView;
  onSelectView: (view: DashboardView) => void;
}

/**
 * Dashboard side navigation.
 *
 * Three fixed top-level entries (Overview / Decks / Shared) — no per-deck rows
 * that would grow the nav unbounded. A search box filters decks/folders and is
 * the entry point for searching all cards. Settings sits in the footer profile
 * row (single account control).
 */
export function Sidebar({
  collapsed,
  onToggleCollapse,
  onOpenSettings,
  mobileOpen = false,
  onCloseMobile,
  user: userProp,
  view,
  onSelectView,
}: SidebarProps) {
  const auth = useAuth();
  const user = userProp !== undefined ? userProp : auth.user;

  const hasUsername = Boolean(user?.username);
  const displayName = hasUsername ? `${user!.username}#${user!.discriminator}` : null;
  const initial = hasUsername ? user!.username!.charAt(0).toUpperCase() : null;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={onCloseMobile} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-border/50 bg-card/80 backdrop-blur-xl transition-[width,transform] duration-300 ease-out md:static md:translate-x-0",
          collapsed ? "w-[4.5rem]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className={cn("flex h-16 items-center px-4", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <Logo />}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
          {!collapsed && (
            <Button variant="ghost" size="icon" className="md:hidden" onClick={onCloseMobile} aria-label="Close menu">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Nav — fixed top-level items only (no badges, no search). */}
        <nav className="flex-1 space-y-1 px-3 py-2" style={{ scrollbarGutter: "stable" }}>
          <NavItem icon={LayoutDashboard} label="Overview" collapsed={collapsed} active={view === "overview"} onClick={() => onSelectView("overview")} />
          <NavItem icon={Layers} label="Decks" collapsed={collapsed} active={view === "decks"} onClick={() => onSelectView("decks")} dataTour="nav-decks" />
          <NavItem icon={FolderSearch} label="Browse" collapsed={collapsed} active={view === "browse"} onClick={() => onSelectView("browse")} />
          <NavItem icon={Users} label="Shared" collapsed={collapsed} active={view === "shared"} onClick={() => onSelectView("shared")} />
        </nav>

        {/* Account footer = settings entry */}
        <div className="border-t border-border/50 p-3">
          <button
            type="button"
            onClick={onOpenSettings}
            data-tour="settings"
            title={collapsed ? (displayName ?? "Account") : "Open settings"}
            aria-label="Open settings"
            className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent/60"
          >
            {hasUsername ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-semibold text-primary-foreground">
                {initial}
              </div>
            ) : (
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
            )}
            {!collapsed &&
              (hasUsername ? (
                <>
                  <p className="flex-1 truncate font-mono text-xs">{displayName}</p>
                  <Settings className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </>
              ) : (
                <div className="h-3 flex-1 animate-pulse rounded bg-muted" aria-label="Loading username" />
              ))}
          </button>
        </div>
      </aside>
    </>
  );
}

interface NavItemProps {
  icon: typeof Layers;
  label: string;
  collapsed: boolean;
  active: boolean;
  onClick: () => void;
  dataTour?: string;
}

function NavItem({ icon: Icon, label, collapsed, active, onClick, dataTour }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      data-tour={dataTour}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
      {/* Label stays mounted and left-anchored; it fades + clips on collapse so
          icons never spring to the center (smooth both ways). */}
      <span className={cn("flex-1 truncate whitespace-nowrap text-left transition-opacity duration-200", collapsed && "pointer-events-none opacity-0")}>
        {label}
      </span>
    </button>
  );
}
