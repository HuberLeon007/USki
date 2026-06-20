import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const isDocker = process.env.DOCKER_ENV === "true";
  
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: {
      port: 5173,
      host: "0.0.0.0",
      // In Docker on Windows/macOS, host file edits don't emit inotify events
      // inside the Linux container, so HMR never fires. Poll instead.
      watch: isDocker ? { usePolling: true, interval: 200 } : undefined,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
        },
      },
      // HMR configuration for Docker
      hmr: isDocker
        ? {
            host: "localhost",
            port: 5173,
            protocol: "ws",
          }
        : undefined,
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL || env.SUPABASE_URL
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
      ),
      // App mode. Reuses the single root-.env source of truth (APP_MODE) the
      // backend already reads, so the frontend and backend can never disagree
      // about the mode. dev -> offline mock adapter, prod -> real Supabase OAuth;
      // the mock adapter is additionally dead-code-eliminated from prod builds
      // (Requirement 7.2).
      "import.meta.env.VITE_APP_MODE": JSON.stringify(
        env.VITE_APP_MODE || env.APP_MODE || "dev"
      ),
    },
  };
});
