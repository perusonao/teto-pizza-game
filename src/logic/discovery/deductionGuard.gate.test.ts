import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import {
  guardedAnswerForParts,
  hypotheticalParts,
  hypotheticalReserves,
  partitionAllowsDh41,
  reserveInHypotheses,
  strictAnswerForParts,
  targetReserveParts,
  toppingClauseAllowedForParts,
  type ReserveParts,
} from "./deductionGuard";
import { requestDeductionHint } from "./deductionRequest";
import { attackStateOf, endgameAttack, partialAttack, type GuardUnderAttack } from "./testSupport/deductionAttacker";
import { dh42aGuardedAnswer, dh42aToppingClauseAllowed } from "./testSupport/deductionGuardDh42a";
import { ALL_INGREDIENT_IDS, ownedAt, reachableKnownSets, sweepStates } from "./testSupport/deductionInversion";

/**
 * Discovery Hint 4.0 (Issue #253), DH4-2B Pre-Implementation Gate: P2-1 (the one-sauce prior) and
 * P2-2 (TC-G's T >= 1), from the independent review of PR #264.
 *
 * The attacker (./testSupport/deductionAttacker.ts) is an independent implementation: it never reads
 * `hypotheticalReserves`; it enumerates reserve candidates from the observable facts (owned set,
 * known part, key, N, the clause, the answer, the public catalog and Rule W) with and without
 * category-defined priors, and treats the guard as a black box.
 */
const LADDER = W1_25_DISCOVERY_LADDER;
const HARDENED: GuardUnderAttack = { answer: guardedAnswerForParts, clauseAllowed: toppingClauseAllowedForParts };
const DH4_2A: GuardUnderAttack = { answer: dh42aGuardedAnswer, clauseAllowed: dh42aToppingClauseAllowed };
const byCategory = (c: string) => INGREDIENTS.filter((i) => i.category === c).map((i) => i.id);
const SAUCES = byCategory("sauce");
const CHEESES = byCategory("cheese");
const TOPPINGS = byCategory("topping");

let serial = 0;
function synthetic(ingredientIds: string[]): Recipe {
  serial += 1;
  return { ...RECIPES[1], id: `synthetic-${serial}` as never, requiredIngredients: ingredientIds.map((ingredientId) => ({ ingredientId, amount: 1 })) as never };
}

/** Synthetic future-catalog shapes (the 172 evidence has no-sauce, cheese-base and multi-spread rows). */
const FAMILIES: Record<string, Recipe[]> = {
  sauceless: CHEESES.flatMap((c) => TOPPINGS.filter((_, i) => i % 3 === 0).flatMap((t, i) => [synthetic([c, t]), synthetic([c, t, TOPPINGS[(i * 3 + 5) % TOPPINGS.length]])])),
  cheeseBase: TOPPINGS.filter((_, i) => i % 4 === 0).map((t) => synthetic([CHEESES[0], CHEESES[1], t])),
  multiSauce: [
    [0, 1],
    [0, 2],
    [1, 2],
  ].flatMap(([a, b]) =>
    TOPPINGS.filter((_, i) => i % 4 === 0).flatMap((t, i) => [
      synthetic([SAUCES[a], SAUCES[b], CHEESES[0]]),
      synthetic([SAUCES[a], SAUCES[b], CHEESES[0], t]),
      synthetic([SAUCES[a], SAUCES[b], CHEESES[1], t, TOPPINGS[(i * 4 + 7) % TOPPINGS.length]]),
    ]),
  ),
  zeroTopping: SAUCES.flatMap((s) => [synthetic([s, CHEESES[0]]), synthetic([s, CHEESES[0], CHEESES[2]]), synthetic([s, CHEESES[1], CHEESES[3], CHEESES[0]])]),
  noCheese: TOPPINGS.filter((_, i) => i % 3 === 0).map((t, i) => synthetic([SAUCES[0], t, TOPPINGS[(i * 3 + 2) % TOPPINGS.length]])),
};
const OWNED_STEPS = [3, 8, 12, 16, 20, 24, "all"] as const;

function syntheticStates(recipes: readonly Recipe[]) {
  return recipes.flatMap((recipe) =>
    OWNED_STEPS.map((step) => {
      const base = step === "all" ? ALL_INGREDIENT_IDS : ownedAt(step, LADDER);
      const owned = [...new Set([...base, ...recipe.requiredIngredients.map((r) => r.ingredientId)])];
      const parts = targetReserveParts(recipe.id, { discoveredCount: 5, ownedIngredientIds: owned }, [recipe])!;
      return { recipe, step, owned, parts };
    }),
  );
}

