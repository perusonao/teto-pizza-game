import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import { researchEntryViews } from "../../state/discoveryHint";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../../state/dex";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import type { RecipeDiscoveryInputs } from "../../state/recipeDiscoveryState";
import type { ScoreBreakdown } from "../../logic/scoring";
import { ordinaryRecipes } from "../catalog/testSupport/lateIds";
import { discoverableHintCandidates, selectHintTarget } from "./hintTarget";
import { researchCohortLetters } from "./researchEntry";
import { classifyNearMiss, type NearMiss } from "./nearMiss";
import { signatureOfPizza } from "./signature";

/**
 * Expansion Batch 15 (Issue #728): the effect of nigerian-suya-pizza on "おしい" (near-miss) classification, the Hint target and the Research display at ordinary ladder step 58, measured over the REAL
 * discoverable pool of that moment (every recipe the player can cook right after buying beef), not just the rendang / suya pair. Production data only; nothing is saved.
 */
const SUYA = "nigerian-suya-pizza";
const SCORE: ScoreBreakdown = { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 };
const discover = (ids: readonly string[]): DexState => ids.reduce((dex, id) => registerScoreToDex(dex, id, SCORE).dex, EMPTY_DEX);
const ladderOwned = (step: number): string[] => [...STARTER_INGREDIENT_IDS, ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds)];
const keysBefore = (step: number): string[] => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const pizzaOf = (ids: readonly string[]): PizzaState =>
  ({
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce),
    toppings: ids.filter((id) => !isSauce(id)).map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 2, y: 50 })),
    bakeResult: 70,
  }) as PizzaState;

const owned = ladderOwned(58);
const inventory = Object.fromEntries(owned.map((id) => [id, 10]));
const recipesWithout = RECIPES.filter((r) => r.id !== SUYA);
const catalogWithout = RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId !== SUYA);
const mk = (dex: DexState): RecipeDiscoveryInputs => ({ dex, ownedIngredientIds: owned, unlockedForShopIngredientIds: owned, inventory });
// Scenario A: the player reached step 58 by discovering only the key recipe of every earlier step (the minimum); the non-credit / sibling recipes are still undiscovered
const dexA = discover(keysBefore(58));
// Scenario B: the player has discovered every other ordinary recipe that is makeable at step 58, so only rendang-pizza (and, after Batch 15, suya) remain
const dexB = discover(RECIPES.map((r) => r.id as string).filter((id) => id !== SUYA && id !== "rendang-pizza"));
const poolIds = (dex: DexState, recipes: readonly Recipe[]) => discoverableHintCandidates(mk(dex), recipes).map((r) => r.id as string).sort();
const show = (n: NearMiss | null) => (n === null ? "null" : `${n.kind}${n.sauceStep ? "/" + n.sauceStep : ""}(d${n.distance})`);

describe("step 58 (right after buying beef): the real discoverable pool", () => {
  it("scenario A (earlier key recipes only): the pool grows by exactly nigerian-suya-pizza and nothing else changes", () => {
    const before = poolIds(dexA, recipesWithout);
    const after = poolIds(dexA, RECIPES);
    expect(before).toContain("rendang-pizza");
    expect(before.length).toBeGreaterThan(1); // other undiscovered non-credit recipes are already makeable here: the pool was already open
    expect(after).toEqual([...before, SUYA].sort());
  });

  it("scenario B (everything else discovered): the pool grows from {rendang-pizza} to {rendang-pizza, nigerian-suya-pizza}", () => {
    expect(poolIds(dexB, recipesWithout)).toEqual(["rendang-pizza"]);
    expect(poolIds(dexB, RECIPES)).toEqual([SUYA, "rendang-pizza"].sort());
  });

  it("Hint target: scenario A is OPEN_POOL before and after (no change); scenario B used to auto-target rendang-pizza and is now OPEN_POOL (nothing is chosen for the player, and nothing names a recipe) -- the same behaviour as every other multi-recipe step (32, 62, 66)", () => {
    expect(selectHintTarget(mk(dexA), { recipes: recipesWithout }).kind).toBe("OPEN_POOL");
    expect(selectHintTarget(mk(dexA)).kind).toBe("OPEN_POOL");
    expect(selectHintTarget(mk(dexB), { recipes: recipesWithout })).toMatchObject({ kind: "TARGET", recipeId: "rendang-pizza" });
    const after = selectHintTarget(mk(dexB));
    expect(after.kind).toBe("OPEN_POOL");
    expect(JSON.stringify(after)).not.toMatch(/rendang|nigerian|suya/);
    // an explicit Research target (the player's own pick from an anonymous card) still works for either
    expect(selectHintTarget(mk(dexB), { researchTargetId: SUYA })).toMatchObject({ kind: "TARGET", recipeId: SUYA, source: "research" });
    expect(selectHintTarget(mk(dexB), { researchTargetId: "rendang-pizza" })).toMatchObject({ kind: "TARGET", recipeId: "rendang-pizza", source: "research" });
  });
});

