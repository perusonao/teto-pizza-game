import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX } from "./dex";
import { discoveredRecipeIds } from "./dex";
import { getRecipe, type RecipeId } from "../data/recipes";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getReferencePizza } from "../data/referencePizza";
import { idealSauceDepositsFor, requiredSauceIds } from "../logic/testSupport/requiredSauces";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Square Dough E-2 (#521), E-AC2 / E-AC3 end to end through the real Free Cooking reducer: the exact grandma-pizza ingredients are a
 * NEW DISCOVERY only when the round is cooked on the tray (pan "tray"), and an ORIGINAL -- no Dex entry, no new recipe -- when cooked round.
 */
const ID = "grandma-pizza" as RecipeId;
const OWNED = [...STARTER_INGREDIENT_IDS, "olive-oil", "garlic"];
const BAKE = 66; // inside both the recipe's 56-76 window and the generic Free Cooking window

function referencePizza(pan: "tray" | null): PizzaState {
  const reference = getReferencePizza(ID)!;
  return {
    ...createEmptyPizza(),
    ...(pan ? { pan } : {}),
    sauceIds: requiredSauceIds(ID),
    sauceDeposits: idealSauceDepositsFor(ID).map((d) => ({ ...d, ingredientId: "tomato-sauce" })),
    toppings: reference.pieceGroups.flatMap((g, gi) => g.positions.map((p, i) => ({ id: `${gi}-${i}`, ingredientId: g.ingredientId, ...p }))),
    bakeResult: BAKE,
  };
}

function cook(pizza: PizzaState): GameState {
  let state = gameReducer(createInitialGameState(EMPTY_DEX, OWNED, 0, {}, []), { type: "START_FREE_COOK" });
  state = { ...state, pizza };
  state = gameReducer(state, { type: "START_BAKE" });
  const result = walkPostBakeToResult(gameReducer(state, { type: "CONFIRM_BAKE", value: BAKE }));
  return gameReducer(result, { type: "REGISTER_TO_DEX" });
}

describe("grandma-pizza through Free Cooking", () => {
  it("E-AC3: on the tray, its exact ingredients are a NEW DISCOVERY, scored as grandma-pizza, in the Dex", () => {
    const after = cook(referencePizza("tray"));
    expect(after.completion?.status).toBe("PASS");
    expect(after.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
    expect(discoveredRecipeIds(after.dex)).toEqual([ID]);
    expect(after.recipe.id).toBe(ID);
    expect(getRecipe(ID)).toBeDefined();
  });

  it("E-AC2: cooked round, the same ingredients are an ORIGINAL -- nothing is discovered and the Dex stays empty", () => {
    const after = cook(referencePizza(null));
    expect(after.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(discoveredRecipeIds(after.dex)).toEqual([]);
    expect(after.recipe.id).not.toBe(ID);
  });
});
