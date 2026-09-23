import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { EMPTY_DEX, getDexEntry, type DexState } from "./dex";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { DEFAULT_COOKING_PROFILE } from "../data/cookingProfiles";
import { FREE_COOK_BAKE_TARGET, FREE_COOK_RECIPE, FREE_COOK_RECIPE_ID } from "../data/freeCook";
import type { InventoryState } from "./inventory";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Progression 2.0 Phase 3-2 (Issue #194): the free-cook round end to end, through the real
 * reducer actions a player's taps dispatch (no state injection): START_FREE_COOK -> DOUGH ->
 * SAUCE -> CHEESE -> TOPPING -> BAKE -> CONFIRM_BAKE -> REGISTER_TO_DEX.
 */

const NOW = 1_000_000;
const MARGHERITA_BAKE = 70; // inside both the generic window and Margherita's own

function dispatchAll(state: GameState, actions: readonly GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}

function start(
  dex: DexState = EMPTY_DEX,
  owned: readonly string[] = STARTER_INGREDIENT_IDS,
  inventory: InventoryState = {},
): GameState {
  const initial = createInitialGameState(dex, owned, 0, inventory, []);
  return gameReducer(initial, { type: "START_FREE_COOK", now: NOW });
}

interface FreePizza {
  sauce?: string;
  cheese?: readonly { id: string; x: number; y: number }[];
  toppings?: readonly { id: string; x: number; y: number }[];
}

/** Walks one free-cook round through every PREPARE step with real actions and bakes it. */
function cook(state: GameState, pizza: FreePizza, bake = MARGHERITA_BAKE): GameState {
  let s = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  if (pizza.sauce) {
    s = gameReducer(s, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: pizza.sauce,
      deposits: buildIdealSauceFixture(),
    });
  }
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  for (const piece of pizza.cheese ?? []) {
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: piece.id, x: piece.x, y: piece.y });
  }
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
  for (const piece of pizza.toppings ?? []) {
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: piece.id, x: piece.x, y: piece.y });
  }
  s = dispatchAll(s, [
    { type: "START_BAKE", now: NOW + 60_000 },
    { type: "CONFIRM_BAKE", value: bake },
  ]);
  return walkPostBakeToResult(s);
}

function piecesOf(ingredientId: string) {
  const group = getReferencePizza("margherita")!.pieceGroups.find((g) => g.ingredientId === ingredientId)!;
  return group.positions.map((p) => ({ id: ingredientId, ...p }));
}

const MARGHERITA: FreePizza = {
  sauce: "tomato-sauce",
  cheese: piecesOf("mozzarella"),
  toppings: piecesOf("basil"),
};

const register = (state: GameState) => gameReducer(state, { type: "REGISTER_TO_DEX" });

describe("START_FREE_COOK", () => {
  it("starts a FREE round at PREPARE with no recipe selected and a clean slate", () => {
    const state = start();
    expect(state.phase).toBe("PREPARE");
    expect(state.freeCook).toBe(true);
    expect(state.isMissionRound).toBe(false);
    expect(state.recipe).toBe(FREE_COOK_RECIPE);
    expect(state.recipe.requiredIngredients).toEqual([]);
    expect(state.makingStep).toBe("DOUGH");
    expect(state.cookingProfile).toBe(DEFAULT_COOKING_PROFILE);
    expect(state.lastDiscovery).toBeNull();
    expect(state.score).toBeNull();
    expect(state.cookingTiming).not.toBeNull();
  });

  it("the generic bake window is derived from the shipped recipes (median start/end)", () => {
    expect(FREE_COOK_BAKE_TARGET).toEqual({ start: 58, end: 78 });
    expect(FREE_COOK_RECIPE.bakeTarget).toBe(FREE_COOK_BAKE_TARGET);
  });

  it("offers every owned ingredient: the reducer accepts ones no recipe subset would name", () => {
    let s = start(EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "garlic"], { garlic: 5 });
    s = dispatchAll(s, [
      { type: "CONFIRM_MAKING_STEP" },
      { type: "CONFIRM_MAKING_STEP" },
      { type: "CONFIRM_MAKING_STEP" },
      { type: "PLACE_TOPPING", ingredientId: "garlic", x: 50, y: 50 },
    ]);
    expect(s.pizza.toppings.map((t) => t.ingredientId)).toEqual(["garlic"]);
  });

  it("never places a LOCKED / AVAILABLE_TO_BUY (not owned) ingredient", () => {
    let s = start();
    s = dispatchAll(s, [
      { type: "CONFIRM_MAKING_STEP" },
      { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "pesto", deposits: buildIdealSauceFixture() },
      { type: "CONFIRM_MAKING_STEP" },
      { type: "CONFIRM_MAKING_STEP" },
      { type: "PLACE_TOPPING", ingredientId: "mushroom", x: 50, y: 50 },
    ]);
    expect(s.pizza.sauceIds).toEqual([]);
    expect(s.pizza.toppings).toEqual([]);
  });
});

