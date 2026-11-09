import { describe, expect, it } from "vitest";
import { DRIZZLE_EXPERIENCE_PRODUCTION, drizzleExperienceEnabled } from "./drizzleExperienceGate";

describe("the DRIZZLE gate (Issue #579, D1)", () => {
  it("production is fixed OFF", () => {
    expect(DRIZZLE_EXPERIENCE_PRODUCTION).toBe(false);
  });
  it("the experience is off (D1 has no Preview / DEV opt-in)", () => {
    expect(drizzleExperienceEnabled()).toBe(false);
  });
});
