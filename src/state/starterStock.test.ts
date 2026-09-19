import { describe, expect, it } from "vitest";
import { applyStarterGrants, STARTER_STOCK_PLAYS } from "./starterStock";
import { registerScoreToDex, EMPTY_DEX, type DexState } from "./dex";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { hasStock, remainingStock, EMPTY_INVENTORY, type InventoryState } from "./inventory";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import type { QualityStars } from "../logic/scoring";
import { getRecipe } from "../data/recipes";

/**
 * Economy & Progression 1.0 EP4: dedicated unit/integration tests for the Starter Grant
 * (../state/starterStock.ts). Complements the EP1/EP2/EP3 regression suites (progression.test.ts,
 * inventory.test.ts, gameReducer.inventoryConsumption.test.ts, gameReducer.restock.test.ts),
 * which pin that this feature doesn't change any of those systems' own established behavior.
 */

/** Builds a Dex where `recipeIds` are discovered at `stars` each, in order -- mirrors the same
 *  helper this codebase's other progression-adjacent test files already use. */
function dexDiscovering(recipeIds: readonly string[], stars: QualityStars): DexState {
  let dex: DexState = EMPTY_DEX;
  for (const recipeId of recipeIds) {
    dex = registerScoreToDex(dex, recipeId, {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: stars * 20,
      stars,
    }).dex;
  }
  return dex;
}

describe("STARTER_STOCK_PLAYS", () => {
  it("is the named constant 10", () => {
    expect(STARTER_STOCK_PLAYS).toBe(10);
  });
});

describe("applyStarterGrants: Margherita exemption", () => {
  it("never grants anything for margherita, even though it is always unlocked", () => {
    const result = applyStarterGrants(EMPTY_DEX, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(result.grantedRecipeIds).toEqual([]);
    expect(result.inventory).toBe(EMPTY_INVENTORY);
    expect(result.ownedIngredientIds).toBe(STARTER_INGREDIENT_IDS);
    expect(result.claimedRecipeIds).toEqual([]);
  });

  it("margherita's own ingredients stay permanently unlimited regardless of inventory", () => {
    for (const id of ["tomato-sauce", "mozzarella", "basil"]) {
      const ingredient = getIngredient(id)!;
      expect(ingredient.unlockCondition).toBeUndefined();
      expect(hasStock(ingredient, {}, 9999)).toBe(true);
      expect(remainingStock(ingredient, {})).toBe("UNLIMITED");
    }
  });

  it("margherita is never added to starterGrantClaimedRecipeIds even after every other recipe unlocks", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(result.claimedRecipeIds).not.toContain("margherita");
  });
});

describe("applyStarterGrants: Recipe #2-#7 grant amounts", () => {
  it("Recipe #2 (funghi) grants mushroom = minCount(3) x 10 = 30 on first unlock", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(result.grantedRecipeIds).toEqual(["funghi"]);
    expect(result.inventory).toEqual({ mushroom: 30 });
    expect(result.ownedIngredientIds).toContain("mushroom");
    expect(result.claimedRecipeIds).toEqual(["funghi"]);
  });

  it("Recipe #3 (marinara) grants garlic = 3x10=30 and oregano = 2x10=20", () => {
    const dex = dexDiscovering(["margherita", "funghi"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, ["funghi"]);
    expect(result.grantedRecipeIds).toEqual(["marinara"]);
    expect(result.inventory).toEqual({ garlic: 30, oregano: 20 });
  });

  it("Recipe #4 (bismarck) grants egg = 1x10=10 (tomato-sauce/mozzarella stay ungranted)", () => {
    const dex = dexDiscovering(["margherita", "funghi", "marinara"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
    ]);
    expect(result.grantedRecipeIds).toEqual(["bismarck"]);
    expect(result.inventory).toEqual({ egg: 10 });
  });

  it("Recipe #5 (genovese) grants pesto = 10 (spread/sauce) and cherry-tomato = 3x10=30", () => {
    const dex = dexDiscovering(["margherita", "funghi", "marinara", "bismarck"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
      "bismarck",
    ]);
    expect(result.grantedRecipeIds).toEqual(["genovese"]);
    expect(result.inventory).toEqual({ pesto: 10, "cherry-tomato": 30 });
  });

  it("Recipe #6 (quattro-formaggi, requires genovese discovered + 8 stars) grants olive-oil=10, gorgonzola/parmigiano/fontina = 2x10=20 each", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese"],
      5 as QualityStars, // 5 discoveries x 5 stars = 25 totalStars, >= 8
    );
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
    ]);
    expect(result.grantedRecipeIds).toEqual(["quattro-formaggi"]);
    expect(result.inventory).toEqual({ "olive-oil": 10, gorgonzola: 20, parmigiano: 20, fontina: 20 });
  });

  it("Recipe #7 (fugazza) grants onion = 4x10=40, plus olive-oil/oregano additively on top of quattro-formaggi/marinara's own grants", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars, // >= 12 totalStars for fugazza's own gate
    );
    // Simulate marinara's and quattro-formaggi's own grants already having landed (oregano 20,
    // olive-oil 10), exactly as production would have applied them at those earlier moments.
    const priorInventory: InventoryState = {
      garlic: 30,
      oregano: 20,
      egg: 10,
      pesto: 10,
      "cherry-tomato": 30,
      "olive-oil": 10,
      gorgonzola: 20,
      parmigiano: 20,
      fontina: 20,
      mushroom: 30,
    };
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, priorInventory, [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
    ]);
    expect(result.grantedRecipeIds).toEqual(["fugazza"]);
    expect(result.inventory.onion).toBe(40);
    // Additive, not overwritten: fugazza's own +10 olive-oil / +10 oregano land on top of the
    // amounts marinara/quattro-formaggi already granted.
    expect(result.inventory["olive-oil"]).toBe(20); // 10 (quattro) + 10 (fugazza)
    expect(result.inventory.oregano).toBe(30); // 20 (marinara) + 10 (fugazza)
    expect(result.ownedIngredientIds).toContain("onion");
  });
});

