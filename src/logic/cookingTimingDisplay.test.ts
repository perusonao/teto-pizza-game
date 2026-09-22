import { describe, expect, it } from "vitest";
import { stepTimingRows } from "./cookingTimingDisplay";
import type { MakingStep } from "../state/gameReducer";

describe("stepTimingRows", () => {
  it("returns one row per step, in the given order, when every step has a finalized time", () => {
    const steps: MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"];
    const perStepElapsedMs = { DOUGH: 8_000, SAUCE: 12_000, CHEESE: 9_000, TOPPING: 21_000 };
    expect(stepTimingRows(steps, perStepElapsedMs)).toEqual([
      { step: "DOUGH", elapsedMs: 8_000 },
      { step: "SAUCE", elapsedMs: 12_000 },
      { step: "CHEESE", elapsedMs: 9_000 },
      { step: "TOPPING", elapsedMs: 21_000 },
    ]);
  });

  // PR-A Dynamic Cooking Steps: marinara/fugazza/pizza-bianca never include CHEESE in `steps`;
  // quattro-formaggi never includes TOPPING. This function takes its ordering entirely from
  // `steps`, never from `perStepElapsedMs`'s own keys, so a step absent from the round's actual
  // profile can never appear here even if (incorrectly) present in `perStepElapsedMs`.
  it("never includes a step absent from the given steps list, even if perStepElapsedMs has a stray entry for it", () => {
    const steps: MakingStep[] = ["DOUGH", "SAUCE", "TOPPING"]; // no CHEESE (e.g. marinara)
    const perStepElapsedMs = { DOUGH: 8_000, SAUCE: 12_000, CHEESE: 999_000, TOPPING: 21_000 };
    const rows = stepTimingRows(steps, perStepElapsedMs);
    expect(rows.map((r) => r.step)).toEqual(["DOUGH", "SAUCE", "TOPPING"]);
  });

  it("never includes a TOPPING row when steps has no TOPPING (e.g. quattro-formaggi)", () => {
    const steps: MakingStep[] = ["DOUGH", "SAUCE", "CHEESE"];
    const perStepElapsedMs = { DOUGH: 8_000, SAUCE: 12_000, CHEESE: 9_000 };
    const rows = stepTimingRows(steps, perStepElapsedMs);
    expect(rows.map((r) => r.step)).toEqual(["DOUGH", "SAUCE", "CHEESE"]);
  });

  it("omits a step present in the list but with no finalized elapsed time yet (round abandoned mid-step)", () => {
    const steps: MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"];
    const perStepElapsedMs = { DOUGH: 8_000, SAUCE: 12_000 }; // abandoned mid-CHEESE
    expect(stepTimingRows(steps, perStepElapsedMs)).toEqual([
      { step: "DOUGH", elapsedMs: 8_000 },
      { step: "SAUCE", elapsedMs: 12_000 },
    ]);
  });

  it("includes a CUT row (post-BAKE step) when present, in its own position in the given order", () => {
    const steps: MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"];
    const perStepElapsedMs = { DOUGH: 8_000, SAUCE: 12_000, CHEESE: 9_000, TOPPING: 21_000, CUT: 15_000 };
    const rows = stepTimingRows(steps, perStepElapsedMs);
    expect(rows[rows.length - 1]).toEqual({ step: "CUT", elapsedMs: 15_000 });
  });

  it("returns an empty array when perStepElapsedMs is null/undefined (Mission round, or timing never started)", () => {
    const steps: MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"];
    expect(stepTimingRows(steps, null)).toEqual([]);
    expect(stepTimingRows(steps, undefined)).toEqual([]);
  });

  it("returns an empty array when perStepElapsedMs is an empty object (no step finalized yet)", () => {
    const steps: MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"];
    expect(stepTimingRows(steps, {})).toEqual([]);
  });

  it("handles a 0ms elapsed step (finished instantly) as a real row, not omitted", () => {
    const steps: MakingStep[] = ["DOUGH"];
    expect(stepTimingRows(steps, { DOUGH: 0 })).toEqual([{ step: "DOUGH", elapsedMs: 0 }]);
  });

  it("returns an empty array when the steps list itself is empty", () => {
    expect(stepTimingRows([], { DOUGH: 8_000 })).toEqual([]);
  });
});
