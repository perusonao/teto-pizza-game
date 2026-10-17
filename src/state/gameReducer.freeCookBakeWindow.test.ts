import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX } from "./dex";
import { RECIPES, type RecipeId } from "../data/recipes";
import { FREE_COOK_BAKE_TARGET } from "../data/freeCook";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { requiredSauceIds } from "../logic/testSupport/requiredSauces";
import { classifyBake } from "../logic/bake";
import { bakeCompletionFailure } from "../logic/completionGate";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { computeScoringV2 } from "../logic/scoringV2";
import { starsFromTotal } from "../logic/scoring";

/**
 * Issue #482 (OD-B1 / OD-B6 F1): Free Cooking judges "is it a dish" -- the Completion Gate, the CUT skip and the
 * 3-level result badge -- by the one window its gauge shows (`FREE_COOK_BAKE_TARGET`, 58-78), never by the matched
 * recipe's own window. The recipe's window only enters Scoring 2.0's Bake component. 生焼け / 焦げ is always FAILED.
 */
const OWNED = [...STARTER_INGREDIENT_IDS, "egg", "bacon", "mushroom", "onion"];
const { start: G_START, end: G_END } = FREE_COOK_BAKE_TARGET;

function idealPizzaFor(recipeId: RecipeId, bakeResult: number): PizzaState {
  const reference = getReferencePizza(recipeId)!;
  return {
    ...createEmptyPizza(),
    sauceIds: requiredSauceIds(recipeId),
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((p, i) => ({ id: `${recipeId}-${gi}-${i}`, ingredientId: group.ingredientId, ...p })),
    ),
    bakeResult,
  };
}

/** A fresh Free Cooking round baked with exactly the reference pizza of `recipeId` at `bake` (stops at CONFIRM_BAKE). */
function confirmBake(recipeId: RecipeId, bake: number): GameState {
  let state = gameReducer(createInitialGameState(EMPTY_DEX, OWNED, 0, {}, []), { type: "START_FREE_COOK" });
  state = { ...state, pizza: idealPizzaFor(recipeId, bake) };
  state = gameReducer(state, { type: "START_BAKE" });
  return gameReducer(state, { type: "CONFIRM_BAKE", value: bake });
}

describe("#482 F1: Free Cooking judges by the generic window, for every recipe", () => {
  it("the generic window is 58-78 (the median of the shipped windows)", () => {
    expect([G_START, G_END]).toEqual([58, 78]);
  });

  it("FAILED <=> outside the generic window; the badge is classifyBake of the SAME window; CUT is skipped on FAILED", () => {
    for (const recipe of RECIPES) {
      for (const bake of [0, 40, 50, 57.99, 58, 62, 68, 78, 78.01, 85, 100]) {
        const after = confirmBake(recipe.id, bake);
        const outside = bake < G_START || bake > G_END;
        const label = `${recipe.id}@${bake}`;
        expect(after.completion?.status, label).toBe(outside ? "FAILED" : "PASS");
        expect(after.bakeState, label).toBe(classifyBake(bake, FREE_COOK_BAKE_TARGET));
        if (outside) {
          expect(bakeCompletionFailure(after.completion), label).toBe(bake < G_START ? "UNDERBAKED" : "OVERBAKED");
          expect(after.phase, label).toBe("RESULT"); // no CUT
          expect(after.cutState.lines, label).toHaveLength(0);
        } else {
          // Never a servable pizza with a 生焼け / 焦げ badge.
          expect(after.bakeState, label).toBe("perfect");
          expect(after.recipe.id, label).toBe(recipe.id); // MATCHED: scored as the recipe it is
        }
      }
    }
  });
});

describe("#482 F1: the matched recipe's own window is Scoring 2.0's only", () => {
  const recipe = RECIPES.find((r) => r.bakeTarget.start === 50 && r.bakeTarget.end === 70)!;

  it("a recipe-window bake below the generic window (52 for 50-70) is FAILED: 生焼け, no CUT, no credit", () => {
    const after = confirmBake(recipe.id, 52);
    expect(after.completion).toMatchObject({ status: "FAILED", reason: "UNDERBAKED" });
    expect(after.bakeState).toBe("raw");
    expect(after.phase).toBe("RESULT");
    const registered = gameReducer(after, { type: "REGISTER_TO_DEX" });
    expect(registered.lastPitzCredit).toBeNull();
    expect(registered.pitzBalance).toBe(0);
    expect(registered.dex).toEqual(EMPTY_DEX);
  });

  it("a bake past the recipe's window but inside the generic one (75 for 50-70) is MATCHED and servable, with the badge of the generic window", () => {
    const after = confirmBake(recipe.id, 75);
    expect(after.completion?.status).toBe("PASS");
    expect(after.recipe.id).toBe(recipe.id);
    expect(after.bakeState).toBe("perfect");
    // No ★ cap from a recipe-window "burnt": the stars are exactly the total's.
    expect(after.score?.stars).toBe(starsFromTotal(after.score!.total));
    // Scoring 2.0 still reads the recipe's own window: 75 is 5 points past it.
    const bake = computeScoringV2(recipe, after.pizza).components.bake;
    expect(bake.available && bake.distanceFromIdeal).toBe(5);
    expect(bake.available && bake.score).toBeLessThan(100);
  });
});
