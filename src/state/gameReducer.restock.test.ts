import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX } from "./dex";
import { getRecipe } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import type { InventoryState } from "./inventory";

/**
 * Economy & Progression 1.0 EP3: Shop 2.0 restock + the placement-time Stock Gate.
 *
 * Mirrors `gameReducer.inventoryConsumption.test.ts`'s (EP2) own direct-injection pattern:
 * `fugazza`/`onion` is the only shipped recipe/ingredient pair where the ingredient is finite
 * (has `unlockCondition`), so it is reused here too. Tests that need a PREPARE-phase round at
 * the TOPPING step construct it directly (bypassing the full DOUGH/SAUCE/CHEESE UI flow) since
 * PLACE_TOPPING's own guards only ever read `phase`/`makingStep`/`ownedIngredientIds`/
 * `inventory`/`pizza` -- never `dex`/recipe-unlock state -- exactly the same legitimate,
 * deliberate bypass EP2's own test file documents.
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

/** A fugazza round sitting at PREPARE/TOPPING, ready for PLACE_TOPPING/RESTOCK_INGREDIENT. */
function preparingFugazzaAtTopping(
  ownedIngredientIds: readonly string[],
  inventory: InventoryState,
  pitzBalance = 0,
): GameState {
  const recipe = getRecipe("fugazza");
  const order = findOrderForRecipe("fugazza");
  if (!recipe || !order) throw new Error("Missing fugazza recipe/order fixture");
  const state = createInitialGameState(EMPTY_DEX, ownedIngredientIds, pitzBalance, inventory);
  return { ...state, recipe, order, phase: "PREPARE", makingStep: "TOPPING" };
}

/** A fugazza round sitting at "BAKE", ready for CONFIRM_BAKE -- same shape as EP2's own
 *  `stateAtFugazzaBake` helper. */
function stateAtFugazzaBake(
  pizza: PizzaState,
  inventory: InventoryState,
  isMissionRound = false,
): GameState {
  const recipe = getRecipe("fugazza");
  const order = findOrderForRecipe("fugazza");
  if (!recipe || !order) throw new Error("Missing fugazza recipe/order fixture");
  let state = createInitialGameState(EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "onion"], 0, inventory);
  state = { ...state, recipe, order, pizza, isMissionRound };
  return gameReducer(state, { type: "START_BAKE" });
}

const OWNED_WITH_ONION = [...STARTER_INGREDIENT_IDS, "onion"];

describe("RESTOCK_INGREDIENT (Economy & Progression 1.0 EP3)", () => {
  it("restocks onion: inventory increases by exactly its restockQuantity (12), pitzBalance decreases by exactly its pricePitz (120)", () => {
    const state = createInitialGameState(EMPTY_DEX, OWNED_WITH_ONION, 200, { onion: 3 });
    const after = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(after.inventory).toEqual({ onion: 15 }); // 3 + 12
    expect(after.pitzBalance).toBe(80); // 200 - 120
  });

  it("rejects atomically when Pitz is insufficient -- neither pitzBalance nor inventory changes", () => {
    const state = createInitialGameState(EMPTY_DEX, OWNED_WITH_ONION, 100, { onion: 3 });
    const after = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(after).toBe(state);
    expect(after.pitzBalance).toBe(100);
    expect(after.inventory).toEqual({ onion: 3 });
  });

  it("rejects restocking an ingredient that isn't owned yet -- complete no-op", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 999, {});
    const after = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(after).toBe(state);
  });

  it("rejects restocking an unlimited (Starter) ingredient -- complete no-op", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 999, {});
    const after = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "mozzarella" });
    expect(after).toBe(state);
  });

  it("restocking an unknown ingredient id is a no-op and never throws", () => {
    const state = createInitialGameState(EMPTY_DEX, OWNED_WITH_ONION, 999, { onion: 0 });
    expect(() =>
      gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "not-a-real-ingredient" }),
    ).not.toThrow();
    const after = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "not-a-real-ingredient" });
    expect(after).toBe(state);
  });

  it("is repeatable (unlike PURCHASE_INGREDIENT): two sequential dispatches both apply, no double-charge from either alone", () => {
    let state = createInitialGameState(EMPTY_DEX, OWNED_WITH_ONION, 500, { onion: 0 });
    state = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(state.inventory).toEqual({ onion: 12 });
    expect(state.pitzBalance).toBe(380);
    state = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(state.inventory).toEqual({ onion: 24 });
    expect(state.pitzBalance).toBe(260);
  });

  it("ownedIngredientIds is never touched by a restock -- restock is inventory/Pitz only", () => {
    const state = createInitialGameState(EMPTY_DEX, OWNED_WITH_ONION, 200, { onion: 0 });
    const after = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(after.ownedIngredientIds).toEqual(state.ownedIngredientIds);
  });

  it("survives RETRY_SAME_RECIPE: restocked inventory carries into the retried round", () => {
    let state = createInitialGameState(EMPTY_DEX, OWNED_WITH_ONION, 200, { onion: 0 });
    state = { ...state, recipe: getRecipe("fugazza")!, order: findOrderForRecipe("fugazza")! };
    state = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(state.inventory).toEqual({ onion: 12 });
    const retried = gameReducer(state, { type: "RETRY_SAME_RECIPE" });
    expect(retried.inventory).toEqual({ onion: 12 });
    expect(retried.pitzBalance).toBe(80);
  });

  it("survives PLAY_AGAIN: restocked inventory carries into the next round", () => {
    let state = createInitialGameState(EMPTY_DEX, OWNED_WITH_ONION, 200, { onion: 0 });
    state = gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(state.inventory).toEqual({ onion: 12 });
    const again = gameReducer(state, { type: "PLAY_AGAIN" });
    expect(again.inventory).toEqual({ onion: 12 });
    expect(again.pitzBalance).toBe(80);
  });

  it("restock works identically for a Lunch Rush (Mission) round as for FREE -- the Shop transaction is not mode-gated", () => {
    const free = createInitialGameState(EMPTY_DEX, OWNED_WITH_ONION, 200, { onion: 0 });
    const mission = { ...free, isMissionRound: true };
    const freeAfter = gameReducer(free, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    const missionAfter = gameReducer(mission, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(freeAfter.inventory).toEqual({ onion: 12 });
    expect(missionAfter.inventory).toEqual({ onion: 12 });
    expect(missionAfter.isMissionRound).toBe(true);
  });
});

