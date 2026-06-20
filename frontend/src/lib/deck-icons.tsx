import {
  Layers,
  BookOpen,
  FlaskConical,
  Globe,
  Calculator,
  Languages,
  Atom,
  Landmark,
  Palette,
  Music,
  Code,
  HeartPulse,
  Leaf,
  Brain,
  Map as MapIcon,
  Sigma,
  GraduationCap,
  Microscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Curated set of preselectable deck pictograms. Stored on the deck as a short
 * key (the `icon` column); rendered via `DeckBadge`. `null`/unknown falls back
 * to the neutral `Layers` glyph so old decks keep working.
 */
export const DECK_ICONS: Record<string, LucideIcon> = {
  book: BookOpen,
  flask: FlaskConical,
  globe: Globe,
  calculator: Calculator,
  languages: Languages,
  atom: Atom,
  landmark: Landmark,
  palette: Palette,
  music: Music,
  code: Code,
  health: HeartPulse,
  leaf: Leaf,
  brain: Brain,
  map: MapIcon,
  sigma: Sigma,
  grad: GraduationCap,
  microscope: Microscope,
};

export const DECK_ICON_KEYS = Object.keys(DECK_ICONS);

/** Resolve a stored key to its component, defaulting to Layers. */
export function deckIconFor(key?: string | null): LucideIcon {
  return (key && DECK_ICONS[key]) || Layers;
}

/** Color palette for deck badges. `bg` tints the badge, `text` colors the
 *  glyph, `swatch` is the solid dot shown in the picker. */
export const DECK_COLORS: Record<string, { bg: string; text: string; swatch: string }> = {
  violet: { bg: "bg-primary/10", text: "text-primary", swatch: "bg-primary" },
  blue: { bg: "bg-sky-500/15", text: "text-sky-500", swatch: "bg-sky-500" },
  emerald: { bg: "bg-emerald-500/15", text: "text-emerald-500", swatch: "bg-emerald-500" },
  amber: { bg: "bg-amber-500/15", text: "text-amber-500", swatch: "bg-amber-500" },
  rose: { bg: "bg-rose-500/15", text: "text-rose-500", swatch: "bg-rose-500" },
  cyan: { bg: "bg-cyan-500/15", text: "text-cyan-500", swatch: "bg-cyan-500" },
  fuchsia: { bg: "bg-fuchsia-500/15", text: "text-fuchsia-500", swatch: "bg-fuchsia-500" },
  lime: { bg: "bg-lime-500/15", text: "text-lime-600", swatch: "bg-lime-500" },
};

export const DECK_COLOR_KEYS = Object.keys(DECK_COLORS);

export function deckColorFor(key?: string | null) {
  return (key && DECK_COLORS[key]) || DECK_COLORS.violet!;
}

/** Colored, rounded badge holding the deck's pictogram. */
export function DeckBadge({
  icon,
  color,
  size = "md",
  className,
}: {
  icon?: string | null;
  color?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = deckIconFor(icon);
  const c = deckColorFor(color);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        c.bg,
        c.text,
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </div>
  );
}