const leakPriors = (guard: GuardUnderAttack, recipe: Recipe, parts: ReserveParts) =>
  endgameAttack(guard, attackStateOf(recipe, parts.reserveId, parts.owned))
    .filter((r) => r.leak)
    .map((r) => r.prior);

describe("P2-1 reproduced: the DH4-2A one-sauce prior drops a sauceless reserve from H", () => {
  it("[mozzarella, egg, mushroom] with everything owned: DH4-2A names egg with no prior at all; the hardened guard does not", () => {
    const recipe = synthetic(["mozzarella", "egg", "mushroom"]);
    const parts = targetReserveParts(recipe.id, { discoveredCount: 5, ownedIngredientIds: ALL_INGREDIENT_IDS }, [recipe])!;
    expect(parts.reserveId).toBe("egg");
    expect(dh42aGuardedAnswer(parts)!.factId).toBe("attr:category:topping");
    expect(leakPriors(DH4_2A, recipe, parts)).toContain("none");
    expect(hypotheticalReserves(parts)).toContain("egg");
    expect(leakPriors(HARDENED, recipe, parts)).toEqual([]);
  });
  it("[mozzarella, basil, egg] (the review's example): the real reserve is in the hardened H at every inventory", () => {
    const recipe = synthetic(["mozzarella", "basil", "egg"]);
    for (const { parts } of syntheticStates([recipe])) {
      expect(hypotheticalReserves(parts)).toContain(parts.reserveId);
      expect(leakPriors(HARDENED, recipe, parts)).toEqual([]);
    }
  });
  it("across the synthetic families DH4-2A leaks and the hardened guard never does", () => {
    let dh42aLeaks = 0;
    for (const [family, recipes] of Object.entries(FAMILIES)) {
      for (const { recipe, step, parts } of syntheticStates(recipes)) {
        if (leakPriors(DH4_2A, recipe, parts).length > 0) dh42aLeaks += 1;
        expect(leakPriors(HARDENED, recipe, parts), `${family} ${recipe.requiredIngredients.map((r) => r.ingredientId)} @${step}`).toEqual([]);
      }
    }
    expect(dh42aLeaks).toBe(48); // of 141 recipes x 7 inventories = 987 owned states
  }, 120_000);
});

describe("Hardened guard: H completeness, H-only branches, fail closed", () => {
  const all = [
    ...sweepStates(LADDER).map((s) => partsOfRuntime(s.recipeId, s.step, s.owned)),
    ...Object.values(FAMILIES).flatMap((r) => syntheticStates(r).map((s) => s.parts)),
  ];
  function partsOfRuntime(recipeId: string, step: number, owned: readonly string[]) {
    return targetReserveParts(recipeId, { discoveredCount: step, ownedIngredientIds: owned })!;
  }
  it("the real reserve is always in H (runtime 300 + every synthetic family)", () => {
    for (const parts of all) expect(hypotheticalReserves(parts), parts.recipeIngredientIds.join(",")).toContain(parts.reserveId);
  });
  it("H, the partition branch and the TC-G decision are the same for every hypothesis in H; no answer class narrows a category side to 1", () => {
    for (const parts of all) {
      const h = hypotheticalReserves(parts);
      const branch = partitionAllowsDh41(parts);
      const clause = toppingClauseAllowedForParts(parts);
      const classes = new Map<string, number>();
      const sides = new Map<string, number>();
      for (const x of h) sides.set(getIngredient(x)!.category, (sides.get(getIngredient(x)!.category) ?? 0) + 1);
      for (const x of h) {
        const hp = hypotheticalParts(parts, x);
        expect(hypotheticalReserves(hp)).toEqual(h);
        expect(partitionAllowsDh41(hp)).toBe(branch);
        expect(toppingClauseAllowedForParts(hp)).toBe(clause);
        const key = `${getIngredient(x)!.category}|${guardedAnswerForParts(hp)!.factId}`;
        classes.set(key, (classes.get(key) ?? 0) + 1);
      }
      // Within each category side, an answer class either has >= 2 members or is the whole side (the
      // answer does not narrow that side at all, e.g. a constant existence answer).
      for (const [key, n] of classes) expect(n >= 2 || n === sides.get(key.split("|")[0]), `${parts.recipeIngredientIds.join(",")} ${key}`).toBe(true);
    }
  }, 120_000);
  it("a told clause is never 0, and no hypothesis in H has a zero topping total when it is told (P2-2)", () => {
    for (const parts of all) {
      if (!toppingClauseAllowedForParts(parts)) continue;
      for (const x of hypotheticalReserves(parts)) {
        expect(hypotheticalParts(parts, x).recipeIngredientIds.some((id) => getIngredient(id)!.category === "topping")).toBe(true);
      }
    }
  });
  it("fails closed when the reserve is not in H (hand-built parts the runtime never produces)", () => {
    const parts: ReserveParts = { recipeIngredientIds: ["tomato-sauce", "mozzarella", "ham"], reserveId: "ham", keyId: "tomato-sauce", owned: ["tomato-sauce", "mozzarella"] };
    expect(hypotheticalReserves(parts)).not.toContain("ham");
    expect(reserveInHypotheses(parts)).toBe(false);
    expect(partitionAllowsDh41(parts)).toBe(false);
    expect(strictAnswerForParts(parts)).toEqual({ level: "existence", factId: "attr:existence" });
    expect(guardedAnswerForParts(parts)).toEqual({ level: "existence", factId: "attr:existence" });
    expect(toppingClauseAllowedForParts(parts)).toBe(false);
    // A reserve Rule W could not have chosen (a cheese while a non-key topping is known).
    const notRuleW: ReserveParts = { recipeIngredientIds: ["tomato-sauce", "ham", "mozzarella"], reserveId: "mozzarella", keyId: "tomato-sauce", owned: [...ALL_INGREDIENT_IDS] };
    expect(partitionAllowsDh41(notRuleW)).toBe(false);
    expect(strictAnswerForParts(notRuleW)).toEqual({ level: "existence", factId: "attr:existence" });
    expect(guardedAnswerForParts(notRuleW)).toEqual({ level: "existence", factId: "attr:existence" });
    expect(toppingClauseAllowedForParts(notRuleW)).toBe(false);
  });
  it("a reserve-unowned request is refused as NOT_A_TARGET: nothing disclosed, nothing charged", () => {
    const recipe = synthetic(["mozzarella", "egg", "mushroom"]);
    const owned = ALL_INGREDIENT_IDS.filter((id) => id !== "egg");
    for (const family of ["structure", "attribute"]) {
      expect(requestDeductionHint({ family, recipeId: recipe.id, context: { discoveredCount: 5, ownedIngredientIds: owned }, storedFactIds: [], legacyPurchases: {}, requestPrice: 5, paidCount: 0, expectedPaidCount: 0, pitzBalance: 100 }, [recipe])).toEqual({
        outcome: "REJECTED",
        reason: "NOT_A_TARGET",
      });
    }
  });
});

