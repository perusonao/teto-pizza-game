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
import { discoverableHintCandidates, selectHintTarget } from "./hintTarget";
import { classifyNearMiss, type NearMiss } from "./nearMiss";
import { signatureOfPizza } from "./signature";

/**
 * Expansion Batch 16 (Issue #736): the effect of ume-shiso-pizza on "おしい" (near-miss) classification, the Hint target and the Research display at ordinary ladder step 67, measured over the REAL discoverable pool
 * of that moment (every recipe the player can cook right after buying umeboshi-paste), with shirasu-pizza (its Jaccard 0.60 neighbour, a B16-only exception) both discovered and undiscovered. Production data only; nothing is saved.
 */
const ME = "ume-shiso-pizza";
const SHIRASU = "shirasu-pizza";
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

const owned = ladderOwned(67);
const inventory = Object.fromEntries(owned.map((id) => [id, 10]));
const recipesWithout = RECIPES.filter((r) => r.id !== ME);
const catalogWithout = RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId !== ME);
const mk = (dex: DexState): RecipeDiscoveryInputs => ({ dex, ownedIngredientIds: owned, unlockedForShopIngredientIds: owned, inventory });
const allIds = RECIPES.map((r) => r.id as string);
// A: the player reached step 67 by discovering only the key recipe of every earlier step (the minimum); B: shirasu-pizza undiscovered, everything else found; C: everything else found
const dexA = discover(keysBefore(67));
const dexB = discover(allIds.filter((id) => id !== ME && id !== SHIRASU));
const dexC = discover(allIds.filter((id) => id !== ME));
const poolIds = (dex: DexState, recipes: readonly Recipe[]) => discoverableHintCandidates(mk(dex), recipes).map((r) => r.id as string).sort();
const show = (n: NearMiss | null) => (n === null ? "null" : `${n.kind}${n.sauceStep ? "/" + n.sauceStep : ""}(d${n.distance})`);

describe("step 67 (right after buying umeboshi-paste): the real discoverable pool", () => {
  it("scenario A (earlier key recipes only): the pool grows by exactly ume-shiso-pizza and nothing else changes", () => {
    const before = poolIds(dexA, recipesWithout);
    expect(before.length).toBeGreaterThan(1); // other undiscovered recipes are already makeable: the pool was already open
    expect(poolIds(dexA, RECIPES)).toEqual([...before, ME].sort());
  });

  it("scenario B (shirasu-pizza undiscovered): {shirasu-pizza} becomes {shirasu-pizza, ume-shiso-pizza}; scenario C (all else found): {} becomes {ume-shiso-pizza}", () => {
    expect(poolIds(dexB, recipesWithout)).toEqual([SHIRASU]);
    expect(poolIds(dexB, RECIPES)).toEqual([ME, SHIRASU].sort());
    expect(poolIds(dexC, recipesWithout)).toEqual([]);
    expect(poolIds(dexC, RECIPES)).toEqual([ME]);
  });

  it("Hint target: A is OPEN_POOL before and after; B used to auto-target shirasu-pizza and is now OPEN_POOL (nothing is chosen for the player, nothing names a recipe) -- the same behaviour as every other multi-recipe step (32, 58, 62, 66); C targets ume-shiso", () => {
    expect(selectHintTarget(mk(dexA), { recipes: recipesWithout }).kind).toBe("OPEN_POOL");
    expect(selectHintTarget(mk(dexA)).kind).toBe("OPEN_POOL");
    expect(selectHintTarget(mk(dexB), { recipes: recipesWithout })).toMatchObject({ kind: "TARGET", recipeId: SHIRASU });
    const after = selectHintTarget(mk(dexB));
    expect(after.kind).toBe("OPEN_POOL");
    expect(JSON.stringify(after)).not.toMatch(/shirasu|ume-shiso|umeboshi/);
    expect(selectHintTarget(mk(dexB), { researchTargetId: ME })).toMatchObject({ kind: "TARGET", recipeId: ME, source: "research" });
    expect(selectHintTarget(mk(dexB), { researchTargetId: SHIRASU })).toMatchObject({ kind: "TARGET", recipeId: SHIRASU, source: "research" });
    expect(selectHintTarget(mk(dexC))).toMatchObject({ kind: "TARGET", recipeId: ME });
  });
});

