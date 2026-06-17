import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { BookOpen, Sparkles, Settings, LogOut, Moon, Sun, Menu, X, RotateCcw, GraduationCap, Plus, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { UsernameDialog } from "@/components/dashboard/UsernameDialog";

const navItems = [
  { icon: BookOpen, label: "Decks", href: "/dashboard" },
  { icon: Sparkles, label: "AI Assistant", href: "/dashboard/ai" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

const mockDecks = [
  { id: 1, name: "Biology Grade 10", newCards: 5, learning: 4, due: 14, lastStudied: "2h ago" },
  { id: 2, name: "History - WW2", newCards: 0, learning: 2, due: 8, lastStudied: "1d ago" },
  { id: 3, name: "English Vocabulary", newCards: 7, learning: 2, due: 13, lastStudied: "30m ago" },
];

const dueTotal = {
  new: mockDecks.reduce((s, d) => s + d.newCards, 0),
  learn: mockDecks.reduce((s, d) => s + d.learning, 0),
  due: mockDecks.reduce((s, d) => s + d.due, 0),
};

export default function DashboardPage() {
  const { user, clearSession, needsUsername } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);

  useEffect(() => {
    if (needsUsername) {
      setShowUsernameDialog(true);
    }
  }, [needsUsername]);

  function handleLogout() {
    clearSession();
  }

  const displayName = user?.username
    ? `${user.username}#${user.discriminator}`
    : user?.email || "User";

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/40 bg-card transition-transform md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border/40 px-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="USki" className="h-7 w-7 rounded-md" />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-primary">US</span>ki
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/40 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {(user?.username || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{displayName}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" asChild aria-label="Settings">
                <Link to="/dashboard/settings">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border/40 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold">Dashboard</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl font-bold mb-1">
              Today&apos;s Review
            </h2>
            <p className="text-sm text-muted-foreground">
              {dueTotal.new + dueTotal.learn + dueTotal.due} cards due across {mockDecks.length} decks
            </p>
          </motion.div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: BookOpen, label: "New", count: dueTotal.new, color: "text-blue-400", bg: "bg-blue-400/10" },
              { icon: RotateCcw, label: "Learn", count: dueTotal.learn, color: "text-amber-400", bg: "bg-amber-400/10" },
              { icon: GraduationCap, label: "Due", count: dueTotal.due, color: "text-primary", bg: "bg-primary/10" },
            ].map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.12 }}
              >
                <Card className={cn("border-border/60 transition-all hover:border-primary/30 hover:shadow-md cursor-pointer", cat.bg)}>
                  <CardContent className="p-4 text-center">
                    <cat.icon className={cn("h-5 w-5 mx-auto mb-2", cat.color)} />
                    <div className={cn("text-2xl font-bold tabular-nums", cat.color)}>{cat.count}</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">{cat.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Decks</h3>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-1" />
                New Deck
              </Button>
            </div>

            <div className="space-y-2">
              {mockDecks.map((deck, i) => (
                <motion.div
                  key={deck.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                >
                  <Card className="border-border/60 transition-all hover:border-primary/30 hover:shadow-md cursor-pointer group">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm">{deck.name}</h4>
                          <p className="text-xs text-muted-foreground">Last studied {deck.lastStudied}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="hidden sm:flex items-center gap-3 text-xs">
                            <span className="w-8 text-right text-blue-400 font-medium">{deck.newCards}</span>
                            <span className="w-8 text-right text-amber-400 font-medium">{deck.learning}</span>
                            <span className="w-8 text-right text-primary font-medium">{deck.due}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <UsernameDialog
        open={showUsernameDialog}
        onOpenChange={setShowUsernameDialog}
      />
    </div>
  );
}