describe("applyStarterGrants: scatter vs spread/sauce derivation", () => {
  it("every scatter ingredient's grant is exactly requiredIngredients.minCount x STARTER_STOCK_PLAYS", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    const genovese = getRecipe("genovese")!;
    const cherryTomatoReq = genovese.requiredIngredients.find((r) => r.ingredientId === "cherry-tomato")!;
    expect(getIngredient("cherry-tomato")!.placement).toBe("scatter");
    expect(result.inventory["cherry-tomato"]).toBe(cherryTomatoReq.minCount * STARTER_STOCK_PLAYS);
  });

  it("every spread/sauce ingredient's grant is exactly STARTER_STOCK_PLAYS (1 use x plays), independent of minCount", () => {
    const dex = dexDiscovering(["margherita", "funghi", "marinara", "bismarck"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
      "bismarck",
    ]);
    expect(getIngredient("pesto")!.placement).toBe("spread");
    expect(result.inventory.pesto).toBe(STARTER_STOCK_PLAYS);
  });
});

describe("applyStarterGrants: exactly-once", () => {
  it("calling it again with the same (already-claimed) recipe is a complete no-op -- no double grant", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    const first = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(first.inventory).toEqual({ mushroom: 30 });

    // Simulates: reload, PLAY_AGAIN, RETRY_SAME_RECIPE, HOME round-trip, Shop open/close, mode
    // switch, Dex recomputation -- every one of these is, from this function's own perspective,
    // just "call it again with the same dex/claimed ledger."
    const second = applyStarterGrants(dex, first.ownedIngredientIds, first.inventory, first.claimedRecipeIds);
    expect(second.grantedRecipeIds).toEqual([]);
    expect(second.inventory).toBe(first.inventory); // same reference -- no-op, not just same value
    expect(second.ownedIngredientIds).toBe(first.ownedIngredientIds);
    expect(second.claimedRecipeIds).toBe(first.claimedRecipeIds);
  });

  it("calling it many times in a row (simulating repeated reducer/load calls) never compounds", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    let result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    for (let i = 0; i < 10; i++) {
      result = applyStarterGrants(dex, result.ownedIngredientIds, result.inventory, result.claimedRecipeIds);
    }
    expect(result.inventory).toEqual({ mushroom: 30 });
  });

  it("shared ingredient additive grant: two different recipes unlocking separately both credit the shared pool, but neither recipe is ever charged twice", () => {
    // oregano is shared by marinara (2/play) and fugazza (1/play) -- unlock marinara first.
    let dex = dexDiscovering(["margherita", "funghi"], 1 as QualityStars);
    let result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, ["funghi"]);
    expect(result.inventory.oregano).toBe(20); // marinara's own 2 x 10

    // Re-running against the *same* unlocked-marinara dex must never add oregano again.
    result = applyStarterGrants(dex, result.ownedIngredientIds, result.inventory, result.claimedRecipeIds);
    expect(result.grantedRecipeIds).toEqual([]);
    expect(result.inventory.oregano).toBe(20);

    // Now unlock the rest of the chain through fugazza -- oregano gets fugazza's own +1x10 on
    // top, additively, exactly once.
    dex = dexDiscovering(
      ["marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    result = applyStarterGrants(dex, result.ownedIngredientIds, result.inventory, result.claimedRecipeIds);
    expect(result.inventory.oregano).toBe(30); // 20 + fugazza's own 10
    expect(result.claimedRecipeIds).toContain("fugazza");
  });
});

describe("applyStarterGrants: future Achievement Reset compatibility", () => {
  it("a Dex reset back to empty does not re-grant a recipe whose Starter Grant is already claimed", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    const granted = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(granted.claimedRecipeIds).toEqual(["funghi"]);

    // Simulates a future "reset achievements" feature: dex/stars go back to empty, but the
    // ledger (a deliberately separate, persistent concept from `dex`) is untouched.
    const afterReset = applyStarterGrants(
      EMPTY_DEX,
      granted.ownedIngredientIds,
      granted.inventory,
      granted.claimedRecipeIds,
    );
    expect(afterReset.grantedRecipeIds).toEqual([]);
    expect(afterReset.inventory).toBe(granted.inventory);

    // Re-discovering margherita again (as the reset flow would have the player do) re-unlocks
    // funghi's `recipeUnlocked` axis, but the ledger still blocks a second grant.
    const rediscovered = dexDiscovering(["margherita"], 1 as QualityStars);
    const afterRediscovery = applyStarterGrants(
      rediscovered,
      afterReset.ownedIngredientIds,
      afterReset.inventory,
      afterReset.claimedRecipeIds,
    );
    expect(afterRediscovery.grantedRecipeIds).toEqual([]);
    expect(afterRediscovery.inventory).toEqual({ mushroom: 30 }); // still exactly the one grant
  });
});

