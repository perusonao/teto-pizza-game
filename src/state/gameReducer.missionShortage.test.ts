import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { getDexEntry, type DexState } from "./dex";
import { getRecipe, type RecipeId } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getCookingProfile } from "../data/cookingProfiles";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createCutState } from "../logic/cut/state";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { isRecipeCookable, recipeStockShortage } from "./recipeDiscoveryState";
import { canStartLunchRush, cookableMissionRecipeIds } from "../mission/lunchRush";
import type { InventoryState } from "./inventory";
import { discoveredDex } from "./testSupport/guidedRound";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Issue #212 (H-R, OD-2): Lunch Rush material-shortage orders. A short order may appear, can't be
 * prepared or baked, and can only be skipped; a skipped recipe is SOLD OUT for the rest of the run;
 * the order after a skip is always cookable; with nothing cookable a run never starts, and a
 * running one never falls back to Free Cooking or drags a baked pizza back into PREPARE.
 * Matrix ids (A-R) follow docs/reports/TETO_LUNCH-RUSH_MATERIAL-SHORTAGE-SKIP_Fresh-Revalidation.md §8.
 */

const finiteOf = (id: RecipeId) =>
  getRecipe(id)!
    .requiredIngredients.map((q) => q.ingredientId)
    .filter((i) => !!getIngredient(i)?.unlockCondition);

/** A save with `recipeIds` discovered, every finite material they need OWNED, and `inventory`. */
function saveState(recipeIds: readonly RecipeId[], inventory: InventoryState, dex?: DexState): GameState {
  const owned = [...new Set([...STARTER_INGREDIENT_IDS, ...recipeIds.flatMap((id) => finiteOf(id))])];
  return createInitialGameState(dex ?? discoveredDex(recipeIds), owned, 120, inventory);
}

/** A Lunch Rush ORDER round for `recipeId` on top of `state` (what MISSION_RESET_ORDER would build
 *  had it drawn this recipe). */
function missionOrder(state: GameState, recipeId: RecipeId, soldOut: readonly string[] = []): GameState {
  const cookingProfile = getCookingProfile(recipeId);
  return {
    ...state,
    phase: "ORDER",
    recipe: getRecipe(recipeId)!,
    order: findOrderForRecipe(recipeId)!,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
    pizza: createEmptyPizza(),
    score: null,
    completion: null,
    freeCook: false,
    isMissionRound: true,
    missionSoldOutRecipeIds: soldOut,
  };
}

/** The recipe's Reference pizza (ideal pieces + sauce), baked mid-window. */
function idealPizzaFor(recipeId: RecipeId): PizzaState {
  const reference = getReferencePizza(recipeId)!;
  const recipe = getRecipe(recipeId)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((g, gi) =>
      g.positions.map((p, i) => ({ id: `${recipeId}-${gi}-${i}`, ingredientId: g.ingredientId, ...p })),
    ),
    bakeResult: Math.round((recipe.bakeTarget.start + recipe.bakeTarget.end) / 2),
  };
}

/** Prepares and bakes the current (cookable) order through the real reducer, landing at RESULT. */
function serveCurrentOrder(state: GameState): GameState {
  const prepared = gameReducer(state, { type: "BEGIN_PREPARE" });
  expect(prepared.phase).toBe("PREPARE");
  const pizza = idealPizzaFor(prepared.recipe.id as RecipeId);
  let s = gameReducer({ ...prepared, pizza }, { type: "START_BAKE" });
  s = gameReducer(s, { type: "CONFIRM_BAKE", value: pizza.bakeResult! });
  return walkPostBakeToResult(s);
}

function drawUntil(state: GameState, recipeId: RecipeId): GameState {
  let s = gameReducer(state, { type: "MISSION_RESET_ORDER" });
  for (let i = 0; i < 200 && s.recipe.id !== recipeId; i += 1) s = gameReducer(state, { type: "MISSION_RESET_ORDER" });
  expect(s.recipe.id).toBe(recipeId);
  return s;
}

