import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  const { theme, setTheme } = useTheme();
  const reduce = useReducedMotion();

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl shadow-sm shadow-primary/5">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="USki logo" className="h-8 w-8 rounded-md" />
          <motion.span
            className="text-xl font-bold tracking-tight"
            initial={reduce ? { opacity: 1 } : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-primary">US</span>ki
          </motion.span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="rounded-full"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5">
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
