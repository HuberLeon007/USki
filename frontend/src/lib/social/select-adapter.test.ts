import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { selectAdapter, type AppMode } from "./select-adapter";

/**
 * Property test for adapter selection (social-login).
 *
 * The current implementation decides the adapter from `appMode` alone: there is
 * no separate mock flag. So the guard reduces to: return "mock" if and only if
 * the mode is exactly "dev", and "supabase" for every other mode (prod, test,
 * and any unexpected string). The generator samples the known modes plus
 * arbitrary strings cast as AppMode to prove "prod"/"test"/anything-else never
 * selects the mock path.
 */
// Feature: social-login, Property 2: Adapter selection guard
describe("Property 2: Adapter selection guard", () => {
  it("returns mock iff appMode is dev, supabase otherwise", () => {
    const appModeArb: fc.Arbitrary<AppMode> = fc.oneof(
      fc.constantFrom<AppMode>("dev", "prod", "test"),
      fc.string() as fc.Arbitrary<AppMode>,
    );

    fc.assert(
      fc.property(appModeArb, (appMode) => {
        const result = selectAdapter(appMode);
        if (appMode === "dev") {
          expect(result).toBe("mock");
        } else {
          expect(result).toBe("supabase");
        }
      }),
      { numRuns: 200 },
    );
  });

  it("never selects mock for prod", () => {
    fc.assert(
      fc.property(fc.constant("prod" as AppMode), (appMode) => {
        expect(selectAdapter(appMode)).toBe("supabase");
      }),
      { numRuns: 100 },
    );
  });
});
