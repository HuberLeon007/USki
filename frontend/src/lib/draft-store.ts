/**
 * Encrypted local drafts for in-progress editors (card / new deck).
 *
 * Goal: never lose what you're typing if the backend/DB hiccups or the tab
 * reloads. Drafts are encrypted at rest (AES-GCM) in IndexedDB with a per-user
 * key kept in localStorage, and only ever hold the CURRENT USER's own
 * in-progress content (never shared-deck data). This is defense-in-depth for
 * data on disk, not DRM: the key lives client-side, so it protects the bytes at
 * rest, not against the user's own devtools. Authorization for who may read a
 * deck stays server-side.
 *
 * Every function fails soft: if IndexedDB / WebCrypto is unavailable, drafts are
 * simply skipped and the editor keeps working.
 */

const DB_NAME = "uski-drafts";
const STORE = "drafts";
const KEY_PREFIX = "uski.draftkey.";

interface StoredDraft {
  iv: string;   // base64
  ct: string;   // base64 ciphertext
  ts: number;
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: StoredDraft): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(key: string): Promise<StoredDraft | undefined> {
  const db = await openDb();
  const out = await new Promise<StoredDraft | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as StoredDraft | undefined);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return out;
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getKey(uid: string): Promise<CryptoKey> {
  const lsKey = KEY_PREFIX + uid;
  let raw = localStorage.getItem(lsKey);
  if (!raw) {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    raw = b64(await crypto.subtle.exportKey("raw", key));
    localStorage.setItem(lsKey, raw);
  }
  return crypto.subtle.importKey("raw", unb64(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function scopedKey(uid: string, id: string): string {
  return `${uid}:${id}`;
}

/** Encrypt + persist a draft. No-op on any storage/crypto failure. */
export async function saveDraft(uid: string, id: string, data: unknown): Promise<void> {
  try {
    const key = await getKey(uid);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(data));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
    await idbPut(scopedKey(uid, id), { iv: b64(iv), ct: b64(ct), ts: Date.now() });
  } catch {
    /* storage or crypto unavailable -> skip, editor still works */
  }
}

/** Load + decrypt a draft, or null if none / unreadable. */
export async function loadDraft<T>(uid: string, id: string): Promise<T | null> {
  try {
    const rec = await idbGet(scopedKey(uid, id));
    if (!rec) return null;
    const key = await getKey(uid);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(rec.iv) }, key, unb64(rec.ct));
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

/** Remove a draft (after a successful save). */
export async function clearDraft(uid: string, id: string): Promise<void> {
  try {
    await idbDel(scopedKey(uid, id));
  } catch {
    /* ignore */
  }
}
