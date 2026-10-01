import { describe, expect, it } from "vitest";
import { RECIPES, type Recipe } from "../../data/recipes";
import { recipeKeyStep } from "../../state/recipeChapters";
import { discoverIds, walkInputs } from "../testSupport/discoveryWalk";
import { SYNTH_BRANCH_A_ID, frozenProduction25, syntheticRecipe } from "../testSupport/syntheticPopulation";
import { compareHintCandidates, discoverableHintCandidates, selectHintTarget } from "./hintTarget";

/**
 * Discovery 3.0 PR-4a -- the automatic hint target when the pool has 2+ recipes.
 *
 * OWNER DECISION PENDING (OD-D3-24-AUTO-TARGET, not decided here). `compareHintCandidates` orders by
 * key step -> FEWEST distinct ingredients -> declaration index. With one discoverable recipe at a time
 * (the 25 production recipes) the order never mattered; with a pool of 2+ it decides which recipe the
 * Free Cooking hint sheet talks about, i.e. what the player is steered toward first. These tests pin the
 * CURRENT deterministic behaviour so a change is a conscious one, and show the alternatives diverge. They
 * do NOT declare "fewest ingredients first" a product rule.
 */

const FIRST_12 = ["margherita", "bismarck", "breakfast-pizza", "funghi", "melanzane-pizza", "parmigiana-pizza", "pepperoni", "salsiccia", "meat-lovers", "bambino", "hawaiian", "capricciosa"];

/** Same key step (12) as A = pizza-portuguesa (6 distinct ingredients), but with 3 / 6 / 8 distinct ingredients. */
const FEW = syntheticRecipe("synthetic-few", [{ ingredientId: "tomato-sauce", minCount: 1 }, { ingredientId: "sausage", minCount: 2 }, { ingredientId: "onion", minCount: 2 }]);
const SAME = syntheticRecipe("synthetic-same", [
  { ingredientId: "tomato-sauce", minCount: 1 },
  { ingredientId: "mozzarella", minCount: 2 },
  { ingredientId: "sausage", minCount: 2 },
  { ingredientId: "onion", minCount: 2 },
  { ingredientId: "black-olive", minCount: 2 },
  { ingredientId: "oregano", minCount: 1 },
]);
const MANY = syntheticRecipe("synthetic-many", [
  { ingredientId: "tomato-sauce", minCount: 1 },
  { ingredientId: "mozzarella", minCount: 2 },
  { ingredientId: "sausage", minCount: 2 },
  { ingredientId: "ham", minCount: 2 },
  { ingredientId: "onion", minCount: 2 },
  { ingredientId: "black-olive", minCount: 2 },
  { ingredientId: "oregano", minCount: 1 },
  { ingredientId: "egg", minCount: 1 },
]);

const distinct = (r: Recipe) => new Set(r.requiredIngredients.map((q) => q.ingredientId)).size;

/** Alternative policies a product owner could choose; each returns the target id from a pool. */
const POLICIES: Record<string, (pool: readonly Recipe[], population: readonly Recipe[]) => string> = {
  "current (key step -> fewest ingredients -> declaration)": (pool, pop) => [...pool].sort((a, b) => compareHintCandidates(a, b, pop))[0].id,
  "declaration order only": (pool, pop) => [...pool].sort((a, b) => pop.indexOf(a) - pop.indexOf(b))[0].id,
  "most ingredients first": (pool, pop) => [...pool].sort((a, b) => distinct(b) - distinct(a) || pop.indexOf(a) - pop.indexOf(b))[0].id,
  "recipe id (alphabetical)": (pool) => [...pool].sort((a, b) => a.id.localeCompare(b.id))[0].id,
};

function poolFor(extra: Recipe) {
  const population = [...frozenProduction25(RECIPES), extra];
  const inputs = walkInputs(discoverIds([], FIRST_12), population);
  return { population, inputs, pool: discoverableHintCandidates(inputs, population) };
}

describe("auto target with a pool of 2 (CURRENT behaviour -- Owner Decision pending)", () => {
  it("fixture: A and the synthetic recipe share key step 12 and are both DISCOVERABLE", () => {
    for (const extra of [FEW, SAME, MANY]) {
      const { pool } = poolFor(extra);
      expect(pool.map((r) => r.id).sort()).toEqual([SYNTH_BRANCH_A_ID, extra.id].sort());
      expect(pool.map((r) => recipeKeyStep(r))).toEqual([12, 12]);
    }
  });

  it("current: the recipe with fewer distinct ingredients is the auto target (like calabresa vs portuguesa)", () => {
    const { population, inputs } = poolFor(FEW);
    expect(distinct(FEW)).toBeLessThan(distinct(population.find((r) => r.id === SYNTH_BRANCH_A_ID)!));
    expect(selectHintTarget(inputs, { recipes: population })).toEqual({ kind: "TARGET", recipeId: FEW.id, source: "auto" });
  });

  it("current: equal ingredient counts fall back to declaration index (A, declared earlier, wins)", () => {
    const { population, inputs } = poolFor(SAME);
    expect(selectHintTarget(inputs, { recipes: population })).toEqual({ kind: "TARGET", recipeId: SYNTH_BRANCH_A_ID, source: "auto" });
  });

  it("current: more ingredients loses to A", () => {
    const { population, inputs } = poolFor(MANY);
    expect(selectHintTarget(inputs, { recipes: population })).toEqual({ kind: "TARGET", recipeId: SYNTH_BRANCH_A_ID, source: "auto" });
  });

  it("the choice is a real product decision: the alternative policies disagree on the same pool", () => {
    const { population, pool } = poolFor(FEW);
    const picks = Object.fromEntries(Object.entries(POLICIES).map(([name, pick]) => [name, pick(pool, population)]));
    expect(picks["current (key step -> fewest ingredients -> declaration)"]).toBe(FEW.id);
    expect(picks["declaration order only"]).toBe(SYNTH_BRANCH_A_ID);
    expect(picks["most ingredients first"]).toBe(SYNTH_BRANCH_A_ID);
    expect(new Set(Object.values(picks)).size).toBeGreaterThan(1);
  });

  it("whatever the policy, the choice is deterministic, never depends on input order, and a pin / sticky target overrides it", () => {
    const { population, inputs } = poolFor(FEW);
    const reversed = [...population].reverse();
    // Reordering the population only changes the declaration tie-break, never an ingredient-count win.
    expect(selectHintTarget(inputs, { recipes: reversed })).toEqual(selectHintTarget(inputs, { recipes: population }));
    expect(selectHintTarget(inputs, { recipes: population, pinnedRecipeId: SYNTH_BRANCH_A_ID })).toEqual({ kind: "TARGET", recipeId: SYNTH_BRANCH_A_ID, source: "dex" });
    expect(selectHintTarget(inputs, { recipes: population, stickyRecipeId: SYNTH_BRANCH_A_ID })).toEqual({ kind: "TARGET", recipeId: SYNTH_BRANCH_A_ID, source: "auto" });
  });
});
