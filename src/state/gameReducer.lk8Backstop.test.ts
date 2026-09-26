import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, getDexEntry, isDiscovered, type DexState } from "./dex";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { FREE_COOK_ORDER, FREE_COOK_RECIPE_ID } from "../data/freeCook";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { canStartGuidedRound, recipeDiscoveryState } from "./recipeDiscoveryState";
import { resolveShopEntitlement } from "./materialEntitlement";
import { createGuidedInitialState, discoveredDex } from "./testSupport/guidedRound";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Progression 2.0 W1 Discovery 2.0 -- W1-a2 (LK-8 / LK-8b / NF-1 / NF-4): the reducer backstop.
 * A guided (recipe-first, reference-shown) round starts only for a DISCOVERED recipe that is
 * cookable right now (`canStartGuidedRound`), at every entry point, and new discoveries come only
 * from the Free Cooking matcher. See docs/reports/TETO_PROGRESS2_W1_DISCOVERY_INTEGRATION-GATE_
 * POST-I5B4.md §3 for the leak these close.
 */

const OLD15 = RECIPES.slice(0, 15).map((r) => r.id);
const finiteOf = (id: RecipeId) =>
  getRecipe(id)!.requiredIngredients.map((q) => q.ingredientId).filter((i) => !!getIngredient(i)?.unlockCondition);

/** A legacy (pre-W1) save: the 15 shipped recipes discovered, their EP4 materials owned with
 *  stock -- the save shape where the gate measured 200/200 undiscovered FREE orders (LK-8). */
function legacyDex15State(): GameState {
  const dex = discoveredDex(OLD15);
  const mats = [...new Set(OLD15.flatMap((id) => finiteOf(id as RecipeId)))];
  const owned = [...STARTER_INGREDIENT_IDS, ...mats];
  const ledger = resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds;
  return createInitialGameState(dex, owned, 500, Object.fromEntries(mats.map((m) => [m, 30])), [], ledger);
}

/** A stale ORDER-phase guided round for `recipeId`, whatever the Dex says (what a leftover order
 *  would look like if anything ever produced one). */
function staleOrder(state: GameState, recipeId: RecipeId, isMissionRound = false): GameState {
  const cookingProfile = getCookingProfile(recipeId);
  return {
    ...state,
    phase: "ORDER",
    recipe: getRecipe(recipeId)!,
    order: findOrderForRecipe(recipeId)!,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
    freeCook: false,
    isMissionRound,
  };
}

function idealPizzaFor(recipeId: RecipeId, extra: readonly string[] = []): PizzaState {
  const reference = getReferencePizza(recipeId)!;
  const recipe = getRecipe(recipeId)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: [
      ...reference.pieceGroups.flatMap((g, gi) =>
        g.positions.map((p, i) => ({ id: `${recipeId}-${gi}-${i}`, ingredientId: g.ingredientId, ...p })),
      ),
      ...extra.map((ingredientId, i) => ({ id: `extra-${i}`, ingredientId, x: 40 + i * 5, y: 62 })),
    ],
    bakeResult: Math.round((recipe.bakeTarget.start + recipe.bakeTarget.end) / 2),
  };
}

function bake(state: GameState, pizza: PizzaState): GameState {
  let s = gameReducer({ ...state, phase: "PREPARE", pizza }, { type: "START_BAKE" });
  s = gameReducer(s, { type: "CONFIRM_BAKE", value: pizza.bakeResult! });
  return walkPostBakeToResult(s);
}