describe("PLACE_TOPPING Stock Gate (Economy & Progression 1.0 EP3)", () => {
  it("rejects placing a finite ingredient with 0 remaining stock -- pizza is unchanged, placement marked rejected", () => {
    const state = preparingFugazzaAtTopping(OWNED_WITH_ONION, { onion: 0 });
    const after = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(after.pizza.toppings).toHaveLength(0);
    expect(after.placement?.status).toBe("rejected");
  });

  it("never decrements inventory itself -- a rejected or accepted placement leaves state.inventory untouched (PREPARE never consumes)", () => {
    const state = preparingFugazzaAtTopping(OWNED_WITH_ONION, { onion: 2 });
    const after = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(after.inventory).toEqual({ onion: 2 });
  });

  it("placed count can never exceed stock: the (stock+1)th placement of the same finite ingredient is rejected", () => {
    // Every tap targets the dough center (50,50) -- findOpenSpot (../state/pizzaState.ts) auto-
    // spaces same-point taps into nearby open spots via its own ring search, so this exercises
    // real placement spacing, not just direct-injected coordinates.
    let state = preparingFugazzaAtTopping(OWNED_WITH_ONION, { onion: 2 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(state.pizza.toppings).toHaveLength(2);
    expect(state.placement?.status).not.toBe("rejected");
    // A 3rd onion against a stock of exactly 2 must be rejected -- placed count must never
    // exceed stock, scatter-consistency requirement.
    const after = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(after.pizza.toppings).toHaveLength(2);
    expect(after.placement?.status).toBe("rejected");
  });

  it("an unlimited (Starter) ingredient's placement is completely unaffected by the Stock Gate -- no regression", () => {
    let state = preparingFugazzaAtTopping(OWNED_WITH_ONION, {});
    state = { ...state, makingStep: "CHEESE" };
    // mozzarella (Starter, unconditionally unlimited) placed many times over -- never gated,
    // regardless of having no tracked inventory entry at all.
    for (let i = 0; i < 8; i++) {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 50 });
    }
    const placedCount = state.pizza.toppings.filter((t) => t.ingredientId === "mozzarella").length;
    expect(placedCount).toBe(8);
    expect(state.placement?.status).not.toBe("rejected");
  });

  it("a finite ingredient with stock remaining can still be placed normally, up to its stock", () => {
    const state = preparingFugazzaAtTopping(OWNED_WITH_ONION, { onion: 4 });
    const after = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(after.pizza.toppings).toHaveLength(1);
    expect(after.placement?.status).not.toBe("rejected");
  });
});

describe("EP2 -> EP3 integration: consume -> low/out of stock -> Shop restock -> consume again", () => {
  it("the full product-goal loop: play (consume onion to 0) -> Shop restock -> play again (consume from restocked stock)", () => {
    // Round 1: 4 onion placed against a stock of exactly 4 -- consumed to 0 at CONFIRM_BAKE
    // (this is EP2's own already-documented onion/EP3-dependency scenario).
    let state = stateAtFugazzaBake(pizzaWithOnions(4), { onion: 4 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    // EP4: `olive-oil` (this fixture's own sauce, `pizzaWithOnions`) is now also finite, so
    // CONFIRM_BAKE's consumption tracks it too -- clamped to 0 same as `onion`, since neither
    // fixture pre-seeds any olive-oil stock.
    expect(state.inventory).toEqual({ onion: 0, "olive-oil": 0 });

    // Out of stock: a fresh PREPARE round can no longer place any onion (Stock Gate).
    let nextRound = gameReducer(state, { type: "PLAY_AGAIN" });
    nextRound = { ...nextRound, recipe: getRecipe("fugazza")!, phase: "PREPARE", makingStep: "TOPPING" };
    const blockedPlacement = gameReducer(nextRound, {
      type: "PLACE_TOPPING",
      ingredientId: "onion",
      x: 50,
      y: 50,
    });
    expect(blockedPlacement.pizza.toppings).toHaveLength(0);
    expect(blockedPlacement.placement?.status).toBe("rejected");

    // Shop: restock onion (needs Pitz -- grant some via CLAIM_MISSION_REWARD, mirroring how a
    // player actually earns Pitz between rounds).
    let restocked = gameReducer(nextRound, {
      type: "CLAIM_MISSION_REWARD",
      runId: 1,
      amount: 200,
    });
    restocked = gameReducer(restocked, { type: "RESTOCK_INGREDIENT", ingredientId: "onion" });
    expect(restocked.inventory).toEqual({ onion: 12, "olive-oil": 0 });

    // Play again: onion is now placeable, and a fresh bake consumes from the restocked stock.
    const placed = gameReducer(restocked, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(placed.pizza.toppings).toHaveLength(1);
    expect(placed.placement?.status).not.toBe("rejected");

    const baking = { ...placed, phase: "BAKE" as const, pizza: pizzaWithOnions(4) };
    const finalState = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
    expect(finalState.inventory).toEqual({ onion: 8, "olive-oil": 0 }); // 12 - 4
  });
});