describe("free cook -> NEW / KNOWN / ORIGINAL", () => {
  it("NEW: a first Margherita is discovered, registered and paid as Margherita", () => {
    const result = cook(start(), MARGHERITA);
    expect(result.phase).toBe("RESULT");
    expect(result.recipe.id).toBe("margherita");
    expect(result.completion?.status).toBe("PASS");
    expect(result.score).not.toBeNull();

    const after = register(result);
    expect(after.phase).toBe("DISCOVERED");
    expect(after.lastDiscovery).toEqual({
      kind: "NEW_DISCOVERY",
      recipeId: "margherita",
      targetId: "shipped:margherita",
    });
    expect(after.justDiscovered).toBe(true);
    expect(getDexEntry(after.dex, "margherita")).toMatchObject({ discovered: true, timesMade: 1 });
    expect(after.lastPitzCredit).not.toBeNull();
    expect(after.pitzBalance).toBeGreaterThan(0);
    expect(after.dex.some((e) => (e.recipeId as string) === FREE_COOK_RECIPE_ID)).toBe(false);
  });

  it("NEW is exactly-once: a repeated REGISTER_TO_DEX returns the identical state", () => {
    const after = register(cook(start(), MARGHERITA));
    expect(register(after)).toBe(after);
  });

  it("KNOWN: the same pizza again is ALREADY_DISCOVERED -- no second discovery event", () => {
    const first = register(cook(start(), MARGHERITA));
    const retry = gameReducer(first, { type: "RETRY_SAME_RECIPE", now: NOW + 120_000 });
    // Retrying a free-cook round cooks freely again; nothing from round 1 leaks into round 2.
    expect(retry.freeCook).toBe(true);
    expect(retry.recipe).toBe(FREE_COOK_RECIPE);
    expect(retry.phase).toBe("PREPARE");
    expect(retry.lastDiscovery).toBeNull();
    expect(retry.justDiscovered).toBe(false);
    expect(retry.lastPitzCredit).toBeNull();
    expect(retry.lastStarterGrantNotice).toBeNull();

    const second = register(cook(retry, MARGHERITA));
    expect(second.lastDiscovery).toEqual({
      kind: "ALREADY_DISCOVERED",
      recipeId: "margherita",
      targetId: "shipped:margherita",
    });
    expect(second.justDiscovered).toBe(false);
    expect(second.lastStarterGrantNotice).toBeNull();
    expect(second.starterGrantClaimedRecipeIds).toEqual(first.starterGrantClaimedRecipeIds);
    expect(getDexEntry(second.dex, "margherita")?.timesMade).toBe(2);
    expect(second.dex.filter((e) => e.discovered)).toHaveLength(1);
  });

  it("ORIGINAL: an unregistered combination finishes normally, unscored, with no Dex/Pitz change", () => {
    const result = cook(start(), { sauce: "tomato-sauce", cheese: piecesOf("mozzarella") });
    expect(result.phase).toBe("RESULT");
    expect(result.recipe).toBe(FREE_COOK_RECIPE);
    expect(result.completion).toEqual({ status: "PASS" });
    expect(result.score).toBeNull();
    expect(result.bakeState).toBe("perfect");

    const after = register(result);
    expect(after.phase).toBe("DISCOVERED");
    expect(after.lastDiscovery).toEqual({ kind: "ORIGINAL", blockedTargetIds: [] });
    expect(after.dex).toBe(result.dex);
    expect(after.pitzBalance).toBe(result.pitzBalance);
    expect(after.justDiscovered).toBe(false);
    expect(after.lastPitzCredit).toBeNull();
    expect(register(after)).toBe(after);
  });

  it("ORIGINAL (near miss): Margherita's set with too little basil is INCOMPLETE_MATCH, not a failure", () => {
    const result = cook(start(), { ...MARGHERITA, toppings: piecesOf("basil").slice(0, 1) });
    expect(result.completion?.status).toBe("PASS");
    const after = register(result);
    expect(after.phase).toBe("DISCOVERED");
    expect(after.lastDiscovery).toEqual({
      kind: "INCOMPLETE_MATCH",
      recipeId: "margherita",
      targetId: "shipped:margherita",
    });
    expect(getDexEntry(after.dex, "margherita")?.discovered ?? false).toBe(false);
  });

  it("a superset of Margherita is ORIGINAL (exact match only)", () => {
    const owned = [...STARTER_INGREDIENT_IDS, "garlic"];
    const result = cook(start(EMPTY_DEX, owned, { garlic: 5 }), {
      ...MARGHERITA,
      toppings: [...piecesOf("basil"), { id: "garlic", x: 50, y: 40 }],
    });
    expect(register(result).lastDiscovery?.kind).toBe("ORIGINAL");
  });

  it("an empty pizza or a burnt one is FAILED (not a dish), not ORIGINAL -- nothing registers", () => {
    const empty = cook(start(), {});
    expect(empty.completion).toMatchObject({ status: "FAILED", reason: "MISSING_REQUIRED_INGREDIENT" });
    expect(register(empty)).toBe(empty);

    const burnt = cook(start(), { sauce: "tomato-sauce" }, 99);
    expect(burnt.completion).toMatchObject({ status: "FAILED", reason: "OVERBAKED" });
    expect(register(burnt)).toBe(burnt);
  });
});