describe("canStartGuidedRound at every guided entry point (LK-8)", () => {
  const undiscoveredCookable = (s: GameState) =>
    RECIPES.filter((r) => recipeDiscoveryState(r, s) === "DISCOVERABLE").map((r) => r.id);

  it("the legacy Dex-15 save really holds undiscovered, fully cookable recipes (the LK-8 setup)", () => {
    expect(undiscoveredCookable(legacyDex15State()).length).toBeGreaterThanOrEqual(1);
  });

  it("SELECT_RECIPE rejects every undiscovered recipe, cookable or not, at Dex 0 and Dex 15", () => {
    for (const state of [createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS), legacyDex15State()]) {
      for (const r of RECIPES.filter((x) => !isDiscovered(state.dex, x.id))) {
        expect(gameReducer(state, { type: "SELECT_RECIPE", recipeId: r.id }), r.id).toBe(state);
      }
    }
  });

  it("BEGIN_PREPARE never starts a stale undiscovered ORDER (FREE or Lunch Rush) -- the round stays at ORDER", () => {
    const legacy = legacyDex15State();
    for (const id of undiscoveredCookable(legacy)) {
      const stale = staleOrder(legacy, id as RecipeId);
      expect(gameReducer(stale, { type: "BEGIN_PREPARE", now: 1 }), id).toBe(stale);
      const staleMission = staleOrder(legacy, id as RecipeId, true);
      expect(gameReducer(staleMission, { type: "BEGIN_PREPARE" }), id).toBe(staleMission);
    }
    const fresh = staleOrder(createInitialGameState(), "margherita"); // LK-8c: Dex 0 margherita
    expect(gameReducer(fresh, { type: "BEGIN_PREPARE" })).toBe(fresh);
  });

  it("RETRY_SAME_RECIPE (guided) never retries an undiscovered recipe (NF-4)", () => {
    const legacy = legacyDex15State();
    for (const id of undiscoveredCookable(legacy)) {
      const parked: GameState = { ...staleOrder(legacy, id as RecipeId), phase: "DISCOVERED" };
      expect(gameReducer(parked, { type: "RETRY_SAME_RECIPE", now: 1 }), id).toBe(parked);
    }
  });

  it("a discovered, cookable recipe is accepted by SELECT_RECIPE, BEGIN_PREPARE and RETRY_SAME_RECIPE", () => {
    const state = createGuidedInitialState("bismarck", { dex: discoveredDex(["margherita"]) });
    const selected = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "bismarck" });
    expect(selected.phase).toBe("PREPARE");
    expect(selected.recipe.id).toBe("bismarck");
    expect(gameReducer(state, { type: "BEGIN_PREPARE" }).phase).toBe("PREPARE");
    const retried = gameReducer({ ...selected, phase: "DISCOVERED" }, { type: "RETRY_SAME_RECIPE" });
    expect(retried.phase).toBe("PREPARE");
    expect(retried.recipe.id).toBe("bismarck");
  });

  it("a discovered recipe without enough stock is rejected everywhere (F-15: ownership is not cookability)", () => {
    const dex = discoveredDex(["margherita", "bismarck"]);
    const owned = [...STARTER_INGREDIENT_IDS, "egg"];
    const empty = createInitialGameState(dex, owned, 0, { egg: 0 });
    expect(canStartGuidedRound("bismarck", empty)).toBe(false);
    expect(gameReducer(empty, { type: "SELECT_RECIPE", recipeId: "bismarck" })).toBe(empty);
    const stale = staleOrder(empty, "bismarck");
    expect(gameReducer(stale, { type: "BEGIN_PREPARE" })).toBe(stale);
    const parked: GameState = { ...stale, phase: "DISCOVERED" };
    expect(gameReducer(parked, { type: "RETRY_SAME_RECIPE" })).toBe(parked);
    // Starters stay unlimited: margherita is always cookable once discovered.
    expect(gameReducer(empty, { type: "SELECT_RECIPE", recipeId: "margherita" }).phase).toBe("PREPARE");
  });
});

describe("FREE order pool = DISCOVERED ∩ cookable, fail closed (NF-1)", () => {
  it("legacy Dex-15 save: 200 PLAY_AGAIN orders are all discovered and cookable (was 200/200 undiscovered)", () => {
    let state = legacyDex15State();
    for (let i = 0; i < 200; i++) {
      state = gameReducer(state, { type: "PLAY_AGAIN" });
      expect(state.freeCook).toBe(false);
      expect(isDiscovered(state.dex, state.recipe.id), state.recipe.id).toBe(true);
      expect(canStartGuidedRound(state.recipe.id, state), state.recipe.id).toBe(true);
    }
  });

  it("an empty pool never falls back to every order: Dex 0 and 'nothing discovered is cookable' both give Free Cooking", () => {
    const dex0 = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS);
    // Only bismarck discovered, egg out of stock: no discovered recipe is cookable.
    const noneCookable = createInitialGameState(discoveredDex(["bismarck"]), [...STARTER_INGREDIENT_IDS, "egg"], 0, { egg: 0 });
    for (let state of [dex0, noneCookable]) {
      for (let i = 0; i < 30; i++) {
        expect(state.phase).toBe("ORDER");
        expect(state.freeCook).toBe(true);
        expect(state.recipe.id).toBe(FREE_COOK_RECIPE_ID);
        expect(state.order.id).toBe(FREE_COOK_ORDER.id);
        state = gameReducer(state, { type: "PLAY_AGAIN" });
      }
      // The Free Cooking ORDER starts normally (the one discovery path stays open).
      const prepared = gameReducer(state, { type: "BEGIN_PREPARE", now: 1 });
      expect(prepared.phase).toBe("PREPARE");
      expect(prepared.freeCook).toBe(true);
    }
  });

  it("Lunch Rush RESULT -> フリープレイへ (EXIT_TO_FREE + PLAY_AGAIN) never lands on an undiscovered order (LK-8a)", () => {
    let state = gameReducer(legacyDex15State(), { type: "MISSION_RESET_ORDER" });
    expect(state.isMissionRound).toBe(true);
    for (let i = 0; i < 100; i++) {
      const free = gameReducer({ ...state, phase: "RESULT" }, { type: "PLAY_AGAIN" });
      expect(free.isMissionRound).toBe(false);
      expect(isDiscovered(free.dex, free.recipe.id), free.recipe.id).toBe(true);
      const prepared = gameReducer(free, { type: "BEGIN_PREPARE", now: 1 });
      expect(isDiscovered(prepared.dex, prepared.recipe.id)).toBe(true);
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    }
  });

  it("HOME during Lunch Rush (PLAY_AGAIN mid-PREPARE) leaves only a discovered or Free Cooking order (LK-8b)", () => {
    for (const base of [legacyDex15State(), createInitialGameState(discoveredDex(["margherita"]))]) {
      let state = gameReducer(base, { type: "MISSION_RESET_ORDER" });
      state = gameReducer(state, { type: "BEGIN_PREPARE" });
      expect(state.phase).toBe("PREPARE");
      for (let i = 0; i < 50; i++) {
        const home = gameReducer(state, { type: "PLAY_AGAIN" });
        // Closing the Lunch Rush intro afterwards only flips the mission mode (EXIT_TO_FREE) --
        // this ORDER is what GAME would show.
        expect(home.freeCook || isDiscovered(home.dex, home.recipe.id), home.recipe.id).toBe(true);
        const begun = gameReducer(home, { type: "BEGIN_PREPARE" });
        expect(begun.freeCook || isDiscovered(begun.dex, begun.recipe.id)).toBe(true);
      }
    }
  });
});

