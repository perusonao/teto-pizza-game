import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { EMPTY_DEX, type DexEntry, type DexState } from "./dex";
import { STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { availableRecipeIds, recipeUnlocked } from "./progression";
import { recipeCardState } from "./pizzaSelect";
import { pickMissionOrder } from "../mission/lunchRush";
import { discoveredRecipeIds } from "./dex";
import { buildMaterialUnlockNotice, resolveShopEntitlement } from "./materialEntitlement";
import type { InventoryState } from "./inventory";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Progression 2.0 W1 Integration I4b-3: the Discovery Ladder wired into the reducer (REC-04
 * OD-REC04-1..3; docs/reports/TETO_PROGRESS2_W1_I4B_Fresh-Audit.md §3 A-K). EP4 is retired: a
 * discovery unlocks the next ladder material for the Shop at stock 0, the first pack is bought
 * with Pitz, and Free Cooking then discovers the next recipe.
 */

const NOW = 1_000_000;

function dispatchAll(state: GameState, actions: readonly GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}

function piecesOf(recipeId: RecipeId, ingredientId: string) {
  const group = getReferencePizza(recipeId)!.pieceGroups.find((g) => g.ingredientId === ingredientId)!;
  return group.positions.map((p) => ({ id: ingredientId, ...p }));
}

/** Free-cooks the reference pizza of `recipeId` (tomato sauce + its reference pieces) and bakes it
 *  inside the recipe's own bake window, then walks to RESULT. */
function freeCook(state: GameState, recipeId: RecipeId): GameState {
  const recipe = getRecipe(recipeId)!;
  const reference = getReferencePizza(recipeId)!;
  let s = gameReducer(state, { type: "START_FREE_COOK", now: NOW });
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  s = gameReducer(s, {
    type: "COMMIT_SAUCE_DISPENSE",
    ingredientId: reference.sauce.ingredientId,
    deposits: buildIdealSauceFixture(),
  });
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  const cheeses = reference.pieceGroups.filter((g) => getIngredient(g.ingredientId)?.category === "cheese");
  for (const g of cheeses) {
    for (const p of piecesOf(recipeId, g.ingredientId)) {
      s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
    }
  }
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
  const toppings = reference.pieceGroups.filter((g) => getIngredient(g.ingredientId)?.category === "topping");
  for (const g of toppings) {
    for (const p of piecesOf(recipeId, g.ingredientId)) {
      s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
    }
  }
  const bake = Math.round((recipe.bakeTarget.start + recipe.bakeTarget.end) / 2);
  s = dispatchAll(s, [
    { type: "START_BAKE", now: NOW + 60_000 },
    { type: "CONFIRM_BAKE", value: bake },
  ]);
  return walkPostBakeToResult(s);
}

const register = (state: GameState) => gameReducer(state, { type: "REGISTER_TO_DEX" });
const buy = (state: GameState, ingredientId: string) =>
  gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId });
const refill = (state: GameState, ingredientId: string) =>
  gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId });

function discovered(...ids: string[]): DexState {
  return ids.map(
    (recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }),
  );
}

