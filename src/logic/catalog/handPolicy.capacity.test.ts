import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_HAND_CAPACITY_CANDIDATE, DEFAULT_HAND_CAPACITY_PRODUCTION, HAND_CAPACITY_CANDIDATES } from "./handPolicy";

/**
 * OD-5 (Owner, 2026-10-03): the hand's production capacity is 12, decided after the real-device ABBA comparison of the
 * Preview variants HAND 9 / HAND 12. This pins the decision: no build (production, a normal Preview, tests) may carry
 * another production capacity, and 9 never becomes a production value again by an edit of the one literal line.
 */
describe("OD-5: the production hand capacity is 12", () => {
  it("DEFAULT_HAND_CAPACITY_PRODUCTION is 12, and so is the capacity the App uses when no Preview variant is in effect", () => {
    expect(DEFAULT_HAND_CAPACITY_PRODUCTION).toBe(12);
    expect(DEFAULT_HAND_CAPACITY_CANDIDATE).toBe(12);
  });

  it("the one literal line says 12 (the hand-on projects rewrite exactly that line)", () => {
    const source = readFileSync(resolve(process.cwd(), "src/logic/catalog/handPolicy.ts"), "utf8");
    expect(source).toMatch(/^export const DEFAULT_HAND_CAPACITY_PRODUCTION: HandCapacityCandidate = 12;$/m);
  });

  it("the supported values are still 9 and 12 (the Preview variant mechanism and the capacity-agnostic tests), 12 included", () => {
    expect([...HAND_CAPACITY_CANDIDATES]).toEqual([9, 12]);
    expect(HAND_CAPACITY_CANDIDATES).toContain(DEFAULT_HAND_CAPACITY_PRODUCTION);
  });
});
