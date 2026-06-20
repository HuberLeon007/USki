import { Link } from "react-router-dom";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          © 2026 USki. All rights reserved.
        </p>
        <nav className="flex gap-4 text-sm text-muted-foreground" aria-label="Legal">
          <Link
            to="/privacy"
            className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Privacy
          </Link>
          <Link
            to="/legal"
            className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Legal Notice
          </Link>
        </nav>
      </div>
    </footer>
  );
}
