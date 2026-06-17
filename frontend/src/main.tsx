import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppRouter } from "./app/router";
import { AuthProvider } from "./app/auth-context";
import { ThemeProvider } from "./app/providers";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="dark" storageKey="uski-theme">
        <TooltipProvider>
          <AuthProvider>
            <AppRouter />
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: "bg-card text-card-foreground border-border",
              }}
            />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