function expectSameProgression(before: GameState, after: GameState) {
  expect(after.dex).toBe(before.dex);
  expect(after.inventory).toBe(before.inventory);
  expect(after.pitzBalance).toBe(before.pitzBalance);
  expect(after.ownedIngredientIds).toBe(before.ownedIngredientIds);
  expect(after.unlockedForShopIngredientIds).toBe(before.unlockedForShopIngredientIds);
  expect(after.discoveryHintPurchases).toBe(before.discoveryHintPurchases);
  expect(after.lastClaimedMissionRunId).toBe(before.lastClaimedMissionRunId);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recipeStockShortage -- the per-ingredient view of isRecipeCookable", () => {
  it("A: enough stock -> no shortage, cookable", () => {
    const s = saveState(["margherita", "bismarck"], { egg: 5 });
    expect(recipeStockShortage(getRecipe("bismarck")!, s)).toEqual([]);
    expect(isRecipeCookable(getRecipe("bismarck")!, s)).toBe(true);
  });

  it("B: one finite material at 0 -> exactly that material, need/have", () => {
    const s = saveState(["margherita", "bismarck"], { egg: 0 });
    expect(recipeStockShortage(getRecipe("bismarck")!, s)).toEqual([{ ingredientId: "egg", need: 1, have: 0 }]);
    expect(isRecipeCookable(getRecipe("bismarck")!, s)).toBe(false);
  });

  it("C: several short materials, in requiredIngredients order (sauce needs 1, scatter needs minCount)", () => {
    const s = saveState(["margherita", "quattro-formaggi"], {
      "olive-oil": 0,
      gorgonzola: 1,
      parmigiano: 2,
      fontina: 0,
    });
    expect(recipeStockShortage(getRecipe("quattro-formaggi")!, s)).toEqual([
      { ingredientId: "olive-oil", need: 1, have: 0 },
      { ingredientId: "gorgonzola", need: 2, have: 1 },
      { ingredientId: "fontina", need: 2, have: 0 },
    ]);
  });

  it("D: stock exactly at the minimum is cookable; one below is short", () => {
    const genovese = getRecipe("genovese")!;
    expect(recipeStockShortage(genovese, saveState(["genovese"], { pesto: 1, "cherry-tomato": 3 }))).toEqual([]);
    expect(recipeStockShortage(genovese, saveState(["genovese"], { pesto: 1, "cherry-tomato": 2 }))).toEqual([
      { ingredientId: "cherry-tomato", need: 3, have: 2 },
    ]);
    expect(recipeStockShortage(getRecipe("bismarck")!, saveState(["bismarck"], { egg: 1 }))).toEqual([]);
  });

  it("E: a starter-only recipe is never short, even with an empty inventory", () => {
    const s = createInitialGameState(discoveredDex(["margherita"]), STARTER_INGREDIENT_IDS, 0, {});
    expect(recipeStockShortage(getRecipe("margherita")!, s)).toEqual([]);
  });

  it("an unowned finite material counts as 0 usable, whatever the inventory says", () => {
    const s = createInitialGameState(discoveredDex(["bismarck"]), STARTER_INGREDIENT_IDS, 0, { egg: 9 });
    expect(recipeStockShortage(getRecipe("bismarck")!, s)).toEqual([{ ingredientId: "egg", need: 1, have: 0 }]);
  });
});

describe("Lunch Rush pool helpers", () => {
  it("the cookable pool keeps discovered, owned, stocked, not SOLD OUT recipes only", () => {
    const s = saveState(["margherita", "bismarck", "genovese"], { egg: 1, pesto: 0, "cherry-tomato": 3 });
    expect(cookableMissionRecipeIds(s)).toEqual(["margherita", "bismarck"]);
    expect(cookableMissionRecipeIds(s, ["bismarck"])).toEqual(["margherita"]);
    expect(canStartLunchRush(s)).toBe(true);
  });

  it("H: nothing cookable -> Lunch Rush cannot start", () => {
    expect(canStartLunchRush(saveState(["bismarck"], { egg: 0 }))).toBe(false);
    expect(canStartLunchRush(createInitialGameState())).toBe(false); // Dex 0
  });
});

describe("BEGIN_PREPARE -- a short Lunch Rush order stays at ORDER", () => {
  it("A: a cookable Lunch Rush order prepares as before", () => {
    const order = missionOrder(saveState(["margherita", "bismarck"], { egg: 2 }), "bismarck");
    expect(gameReducer(order, { type: "BEGIN_PREPARE" }).phase).toBe("PREPARE");
  });

  it("B/C: a short order is rejected (same reference), for one or many missing materials", () => {
    const one = missionOrder(saveState(["margherita", "bismarck"], { egg: 0 }), "bismarck");
    expect(gameReducer(one, { type: "BEGIN_PREPARE", now: 5 })).toBe(one);
    const many = missionOrder(saveState(["margherita", "quattro-formaggi"], {}), "quattro-formaggi");
    expect(gameReducer(many, { type: "BEGIN_PREPARE" })).toBe(many);
  });

  it("E: the starter-only margherita always prepares", () => {
    const order = missionOrder(createInitialGameState(discoveredDex(["margherita"]), STARTER_INGREDIENT_IDS), "margherita");
    expect(gameReducer(order, { type: "BEGIN_PREPARE" }).phase).toBe("PREPARE");
  });

  it("R: never leaves any phase but ORDER -- a baked pizza is never dragged back into PREPARE", () => {
    const served = serveCurrentOrder(missionOrder(saveState(["margherita"], {}), "margherita"));
    expect(served.phase).toBe("RESULT");
    expect(gameReducer(served, { type: "BEGIN_PREPARE" })).toBe(served);
    for (const phase of ["PREPARE", "BAKE", "POST_BAKE", "DISCOVERED"] as const) {
      const at: GameState = { ...served, phase };
      expect(gameReducer(at, { type: "BEGIN_PREPARE" }), phase).toBe(at);
    }
  });

  it("the FREE guided round keeps its own LK-8 behaviour", () => {
    const free: GameState = { ...missionOrder(saveState(["margherita", "bismarck"], { egg: 0 }), "bismarck"), isMissionRound: false };
    expect(gameReducer(free, { type: "BEGIN_PREPARE" })).toBe(free);
  });
});

