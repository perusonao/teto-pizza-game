import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, getDexEntry } from "./dex";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { INGREDIENTS, getIngredient } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { calculatePitzReward } from "../logic/pitzReward";
import { LUNCH_RUSH_RULESET_VERSION } from "../shared/lunchRushScoring";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Issue #215 (Completion Gate partial-quantity), Owner Decision OD-1 G1 / OD-2 Q 0.5 / OD-3 0.15
 * / OD-4 LR-A / OD-4b 0.15 / OD-5 D-A, end to end through the real reducer: CONFIRM_BAKE's
 * Completion Gate policy + Scoring 2.0's quantity factor, then REGISTER_TO_DEX's Dex/Pitz.
 */

const ALL_INGREDIENT_IDS = INGREDIENTS.map((i) => i.id);

function midBake(recipeId: RecipeId): number {
  const { start, end } = getRecipe(recipeId)!.bakeTarget;
  return Math.round((start + end) / 2);
}

/** The Reference pizza with `ingredientId` placed `count` times (Reference positions first,
 *  then extra pieces inside the dough for an excess). */
function pizzaWithCount(recipeId: RecipeId, ingredientId: string, count: number): PizzaState {
  const reference = getReferencePizza(recipeId)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) => {
      const positions =
        group.ingredientId === ingredientId
          ? Array.from({ length: count }, (_, i) => group.positions[i] ?? { x: 30 + i * 5, y: 70 })
          : group.positions;
      return positions.map((p, i) => ({ id: `${recipeId}-${gi}-${i}`, ingredientId: group.ingredientId, ...p }));
    }),
    bakeResult: midBake(recipeId),
  };
}

function playToResult(recipeId: RecipeId, pizza: PizzaState, isMissionRound = false): GameState {
  const recipe = getRecipe(recipeId)!;
  const order = findOrderForRecipe(recipeId)!;
  const cookingProfile = getCookingProfile(recipeId);
  let state = createInitialGameState(EMPTY_DEX, ALL_INGREDIENT_IDS, 0, {}, []);
  state = {
    ...state,
    recipe,
    order,
    pizza,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
    isMissionRound,
    // Discovery 2.0: an injected guided round (a Dex-0 initial state is a Free Cooking round now).
    freeCook: false,
  };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult! });
  return walkPostBakeToResult(state);
}

const round1 = (x: number) => Math.round(x * 10) / 10;

describe("Issue #215 recipe mode: funghi, mushroom ideal 3 (Fresh Audit HR-1..HR-5 values)", () => {
  // Production Scoring 2.0 totals (unrounded; stars/Pitz read these directly). Matches the
  // Fresh Audit's `idealThreeReplayRows` to one decimal: 99.5 / 82.5 / 65.6 / FAILED / 92.7 / 86.0.
  it.each([
    [3, "PASS", 99.5, 5, 120],
    [2, "PASS", 82.5, 4, 100],
    [1, "PASS", 65.6, 3, 80],
    [4, "PASS", 92.7, 5, 120],
    [5, "PASS", 86.0, 4, 100],
    [6, "PASS", 79.5, 4, 100],
  ] as const)("%i mushroom -> %s, total %f, ★%i, %i Pitz", (count, status, total, stars, pitz) => {
    const result = playToResult("funghi", pizzaWithCount("funghi", "mushroom", count));
    expect(result.completion?.status).toBe(status);
    expect(round1(result.score!.total)).toBe(total);
    expect(result.score!.stars).toBe(stars);
    expect(calculatePitzReward(getRecipe("funghi")!.baseRewardPitz, result.score!.total).earnedPitz).toBe(pitz);
  });

  it("0 mushroom -> FAILED MISSING_REQUIRED_INGREDIENT; nothing registers (G1 boundary)", () => {
    const result = playToResult("funghi", pizzaWithCount("funghi", "mushroom", 0));
    expect(result.completion).toMatchObject({
      status: "FAILED",
      reason: "MISSING_REQUIRED_INGREDIENT",
      ingredientId: "mushroom",
    });
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after).toBe(result);
  });

  it("2 mushroom registers to the Dex with the quantity-reduced ★4 BEST and pays 100 Pitz", () => {
    const result = playToResult("funghi", pizzaWithCount("funghi", "mushroom", 2));
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(getDexEntry(after.dex, "funghi")).toMatchObject({ discovered: true, bestStars: 4 });
    expect(after.lastPitzCredit?.earnedPitz).toBe(100);
  });

  it("the ideal pizza's total is unchanged by the quantity factor (factor exactly 1)", () => {
    const result = playToResult("funghi", pizzaWithCount("funghi", "mushroom", 3));
    expect(result.scoringV2Result?.components.quantity).toMatchObject({ available: true, factor: 1 });
  });
});

