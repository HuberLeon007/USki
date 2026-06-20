import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Vitest config for the frontend property and unit tests (social-login 6.1).
// A single jsdom environment serves both the pure-logic tests (select-adapter,
// redirect-allowlist, canonical-session, mock/auth-broker) and the
// @testing-library/react component tests (SocialButtons). The "@" alias mirrors
// the app/vite config so imports resolve identically under test.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  define: {
    // The supabase client is constructed at module load (lib/supabase.ts), so
    // give it harmless dummy values under test. No network call is ever made.
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://localhost:54321"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test-anon-key"),
    // VITE_APP_MODE is intentionally NOT defined here so it stays a runtime
    // lookup that tests can override with vi.stubEnv (see create-broker tests).
  },
});
