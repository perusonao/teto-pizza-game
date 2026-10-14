import { describe, expect, it } from "vitest";
import { STEP_LABEL, STEP_SHORT_LABEL } from "./makingStepLabels";
import { MAX_VISIBLE_COOKING_TABS } from "./cookingProfiles";

/** Cooking Steps 2.0 CS-4a (T3 compact chips): the short-label contract that keeps a 7+ tab strip legible at 360px. */
describe("making-step labels (CS-4a)", () => {
  const steps = Object.keys(STEP_LABEL) as (keyof typeof STEP_LABEL)[];

  it("every step has a short label, and never an empty one", () => {
    expect(Object.keys(STEP_SHORT_LABEL).sort()).toEqual([...steps].sort());
    for (const step of steps) expect(STEP_SHORT_LABEL[step].length).toBeGreaterThan(0);
  });

  it("a short label is at most 3 characters and never longer than the formal label", () => {
    for (const step of steps) {
      expect([...STEP_SHORT_LABEL[step]].length, `${step} short label`).toBeLessThanOrEqual(3);
      expect([...STEP_SHORT_LABEL[step]].length).toBeLessThanOrEqual([...STEP_LABEL[step]].length);
    }
  });

  it("the steps Production uses today keep their existing label (only unshipped steps are shortened)", () => {
    for (const step of ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT", "FINISH"] as const) {
      expect(STEP_SHORT_LABEL[step]).toBe(STEP_LABEL[step]);
    }
  });

  it("CS-4a does not move the Production tab ceiling (Owner Decision: stays 6)", () => {
    expect(MAX_VISIBLE_COOKING_TABS).toBe(6);
  });
});
