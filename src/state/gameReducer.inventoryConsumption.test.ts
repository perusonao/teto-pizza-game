import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX } from "./dex";
import { getRecipe } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import type { InventoryState } from "./inventory";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Economy & Progression 1.0 EP2: Inventory atomic consumption at CONFIRM_BAKE.
 *
 * `fugazza`/`onion` is used throughout (recipe minCount 4, src/data/recipes.ts) since it is the
 * only recipe/ingredient pair in shipped data where the ingredient is finite (has
 * `unlockCondition`) -- every other recipe uses only Starter (permanently unlimited)
 * ingredients, so it can never exercise the consumption path at all (see the dedicated
 * "all-Starter pizza" test below, which asserts exactly that).
 *
 * These tests directly swap in `recipe`/`order`/`pizza`/`inventory` before `START_BAKE`, the
 * same established pattern `gameReducer.scoringV2Authority.test.ts` already uses to drive
 * CONFIRM_BAKE from an exact canonical pizza without replaying the whole PREPARE/placement/
 * ownership UI flow -- CONFIRM_BAKE's own logic (scoring and, as of EP2, inventory consumption)
 * only ever reads `state.recipe`/`state.pizza`/`state.inventory`, never `makingStep` or
 * `ownedIngredientIds`, so this is a legitimate, deliberate bypass of the orthogonal
 * placement/ownership/progression axes, not a shortcut around what this suite actually tests.
 */

function pizzaWithOnions(count: number, overrides: Partial<PizzaState> = {}): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ["olive-oil"],
    toppings: Array.from({ length: count }, (_, i) => ({
      id: `onion-${i}`,
      ingredientId: "onion",
      x: i,
      y: i,
    })),
    ...overrides,
  };
}

/** Builds a fugazza round sitting at "BAKE", ready for CONFIRM_BAKE, with `pizza`/`inventory`
 *  injected directly and `isMissionRound` set explicitly (FREE by default). */
function stateAtFugazzaBake(
  pizza: PizzaState,
  inventory: InventoryState,
  isMissionRound = false,
): GameState {
  const recipe = getRecipe("fugazza");
  const order = findOrderForRecipe("fugazza");
  if (!recipe || !order) throw new Error("Missing fugazza recipe/order fixture");
  let state = createInitialGameState(EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "onion"], 0, inventory);
  // Pizza Cutting 1.0 Phase 2: `createInitialGameState` always seeds margherita's own
  // CUT-enabled profile (../data/orders.ts's `preferFirst`) -- re-resolve `cookingProfile`/
  // `cutState` for fugazza (whose profile is the unmodified DEFAULT_COOKING_PROFILE), same fix
  // as gameReducer.completionGate.test.ts's own `playToResultForRecipe`.
  const cookingProfile = getCookingProfile(recipe.id);
  state = {
    ...state,
    recipe,
    order,
    pizza,
    isMissionRound,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
  };
  return gameReducer(state, { type: "START_BAKE" });
}

describe("Economy & Progression 1.0 EP2: CONFIRM_BAKE inventory consumption", () => {
  it("consumes exactly the placed piece count on the first CONFIRM_BAKE, not the recipe's minCount", () => {
    const baking = stateAtFugazzaBake(pizzaWithOnions(5), { onion: 20 });
    const confirmed = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
    // Pizza Cutting 1.0 Phase 4B: fugazza is now CUT-eligible, so CONFIRM_BAKE lands on
    // POST_BAKE/CUT rather than RESULT directly -- inventory consumption itself happens at
    // CONFIRM_BAKE (unconditional, unaffected by CUT, see ../data/cookingProfiles.ts), so it is
    // already correct on `confirmed` before CUT is even walked; `walkPostBakeToResult` confirms
    // it stays unperturbed all the way to RESULT too.
    expect(confirmed.inventory.onion).toBe(15);
    const result = walkPostBakeToResult(confirmed);
    expect(result.phase).toBe("RESULT");
    expect(result.inventory.onion).toBe(15);
  });

  it("a second CONFIRM_BAKE dispatched against the resulting RESULT state is a no-op -- exactly-once, no double consumption", () => {
    const baking = stateAtFugazzaBake(pizzaWithOnions(5), { onion: 20 });
    const afterFirst = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
    expect(afterFirst.inventory.onion).toBe(15);

    const afterSecond = gameReducer(afterFirst, { type: "CONFIRM_BAKE", value: 70 });
    // The `phase !== "BAKE"` guard returns the exact same state reference unchanged.
    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.inventory.onion).toBe(15);
  });

  it("a CONFIRM_BAKE dispatched from any phase other than BAKE is a no-op", () => {
    const recipe = getRecipe("fugazza");
    const order = findOrderForRecipe("fugazza");
    if (!recipe || !order) throw new Error("Missing fugazza recipe/order fixture");
    let state = createInitialGameState(EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "onion"], 0, {
      onion: 20,
    });
    state = { ...state, recipe, order, pizza: pizzaWithOnions(5), phase: "PREPARE" };

    const result = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    expect(result).toBe(state);
    expect(result.phase).toBe("PREPARE");
    expect(result.inventory.onion).toBe(20);
  });

  it("RETRY_SAME_RECIPE after a bake carries the already-consumed inventory forward unchanged", () => {
    const baking = stateAtFugazzaBake(pizzaWithOnions(5), { onion: 20 });
    const afterBake = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
    const discovered = gameReducer(afterBake, { type: "REGISTER_TO_DEX" });
    const retried = gameReducer(discovered, { type: "RETRY_SAME_RECIPE" });
    expect(retried.phase).toBe("PREPARE");
    expect(retried.inventory.onion).toBe(15);
  });

  it("PLAY_AGAIN after a bake carries the already-consumed inventory forward unchanged", () => {
    const baking = stateAtFugazzaBake(pizzaWithOnions(5), { onion: 20 });
    const afterBake = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
    const discovered = gameReducer(afterBake, { type: "REGISTER_TO_DEX" });
    const playedAgain = gameReducer(discovered, { type: "PLAY_AGAIN" });
    expect(playedAgain.inventory.onion).toBe(15);
  });

  it("FREE mode: CONFIRM_BAKE consumption applies normally", () => {
    const baking = stateAtFugazzaBake(pizzaWithOnions(3), { onion: 10 }, false);
    const result = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
    expect(result.isMissionRound).toBe(false);
    expect(result.inventory.onion).toBe(7);
  });

  it("Lunch Rush: CONFIRM_BAKE consumption applies identically to a Mission round (same shared reducer path as FREE)", () => {
    const baking = stateAtFugazzaBake(pizzaWithOnions(3), { onion: 10 }, true);
    const result = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
    expect(result.isMissionRound).toBe(true);
    expect(result.inventory.onion).toBe(7);
  });

  it("inventory shortage clamps to 0 at CONFIRM_BAKE time -- never goes negative", () => {
    const baking = stateAtFugazzaBake(pizzaWithOnions(5), { onion: 2 });
    const result = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
    expect(result.inventory.onion).toBe(0);
  });

  it("an all-Starter pizza (Margherita) never touches inventory, even across a full PREPARE walkthrough", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0, { onion: 3 });
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    const result = walkPostBakeToResult(state);
    expect(result.phase).toBe("RESULT");
    expect(result.inventory).toEqual({ onion: 3 });
  });
});
