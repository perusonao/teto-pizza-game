import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { guardedAnswerForParts, guardedReserveAttributeAnswer, targetReserveParts, toppingClauseAllowedForParts } from "./deductionGuard";
import { attackStateOf, keyStepOf, timingAttack, type GuardUnderAttack } from "./testSupport/deductionAttacker";
import { ownedAt, sweepStates } from "./testSupport/deductionInversion";

/**
 * Discovery Hint 4.0 (Issue #253), DH4-2B Pre-Implementation Gate: the purchase-timing finding
 * (independent review of PR #267, P1-1). OPEN: it needs an Owner Decision (see the Gate report §9),
 * so DH4-2B does not start. These tests pin the measured size of the leak so any change to it is
 * seen; they are not a statement that it is acceptable.
 */
const LADDER = W1_25_DISCOVERY_LADDER;
const HARDENED: GuardUnderAttack = { answer: guardedAnswerForParts, clauseAllowed: toppingClauseAllowedForParts };

describe("P1-1 purchase timing (OPEN, Owner Decision required)", () => {
  it("reproduces the review's pepperoni case: a cheese bought after the target was makeable turns existence into category:cheese", () => {
    const without = ownedAt(6, LADDER).filter((id) => id !== "parmigiano");
    const late = [...without, "parmigiano"];
    expect(guardedReserveAttributeAnswer("pepperoni", { discoveredCount: 6, ownedIngredientIds: without })!.factId).toBe("attr:existence");
    expect(guardedReserveAttributeAnswer("pepperoni", { discoveredCount: 6, ownedIngredientIds: late })!.factId).toBe("attr:category:cheese");
    const parts = targetReserveParts("pepperoni", { discoveredCount: 6, ownedIngredientIds: late })!;
    const recipe = RECIPES.find((r) => r.id === "pepperoni")!;
    expect(timingAttack(HARDENED, attackStateOf(recipe, parts.reserveId, late), ["parmigiano"]).filter((r) => r.leak).map((r) => r.candidates)).toContainEqual(["mozzarella"]);
  });

  it("pins the size: 300 states x one decoy bought late (unlocked no later than the key, not a starter)", () => {
    const leaking = new Map<string, number>();
    for (const s of sweepStates(LADDER)) {
      const recipe = RECIPES.find((r) => r.id === s.recipeId)!;
      const parts = targetReserveParts(s.recipeId, { discoveredCount: s.step, ownedIngredientIds: s.owned })!;
      const keyStep = keyStepOf(parts.keyId!);
      const decoys = s.owned.filter((id) => !parts.recipeIngredientIds.includes(id) && !STARTER_INGREDIENT_IDS.includes(id) && keyStepOf(id) <= keyStep);
      for (const d of decoys) {
        if (timingAttack(HARDENED, attackStateOf(recipe, parts.reserveId, s.owned), [d]).some((r) => r.leak)) leaking.set(s.recipeId, (leaking.get(s.recipeId) ?? 0) + 1);
      }
    }
    // 44 (state, late decoy) pairs in 3 recipes. The DH4-2A guard leaks identically (not a regression).
    expect(Object.fromEntries(leaking)).toEqual({ genovese: 7, pepperoni: 19, salsiccia: 18 });
  }, 120_000);
});
