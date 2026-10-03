import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HAND_CAPACITY_CANDIDATE,
  DEFAULT_HAND_CAPACITY_PRODUCTION,
  HAND_CAPACITY_CANDIDATES,
  HAND_ENFORCEMENT_ENABLED,
  HAND_ENFORCEMENT_PRODUCTION,
} from "./handPolicy";

/**
 * The production authority of the hand, pinned (default project = the shipped literals):
 * - OD-5 (Owner, 2026-10-03): the production capacity is 12 (decided after the real-device ABBA comparison with HAND 9);
 * - LC-R6-e: the production switch is ON. Rollback = the one literal `HAND_ENFORCEMENT_PRODUCTION = false` (the `hand-off`
 *   Vitest project proves that state); changing either literal means updating THIS file on purpose.
 */
describe("production hand authority: capacity 12 (OD-5), enforcement ON (LC-R6-e)", () => {
  const source = readFileSync(resolve(process.cwd(), "src/logic/catalog/handPolicy.ts"), "utf8");

  it("DEFAULT_HAND_CAPACITY_PRODUCTION is 12, and so is the capacity the App uses when no Preview variant is in effect", () => {
    expect(DEFAULT_HAND_CAPACITY_PRODUCTION).toBe(12);
    expect(DEFAULT_HAND_CAPACITY_CANDIDATE).toBe(12);
    expect(source).toMatch(/^export const DEFAULT_HAND_CAPACITY_PRODUCTION: HandCapacityCandidate = 12;$/m);
  });

  it("the production switch is ON (one literal line); enforcement follows it in a production build", () => {
    expect(HAND_ENFORCEMENT_PRODUCTION).toBe(true);
    expect(HAND_ENFORCEMENT_ENABLED).toBe(true);
    expect(source).toMatch(/^export const HAND_ENFORCEMENT_PRODUCTION = true;$/m);
  });

  it("the supported values are still 9 and 12 (the Preview variant mechanism and the capacity-agnostic tests), 12 included", () => {
    expect([...HAND_CAPACITY_CANDIDATES]).toEqual([9, 12]);
    expect(HAND_CAPACITY_CANDIDATES).toContain(DEFAULT_HAND_CAPACITY_PRODUCTION);
  });
});