describe("'おしい' over the whole step-58 pool", () => {
  const SUYA_SET = ["beef", "green-pepper", "mozzarella", "onion"].join("|");
  const candAfter = discoverableHintCandidates(mk(dexA));
  const candBefore = discoverableHintCandidates(mk(dexA), recipesWithout);
  const poolIngredients = [...new Set(candAfter.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId as string)))].sort();
  const nonSauce = poolIngredients.filter((id) => !isSauce(id));
  const sauces: (string | null)[] = [null, "tomato-sauce", "curry-ketchup", "olive-oil", "pesto"];
  // (1) exhaustive over the rendang / suya neighbourhood: every subset of {beef, mozzarella, onion, green-pepper} x every sauce option
  const core = ["beef", "mozzarella", "onion", "green-pepper"];
  const attempts: string[][] = [];
  for (let m = 1; m < 16; m += 1) for (const sa of sauces) attempts.push([...core.filter((_, i) => m & (1 << i)), ...(sa ? [sa] : [])]);
  // (2) seeded random attempts over EVERY ingredient of the pool (sizes 2-6, a random sauce option), so a neighbour elsewhere in the pool is covered too
  let seed = 20261102;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let n = 0; n < 1500; n += 1) {
    const size = 2 + Math.floor(rnd() * 5);
    const ids = new Set<string>();
    while (ids.size < size) ids.add(nonSauce[Math.floor(rnd() * nonSauce.length)]);
    const sa = sauces[Math.floor(rnd() * sauces.length)];
    attempts.push([...ids, ...(sa ? [sa] : [])]);
  }
  const read = (ids: string[], after: boolean) => {
    const sig = signatureOfPizza(pizzaOf(ids));
    return after ? classifyNearMiss(sig, candAfter) : classifyNearMiss(sig, candBefore, { catalog: catalogWithout, recipes: recipesWithout });
  };

  it("covers the pool: it holds more than rendang and suya, and the universe includes ingredients from other recipes", () => {
    expect(candAfter.length).toBeGreaterThan(2);
    expect(nonSauce.length).toBeGreaterThan(6);
    expect(attempts.length).toBeGreaterThan(1500);
  });

  it("adding suya never makes any attempt WORSE: every changed attempt becomes strictly nearer, or is exactly the new recipe; every attempt that already matched (null) still does", () => {
    let changed = 0;
    for (const ids of attempts) {
      const before = read(ids, false);
      const after = read(ids, true);
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      changed += 1;
      expect(before, `an attempt that exactly matched a recipe before must still: ${ids.join("+")} -> ${show(after)}`).not.toBeNull();
      const isExactSuya = after === null && [...ids].sort().join("|") === SUYA_SET;
      expect(isExactSuya || (after !== null && after.distance < before!.distance), `${ids.join("+")}: ${show(before)} -> ${show(after)}`).toBe(true);
    }
    expect(changed).toBeGreaterThan(10);
  }, 120_000);

  it("every changed attempt involves green-pepper (the one ingredient that distinguishes suya from rendang) or an ingredient of suya's set: nothing far from suya moves", () => {
    for (const ids of attempts) {
      if (JSON.stringify(read(ids, false)) === JSON.stringify(read(ids, true))) continue;
      expect(ids.includes("green-pepper") || ids.filter((i) => ["beef", "mozzarella", "onion"].includes(i)).length >= 2, ids.join("+")).toBe(true);
    }
  }, 120_000);

  it("rendang's own neighbourhood reads exactly as before (the d=1 tie without a sauce still goes to rendang's SAUCE_ONLY line)", () => {
    for (const ids of [
      ["mozzarella", "beef", "onion"],
      ["mozzarella", "beef", "onion", "tomato-sauce"],
      ["mozzarella", "beef", "onion", "curry-ketchup"],
      ["mozzarella", "beef", "onion", "green-pepper", "curry-ketchup"],
      ["mozzarella", "beef", "curry-ketchup"],
      ["beef", "onion", "curry-ketchup"],
    ]) expect(show(read(ids, true)), ids.join("+")).toBe(show(read(ids, false)));
  });

  it("the result still carries only kind / distance / sauceStep / keyUnused (no recipe, no ingredient) for every attempt", () => {
    for (const ids of attempts) {
      const n = read(ids, true);
      if (n) expect(Object.keys(n).every((k) => ["kind", "distance", "sauceStep", "keyUnused"].includes(k))).toBe(true);
    }
  }, 120_000);
});

describe("Research display at step 58", () => {
  const ORD = ordinaryRecipes(RECIPES);
  const ORD_WITHOUT = ORD.filter((r) => r.id !== SUYA);

  it("before: rendang-pizza is a single-member cohort (no letter); after: suya A / rendang B, the labels name only the unlock material and a letter; no other entry changes", () => {
    const lettersBefore = researchCohortLetters(owned, ORD_WITHOUT);
    const lettersAfter = researchCohortLetters(owned, ORD);
    expect(lettersBefore.has("rendang-pizza")).toBe(false);
    expect(lettersAfter.get(SUYA)).toBe("A");
    expect(lettersAfter.get("rendang-pizza")).toBe("B");
    for (const r of ORD_WITHOUT) if (r.id !== "rendang-pizza") expect(lettersAfter.get(r.id), r.id).toBe(lettersBefore.get(r.id));
    const views = researchEntryViews({ dex: dexB, ownedIngredientIds: owned });
    const label = Object.fromEntries(views.map((v) => [v.recipeId as string, v.label]));
    expect(label["rendang-pizza"]).toBe("？？？ピザ B（牛肉）");
    expect(label[SUYA]).toBe("？？？ピザ A（牛肉）");
    for (const l of Object.values(label)) expect(l).not.toMatch(/ナイジェリア|スヤ|ルンダン|suya|rendang/i);
  });

  it("once rendang-pizza is discovered its entry (and so its letter) is gone, and suya stays the only open entry of the cohort ('A' is never reused or renumbered)", () => {
    const dexRendang = registerScoreToDex(dexB, "rendang-pizza", SCORE).dex;
    const views = researchEntryViews({ dex: dexRendang, ownedIngredientIds: owned });
    expect(views.map((v) => v.recipeId as string)).toEqual([SUYA]);
    expect(views[0].label).toBe("？？？ピザ A（牛肉）");
  });
});
