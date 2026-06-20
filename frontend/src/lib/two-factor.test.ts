import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { shouldEnforceEmailSecondFactor } from "./two-factor";
import type { AppMode } from "./social/select-adapter";

/**
 * Property test for the email-OTP second-factor decision (2FA).
 *
 * Policy invariant: a second email code is enforced if and only if ALL hold:
 *   - mode === "prod"            (dev/test mock emails have no inbox)
 *   - the user enabled 2FA       (opt-in preference)
 *   - a non-empty email exists   (a code needs somewhere to go)
 * Any other combination must return false, so dev/test logins are never gated.
 */
describe("Property: email second-factor enforcement", () => {
  const modeArb: fc.Arbitrary<AppMode> = fc.oneof(
    fc.constantFrom<AppMode>("dev", "prod", "test"),
    fc.string() as fc.Arbitrary<AppMode>,
  );
  const emailArb = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(""),
    fc.emailAddress(),
  );

  it("enforces iff prod AND enabled AND email present", () => {
    fc.assert(
      fc.property(modeArb, fc.boolean(), emailArb, (mode, enabled, email) => {
        const result = shouldEnforceEmailSecondFactor(mode, enabled, email);
        const expected = mode === "prod" && enabled === true && !!email;
        expect(result).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it("never enforces in dev or test, regardless of preference/email", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<AppMode>("dev", "test"),
        fc.boolean(),
        emailArb,
        (mode, enabled, email) => {
          expect(shouldEnforceEmailSecondFactor(mode, enabled, email)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
