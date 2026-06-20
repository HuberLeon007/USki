import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { toCanonicalSession, type CanonicalSessionLike } from "./types";

/**
 * Property test for canonical session indistinguishability (social-login).
 *
 * Generated payloads carry the five canonical fields plus arbitrary extra
 * fields and an explicit `origin` marker ("otp" | "supabase" | "mock"). After
 * mapping through `toCanonicalSession`, the result has exactly the five
 * canonical keys, drops every extra (including the origin marker), and is equal
 * for two inputs that share the canonical fields but differ in origin. Nothing
 * downstream can therefore tell a social/mock session apart from an OTP session.
 */
// Feature: social-login, Property 1: Canonical session indistinguishability
describe("Property 1: Canonical session indistinguishability", () => {
  const CANONICAL_KEYS = [
    "access_token",
    "email",
    "needs_username",
    "refresh_token",
    "user_id",
  ] as const;

  const canonicalArb: fc.Arbitrary<CanonicalSessionLike> = fc.record({
    access_token: fc.string(),
    refresh_token: fc.string(),
    user_id: fc.string(),
    email: fc.option(fc.string(), { nil: null }),
    needs_username: fc.boolean(),
  });

  const originArb = fc.constantFrom("otp", "supabase", "mock");

  const extraArb = fc.dictionary(
    fc.string().filter((k) => !CANONICAL_KEYS.includes(k as never)),
    fc.anything(),
  );

  it("yields exactly the five canonical fields, dropping extras regardless of origin", () => {
    fc.assert(
      fc.property(canonicalArb, originArb, extraArb, (base, origin, extra) => {
        const input = { ...extra, origin, ...base };
        const result = toCanonicalSession(input as CanonicalSessionLike);

        // Exactly the five canonical keys, nothing else.
        expect(Object.keys(result).sort()).toEqual([...CANONICAL_KEYS]);
        // The canonical values survive untouched.
        expect(result).toEqual(base);
      }),
      { numRuns: 200 },
    );
  });

  it("produces an identical session for the same fields across origins", () => {
    fc.assert(
      fc.property(canonicalArb, (base) => {
        const fromOtp = toCanonicalSession({ ...base, origin: "otp" } as CanonicalSessionLike);
        const fromSupabase = toCanonicalSession({
          ...base,
          origin: "supabase",
        } as CanonicalSessionLike);
        const fromMock = toCanonicalSession({ ...base, origin: "mock" } as CanonicalSessionLike);

        expect(fromOtp).toEqual(fromSupabase);
        expect(fromSupabase).toEqual(fromMock);
      }),
      { numRuns: 150 },
    );
  });
});