describe("matcher-only NEW discovery", () => {
  it("a guided round of an undiscovered recipe (injected past every guard) never registers that recipe by its id", () => {
    // Bismarck + mushroom is not any recipe's exact set: the matcher says ORIGINAL.
    const state = staleOrder(createInitialGameState(discoveredDex(["margherita"]), [...STARTER_INGREDIENT_IDS, "egg", "mushroom"], 0, { egg: 9, mushroom: 9 }), "bismarck");
    const result = bake(state, idealPizzaFor("bismarck", ["mushroom", "mushroom"]));
    expect(result.completion?.status).toBe("PASS");
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(getDexEntry(after.dex, "bismarck")).toBeUndefined();
    expect(after.justDiscovered).toBe(false);
    expect(after.lastDiscovery).toEqual({ kind: "ORIGINAL", blockedTargetIds: [] });
  });

  it("Lunch Rush (MISSION_NEXT_ORDER) never discovers either", () => {
    const state = staleOrder(createInitialGameState(discoveredDex(["margherita"]), [...STARTER_INGREDIENT_IDS, "egg"], 0, { egg: 9 }), "bismarck", true);
    const result = bake(state, idealPizzaFor("bismarck"));
    const next = gameReducer(result, { type: "MISSION_NEXT_ORDER" });
    expect(getDexEntry(next.dex, "bismarck")).toBeUndefined();
  });

  it("the Free Cooking matcher still discovers normally (and a discovered recipe re-registers normally)", () => {
    const start = gameReducer(
      createInitialGameState(discoveredDex(["margherita"]), [...STARTER_INGREDIENT_IDS, "egg"], 0, { egg: 9 }),
      { type: "START_FREE_COOK", now: 1 },
    );
    const result = bake(start, idealPizzaFor("bismarck"));
    expect(result.recipe.id).toBe("bismarck");
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(isDiscovered(after.dex, "bismarck")).toBe(true);
    expect(after.justDiscovered).toBe(true);
    expect(after.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "bismarck" });

    const guided = bake(createGuidedInitialState("bismarck", { dex: after.dex }), idealPizzaFor("bismarck"));
    const again = gameReducer(guided, { type: "REGISTER_TO_DEX" });
    expect(getDexEntry(again.dex, "bismarck")?.timesMade).toBe(getDexEntry(after.dex, "bismarck")!.timesMade + 1);
    expect(again.justDiscovered).toBe(false);
  });
});

describe("existing saves stay compatible", () => {
  it("a legacy Dex-15 save hydrates to a discovered order with its Dex / ownership / stock / ledger untouched", () => {
    const state = legacyDex15State();
    expect(state.phase).toBe("ORDER");
    expect(isDiscovered(state.dex, state.recipe.id)).toBe(true);
    expect(state.dex.filter((e) => e.discovered)).toHaveLength(15);
    const discovered: DexState = discoveredDex(OLD15);
    expect(state.dex).toEqual(discovered);
  });
});
