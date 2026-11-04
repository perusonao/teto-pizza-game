import { describe, expect, it, vi } from "vitest";
import { gameReducer } from "../../state/gameReducer";
import { buildPendingRound, pizzaFromJournal } from "../../state/pendingRound";
import { normalised, placeBeefAndBake, toStep } from "./prepFixtures";

/**
 * Cooking Prep Phase 1 PR-A S2: PREP_INGREDIENT with the experience gate OPEN (the Preview opt-in state). The production-OFF half is
 * ./prepIngredient.flagOff.test.ts. Spec AC-2 .. AC-5, AC-7, AC-19, §3.3, §8.1.
 */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../../data/prepExperienceGate", () => ({
  PREP_EXPERIENCE_PRODUCTION: false,
  prepExperienceEnabled: () => gate.open,
}));

const prep = (ingredientId = "beef") => ({ type: "PREP_INGREDIENT" as const, ingredientId });

describe("PREP_INGREDIENT: allowed (Guided / Free Cooking, TOPPING, beef owned)", () => {
  it.each(["GUIDED", "FREE_COOK"] as const)("%s: marks beef prepped, once", (kind) => {
    const s = toStep(kind, "TOPPING");
    expect(s.preparedIngredientIds).toBeUndefined();
    const once = gameReducer(s, prep());
    expect(once.preparedIngredientIds).toEqual(["beef"]);
    expect(gameReducer(once, prep())).toBe(once); // already prepped: same reference
  });

  it("changes nothing but preparedIngredientIds (no stock is consumed, nothing re-scored)", () => {
    const s = toStep("GUIDED", "TOPPING");
    const { preparedIngredientIds, ...after } = gameReducer(s, prep());
    expect(preparedIngredientIds).toEqual(["beef"]);
    expect(after).toStrictEqual(s);
  });
});

describe("PREP_INGREDIENT: refused with the SAME state reference", () => {
  it.each(["LUNCH_RUSH", "DINNER"] as const)("%s", (roundKind) => {
    const s = { ...toStep("GUIDED", "TOPPING"), roundKind };
    expect(gameReducer(s, prep())).toBe(s);
  });

  it("any step but TOPPING", () => {
    for (const upTo of ["DOUGH", "SAUCE"] as const) {
      const s = toStep("GUIDED", upTo);
      expect(gameReducer(s, prep())).toBe(s);
    }
  });

  it("outside PREPARE (after the bake)", () => {
    const done = placeBeefAndBake(toStep("GUIDED", "TOPPING"), false);
    expect(done.phase).not.toBe("PREPARE");
    expect(gameReducer(done, prep())).toBe(done);
  });

  it("an ingredient that is not a target, or unknown", () => {
    const s = toStep("GUIDED", "TOPPING");
    for (const id of ["mozzarella", "tomato", "no-such-ingredient", ""]) expect(gameReducer(s, prep(id))).toBe(s);
  });

  it("beef the player does not own (ownedIngredientIds decides; stock is not consulted)", () => {
    const s = toStep("GUIDED", "TOPPING", false);
    expect(s.ownedIngredientIds).not.toContain("beef");
    expect(gameReducer(s, prep())).toBe(s);
    // owned but with an empty stock entry: still allowed, because the prep consumes nothing
    const owned = toStep("GUIDED", "TOPPING");
    const noStock = { ...owned, inventory: { ...owned.inventory, beef: 0 } };
    expect(gameReducer(noStock, prep()).preparedIngredientIds).toEqual(["beef"]);
  });
});

describe("optional, never fails", () => {
  it.each(["GUIDED", "FREE_COOK"] as const)("%s: a round that never preps places, bakes and scores as before", (kind) => {
    const done = placeBeefAndBake(toStep(kind, "TOPPING"), false);
    expect(done.preparedIngredientIds).toBeUndefined();
    expect(done.phase).not.toBe("PREPARE");
    expect(done.scoringV2Result ?? done.score ?? done.bakeValue).not.toBeNull();
  });

  it.each(["GUIDED", "FREE_COOK"] as const)("%s: prepping changes pizza / score / scoringV2 / completion / inventory / everything else by nothing", (kind) => {
    const base = toStep(kind, "TOPPING");
    const plain = placeBeefAndBake(base, false);
    const prepped = placeBeefAndBake(base, true);
    expect(prepped.preparedIngredientIds).toEqual(["beef"]);
    expect(normalised(prepped)).toStrictEqual(normalised(plain));
    for (const key of ["pizza", "score", "scoringV2Result", "completion", "inventory", "dex", "pitzBalance"] as const) {
      expect(JSON.stringify(prepped[key]).replace(/"topping-\d+"/g, "T")).toBe(JSON.stringify(plain[key]).replace(/"topping-\d+"/g, "T"));
    }
  });

  it("prepping after some beef is already placed is allowed (the whole ingredient changes at once, P-4)", () => {
    let s = toStep("GUIDED", "TOPPING");
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "beef", x: 40, y: 50 });
    const before = s.pizza;
    s = gameReducer(s, prep());
    expect(s.preparedIngredientIds).toEqual(["beef"]);
    expect(s.pizza).toBe(before);
  });
});

describe("not carried over", () => {
  it("RESET_PIZZA removes the property itself", () => {
    const prepped = gameReducer(toStep("GUIDED", "TOPPING"), prep());
    const reset = gameReducer(prepped, { type: "RESET_PIZZA" });
    expect("preparedIngredientIds" in reset).toBe(false);
  });

  it("PLAY_AGAIN and RETRY_SAME_RECIPE start a round without it", () => {
    const done = placeBeefAndBake(gameReducer(toStep("GUIDED", "TOPPING"), prep()), false);
    expect(done.preparedIngredientIds).toEqual(["beef"]);
    expect("preparedIngredientIds" in gameReducer(done, { type: "PLAY_AGAIN" })).toBe(false);
    expect("preparedIngredientIds" in gameReducer(done, { type: "RETRY_SAME_RECIPE" })).toBe(false);
  });

  it("starting a new Free Cooking round does not carry it", () => {
    const done = placeBeefAndBake(gameReducer(toStep("FREE_COOK", "TOPPING"), prep()), false);
    expect("preparedIngredientIds" in gameReducer(done, { type: "START_FREE_COOK" })).toBe(false);
  });
});

describe("save / pendingRound boundary (AC-7, AC-19)", () => {
  it("the pending-round journal is identical with and without the prep, and carries no prep state", () => {
    const base = toStep("GUIDED", "TOPPING");
    const plain = placeBeefAndBake(base, false);
    const prepped = placeBeefAndBake(base, true);
    const journal = (s: typeof plain) => JSON.stringify(buildPendingRound(s, "round-1", 70, 1)).replace(/"topping-\d+"/g, "T");
    expect(journal(prepped)).toBe(journal(plain));
    expect(journal(prepped)).not.toMatch(/prepar|prep/i);
  });

  it("a restored pizza has no prep: the journal pizza is the whole restorable state", () => {
    const prepped = placeBeefAndBake(toStep("GUIDED", "TOPPING"), true);
    const restored = pizzaFromJournal(buildPendingRound(prepped, "round-1", 70, 1).pizza);
    expect(JSON.stringify(restored)).not.toMatch(/prepar/i);
  });
});