describe("Starter Grant integration via the reducer (REGISTER_TO_DEX / MISSION_NEXT_ORDER)", () => {
  /** Plays margherita through PREPARE -> BAKE -> RESULT, scoring inside its perfect zone. */
  function playMargheritaToResult(isMissionRound = false): GameState {
    let state = createInitialGameState();
    if (isMissionRound) state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
    state = gameReducer(state, { type: "START_BAKE" });
    return gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
  }

  it("FREE: REGISTER_TO_DEX grants funghi's Starter Stock the instant margherita's own discovery unlocks it", () => {
    const discovered = gameReducer(playMargheritaToResult(), { type: "REGISTER_TO_DEX" });
    expect(discovered.phase).toBe("DISCOVERED");
    expect(discovered.starterGrantClaimedRecipeIds).toEqual(["funghi"]);
    expect(discovered.inventory).toEqual({ mushroom: 30 });
    expect(discovered.ownedIngredientIds).toContain("mushroom");
  });

  it("Lunch Rush: MISSION_NEXT_ORDER grants the same way REGISTER_TO_DEX does", () => {
    const next = gameReducer(playMargheritaToResult(true), { type: "MISSION_NEXT_ORDER" });
    expect(next.phase).toBe("ORDER");
    expect(next.starterGrantClaimedRecipeIds).toEqual(["funghi"]);
    expect(next.inventory).toEqual({ mushroom: 30 });
  });

  it("PLAY_AGAIN/RETRY_SAME_RECIPE/SELECT_RECIPE/HOME round-trip/mode switches never re-grant after REGISTER_TO_DEX already did", () => {
    const discovered = gameReducer(playMargheritaToResult(), { type: "REGISTER_TO_DEX" });
    const claimedAfterFirstGrant = discovered.starterGrantClaimedRecipeIds;
    const inventoryAfterFirstGrant = discovered.inventory;

    let state = gameReducer(discovered, { type: "PLAY_AGAIN" });
    expect(state.starterGrantClaimedRecipeIds).toBe(claimedAfterFirstGrant);
    expect(state.inventory).toBe(inventoryAfterFirstGrant);

    state = gameReducer(state, { type: "RETRY_SAME_RECIPE" });
    expect(state.inventory).toBe(inventoryAfterFirstGrant);

    state = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "margherita" });
    expect(state.inventory).toBe(inventoryAfterFirstGrant);

    // "HOME往復": App.tsx never dispatches a GameAction just from navigating screens, so a
    // round-trip is represented here by simply re-reading the same state -- there is no action
    // to dispatch that would change anything.
    expect(state.starterGrantClaimedRecipeIds).toBe(claimedAfterFirstGrant);

    // Mode switch (FREE <-> Lunch Rush).
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(state.inventory).toBe(inventoryAfterFirstGrant);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" }); // back to FREE-equivalent pool
    expect(state.inventory).toBe(inventoryAfterFirstGrant);
  });

  it("Shop open/close (PURCHASE_INGREDIENT/RESTOCK_INGREDIENT dispatches) never touches the claimed ledger", () => {
    const discovered = gameReducer(playMargheritaToResult(), { type: "REGISTER_TO_DEX" });
    const claimed = discovered.starterGrantClaimedRecipeIds;

    // A purchase attempt always rejects here (mushroom is already OWNED via its own Starter
    // Grant, and is `starterGrantOnly` besides) -- opening/using Shop must never mutate the
    // ledger either way.
    const afterPurchaseAttempt = gameReducer(discovered, {
      type: "PURCHASE_INGREDIENT",
      ingredientId: "mushroom",
    });
    expect(afterPurchaseAttempt.starterGrantClaimedRecipeIds).toBe(claimed);

    const afterRestock = gameReducer(discovered, {
      type: "RESTOCK_INGREDIENT",
      ingredientId: "mushroom",
    });
    expect(afterRestock.starterGrantClaimedRecipeIds).toBe(claimed);
  });

  it("a granted ingredient still respects the Stock Gate once its 10-play stock is exhausted (no infinite Starter Stock)", () => {
    const discovered = gameReducer(playMargheritaToResult(), { type: "REGISTER_TO_DEX" });
    expect(discovered.inventory.mushroom).toBe(30);
    const mushroom = getIngredient("mushroom")!;
    // Exactly 30 placed pieces (10 plays x 3/pizza) still have stock; the 31st does not.
    expect(hasStock(mushroom, discovered.inventory, 29)).toBe(true);
    expect(hasStock(mushroom, discovered.inventory, 30)).toBe(false);
  });
});
