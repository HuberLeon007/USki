import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  imgClassName?: string;
  textClassName?: string;
  showText?: boolean;
}

/** USki wordmark — "US" tinted (English / "us" / open-source community). */
export function Logo({ className, imgClassName, textClassName, showText = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/logo.png"
        alt=""
        className={cn("h-9 w-9 rounded-xl", imgClassName)}
      />
      {showText && (
        <span className={cn("text-xl font-bold tracking-tight", textClassName)}>
          <span className="text-primary">US</span>ki
        </span>
      )}
    </span>
  );
}