describe("the REC-04 loop: discovery -> NEW MATERIAL -> first pack -> Free Cooking -> next discovery", () => {
  it("new save: Margherita -> egg NEW (stock 0) -> buy egg (-60, +10) -> Free Cooking Bismarck -> bacon NEW", () => {
    let state = createInitialGameState();
    expect(state.unlockedForShopIngredientIds).toEqual([]);

    // 1. Free Cooking Margherita (starters only) -> first discovery.
    state = register(freeCook(state, "margherita"));
    expect(state.phase).toBe("DISCOVERED");
    expect(state.justDiscovered).toBe(true);
    expect(state.unlockedForShopIngredientIds).toEqual(["egg"]);
    expect(state.lastMaterialUnlockNotice).toEqual(buildMaterialUnlockNotice(["egg"]));
    expect(state.lastMaterialUnlockNotice?.messageJa).toContain("たまご");
    // Zero stock, not owned, nothing granted (OD-REC04-2).
    expect(state.ownedIngredientIds).toEqual(STARTER_INGREDIENT_IDS);
    expect(state.inventory.egg ?? 0).toBe(0);
    expect(state.starterGrantClaimedRecipeIds).toEqual([]);
    // Margherita pays at least floor 20 + first-discovery 50 -- enough for the T1 first pack.
    expect(state.pitzBalance).toBeGreaterThanOrEqual(60);
    const pitzBefore = state.pitzBalance;

    // 2. Shop: first pack of egg.
    state = buy(state, "egg");
    expect(state.ownedIngredientIds).toContain("egg");
    expect(state.inventory.egg).toBe(10);
    expect(state.pitzBalance).toBe(pitzBefore - 60);

    // 3. Free Cooking Bismarck with the bought egg -> second discovery.
    state = gameReducer(state, { type: "PLAY_AGAIN" });
    const cooked = freeCook(state, "bismarck");
    state = register(cooked);
    expect(discoveredRecipeIds(state.dex)).toEqual(["margherita", "bismarck"]);
    expect(state.inventory.egg).toBe(10 - getReferencePizza("bismarck")!.pieceGroups.find((g) => g.ingredientId === "egg")!.positions.length);

    // 4. The ladder advanced one step: bacon is NEW at stock 0.
    expect(state.unlockedForShopIngredientIds).toEqual(["egg", "bacon"]);
    expect(state.lastMaterialUnlockNotice?.ingredientIds).toEqual(["bacon"]);
    expect(state.inventory.bacon ?? 0).toBe(0);
    expect(state.ownedIngredientIds).not.toContain("bacon");
  });

  it("the notice resets on the next round and is never re-shown", () => {
    const state = register(freeCook(createInitialGameState(), "margherita"));
    expect(state.lastMaterialUnlockNotice).not.toBeNull();
    expect(gameReducer(state, { type: "PLAY_AGAIN" }).lastMaterialUnlockNotice).toBeNull();
    expect(gameReducer(state, { type: "RETRY_SAME_RECIPE" }).lastMaterialUnlockNotice).toBeNull();
    // A replay of an already-discovered recipe unlocks nothing new.
    const again = register(freeCook(gameReducer(state, { type: "PLAY_AGAIN" }), "margherita"));
    expect(again.justDiscovered).toBe(false);
    expect(again.lastMaterialUnlockNotice).toBeNull();
    expect(again.unlockedForShopIngredientIds).toEqual(["egg"]);
  });

  it("the entitlement survives every round transition and never shrinks", () => {
    let state = createInitialGameState(discovered("margherita", "bismarck", "funghi"), STARTER_INGREDIENT_IDS, 0, {}, [], [
      "egg",
      "bacon",
      "mushroom",
    ]);
    const entitled = state.unlockedForShopIngredientIds;
    for (const action of [
      { type: "PLAY_AGAIN" },
      { type: "RETRY_SAME_RECIPE" },
      { type: "MISSION_RESET_ORDER" },
      { type: "SELECT_RECIPE", recipeId: "margherita" },
      { type: "START_FREE_COOK", now: NOW },
    ] as const) {
      state = gameReducer(state, action);
      expect(state.unlockedForShopIngredientIds).toBe(entitled);
    }
  });
});

describe("PURCHASE_INGREDIENT (first pack) and RESTOCK_INGREDIENT (refill) through the reducer", () => {
  const NEW_EGG = () =>
    createInitialGameState(discovered("margherita"), STARTER_INGREDIENT_IDS, 100, {}, [], ["egg"]);

  it("insufficient Pitz: state is returned unchanged (same reference)", () => {
    const poor = { ...NEW_EGG(), pitzBalance: 59 };
    expect(buy(poor, "egg")).toBe(poor);
  });

  it("LOCKED (not unlocked by the ladder yet): unchanged", () => {
    const state = NEW_EGG();
    expect(buy(state, "bacon")).toBe(state);
  });

  it("starters are never for sale and never refilled", () => {
    const state = NEW_EGG();
    for (const id of STARTER_INGREDIENT_IDS) {
      expect(buy(state, id)).toBe(state);
      expect(refill(state, id)).toBe(state);
    }
  });

  it("no double purchase: the second dispatch is rejected (ALREADY_OWNED)", () => {
    const once = buy(NEW_EGG(), "egg");
    expect(once.pitzBalance).toBe(40);
    expect(buy(once, "egg")).toBe(once);
  });

  it("a NEW material cannot be refilled before its first pack", () => {
    const state = NEW_EGG();
    expect(refill(state, "egg")).toBe(state);
  });

  it("refill: -30 (T1) and +10 x k, repeatable until Pitz runs out", () => {
    let state = buy(NEW_EGG(), "egg"); // 100 - 60 = 40, egg 10
    state = refill(state, "egg");
    expect(state.pitzBalance).toBe(10);
    expect(state.inventory.egg).toBe(20);
    expect(refill(state, "egg")).toBe(state); // 10 < 30
  });

  it("an unknown ingredient id is a no-op", () => {
    const state = NEW_EGG();
    expect(buy(state, "not-an-ingredient")).toBe(state);
    expect(refill(state, "not-an-ingredient")).toBe(state);
  });

  it("stock never goes negative: consumption clamps at 0 and a pack adds on top of 0", () => {
    const state = createInitialGameState(
      discovered("margherita"),
      [...STARTER_INGREDIENT_IDS, "egg"],
      100,
      { egg: -3 } as InventoryState,
      [],
      ["egg"],
    );
    const refilled = refill(state, "egg");
    expect(refilled.inventory.egg).toBe(10);
  });
});

