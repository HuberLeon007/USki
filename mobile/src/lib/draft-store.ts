/**
 * Encrypted local drafts for in-progress editors on mobile.
 *
 * Goal: never lose what you're typing if the app crashes or is backgrounded and
 * killed before you hit save. Drafts are stored in expo-secure-store, which
 * keeps values in the platform keystore (Keychain on iOS, EncryptedSharedPrefs
 * on Android) — encrypted at rest, scoped to this app. Only the CURRENT USER's
 * own in-progress content is ever stored; shared-deck data never goes here.
 *
 * Every function fails soft: if SecureStore is unavailable or the value is too
 * large, the draft is simply skipped and the editor keeps working.
 */

import * as SecureStore from "expo-secure-store";

/** SecureStore keys allow only [A-Za-z0-9._-]; sanitize anything else. */
function keyFor(uid: string, id: string): string {
  return `draft_${uid}_${id}`.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function saveDraft(uid: string, id: string, data: unknown): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyFor(uid, id), JSON.stringify(data));
  } catch {
    /* keystore unavailable or value too large -> skip, editor still works */
  }
}

export async function loadDraft<T>(uid: string, id: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(keyFor(uid, id));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function clearDraft(uid: string, id: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(keyFor(uid, id));
  } catch {
    /* ignore */
  }
}
