import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isAllowedRedirect, resolveRedirect } from "./redirect-allowlist";

/**
 * Property test for redirect safety (social-login).
 *
 * Generated candidate targets span every shape a caller might pass: relative,
 * relative-with-trailing-slash, same-origin absolute, off-host absolute,
 * scheme-varied (http vs https), backslash-escaped, protocol-relative, and raw
 * arbitrary strings. Allowlists are non-empty subsets of the app's approved
 * destinations. The invariant: `resolveRedirect` never yields an off-allowlist
 * destination (its result is either an allowlisted target or the fallback), and
 * `isAllowedRedirect` is exactly the predicate that decides which branch runs.
 */
// Feature: social-login, Property 8: Redirect target is always on the allowlist
describe("Property 8: Redirect target is always on the allowlist", () => {
  const ORIGIN = "https://app.uski.example";
  const FALLBACK = `${ORIGIN}/login`;

  const pathArb = fc.constantFrom("/auth/callback", "/login", "/dashboard", "/evil", "/admin", "/");

  const allowlistArb = fc.uniqueArray(
    fc.constantFrom(`${ORIGIN}/auth/callback`, `${ORIGIN}/login`, `${ORIGIN}/dashboard`),
    { minLength: 1, maxLength: 3 },
  );

  const targetArb: fc.Arbitrary<string> = fc.oneof(
    // relative
    pathArb,
    // relative with a trailing slash
    pathArb.map((p) => (p === "/" ? p : `${p}/`)),
    // same-origin absolute
    pathArb.map((p) => `${ORIGIN}${p}`),
    // off-host absolute
    pathArb.map((p) => `https://evil.example${p}`),
    // scheme-varied (http instead of https) on the real host
    pathArb.map((p) => `http://app.uski.example${p}`),
    // backslash-escaped host smuggling attempt
    pathArb.map((p) => `https://evil.example\\@app.uski.example${p}`),
    // protocol-relative off-host
    pathArb.map((p) => `//evil.example${p}`),
    // raw arbitrary strings
    fc.string(),
  );

  it("resolveRedirect never yields an off-allowlist destination", () => {
    fc.assert(
      fc.property(targetArb, allowlistArb, (target, allowlist) => {
        const resolved = resolveRedirect(target, allowlist, FALLBACK);

        // The resolved value is always safe: it is either the trusted fallback
        // or an explicitly allowlisted destination. Never anything else.
        const safe = resolved === FALLBACK || isAllowedRedirect(resolved, allowlist);
        expect(safe).toBe(true);

        // resolveRedirect is exactly gated by isAllowedRedirect.
        if (isAllowedRedirect(target, allowlist)) {
          expect(resolved).toBe(target);
        } else {
          expect(resolved).toBe(FALLBACK);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("off-host absolute targets are never allowed", () => {
    fc.assert(
      fc.property(pathArb, allowlistArb, (p, allowlist) => {
        expect(isAllowedRedirect(`https://evil.example${p}`, allowlist)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
