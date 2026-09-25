import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER, SHIPPED_15_DISCOVERY_LADDER } from "./discoveryLadder";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES } from "./recipes";
import { materialIdsOfSteps, validateDiscoveryLadder } from "../logic/discoveryLadder";
import {
  REC04_STARTERS,
  REC04_W1_25_LADDER_FIXTURE,
  W1_RECIPE_POPULATION_FIXTURE,
  buildKeyRecipeLadder,
  toMaterialLadder,
  type LadderRecipe,
} from "../logic/testSupport/discoveryLadderRule";

const SHIPPED_POPULATION: LadderRecipe[] = RECIPES.map((r) => ({
  id: r.id,
  ingredientIds: r.requiredIngredients.map((q) => q.ingredientId),
}));

describe("Discovery Ladder authority data (I4a, REC-04 OD-REC04-1)", () => {
  it("the current ladder is the shipped 15-recipe ladder", () => {
    expect(DISCOVERY_LADDER).toBe(SHIPPED_15_DISCOVERY_LADDER);
    expect(SHIPPED_15_DISCOVERY_LADDER.populationId).toBe("shipped-15");
  });

  it("targets the current 15-recipe population", () => {
    expect(RECIPES).toHaveLength(15);
    expect(SHIPPED_15_DISCOVERY_LADDER.steps).toHaveLength(14);
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
    for (const step of SHIPPED_15_DISCOVERY_LADDER.steps) {
      expect(recipeIds.has(step.keyRecipeId)).toBe(true);
      for (const id of step.ingredientIds) expect(ingredientIds.has(id)).toBe(true);
    }
  });

  it("never includes an onboarding starter (they keep the existing starter authority)", () => {
    expect([...STARTER_INGREDIENT_IDS].sort()).toEqual([...REC04_STARTERS]);
    const materials = materialIdsOfSteps(SHIPPED_15_DISCOVERY_LADDER.steps);
    for (const starter of REC04_STARTERS) expect(materials).not.toContain(starter);
  });

  it("starters + ladder materials cover exactly the ingredients the shipped recipes use", () => {
    const used = new Set(RECIPES.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)));
    const covered = new Set([
      ...REC04_STARTERS,
      ...materialIdsOfSteps(SHIPPED_15_DISCOVERY_LADDER.steps),
    ]);
    expect([...covered].sort()).toEqual([...used].sort());
  });

  it("each step completes its key recipe exactly at that step (no useless step)", () => {
    const owned = new Set(REC04_STARTERS);
    const makeable = (ids: Set<string>) =>
      new Set(
        RECIPES.filter((r) => r.requiredIngredients.every((q) => ids.has(q.ingredientId))).map(
          (r) => r.id as string,
        ),
      );
    expect([...makeable(owned)]).toEqual(["margherita"]);
    for (const step of SHIPPED_15_DISCOVERY_LADDER.steps) {
      const before = makeable(owned);
      expect(before.has(step.keyRecipeId)).toBe(false);
      for (const id of step.ingredientIds) owned.add(id);
      const after = makeable(owned);
      expect(after.has(step.keyRecipeId)).toBe(true);
      expect(after.size).toBeGreaterThan(before.size);
    }
    expect(makeable(owned).size).toBe(RECIPES.length);
  });

  it("uses no star gate: steps carry only step/kind/ingredientIds/keyRecipeId", () => {
    for (const step of SHIPPED_15_DISCOVERY_LADDER.steps) {
      expect(Object.keys(step).sort()).toEqual(["ingredientIds", "keyRecipeId", "kind", "step"]);
    }
  });
});