describe("A2: a discovered recipe is always unlocked; the EP1 chain only gates undiscovered ones", () => {
  // Bismarck's EP1 chain needs marinara discovered; the Discovery Ladder reaches it at step 1.
  const dex = discovered("margherita", "bismarck");
  const owned = [...STARTER_INGREDIENT_IDS, "egg"];

  it("recipeUnlocked is true for a discovered recipe whatever its chain says", () => {
    expect(recipeUnlocked(getRecipe("bismarck")!, dex)).toBe(true);
    for (const recipe of RECIPES) expect(recipeUnlocked(recipe, discovered(recipe.id))).toBe(true);
  });

  it("the chain still gates an undiscovered recipe exactly as before", () => {
    expect(recipeUnlocked(getRecipe("bismarck")!, discovered("margherita"))).toBe(false);
    expect(recipeUnlocked(getRecipe("funghi")!, EMPTY_DEX)).toBe(false);
    expect(recipeUnlocked(getRecipe("funghi")!, discovered("margherita"))).toBe(true);
    // ⭐ floor still applies to an undiscovered recipe (quattro-formaggi: genovese + ★8).
    expect(recipeUnlocked(getRecipe("quattro-formaggi")!, discovered("genovese"))).toBe(false);
  });

  it("Pizza Select shows a discovered, stocked recipe as COMPLETED (re-selectable), not LOCKED", () => {
    expect(recipeCardState(getRecipe("bismarck")!, dex, owned).kind).toBe("COMPLETED");
    const state = createInitialGameState(dex, owned, 0, { egg: 10 }, [], ["egg"]);
    const selected = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "bismarck" });
    expect(selected.phase).toBe("PREPARE");
    expect(selected.recipe.id).toBe("bismarck");
  });

  it("a discovered recipe whose material is not owned stays unavailable (materials still gate)", () => {
    expect(recipeCardState(getRecipe("bismarck")!, dex, STARTER_INGREDIENT_IDS).kind).toBe("LOCKED");
  });

  it("Lunch Rush's pool includes the discovered recipe", () => {
    const pool = availableRecipeIds(dex, owned);
    expect(pool).toContain("bismarck");
    const picks = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const order = pickMissionOrder(pool, ["margherita", "bismarck"], i % 2 === 0 ? "margherita" : "bismarck");
      if (order) picks.add(order.recipeId);
    }
    expect(picks).toEqual(new Set(["margherita", "bismarck"]));
  });

  it("a ★1 player discovering in ladder order never has a discovered-but-locked recipe", () => {
    const order = ["margherita", ...[
      "bismarck", "breakfast-pizza", "funghi", "pepperoni", "salsiccia", "meat-lovers", "capricciosa",
      "marinara", "napoletana", "fugazza", "pizza-bianca", "tonno-e-cipolla", "genovese", "quattro-formaggi",
    ]];
    for (let n = 1; n <= order.length; n += 1) {
      const d = discovered(...order.slice(0, n));
      for (const id of order.slice(0, n)) expect(recipeUnlocked(getRecipe(id as RecipeId)!, d)).toBe(true);
    }
  });
});

describe("existing-save migration (resolveShopEntitlement at load)", () => {
  it("an EP4 save keeps its owned materials and stock; ladder materials it lacks become NEW at 0", () => {
    // Dex 5 (EP1 chain order), EP4-granted mushroom/garlic/oregano/egg/pesto/cherry-tomato.
    const dex = discovered("margherita", "funghi", "marinara", "bismarck", "genovese");
    const owned = [
      ...STARTER_INGREDIENT_IDS,
      "mushroom",
      "garlic",
      "oregano",
      "egg",
      "pesto",
      "cherry-tomato",
    ];
    const result = resolveShopEntitlement(dex, owned, []);
    // Every owned finite material is entitled (OWNED), plus the ladder reach at count 5.
    expect(result.unlockedForShopIngredientIds).toEqual([
      "mushroom",
      "garlic",
      "oregano",
      "egg",
      "pesto",
      "cherry-tomato",
      "bacon",
      "pepperoni",
      "sausage",
    ]);
    expect(result.newlyUnlockedMaterialIds).toEqual(["bacon", "pepperoni", "sausage"]);
    // The load path hands exactly this to createInitialGameState: stock/ownership untouched.
    const inventory = { mushroom: 17, garlic: 4 };
    const state = createInitialGameState(dex, owned, 55, inventory, ["funghi", "marinara"], result.unlockedForShopIngredientIds);
    expect(state.inventory).toBe(inventory);
    expect(state.ownedIngredientIds).toBe(owned);
    expect(state.starterGrantClaimedRecipeIds).toEqual(["funghi", "marinara"]);
    expect(state.pitzBalance).toBe(55);
  });

  it("is a no-op (same reference) for an up-to-date ledger", () => {
    const dex = discovered("margherita");
    const ledger = ["egg"];
    expect(resolveShopEntitlement(dex, STARTER_INGREDIENT_IDS, ledger).unlockedForShopIngredientIds).toBe(ledger);
  });

  it("never re-locks: a ledger larger than the ladder reach is kept whole", () => {
    const ledger = ["egg", "bacon", "tuna"];
    const result = resolveShopEntitlement(discovered("margherita"), STARTER_INGREDIENT_IDS, ledger);
    expect(result.unlockedForShopIngredientIds).toBe(ledger);
    expect(result.newlyUnlockedMaterialIds).toEqual([]);
  });

  it("never lists a starter, even if one is in the owned list", () => {
    const result = resolveShopEntitlement(discovered("margherita", "bismarck"), STARTER_INGREDIENT_IDS, []);
    for (const id of STARTER_INGREDIENT_IDS) expect(result.unlockedForShopIngredientIds).not.toContain(id);
  });
});
