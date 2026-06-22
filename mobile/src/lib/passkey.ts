import { Passkey } from "react-native-passkey";

import {
  passkeyLoginOptions,
  passkeyLoginVerify,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  type AuthResponse,
  type PasskeyInfo,
} from "./api";

/**
 * Native passkeys (WebAuthn) via react-native-passkey, mirroring the web flow
 * in frontend/src/lib/api.ts. The backend ceremony is identical to the web's:
 * the options JSON it returns is fed straight to the OS credential manager, and
 * the resulting attestation/assertion JSON is posted back to verify.
 *
 * Requirements (see PRODUCTION.md):
 * - Backend WEBAUTHN_RP_ID = uski.huberleon.com and WEBAUTHN_ORIGINS includes
 *   the app's android:apk-key-hash:<...> origin (read from clientDataJSON).
 * - An assetlinks.json served at https://uski.huberleon.com/.well-known/ that
 *   binds the app package + signing cert to the RP. Without it the OS refuses
 *   to create/use a passkey for the domain.
 * - Works only in a real build (APK / dev-client), never in Expo Go.
 */

export type PasskeyResult =
  | { ok: true; access_token: string; refresh_token: string; needs_username: boolean }
  | { ok: false; cancelled?: boolean; unsupported?: boolean; error?: string };

/** True when the OS exposes a credential manager (Android 9+/iOS 15+, real build). */
export function passkeysSupported(): boolean {
  try {
    return Passkey.isSupported();
  } catch {
    return false;
  }
}

// react-native-passkey can omit `type`; py_webauthn requires "public-key".
function withType<T extends { type?: string }>(cred: T): T & { type: string } {
  return { ...cred, type: cred.type ?? "public-key" };
}

function isCancel(err: unknown): boolean {
  const m = String((err as { message?: string })?.message ?? err ?? "").toLowerCase();
  return m.includes("cancel") || m.includes("user_cancel") || m.includes("aborted") || m.includes("nocredentials");
}

/**
 * Register a new passkey for the signed-in user. Returns the stored credential
 * info on success. Requires a valid session (uses the authed endpoints).
 */
export async function registerPasskey(name?: string): Promise<PasskeyInfo> {
  if (!passkeysSupported()) throw new Error("Passkeys aren't supported on this device.");
  const options = await passkeyRegisterOptions();
  // The options JSON is already PublicKeyCredentialCreationOptionsJSON-shaped.
  const credential = await Passkey.create(options as unknown as Parameters<typeof Passkey.create>[0]);
  return passkeyRegisterVerify(withType(credential), name);
}

/**
 * Sign in with a discoverable passkey (no email needed). Returns session tokens
 * the caller hands to auth.signIn(), mirroring the social/OTP shape.
 */
export async function loginWithPasskey(): Promise<PasskeyResult> {
  if (!passkeysSupported()) return { ok: false, unsupported: true };
  let credential: Awaited<ReturnType<typeof Passkey.get>>;
  let handle: string;
  try {
    const { options, handle: h } = await passkeyLoginOptions();
    handle = h;
    credential = await Passkey.get(options as unknown as Parameters<typeof Passkey.get>[0]);
  } catch (err) {
    if (isCancel(err)) return { ok: false, cancelled: true };
    return { ok: false, error: "Passkey sign-in didn't complete." };
  }
  try {
    const res: AuthResponse = await passkeyLoginVerify(handle, withType(credential));
    return {
      ok: true,
      access_token: res.access_token,
      refresh_token: res.refresh_token,
      needs_username: res.needs_username,
    };
  } catch {
    return { ok: false, error: "That passkey wasn't recognised." };
  }
}