describe("Independent attacker: runtime and partial knowledge", () => {
  it("runtime 300 states: no prior (none / one-sauce / not-one-sauce / Rule W / known category) is narrowed to 1 by the hint", () => {
    for (const s of sweepStates(LADDER)) {
      const recipe = RECIPES.find((r) => r.id === s.recipeId)!;
      const parts = targetReserveParts(s.recipeId, { discoveredCount: s.step, ownedIngredientIds: s.owned })!;
      expect(leakPriors(HARDENED, recipe, parts), `${s.recipeId}@${s.step}`).toEqual([]);
    }
  });
  it("all owned: every target", () => {
    for (const recipe of RECIPES.slice(1)) {
      const parts = targetReserveParts(recipe.id, { discoveredCount: 24, ownedIngredientIds: ALL_INGREDIENT_IDS })!;
      expect(leakPriors(HARDENED, recipe, parts), recipe.id).toEqual([]);
    }
  });
  it("partial knowledge (every reachable purchase state x 300 states): >= 2 possible reserves after N + clause + answer", () => {
    for (const s of sweepStates(LADDER)) {
      const recipe = RECIPES.find((r) => r.id === s.recipeId)!;
      const parts = targetReserveParts(s.recipeId, { discoveredCount: s.step, ownedIngredientIds: s.owned })!;
      const state = attackStateOf(recipe, parts.reserveId, s.owned);
      for (const known of reachableKnownSets(s)) expect(partialAttack(HARDENED, state, [...known]).leak, `${s.recipeId}@${s.step} ${[...known]}`).toBe(false);
    }
  }, 120_000);
  it("partial knowledge on the synthetic families (key-only and one-fact-short known sets)", () => {
    for (const recipes of Object.values(FAMILIES)) {
      for (const { recipe, parts } of syntheticStates(recipes.filter((_, i) => i % 2 === 0)).filter((_, i) => i % 3 === 0)) {
        const state = attackStateOf(recipe, parts.reserveId, parts.owned);
        const knownPart = parts.recipeIngredientIds.filter((id) => id !== parts.reserveId);
        const knownSets = [parts.keyId ? [parts.keyId] : [], ...knownPart.map((drop) => knownPart.filter((id) => id !== drop))];
        for (const known of knownSets) expect(partialAttack(HARDENED, state, known).leak, `${recipe.requiredIngredients.map((r) => r.ingredientId)} ${known}`).toBe(false);
      }
    }
  }, 120_000);
});
