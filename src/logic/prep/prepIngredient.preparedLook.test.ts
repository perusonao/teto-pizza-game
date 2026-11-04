import { describe, expect, it, vi } from "vitest";
import { gameReducer } from "../../state/gameReducer";
import { buildPendingRound } from "../../state/pendingRound";
import { normalised, placeBeefAndBake, toStep } from "./prepFixtures";

/**
 * Cooking Prep Phase 1B (#696), Owner decision Q4: `preparedLook` is the transient, display-only record of how far into the pan time each prepped ingredient was
 * taken out. Conditions: no effect on saves, scoring, inventory or the Dex; the reducer change stays minimal (an optional `progress` on PREP_INGREDIENT).
 */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../../data/prepExperienceGate", () => ({ PREP_EXPERIENCE_PRODUCTION: false, prepExperienceEnabled: () => gate.open }));

const prep = (progress?: number, ingredientId = "beef") => ({ type: "PREP_INGREDIENT" as const, ingredientId, progress });

describe("PREP_INGREDIENT with a progress", () => {
  it.each(["GUIDED", "FREE_COOK"] as const)("%s: records preparedLook next to preparedIngredientIds, and nothing else changes", (kind) => {
    const s = toStep(kind, "TOPPING");
    const after = gameReducer(s, prep(0.42));
    expect(after.preparedIngredientIds).toEqual(["beef"]);
    expect(after.preparedLook).toEqual({ beef: 0.42 });
    const { preparedIngredientIds: _a, preparedLook: _b, ...rest } = after;
    expect(rest).toStrictEqual(s);
  });

  it("without a progress there is no look at all (the PR-B behaviour is unchanged)", () => {
    const after = gameReducer(toStep("GUIDED", "TOPPING"), { type: "PREP_INGREDIENT", ingredientId: "beef" });
    expect(after.preparedIngredientIds).toEqual(["beef"]);
    expect("preparedLook" in after).toBe(false);
  });

  it("clamps to 0..1", () => {
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, prep(-3)).preparedLook).toEqual({ beef: 0 });
    expect(gameReducer(s, prep(7)).preparedLook).toEqual({ beef: 1 });
    expect(gameReducer(s, prep(0)).preparedLook).toEqual({ beef: 0 });
    expect(gameReducer(s, prep(1)).preparedLook).toEqual({ beef: 1 });
  });

  it.each([Number.NaN, Infinity, -Infinity])("a progress of %s is refused with the SAME state", (bad) => {
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, prep(bad))).toBe(s);
  });

  it("every existing refusal still returns the SAME state when a progress is given", () => {
    const s = toStep("GUIDED", "TOPPING");
    const lunch = { ...s, roundKind: "LUNCH_RUSH" as const };
    expect(gameReducer(lunch, prep(0.5))).toBe(lunch);
    const dough = toStep("GUIDED", "DOUGH");
    expect(gameReducer(dough, prep(0.5))).toBe(dough);
    expect(gameReducer(s, prep(0.5, "mozzarella"))).toBe(s);
    const notOwned = toStep("GUIDED", "TOPPING", false);
    expect(gameReducer(notOwned, prep(0.5))).toBe(notOwned);
    gate.open = false;
    expect(gameReducer(s, prep(0.5))).toBe(s);
    gate.open = true;
  });

  it("a second prep of the same ingredient is refused with the SAME state, the first look stays", () => {
    const once = gameReducer(toStep("GUIDED", "TOPPING"), prep(0.3));
    expect(gameReducer(once, prep(0.9))).toBe(once);
    expect(once.preparedLook).toEqual({ beef: 0.3 });
  });
});

describe("not carried over, never saved", () => {
  it("RESET_PIZZA removes the property itself (not set to undefined)", () => {
    const prepped = gameReducer(toStep("GUIDED", "TOPPING"), prep(0.5));
    const reset = gameReducer(prepped, { type: "RESET_PIZZA" });
    expect("preparedLook" in reset).toBe(false);
    expect("preparedIngredientIds" in reset).toBe(false);
  });

  it("PLAY_AGAIN / RETRY_SAME_RECIPE / a new Free Cooking round start without it", () => {
    const done = placeBeefAndBake(gameReducer(toStep("GUIDED", "TOPPING"), prep(0.5)), false);
    expect(done.preparedLook).toEqual({ beef: 0.5 });
    for (const action of [{ type: "PLAY_AGAIN" }, { type: "RETRY_SAME_RECIPE" }] as const) expect("preparedLook" in gameReducer(done, action)).toBe(false);
    const free = placeBeefAndBake(gameReducer(toStep("FREE_COOK", "TOPPING"), prep(0.5)), false);
    expect("preparedLook" in gameReducer(free, { type: "START_FREE_COOK" })).toBe(false);
  });

  it.each([0, 0.2, 0.525, 0.9, 1])("progress %s: pizza / score / scoringV2 / completion / inventory / dex / pitz and the journal are the same as without the prep", (progress) => {
    const base = toStep("GUIDED", "TOPPING");
    const plain = placeBeefAndBake(base, false);
    const prepped = placeBeefAndBake(base, progress);
    expect(prepped.preparedLook).toEqual({ beef: progress });
    expect(normalised(prepped)).toStrictEqual(normalised(plain));
    const squash = (v: unknown) => JSON.stringify(v).replace(/"topping-\d+"/g, "T");
    for (const key of ["pizza", "score", "scoringV2Result", "completion", "inventory", "dex", "pitzBalance"] as const) expect(squash(prepped[key])).toBe(squash(plain[key]));
    const journal = (s: typeof plain) => squash(buildPendingRound(s, "round-1", 70, 1));
    expect(journal(prepped)).toBe(journal(plain));
    expect(journal(prepped)).not.toMatch(/look|prepar|prep/i);
  });
});
