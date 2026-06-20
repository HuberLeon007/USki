import { cn } from "@/lib/utils";

/**
 * FSRS due breakdown shown as three colored numbers — blue (new), orange
 * (learning), purple (due) — in that fixed order, with NO text labels.
 * Zeros stay visible in their color (a category is never hidden). Titles /
 * aria-labels carry the meaning for screen readers.
 */
export function StateCounts({
  nw,
  ln,
  du,
  size = "sm",
  className,
}: {
  nw: number;
  ln: number;
  du: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const text = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-xs";
  return (
    <span className={cn("flex items-center gap-1.5 font-mono font-bold tabular-nums", text, className)}>
      <span className="text-state-new" title="New" aria-label={`${nw} new`}>{nw}</span>
      <span className="text-state-learn" title="Review" aria-label={`${ln} in review`}>{ln}</span>
      <span className="text-state-due" title="Due" aria-label={`${du} due`}>{du}</span>
    </span>
  );
}