describe("MISSION_SKIP_ORDER", () => {
  const shortBismarck = () => missionOrder(saveState(["margherita", "bismarck"], { egg: 0 }), "bismarck");

  it("B/F: skipping a short order draws a cookable one and marks the skipped recipe SOLD OUT", () => {
    const before = shortBismarck();
    const after = gameReducer(before, { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" });
    expect(after.phase).toBe("ORDER");
    expect(after.isMissionRound).toBe(true);
    expect(after.freeCook).toBe(false);
    expect(after.recipe.id).toBe("margherita");
    expect(after.missionSoldOutRecipeIds).toEqual(["bismarck"]);
    expect(gameReducer(after, { type: "BEGIN_PREPARE" }).phase).toBe("PREPARE");
  });

  it("K/L/P: no score, Pitz, inventory, Dex (BEST / timesMade) or ownership side effect", () => {
    const before = shortBismarck();
    const after = gameReducer(before, { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" });
    expectSameProgression(before, after);
    expect(after.score).toBeNull();
    expect(after.completion).toBeNull();
    expect(getDexEntry(after.dex, "bismarck")).toEqual(getDexEntry(before.dex, "bismarck"));
  });

  it("F: across many draws the order after a skip is always cookable and never the skipped recipe", () => {
    const base = saveState(["margherita", "bismarck", "genovese", "marinara"], {
      egg: 0,
      pesto: 0,
      "cherry-tomato": 0,
      garlic: 9,
      oregano: 9,
    });
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const after = gameReducer(missionOrder(base, "genovese"), { type: "MISSION_SKIP_ORDER", recipeId: "genovese" });
      expect(isRecipeCookable(after.recipe, after)).toBe(true);
      expect(after.recipe.id).not.toBe("genovese");
      seen.add(after.recipe.id);
    }
    expect([...seen].sort()).toEqual(["margherita", "marinara"]);
  });

  it("M: a cookable order can never be skipped (no rerolling)", () => {
    const cookable = missionOrder(saveState(["margherita", "bismarck"], { egg: 1 }), "bismarck");
    expect(gameReducer(cookable, { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" })).toBe(cookable);
    const marg = missionOrder(saveState(["margherita"], {}), "margherita");
    expect(gameReducer(marg, { type: "MISSION_SKIP_ORDER", recipeId: "margherita" })).toBe(marg);
  });

  it("G: a stale / double tap is a no-op (the recipeId no longer matches, or the new order is cookable)", () => {
    const once = gameReducer(shortBismarck(), { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" });
    expect(gameReducer(once, { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" })).toBe(once);
    expect(gameReducer(once, { type: "MISSION_SKIP_ORDER", recipeId: once.recipe.id })).toBe(once);
  });

  it("N/O: ignored outside a Lunch Rush ORDER round", () => {
    const order = shortBismarck();
    const free: GameState = { ...order, isMissionRound: false };
    expect(gameReducer(free, { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" })).toBe(free);
    const freeCook: GameState = { ...order, freeCook: true };
    expect(gameReducer(freeCook, { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" })).toBe(freeCook);
    for (const phase of ["PREPARE", "BAKE", "POST_BAKE", "RESULT", "DISCOVERED"] as const) {
      const at: GameState = { ...order, phase };
      expect(gameReducer(at, { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" }), phase).toBe(at);
    }
  });

  it("H: with nothing cookable left, only the SOLD OUT set changes -- no Free Cooking, no PREPARE", () => {
    // Defensive: a cookable pool that empties between the draw and the skip (not reachable in
    // play -- stock never changes at ORDER -- but the reducer must still stay closed).
    const order = missionOrder(saveState(["bismarck", "genovese"], { egg: 0, pesto: 0 }), "bismarck");
    const after = gameReducer(order, { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" });
    expect(after.phase).toBe("ORDER");
    expect(after.recipe.id).toBe("bismarck");
    expect(after.freeCook).toBe(false);
    expect(after.isMissionRound).toBe(true);
    expect(after.missionSoldOutRecipeIds).toEqual(["bismarck"]);
    expectSameProgression(order, after);
    expect(gameReducer(after, { type: "BEGIN_PREPARE" })).toBe(after);
  });
});

describe("SOLD OUT is run-local", () => {
  it("MISSION_NEXT_ORDER carries it; a new run (MISSION_RESET_ORDER) and a FREE round clear it", () => {
    const skipped = gameReducer(
      missionOrder(saveState(["margherita", "bismarck"], { egg: 0 }), "bismarck"),
      { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" },
    );
    const served = serveCurrentOrder(skipped);
    const next = gameReducer(served, { type: "MISSION_NEXT_ORDER" });
    expect(next.missionSoldOutRecipeIds).toEqual(["bismarck"]);
    expect(next.recipe.id).toBe("margherita");
    expect(gameReducer(next, { type: "MISSION_RESET_ORDER" }).missionSoldOutRecipeIds).toEqual([]);
    expect(gameReducer(next, { type: "PLAY_AGAIN" }).missionSoldOutRecipeIds).toEqual([]);
  });

  it("a fresh session starts with nothing SOLD OUT", () => {
    expect(createInitialGameState().missionSoldOutRecipeIds).toEqual([]);
  });
});

describe("G: a whole run -- shortages never chain and a skipped recipe never returns", () => {
  it("over many orders: each short recipe is shown at most once, never twice in a row", () => {
    // margherita (starter) and marinara are cookable; bismarck/genovese/quattro-formaggi are short.
    const base = saveState(["margherita", "bismarck", "genovese", "marinara", "quattro-formaggi"], {
      egg: 0,
      pesto: 0,
      garlic: 999,
      oregano: 999,
    });
    for (let run = 0; run < 10; run += 1) {
      let s = gameReducer(base, { type: "MISSION_RESET_ORDER" });
      const shortShown: string[] = [];
      let previousWasShort = false;
      for (let order = 0; order < 40; order += 1) {
        const short = !isRecipeCookable(s.recipe, s);
        if (short) {
          expect(previousWasShort).toBe(false);
          expect(shortShown).not.toContain(s.recipe.id);
          shortShown.push(s.recipe.id);
          s = gameReducer(s, { type: "MISSION_SKIP_ORDER", recipeId: s.recipe.id });
          expect(isRecipeCookable(s.recipe, s)).toBe(true);
        } else {
          s = gameReducer(serveCurrentOrder(s), { type: "MISSION_NEXT_ORDER" });
        }
        previousWasShort = short;
        expect(s.missionSoldOutRecipeIds).toEqual(shortShown);
      }
      expect(shortShown.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("D/H: stock used up during a run", () => {
  it("D: baking the last unit makes the next draw of that recipe short", () => {
    const order = missionOrder(saveState(["margherita", "bismarck"], { egg: 1 }), "bismarck");
    const served = serveCurrentOrder(order);
    expect(served.inventory.egg).toBe(0);
    const next = gameReducer(served, { type: "MISSION_NEXT_ORDER" });
    expect(next.phase).toBe("ORDER");
    expect(isRecipeCookable(getRecipe("bismarck")!, next)).toBe(false);
    expect(cookableMissionRecipeIds(next)).toEqual(["margherita"]);
  });

  it("H: serving the last cookable pizza keeps the round at RESULT (registered) -- no Free Cooking, no PREPARE", () => {
    const order = missionOrder(saveState(["bismarck", "genovese"], { egg: 1, pesto: 0 }), "bismarck");
    const served = serveCurrentOrder(order);
    const next = gameReducer(served, { type: "MISSION_NEXT_ORDER" });
    expect(next.phase).toBe("RESULT");
    expect(next.recipe.id).toBe("bismarck");
    expect(next.freeCook).toBe(false);
    expect(next.isMissionRound).toBe(true);
    expect(getDexEntry(next.dex, "bismarck")?.timesMade).toBe(1); // the served pizza registered once
    expect(canStartLunchRush(next)).toBe(false);
    expect(gameReducer(next, { type: "BEGIN_PREPARE" })).toBe(next);
  });

  it("H: a new run with nothing cookable is refused (state unchanged, never a Free Cooking round)", () => {
    const none = saveState(["bismarck"], { egg: 0 });
    expect(gameReducer(none, { type: "MISSION_RESET_ORDER" })).toBe(none);
  });

  it("the normal draw may still land on a short order (H-R keeps shortages visible)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const s = saveState(["margherita", "bismarck"], { egg: 0 });
    const withPrevMarg = missionOrder(s, "margherita");
    const drawn = gameReducer(withPrevMarg, { type: "MISSION_RESET_ORDER" });
    expect(drawn.recipe.id).toBe("bismarck");
    expect(isRecipeCookable(drawn.recipe, drawn)).toBe(false);
    expect(drawUntil(s, "bismarck").isMissionRound).toBe(true);
  });
});
