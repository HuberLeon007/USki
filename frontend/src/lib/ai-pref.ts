/**
 * Per-user AI assistant preference (Sero on/off).
 *
 * Stored locally per account so a user can switch the assistant off entirely.
 * When off, the floating assistant and its greeting never mount anywhere in the
 * app. Default is on. A custom window event lets mounted listeners react the
 * moment the toggle changes, without a full reload.
 */

const EVENT = "uski-ai-pref";

function key(uid: string): string {
  return `uski.ai.enabled.${uid}`;
}

/** Whether the AI assistant is enabled for this user (defaults to true). */
export function isAiEnabled(uid: string): boolean {
  try {
    return localStorage.getItem(key(uid)) !== "0";
  } catch {
    return true;
  }
}

/** Persist the preference and notify in-page listeners. */
export function setAiEnabled(uid: string, enabled: boolean): void {
  try {
    localStorage.setItem(key(uid), enabled ? "1" : "0");
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore storage errors */
  }
}

/** Subscribe to preference changes; returns an unsubscribe function. */
export function onAiPrefChange(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