describe("Issue #215 G1 across every shipped recipe", () => {
  for (const recipe of RECIPES) {
    const reference = getReferencePizza(recipe.id);
    if (!reference) continue;
    for (const group of reference.pieceGroups) {
      it(`${recipe.id} / ${group.ingredientId}: 1 piece PASSes the recipe policy, 0 is MISSING, < ideal fails the order policy`, () => {
        const one = pizzaWithCount(recipe.id, group.ingredientId, 1);
        expect(evaluatePizzaCompletion(recipe, one).status).toBe("PASS");
        expect(evaluatePizzaCompletion(recipe, pizzaWithCount(recipe.id, group.ingredientId, 0))).toMatchObject({
          status: "FAILED",
          reason: "MISSING_REQUIRED_INGREDIENT",
        });
        const req = recipe.requiredIngredients.find((r) => r.ingredientId === group.ingredientId)!;
        const exact = pizzaWithCount(recipe.id, group.ingredientId, req.minCount);
        expect(evaluatePizzaCompletion(recipe, exact, "order").status).toBe("PASS");
        if (req.minCount > 1) {
          const short = pizzaWithCount(recipe.id, group.ingredientId, req.minCount - 1);
          expect(evaluatePizzaCompletion(recipe, short, "order")).toMatchObject({
            status: "FAILED",
            reason: "INSUFFICIENT_REQUIRED_AMOUNT",
            ingredientId: group.ingredientId,
          });
        }
      });
    }
  }

  it("every scatter minCount still equals its Reference quantity (DS-A: minCount stays the ideal)", () => {
    for (const recipe of RECIPES) {
      const reference = getReferencePizza(recipe.id);
      if (!reference) continue;
      for (const req of recipe.requiredIngredients) {
        if (getIngredient(req.ingredientId)?.placement !== "scatter") continue;
        const group = reference.pieceGroups.find((g) => g.ingredientId === req.ingredientId);
        expect(group?.positions.length, `${recipe.id}/${req.ingredientId}`).toBe(req.minCount);
      }
    }
  });
});

describe("Issue #215 Lunch Rush (OD-4 LR-A + OD-4b)", () => {
  it("under the ordered quantity -> FAILED INSUFFICIENT_REQUIRED_AMOUNT (the order policy)", () => {
    const result = playToResult("funghi", pizzaWithCount("funghi", "mushroom", 2), true);
    expect(result.completion).toMatchObject({
      status: "FAILED",
      reason: "INSUFFICIENT_REQUIRED_AMOUNT",
      ingredientId: "mushroom",
    });
  });

  it("0 of an ordered ingredient is still MISSING_REQUIRED_INGREDIENT", () => {
    const result = playToResult("funghi", pizzaWithCount("funghi", "mushroom", 0), true);
    expect(result.completion).toMatchObject({ status: "FAILED", reason: "MISSING_REQUIRED_INGREDIENT" });
  });

  it("exactly the ordered quantity -> PASS with the unchanged ideal quality", () => {
    const mission = playToResult("funghi", pizzaWithCount("funghi", "mushroom", 3), true);
    const free = playToResult("funghi", pizzaWithCount("funghi", "mushroom", 3), false);
    expect(mission.completion?.status).toBe("PASS");
    expect(mission.score!.total).toBe(free.score!.total);
    expect(round1(mission.score!.total)).toBe(99.5);
  });

  it("over the ordered quantity -> PASS, quality reduced by the 0.15 excess penalty", () => {
    const exact = playToResult("funghi", pizzaWithCount("funghi", "mushroom", 3), true);
    const over = playToResult("funghi", pizzaWithCount("funghi", "mushroom", 4), true);
    expect(over.completion?.status).toBe("PASS");
    expect(over.scoringV2Result?.components.quantity).toMatchObject({
      available: true,
      shortage: null,
      excess: { ingredientId: "mushroom", playerCount: 4, targetCount: 3 },
    });
    expect(over.scoringV2Result?.components.quantity.available && over.scoringV2Result.components.quantity.factor).toBeCloseTo(0.95, 12);
    expect(round1(over.score!.total)).toBe(92.7);
    expect(over.score!.total).toBeLessThan(exact.score!.total);
  });

  it("keeps the Lunch Rush ranking ruleset (LR-A needs no ranking change)", () => {
    expect(LUNCH_RUSH_RULESET_VERSION).toBe("lunch-rush-v1");
  });
});