describe("free cook: inventory consumption", () => {
  const OWNED = [...STARTER_INGREDIENT_IDS, "onion"];

  it("consumes a finite owned ingredient exactly once at CONFIRM_BAKE, for an ORIGINAL pizza too", () => {
    const result = cook(start(EMPTY_DEX, OWNED, { onion: 3 }), {
      toppings: [
        { id: "onion", x: 40, y: 50 },
        { id: "onion", x: 60, y: 50 },
      ],
    });
    expect(result.inventory.onion).toBe(1);
    expect(register(result).inventory.onion).toBe(1);
    // A duplicate CONFIRM_BAKE is rejected by the existing BAKE-phase guard.
    expect(gameReducer(result, { type: "CONFIRM_BAKE", value: 70 })).toBe(result);
  });

  it("an owned ingredient with 0 stock cannot be placed (existing Stock Gate contract)", () => {
    let s = start(EMPTY_DEX, OWNED, { onion: 0 });
    s = dispatchAll(s, [
      { type: "CONFIRM_MAKING_STEP" },
      { type: "CONFIRM_MAKING_STEP" },
      { type: "CONFIRM_MAKING_STEP" },
      { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 },
    ]);
    expect(s.pizza.toppings).toEqual([]);
    expect(s.placement?.status).toBe("rejected");
  });

  it("unlimited starter ingredients are never consumed", () => {
    const result = cook(start(), MARGHERITA);
    expect(result.inventory).toEqual({});
  });
});

describe("free cook does not leak into other flows", () => {
  it("HOME (PLAY_AGAIN) mid-round resets to a recipe round with no stale discovery", () => {
    const mid = gameReducer(start(), { type: "CONFIRM_MAKING_STEP" });
    const home = gameReducer(mid, { type: "PLAY_AGAIN" });
    expect(home.freeCook).toBe(false);
    expect(home.recipe.id).not.toBe(FREE_COOK_RECIPE_ID);
    expect(home.lastDiscovery).toBeNull();
  });

  it("after a free-cook discovery, SELECT_RECIPE starts a normal recipe-guided round", () => {
    const discovered = register(cook(start(), MARGHERITA));
    const guided = gameReducer(discovered, { type: "SELECT_RECIPE", recipeId: "margherita", now: NOW });
    expect(guided.freeCook).toBe(false);
    expect(guided.recipe.id).toBe("margherita");
    expect(guided.lastDiscovery).toBeNull();
    expect(guided.justDiscovered).toBe(false);
    // RETRY in a guided round stays guided.
    const retried = gameReducer(guided, { type: "RETRY_SAME_RECIPE", now: NOW });
    expect(retried.freeCook).toBe(false);
    expect(retried.recipe.id).toBe("margherita");
  });

  it("Lunch Rush (MISSION_RESET_ORDER) from a free-cook state is a normal Mission round", () => {
    const discovered = register(cook(start(), MARGHERITA));
    const mission = gameReducer(discovered, { type: "MISSION_RESET_ORDER" });
    expect(mission.freeCook).toBe(false);
    expect(mission.isMissionRound).toBe(true);
    expect(mission.recipe.id).not.toBe(FREE_COOK_RECIPE_ID);
    expect(mission.lastDiscovery).toBeNull();
  });

  it("the free-cook hint never names a recipe ingredient", () => {
    let s = start();
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
    expect(s.hint?.id).toBe("hint.free-cook.SAUCE");
    expect(s.hint?.textJa).not.toMatch(/トマト|バジル|モッツァレラ/);
  });
});
