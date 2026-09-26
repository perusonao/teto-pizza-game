import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER, SHIPPED_15_DISCOVERY_LADDER, W1_25_DISCOVERY_LADDER, type DiscoveryLadder } from "./discoveryLadder";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { materialIdsOfSteps, validateDiscoveryLadder } from "../logic/discoveryLadder";
import {
  REC04_STARTERS,
  REC04_W1_25_LADDER_FIXTURE,
  W1_RECIPE_POPULATION_FIXTURE,
  buildKeyRecipeLadder,
  toMaterialLadder,
  type LadderRecipe,
} from "../logic/testSupport/discoveryLadderRule";

/** The 15 recipes the I4a/I4b ladder was generated for: margherita + the EP1 chain. Since W1
 *  I5b-3, `RECIPES` also holds the 10 W1 recipes (no `unlockCondition`, OD-I5B-2). */
const SHIPPED_15_RECIPES = (RECIPES as readonly Recipe[]).filter((r) => r.id === "margherita" || r.unlockCondition);

const SHIPPED_POPULATION: LadderRecipe[] = SHIPPED_15_RECIPES.map((r) => ({
  id: r.id,
  ingredientIds: r.requiredIngredients.map((q) => q.ingredientId),
}));

const PRODUCTION_POPULATION: LadderRecipe[] = RECIPES.map((r) => ({
  id: r.id,
  ingredientIds: r.requiredIngredients.map((q) => q.ingredientId),
}));

describe("Discovery Ladder authority data (I4a, REC-04 OD-REC04-1)", () => {
  it("the current ladder is the 25-recipe W1 ladder (I5b-3); the shipped-15 ladder stays as history", () => {
    expect(DISCOVERY_LADDER).toBe(W1_25_DISCOVERY_LADDER);
    expect(DISCOVERY_LADDER.populationId).toBe("w1-25");
    expect(SHIPPED_15_DISCOVERY_LADDER.populationId).toBe("shipped-15");
  });

  it("targets the current 25-recipe population (24 steps); shipped-15 had 15 recipes (14 steps)", () => {
    expect(RECIPES).toHaveLength(25);
    expect(DISCOVERY_LADDER.steps).toHaveLength(24);
    expect(SHIPPED_15_RECIPES).toHaveLength(15);
    expect(SHIPPED_15_DISCOVERY_LADDER.steps).toHaveLength(14);
  });

  it("the production ladder equals the REC-04 key-recipe rule applied to the production recipe data", () => {
    const derived = toMaterialLadder("w1-25", buildKeyRecipeLadder(PRODUCTION_POPULATION));
    expect(DISCOVERY_LADDER).toEqual(derived);
    expect(validateDiscoveryLadder(DISCOVERY_LADDER)).toEqual([]);
  });

  it("is structurally valid (steps 1..n in order, known kind, no duplicate material)", () => {
    expect(validateDiscoveryLadder(SHIPPED_15_DISCOVERY_LADDER)).toEqual([]);
  });

  it("every W1-era step is kind MATERIAL", () => {
    for (const step of SHIPPED_15_DISCOVERY_LADDER.steps) expect(step.kind).toBe("MATERIAL");
  });

  it("equals the REC-04 key-recipe rule applied to the shipped recipe data", () => {
    const derived = toMaterialLadder("shipped-15", buildKeyRecipeLadder(SHIPPED_POPULATION));
    expect(SHIPPED_15_DISCOVERY_LADDER.steps).toEqual(derived.steps);
  });

  it("the rule port reproduces REC-04's recorded 24-step ladder for shipped 15 + W1 10", () => {
    const derived = toMaterialLadder(
      "w1-25",
      buildKeyRecipeLadder([...SHIPPED_POPULATION, ...W1_RECIPE_POPULATION_FIXTURE]),
    );
    expect(derived.steps).toEqual(REC04_W1_25_LADDER_FIXTURE.steps);
    expect(validateDiscoveryLadder(REC04_W1_25_LADDER_FIXTURE)).toEqual([]);
  });

  it("names only ingredients and recipes that exist in the current data", () => {
    const ingredientIds = new Set(INGREDIENTS.map((i) => i.id));
    const recipeIds = new Set<string>(RECIPES.map((r) => r.id));
    for (const step of [...SHIPPED_15_DISCOVERY_LADDER.steps, ...DISCOVERY_LADDER.steps]) {
      expect(recipeIds.has(step.keyRecipeId)).toBe(true);
      for (const id of step.ingredientIds) expect(ingredientIds.has(id)).toBe(true);
    }
  });

  it("never includes an onboarding starter (they keep the existing starter authority)", () => {
    expect([...STARTER_INGREDIENT_IDS].sort()).toEqual([...REC04_STARTERS]);
    const materials = materialIdsOfSteps(SHIPPED_15_DISCOVERY_LADDER.steps);
    for (const starter of REC04_STARTERS) expect(materials).not.toContain(starter);
  });

  const PAIRS: readonly [string, DiscoveryLadder, readonly Recipe[]][] = [
    ["shipped-15", SHIPPED_15_DISCOVERY_LADDER, SHIPPED_15_RECIPES],
    ["production (w1-25)", DISCOVERY_LADDER, RECIPES],
  ];

  it.each(PAIRS)("%s: starters + ladder materials cover exactly the ingredients its recipes use", (_name, ladder, recipes) => {
    const used = new Set(recipes.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)));
    const covered = new Set([...REC04_STARTERS, ...materialIdsOfSteps(ladder.steps)]);
    expect([...covered].sort()).toEqual([...used].sort());
  });

  it.each(PAIRS)("%s: each step completes its key recipe exactly at that step (no useless step)", (_name, ladder, recipes) => {
    const owned = new Set(REC04_STARTERS);
    const makeable = (ids: Set<string>) =>
      new Set(
        recipes.filter((r) => r.requiredIngredients.every((q) => ids.has(q.ingredientId))).map(
          (r) => r.id as string,
        ),
      );
    expect([...makeable(owned)]).toEqual(["margherita"]);
    for (const step of ladder.steps) {
      const before = makeable(owned);
      expect(before.has(step.keyRecipeId)).toBe(false);
      for (const id of step.ingredientIds) owned.add(id);
      const after = makeable(owned);
      expect(after.has(step.keyRecipeId)).toBe(true);
      expect(after.size).toBeGreaterThan(before.size);
    }
    expect(makeable(owned).size).toBe(recipes.length);
  });

  it("uses no star gate: steps carry only step/kind/ingredientIds/keyRecipeId", () => {
    for (const step of [...SHIPPED_15_DISCOVERY_LADDER.steps, ...DISCOVERY_LADDER.steps]) {
      expect(Object.keys(step).sort()).toEqual(["ingredientIds", "keyRecipeId", "kind", "step"]);
    }
  });
});
