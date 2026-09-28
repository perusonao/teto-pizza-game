import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import {
  guardedAnswerForParts,
  guardedReserveAttributeAnswer,
  hypotheticalReserves,
  makeablePrefix,
  structureAnswer,
  targetReserveParts,
  toppingClauseAllowed,
  toppingClauseAllowedForParts,
} from "./deductionGuard";
import { attackStateOf, endgameAttack, keyStepOf, reserveAcquiredLast, timingAttack, type GuardUnderAttack } from "./testSupport/deductionAttacker";
import { dh42aGuardedAnswer, dh42aToppingClauseAllowed } from "./testSupport/deductionGuardDh42a";
import { ownedAt, sweepStates } from "./testSupport/deductionInversion";

/**
 * Discovery Hint 4.0 (Issue #253), DH4-2B Pre-Implementation Gate: purchase timing (independent
 * review of PR #267, P1-1), closed by Owner Decision T1a. H and every decoy come only from what was
 * owned when the target became makeable, rebuilt from the acquisition order of ownedIngredientIds.
 */
const LADDER = W1_25_DISCOVERY_LADDER;
const HARDENED: GuardUnderAttack = { answer: guardedAnswerForParts, clauseAllowed: toppingClauseAllowedForParts };
const DH4_2A: GuardUnderAttack = { answer: dh42aGuardedAnswer, clauseAllowed: dh42aToppingClauseAllowed };
const recipeOf = (id: string) => RECIPES.find((r) => r.id === id)!;
const ctx = (step: number, owned: readonly string[]) => ({ discoveredCount: step, ownedIngredientIds: owned });

/** `owned` with `late` moved to the end: bought after the target became makeable. */
const boughtLate = (owned: readonly string[], late: readonly string[]) => [...owned.filter((id) => !late.includes(id)), ...late];

/** Every (state, decoy) of the review: one decoy that is not a starter, not in the recipe and not
 *  ruled out by the key rule, bought after the target became makeable. */
function lateDecoyCases() {
  return sweepStates(LADDER).flatMap((s) => {
    const parts = targetReserveParts(s.recipeId, ctx(s.step, s.owned))!;
    const keyStep = keyStepOf(parts.keyId!);
    return s.owned
      .filter((id) => !parts.recipeIngredientIds.includes(id) && !STARTER_INGREDIENT_IDS.includes(id) && keyStepOf(id) <= keyStep)
      .map((decoy) => ({ s, decoy, owned: boughtLate(s.owned, [decoy]) }));
  });
}

