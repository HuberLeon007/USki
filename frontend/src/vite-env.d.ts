/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Environment mode mirroring the backend APP_MODE ("dev" | "prod" | "test"). dev -> offline mock social login, prod -> real OAuth. */
  readonly VITE_APP_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
