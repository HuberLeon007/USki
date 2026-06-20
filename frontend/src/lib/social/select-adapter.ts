/**
 * Adapter selection guard (social-login).
 *
 * This pure function decides which {@link AuthBroker} adapter runs purely from
 * the environment mode, with no environment access of its own, so the
 * safety-critical decision is exhaustively testable with zero setup.
 *
 * The adapter is decided by `appMode` alone: development always uses the offline
 * mock path, every other mode (including `prod`) uses the real Supabase adapter.
 * There is no separate flag, so the mock path can never be selected in
 * production (Requirements 2.1, 2.2, 7.1, 7.5, 10.5).
 */

/** Environment mode mirroring the backend `APP_MODE` setting. */
export type AppMode = "dev" | "prod" | "test";

/** The two adapters that satisfy the `AuthBroker` seam. */
export type AdapterKind = "supabase" | "mock";

/**
 * Returns `"mock"` if and only if `appMode === "dev"`; returns `"supabase"` for
 * every other mode.
 *
 * @param appMode The current environment mode.
 */
export function selectAdapter(appMode: AppMode): AdapterKind {
  return appMode === "dev" ? "mock" : "supabase";
}
