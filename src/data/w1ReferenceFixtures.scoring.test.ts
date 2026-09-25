import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReferencePizza } from "./referencePizza";

/**
 * Progression 2.0 W1 I5b-2: perfect-score regression for the 10 unwired W1 fixtures through the
 * real `computeScoringV2`. The scoring code reads fixtures only via `getReferencePizza`, so this
 * file (and only this file) extends that lookup with the W1 fixtures -- exactly what I5b-3's
 * registration in `REFERENCE_PIZZAS` will do. The scoring algorithm and the shipped fixtures are
 * untouched.
 */
const extra = vi.hoisted(() => new Map<string, unknown>());
vi.mock("./referencePizza", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./referencePizza")>();
  return {
    ...actual,
    getReferencePizza: (id: string) => (extra.get(id) as ReferencePizza | undefined) ?? actual.getReferencePizza(id),
  };
});

import { buildIdealSauceFixture, getReferencePizza } from "./referencePizza";
import { W1_REFERENCE_FIXTURES, W1_REFERENCE_RECIPE_META, type W1ReferencePizza } from "./w1ReferenceFixtures";
import { getRecipe, type Recipe } from "./recipes";
import { W1_RECIPE_REQUIREMENTS_FIXTURE } from "../logic/testSupport/discoveryLadderRule";
import { computeScoringV2 } from "../logic/scoringV2";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";

beforeAll(() => {
  for (const f of W1_REFERENCE_FIXTURES) extra.set(f.recipeId, f);
});

function w1Recipe(fixture: W1ReferencePizza): Recipe {
  const requirements = W1_RECIPE_REQUIREMENTS_FIXTURE.find((r) => r.id === fixture.recipeId)!;
  return {
    id: fixture.recipeId,
    nameJa: fixture.recipeId,
    description: "",
    requiredIngredients: requirements.requiredIngredients,
    bakeTarget: W1_REFERENCE_RECIPE_META[fixture.recipeId].bakeTarget,
    baseRewardPitz: 100,
  } as unknown as Recipe;
}

function midBake(recipe: Recipe): number {
  return (recipe.bakeTarget.start + recipe.bakeTarget.end) / 2;
}

/** Sauce painted as the ideal fixture, every piece exactly on its Reference position, baked mid-zone. */
function referenceExact(reference: Pick<ReferencePizza, "sauce" | "pieceGroups">, recipe: Recipe, tag: string): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((g, gi) =>
      g.positions.map((p, i) => ({ id: `${tag}-${gi}-${i}`, ingredientId: g.ingredientId, ...p })),
    ),
    bakeResult: midBake(recipe),
  };
}

function shifted(pizza: PizzaState, dx: number): PizzaState {
  return { ...pizza, toppings: pizza.toppings.map((t, i) => ({ ...t, x: t.x + (i % 2 === 0 ? dx : -dx) })) };
}

const margherita = getRecipe("margherita")!;
const margheritaPerfect = computeScoringV2(margherita, referenceExact(getReferencePizza("margherita")!, margherita, "m"));

describe("W1 fixtures: Reference-exact pizza through the real computeScoringV2", () => {
  it("the shipped Margherita baseline is unchanged by this file's lookup extension", () => {
    expect(margheritaPerfect.available).toBe(true);
    expect(getReferencePizza("margherita")!.recipeId).toBe("margherita");
  });

  it.each(W1_REFERENCE_FIXTURES.map((f) => [f.recipeId, f] as const))(
    "%s: available, Pieces 100, Recipe 100, Bake 100, quantity factor 1, total = the Margherita perfect total",
    (_id, fixture) => {
      const recipe = w1Recipe(fixture);
      const result = computeScoringV2(recipe, referenceExact(fixture, recipe, "w1"));
      expect(result.available).toBe(true);
      expect(result.unavailableReason).toBeNull();
      const { sauce, pieces, recipe: recipeComponent, bake, quantity } = result.components;
      if (!sauce.available || !pieces.available || !recipeComponent.available || !bake.available || !quantity.available) {
        throw new Error("every component must be available");
      }
      expect(pieces.score).toBe(100);
      expect(recipeComponent.score).toBe(100);
      expect(bake.score).toBe(100);
      expect(quantity.factor).toBe(1);
      // Same ideal sauce fixture against the same mechanical target -> the same near-perfect sauce.
      if (!margheritaPerfect.components.sauce.available) throw new Error("baseline");
      expect(sauce.score).toBe(margheritaPerfect.components.sauce.score);
      expect(result.totalScore).toBe(margheritaPerfect.totalScore);
    },
  );

  it.each(W1_REFERENCE_FIXTURES.map((f) => [f.recipeId, f] as const))(
    "%s: perfect > displaced > empty",
    (_id, fixture) => {
      const recipe = w1Recipe(fixture);
      const perfect = computeScoringV2(recipe, referenceExact(fixture, recipe, "w1")).totalScore as number;
      const displaced = computeScoringV2(recipe, shifted(referenceExact(fixture, recipe, "w1"), 12)).totalScore as number;
      const empty = computeScoringV2(recipe, createEmptyPizza()).totalScore as number;
      expect(perfect).toBeGreaterThan(displaced);
      expect(displaced).toBeGreaterThan(empty);
    },
  );
});
