/**
 * Email-OTP second-factor decision (R: 2FA).
 *
 * Pure policy at one seam: given the runtime mode, the user's stored
 * preference, and the session email, decide whether a social login must be
 * gated behind a second email one-time code.
 *
 * Why these conditions:
 * - Email-OTP login already proves email ownership, so a second email code on
 *   top of it is pure redundancy. The second factor is therefore meaningful
 *   only for the social (OAuth) path, which is the only caller of this helper.
 * - A second factor needs a real, deliverable inbox. In `dev`/`test` the social
 *   path uses the offline Mock_Identity whose email has no inbox, so enforcing
 *   there would dead-end the login. The factor is enforced only in `prod`.
 * - An empty/unknown email cannot receive a code, so it is never enforced.
 */

import type { AppMode } from "./social/select-adapter";

export function shouldEnforceEmailSecondFactor(
  mode: AppMode,
  twoFactorEnabled: boolean,
  email: string | null | undefined,
): boolean {
  return mode === "prod" && twoFactorEnabled === true && !!email;
}
