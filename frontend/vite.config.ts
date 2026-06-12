import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load SUPABASE_URL / SUPABASE_ANON_KEY from parent .env
  // and expose them as VITE_ vars so the frontend can use them.
  // In Docker, docker-compose.yml handles this via `environment:`.
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      allowedHosts: true, // Allow Docker proxy traffic
      proxy: {
        "/api": {
          // In Docker: set VITE_API_PROXY_TARGET=http://host.docker.internal:8000
          // Locally: defaults to localhost:8000
          target: env.VITE_API_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL || env.SUPABASE_URL || ""
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ""
      ),
    },
  };
});
