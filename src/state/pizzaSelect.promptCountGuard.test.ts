import { describe, expect, it } from "vitest";
import { buildPizzaSelectView } from "./pizzaSelect";
import { selectHintTarget } from "../logic/discovery/hintTarget";
import type { Recipe, RecipeId } from "../data/recipes";
import {
  poolOf,
  SYNTHETIC_BRANCH_B,
  W1_ORDER,
  W1_RECIPES,
  branchPoint,
  walkState,
} from "../logic/testSupport/branchingFixture";

/**
 * Candidate-count hardening: `PizzaSelectView.prompt` carries `kind` only. The number of
 * DISCOVERABLE (or shop-known) recipes is decided as a `> 0` fact inside the producer and never
 * stored on the view model, so no screen can ever render it.
 */

const { step: STEP } = branchPoint(SYNTHETIC_BRANCH_B);
const BASE = W1_ORDER.slice(0, STEP);
const BASE_RECIPES = W1_RECIPES.filter((r) => BASE.includes(r.id));

/** `size` interchangeable DISCOVERABLE candidates on top of the already-discovered BASE recipes. */
function populationWithPool(size: number): readonly Recipe[] {
  const clones = Array.from({ length: size }, (_, i): Recipe => ({
    ...SYNTHETIC_BRANCH_B,
    id: `synthetic-pool-${i}` as RecipeId,
  }));
  return [...BASE_RECIPES, ...clones];
}

describe("PizzaSelectView.prompt carries no candidate count", () => {
  it("DISCOVERABLE prompt is exactly { kind } for pool size 1..5", () => {
    for (let size = 1; size <= 5; size += 1) {
      const recipes = populationWithPool(size);
      const state = walkState(BASE, recipes);
      expect(poolOf(state, recipes), `pool ${size}`).toHaveLength(size);
      const { prompt } = buildPizzaSelectView(state, recipes);
      expect(prompt, `pool ${size}`).toEqual({ kind: "DISCOVERABLE" });
      expect(Object.keys(prompt ?? {}), `pool ${size}`).toEqual(["kind"]);
    }
  });

  it("the prompt is identical for pool 2..5 and the view model serialises no pool number", () => {
    const views = [2, 3, 4, 5].map((size) => {
      const recipes = populationWithPool(size);
      return buildPizzaSelectView(walkState(BASE, recipes), recipes);
    });
    for (const v of views) expect(v.prompt).toEqual(views[0].prompt);
    for (const v of views) expect(JSON.stringify(v.prompt)).not.toMatch(/\d/);
  });

  it("SHOP prompt is exactly { kind } however many shop-known recipes there are", () => {
    for (let size = 1; size <= 5; size += 1) {
      const recipes = populationWithPool(size);
      const state = walkState(BASE, recipes);
      // Entitled but out of stock -> KNOWN_BUT_MISSING_MATERIAL, not DISCOVERABLE.
      const empty = { ...state, ownedIngredientIds: [], inventory: {} };
      const { prompt } = buildPizzaSelectView(empty, recipes);
      expect(prompt, `size ${size}`).toEqual({ kind: "SHOP" });
      expect(Object.keys(prompt ?? {}), `size ${size}`).toEqual(["kind"]);
    }
  });

  it("OPEN_POOL contract does not vary with pool size 2..5", () => {
    for (let size = 2; size <= 5; size += 1) {
      const recipes = populationWithPool(size);
      const state = walkState(BASE, recipes);
      expect(selectHintTarget(state, { recipes }), `pool ${size}`).toEqual({ kind: "OPEN_POOL" });
    }
  });
});
