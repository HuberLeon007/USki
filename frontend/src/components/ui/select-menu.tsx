import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectMenuProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  /** Menu alignment relative to the trigger. */
  align?: "start" | "end";
  /** Applied to the trigger button (sizing, etc.). */
  className?: string;
  disabled?: boolean;
}

/**
 * Styled dropdown that replaces the unstyled native <select>. Matches the app's
 * inputs (rounded-xl, soft border, focus ring) with an animated popover list,
 * selected-item check, keyboard Escape, and click-outside to close.
 */
export function SelectMenu({
  value, onChange, options, placeholder = "Select…", ariaLabel, align = "start", className, disabled,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 items-center justify-between gap-2 rounded-xl border border-input bg-background/60 px-3 text-sm outline-none transition-colors",
          "hover:border-primary/40 focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-primary/60 ring-4 ring-primary/15",
          className,
        )}
      >
        <span className={cn("truncate", !current && "text-muted-foreground")}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} tabIndex={-1} />
            <motion.ul
              role="listbox"
              aria-label={ariaLabel}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "absolute z-50 mt-1.5 max-h-64 min-w-full overflow-y-auto rounded-xl border border-border/60 bg-card p-1 shadow-xl shadow-black/30",
                align === "end" ? "right-0" : "left-0",
              )}
            >
              {options.map((o) => {
                const selected = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => { onChange(o.value); setOpen(false); }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        selected ? "bg-primary/10 text-primary" : "text-foreground/90 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{o.label}</span>
                      {selected && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