describe("'おしい' over the whole step-67 pool", () => {
  const ME_SET = ["mozzarella", "shiso", "umeboshi-paste", "whitebait"].join("|");
  for (const [name, dex] of [["A (keys only)", dexA], ["B (shirasu undiscovered)", dexB]] as const) {
    const candAfter = discoverableHintCandidates(mk(dex));
    const candBefore = discoverableHintCandidates(mk(dex), recipesWithout);
    const poolIngredients = [...new Set(candAfter.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId as string)))].sort();
    const nonSauce = poolIngredients.filter((id) => !isSauce(id));
    const sauces: (string | null)[] = [null, "umeboshi-paste", "tomato-sauce", "curry-ketchup", "olive-oil"];
    // (1) exhaustive over the neighbourhood: every subset of {mozzarella, whitebait, shiso, lemon} x every sauce option
    const core = ["mozzarella", "whitebait", "shiso", "lemon"];
    const attempts: string[][] = [];
    for (let m = 1; m < 16; m += 1) for (const sa of sauces) attempts.push([...core.filter((_, i) => m & (1 << i)), ...(sa ? [sa] : [])]);
    // (2) seeded random attempts over EVERY ingredient of the pool, so a neighbour elsewhere is covered too
    let seed = 20261103;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let n = 0; n < 1500; n += 1) {
      const size = Math.min(nonSauce.length, 2 + Math.floor(rnd() * 5));
      const ids = new Set<string>();
      while (ids.size < size) ids.add(nonSauce[Math.floor(rnd() * nonSauce.length)]);
      const sa = sauces[Math.floor(rnd() * sauces.length)];
      attempts.push([...ids, ...(sa ? [sa] : [])]);
    }
    const read = (ids: string[], after: boolean) => {
      const sig = signatureOfPizza(pizzaOf(ids));
      return after ? classifyNearMiss(sig, candAfter) : classifyNearMiss(sig, candBefore, { catalog: catalogWithout, recipes: recipesWithout });
    };

    it(`${name}: the universe is meaningful (more than the neighbourhood)`, () => {
      expect(candAfter.length).toBeGreaterThan(0);
      expect(nonSauce).toEqual(expect.arrayContaining(["mozzarella", "whitebait", "shiso"]));
      expect(attempts.length).toBeGreaterThan(1500);
    });

    it(`${name}: adding ume-shiso never makes any attempt WORSE: every changed attempt becomes strictly nearer, or is exactly the new recipe; every attempt that already matched (null) still does`, () => {
      let changed = 0;
      for (const ids of attempts) {
        const before = read(ids, false);
        const after = read(ids, true);
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        changed += 1;
        expect(before, `an attempt that exactly matched a recipe before must still: ${ids.join("+")} -> ${show(after)}`).not.toBeNull();
        const isExactMe = after === null && [...ids].sort().join("|") === ME_SET;
        expect(isExactMe || (after !== null && after.distance < before!.distance), `${ids.join("+")}: ${show(before)} -> ${show(after)}`).toBe(true);
      }
      expect(changed).toBeGreaterThan(10);
    }, 120_000);

    it(`${name}: shirasu-pizza's neighbourhood: untouched while shirasu is a candidate (B: its pizza, and the lemon-less d=1 tie still going to shirasu's ADD_ONE line); only nearer once it is discovered (A)`, () => {
      for (const ids of [
        ["mozzarella", "lemon", "shiso", "whitebait"],
        ["mozzarella", "shiso", "whitebait"],
        ["mozzarella", "lemon", "whitebait"],
        ["lemon", "shiso", "whitebait"],
      ]) {
        const before = read(ids, false);
        const after = read(ids, true);
        // shirasu-pizza is a candidate only when it is undiscovered (B): then its neighbourhood is untouched. When it is already discovered (A) it is no candidate, so these pizzas may only get NEARER to ume-shiso.
        if (name.startsWith("B")) expect(show(after), ids.join("+")).toBe(show(before));
        else expect(after === null || before === null || after.distance <= before.distance, `${ids.join("+")}: ${show(before)} -> ${show(after)}`).toBe(true);
      }
    }, 120_000);

    it(`${name}: the result still carries only kind / distance / sauceStep / keyUnused (no recipe, no ingredient) for every attempt`, () => {
      for (const ids of attempts) {
        const n = read(ids, true);
        if (n) expect(Object.keys(n).every((k) => ["kind", "distance", "sauceStep", "keyUnused"].includes(k))).toBe(true);
      }
    }, 120_000);
  }
});

describe("Research display at step 67", () => {
  it("the single-member cohort: one entry '？？？ピザ（梅肉）' (no letter) and no other entry changes; once discovered it is gone", () => {
    const views = researchEntryViews({ dex: dexC, ownedIngredientIds: owned });
    expect(views.map((v) => `${v.recipeId}:${v.label}`)).toEqual([`${ME}:？？？ピザ（梅肉）`]);
    for (const v of views) expect(v.label).not.toMatch(/梅しそ|ume-shiso|しらす|大葉/);
    const registered = registerScoreToDex(dexC, ME, SCORE).dex;
    expect(researchEntryViews({ dex: registered, ownedIngredientIds: owned })).toEqual([]);
  });

  it("with shirasu-pizza also undiscovered the two entries keep their own labels (shirasu's cohort key is whitebait; ume-shiso's is umeboshi-paste): nothing is lettered", () => {
    const labels = researchEntryViews({ dex: dexB, ownedIngredientIds: owned }).map((v) => v.label).sort();
    expect(labels).toEqual(["？？？ピザ（しらす）", "？？？ピザ（梅肉）"].sort());
  });
});
