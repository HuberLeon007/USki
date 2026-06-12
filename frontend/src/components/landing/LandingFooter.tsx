import { Link } from "react-router-dom";
import { Code2 } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border px-4 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <Link to="/" className="text-lg font-bold tracking-tight">
          USki
        </Link>

        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href="#" className="transition-colors hover:text-foreground">
            Datenschutz
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            Impressum
          </a>
          <Link to="/login" className="transition-colors hover:text-foreground">
            Login
          </Link>
        </div>

        <div className="flex gap-4">
          <a
            href="#"
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="GitHub"
          >
            <Code2 className="size-5" />
          </a>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-7xl text-center text-sm text-muted-foreground">
        &copy; 2026 USki. Alle Rechte vorbehalten.
      </div>
    </footer>
  );
}