describe("P1-1 purchase timing, Owner Decision T1a", () => {
  it("regression: pepperoni @6 -- parmigiano bought after the target was makeable no longer turns existence into category:cheese", () => {
    const withoutParm = ownedAt(6, LADDER).filter((id) => id !== "parmigiano");
    const late = [...withoutParm, "parmigiano"];
    expect(guardedReserveAttributeAnswer("pepperoni", ctx(6, withoutParm))!.factId).toBe("attr:existence");
    expect(guardedReserveAttributeAnswer("pepperoni", ctx(6, late))!.factId).toBe("attr:existence");
    // DH4-2A (and this gate before T1a) answered category:cheese here, which names mozzarella.
    const parts = targetReserveParts("pepperoni", ctx(6, late))!;
    expect(dh42aGuardedAnswer(parts)!.factId).toBe("attr:category:cheese");
    expect(hypotheticalReserves(parts)).not.toContain("parmigiano");
    expect(timingAttack(HARDENED, attackStateOf(recipeOf("pepperoni"), parts.reserveId, late), ["parmigiano"]).filter((r) => r.leak)).toEqual([]);
  });

  it("the boundary: parmigiano owned BEFORE the target became makeable is a real decoy; bought right after it is not", () => {
    // Ladder order: parmigiano (step 5) is acquired before pepperoni (step 6, the key) -> a decoy.
    const before = ownedAt(6, LADDER);
    expect(before.indexOf("parmigiano")).toBeLessThan(before.indexOf("pepperoni"));
    const partsBefore = targetReserveParts("pepperoni", ctx(6, before))!;
    expect(makeablePrefix(partsBefore)).toContain("parmigiano");
    expect(hypotheticalReserves(partsBefore)).toContain("parmigiano");
    expect(guardedReserveAttributeAnswer("pepperoni", ctx(6, before))!.factId).toBe("attr:category:cheese");
    // The same set, with parmigiano bought one purchase after pepperoni: not a decoy.
    const after = boughtLate(before, ["parmigiano"]);
    const partsAfter = targetReserveParts("pepperoni", ctx(6, after))!;
    expect(makeablePrefix(partsAfter)).not.toContain("parmigiano");
    expect(guardedReserveAttributeAnswer("pepperoni", ctx(6, after))!.factId).toBe("attr:existence");
  });

  it("the review's 44 (state, late decoy) pairs are in this set; the T1a guard leaks in 0 of them (DH4-2A in 85)", () => {
    const cases = lateDecoyCases();
    expect(cases.length).toBeGreaterThan(44);
    let dh42a = 0;
    let hardened = 0;
    for (const { s, decoy, owned } of cases) {
      const parts = targetReserveParts(s.recipeId, ctx(s.step, owned))!;
      const state = attackStateOf(recipeOf(s.recipeId), parts.reserveId, owned);
      if (timingAttack(DH4_2A, state, [decoy]).some((r) => r.leak)) dh42a += 1;
      if (timingAttack(HARDENED, state, [decoy]).some((r) => r.leak) || endgameAttack(HARDENED, state).some((r) => r.leak)) hardened += 1;
    }
    expect(dh42a).toBe(85); // DH4-2A lacks the key rule too
    expect(hardened).toBe(0);
    // The pre-T1a hardened guard read today's inventory as a set, so it answered as if each decoy
    // were owned from the start. That exact situation (the decoy early, the attacker knowing it was
    // bought late) reproduces the review's 44.
    let preT1a = 0;
    for (const { s, decoy } of cases) {
      const parts = targetReserveParts(s.recipeId, ctx(s.step, s.owned))!;
      if (timingAttack(HARDENED, attackStateOf(recipeOf(s.recipeId), parts.reserveId, s.owned), [decoy]).some((r) => r.leak)) preT1a += 1;
    }
    expect(preT1a).toBe(44);
  }, 120_000);

  it("a late purchase never makes any answer stronger: the answer and the clause equal those without it", () => {
    for (const { s, decoy, owned } of lateDecoyCases()) {
      const without = s.owned.filter((id) => id !== decoy);
      const where = `${s.recipeId}@${s.step} +${decoy}`;
      expect(guardedReserveAttributeAnswer(s.recipeId, ctx(s.step, owned)), where).toEqual(guardedReserveAttributeAnswer(s.recipeId, ctx(s.step, without)));
      expect(toppingClauseAllowed(s.recipeId, ctx(s.step, owned)), where).toBe(toppingClauseAllowed(s.recipeId, ctx(s.step, without)));
      expect(structureAnswer(s.recipeId, ctx(s.step, owned)), where).toEqual(structureAnswer(s.recipeId, ctx(s.step, without)));
    }
  }, 120_000);

  it("many late purchases at once (everything after the key moved to the end) also change nothing", () => {
    for (const s of sweepStates(LADDER)) {
      const parts = targetReserveParts(s.recipeId, ctx(s.step, s.owned))!;
      const cut = s.owned.indexOf(parts.keyId!);
      const early = s.owned.slice(0, cut + 1);
      expect(guardedReserveAttributeAnswer(s.recipeId, ctx(s.step, s.owned)), `${s.recipeId}@${s.step}`).toEqual(
        guardedReserveAttributeAnswer(s.recipeId, ctx(s.step, early)),
      );
    }
  });
});

describe("T1a: the reserve acquired last (the purchase that made the target makeable) fails closed", () => {
  it("existence and no clause; an onset-unaware attacker learns only that onset fact", () => {
    // Synthetic [tomato-sauce, mozzarella, egg, mushroom]: mushroom (step 3) is the key, egg the Rule W
    // reserve. Here egg is bought after mushroom, so buying egg is what made the target makeable.
    const recipe = { ...recipeOf("bismarck"), id: "synthetic-reserve-last" as never, requiredIngredients: ["tomato-sauce", "mozzarella", "egg", "mushroom"].map((ingredientId) => ({ ingredientId, amount: 1 })) as never };
    const owned = boughtLate(ownedAt(3, LADDER), ["egg"]);
    const parts = targetReserveParts(recipe.id, ctx(5, owned), [recipe])!;
    expect([parts.keyId, parts.reserveId]).toEqual(["mushroom", "egg"]);
    const state = attackStateOf(recipe, parts.reserveId, owned);
    expect(reserveAcquiredLast(state)).toBe(true);
    expect(guardedAnswerForParts(parts)).toEqual({ level: "existence", factId: "attr:existence" });
    expect(toppingClauseAllowedForParts(parts)).toBe(false);
    expect(endgameAttack(HARDENED, state).filter((r) => r.leak)).toEqual([]);
  });

  it("on the 300 runtime states the reserve is never acquired last (the key is), so nothing fails closed there", () => {
    for (const s of sweepStates(LADDER)) {
      const parts = targetReserveParts(s.recipeId, ctx(s.step, s.owned))!;
      expect(reserveAcquiredLast(attackStateOf(recipeOf(s.recipeId), parts.reserveId, s.owned)), `${s.recipeId}@${s.step}`).toBe(false);
    }
  });
});
