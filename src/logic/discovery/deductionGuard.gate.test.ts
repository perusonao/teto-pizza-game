import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
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
import { attackStateOf, endgameAttack, keyStepOf, partialAttack, reserveAcquiredLast, type GuardUnderAttack } from "./testSupport/deductionAttacker";
import { dh42aGuardedAnswer, dh42aToppingClauseAllowed } from "./testSupport/deductionGuardDh42a";
import { ALL_INGREDIENT_IDS, ownedAt, reachableKnownSets, sweepStates } from "./testSupport/deductionInversion";
import { hintKeyIngredientId } from "./hintSteps";
import { reservedIngredientId } from "./selectableHint";

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

/** Synthetic states as they happen in play: the recipe's missing ingredients are bought after the
 *  inventory base, the free key last (the purchase that makes the target makeable). With
 *  `reserveLast`, the reserve is bought after the key instead (T1a: that fails closed). */
function syntheticStates(recipes: readonly Recipe[], opts: { reserveLast?: boolean } = {}) {
  return recipes.flatMap((recipe) =>
    OWNED_STEPS.map((step) => {
      const base = step === "all" ? ALL_INGREDIENT_IDS : ownedAt(step, LADDER);
      const ids = recipe.requiredIngredients.map((r) => r.ingredientId);
      const key = hintKeyIngredientId(recipe);
      const reserve = reservedIngredientId(recipe);
      const tail = opts.reserveLast ? [...ids.filter((id) => id !== reserve), reserve] : [...ids.filter((id) => id !== key), ...(key ? [key] : [])];
      const starters = new Set(STARTER_INGREDIENT_IDS);
      const late = tail.filter((id, i) => tail.indexOf(id) === i && !starters.has(id));
      const owned = [...base.filter((id) => !late.includes(id)), ...late];
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
    // Expansion Slice 3: `other` now has two catalog members (egg, almond), so the family answer is no longer a singleton
    // fallback; the property under test (the hardened guard leaks nothing) is the assertions below.
    expect(dh42aGuardedAnswer(parts)!.factId).toBe("attr:family:other");
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
    // Re-measured at No.27 (30 ingredients: the synthetic families are cut from the production TOPPINGS,
    // so adding chicken re-shapes them). The property that matters is the hardened `toEqual([])` above.
    // Re-measured again at Expansion Slice 1 (31 ingredients: shrimp joins the TOPPINGS the families are cut from).
    // Re-measured again at Expansion Slice 3 (35 ingredients: almond joins the TOPPINGS the families are cut from).
    // Re-measured again at Expansion Batch 1 (38 ingredients: pine-nuts / prosciutto-crudo / green-pepper join the TOPPINGS).
    // Re-measured again at Expansion Batch 2 (45 ingredients: salami / arugula / lemon / salmon join the TOPPINGS; the cheeses do not).
    // Re-measured again at Expansion Batch 4 (55 ingredients: catupiry / jalapeno / feta / sardine join; the hardened `toEqual([])` above held for every state).
    // Re-measured again at Expansion Batch 5 (57 ingredients: ricotta (a cheese) and hot-dog join; the hardened `toEqual([])` above held for every state).
    // Re-measured again at Batch 6 PR-2 (61 ingredients: avocado / goat-cheese / artichoke / spinach join; the hardened `toEqual([])` above held for every state).
    expect(dh42aLeaks).toBe(123);
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
  // This sweep is exhaustive on purpose: ~3,800 parts (300 runtime + the synthetic families, which grow with the catalog), and for each of
  // ~65,000 hypotheses it recomputes H, the partition branch and the guarded answer. Measured at 61 ingredients (single core): ~95s, of
  // which `partitionAllowsDh41` ~37s and `guardedAnswerForParts` ~42s (each is O(|H|) over the DH4-1 answers, |H| up to 60). On a shared
  // 2-vCPU CI runner it crossed the former 120s limit (PR #440, twice). The checks and assertions are unchanged; only this test's limit moves.
  }, 300_000);
  it("a told clause is never 0, and no hypothesis in H has a zero topping total when it is told (P2-2)", () => {
    for (const parts of all) {
      if (!toppingClauseAllowedForParts(parts)) continue;
      for (const x of hypotheticalReserves(parts)) {
        expect(hypotheticalParts(parts, x).recipeIngredientIds.some((id) => getIngredient(id)!.category === "topping")).toBe(true);
      }
    }
  });
  it("fails closed when the reserve is not in H (hand-built parts the runtime never produces)", () => {
    const real = targetReserveParts("capricciosa", { discoveredCount: 24, ownedIngredientIds: ALL_INGREDIENT_IDS })!;
    // The reserve is not owned.
    const unowned: ReserveParts = { ...real, owned: real.owned.filter((id) => id !== real.reserveId) };
    // A reserve Rule W could not have chosen (a cheese while a non-key topping is known).
    const cheese = real.recipeIngredientIds.find((id) => getIngredient(id)!.category === "cheese")!;
    const notRuleW: ReserveParts = { ...real, reserveId: cheese };
    // A reserve unlocked after the key (it would have been the key).
    const lateKey: ReserveParts = { ...real, keyId: real.recipeIngredientIds.find((id) => getIngredient(id)!.category === "sauce")! };
    for (const parts of [unowned, notRuleW, lateKey]) {
      expect(hypotheticalReserves(parts)).not.toContain(parts.reserveId);
      expect(reserveInHypotheses(parts)).toBe(false);
      expect(partitionAllowsDh41(parts)).toBe(false);
      expect(strictAnswerForParts(parts)).toEqual({ level: "existence", factId: "attr:existence" });
      expect(guardedAnswerForParts(parts)).toEqual({ level: "existence", factId: "attr:existence" });
      expect(toppingClauseAllowedForParts(parts)).toBe(false);
    }
  });
  it("key rule (Codex review): Bismarck at step 5 never answers a class that only mozzarella can fill", () => {
    const parts = targetReserveParts("bismarck", { discoveredCount: 5, ownedIngredientIds: ownedAt(5, LADDER) })!;
    for (const x of hypotheticalReserves(parts)) expect(keyStepOf(x)).toBeLessThanOrEqual(keyStepOf(parts.keyId!));
    expect(guardedAnswerForParts(parts)!.factId).not.toBe("attr:category:cheese");
    expect(leakPriors(HARDENED, RECIPES.find((r) => r.id === "bismarck")!, parts)).toEqual([]);
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

describe("T1a: synthetic families with the reserve bought last fail closed, and still leak nothing", () => {
  // The onset-aware attacker check below is structurally 0 in these states (its universe is the
  // reserve alone: the makeable moment already names it); the fail-closed answer is what is tested.
  it("every synthetic family: existence and no clause whenever the reserve was acquired after everything else", () => {
    let reserveLast = 0;
    for (const recipes of Object.values(FAMILIES)) {
      for (const { recipe, owned, parts } of syntheticStates(recipes, { reserveLast: true })) {
        const state = attackStateOf(recipe, parts.reserveId, owned);
        if (!reserveAcquiredLast(state)) continue;
        reserveLast += 1;
        expect(guardedAnswerForParts(parts)).toEqual({ level: "existence", factId: "attr:existence" });
        expect(toppingClauseAllowedForParts(parts)).toBe(false);
        expect(leakPriors(HARDENED, recipe, parts)).toEqual([]);
      }
    }
    expect(reserveLast).toBeGreaterThan(100);
  }, 120_000);
  it("an onset-UNAWARE attacker can only single out a reserve that was acquired last (the makeable moment itself)", () => {
    let found = 0;
    for (const recipes of Object.values(FAMILIES)) {
      for (const opts of [{}, { reserveLast: true }]) {
        for (const { recipe, owned, parts } of syntheticStates(recipes.filter((_, i) => i % 2 === 0), opts)) {
          const state = attackStateOf(recipe, parts.reserveId, owned);
          const leaks = endgameAttack(HARDENED, state, undefined, { onsetAware: false }).filter((r) => r.leak);
          if (leaks.length > 0) {
            found += 1;
            expect(reserveAcquiredLast(state), recipe.requiredIngredients.map((r) => r.ingredientId).join(",")).toBe(true);
          }
        }
      }
    }
    // Not vacuous: the onset-unaware attacker does find these (and only these).
    expect(found).toBeGreaterThan(0);
  }, 120_000);
});

describe("Independent attacker: runtime and partial knowledge", () => {
  it("the DH4-2A guard leaks on the RUNTIME under the key rule (Codex review of #267): 40 states, bismarck + funghi @5..24; the hardened guard 0", () => {
    const leaking = new Map<string, number[]>();
    for (const s of sweepStates(LADDER)) {
      const recipe = RECIPES.find((r) => r.id === s.recipeId)!;
      const parts = targetReserveParts(s.recipeId, { discoveredCount: s.step, ownedIngredientIds: s.owned })!;
      if (leakPriors(DH4_2A, recipe, parts).length > 0) leaking.set(s.recipeId, [...(leaking.get(s.recipeId) ?? []), s.step]);
    }
    const steps = Array.from({ length: 20 }, (_, i) => i + 5);
    expect([...leaking]).toEqual([
      ["bismarck", steps],
      ["funghi", steps],
    ]);
  });
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
