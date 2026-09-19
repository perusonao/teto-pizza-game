import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState, type MakingStep } from "./gameReducer";
import { registerScoreToDex, EMPTY_DEX, type DexState } from "./dex";
import type { ScoreBreakdown, QualityStars } from "../logic/scoring";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { EMPTY_MISSION_METRICS, recordServe } from "../logic/missionScoring";
import { EMPTY_INVENTORY, type InventoryState } from "./inventory";

function scoreOf(total: number, stars: QualityStars): ScoreBreakdown {
  return {
    matchScore: total,
    ingredientScore: total,
    placementScore: total,
    bakeScore: total,
    total,
    stars,
  };
}

/** Builds a Dex where `recipeIds` are discovered at `stars` each -- a shorthand for
 *  simulating "played through the Chapter 1 chain up to here" (Economy & Progression 1.0
 *  EP1's recipe-unlock gate, src/state/progression.ts's `recipeUnlocked`). */
function dexDiscovering(recipeIds: readonly string[], stars: QualityStars): DexState {
  let dex: DexState = EMPTY_DEX;
  for (const recipeId of recipeIds) {
    dex = registerScoreToDex(dex, recipeId, scoreOf(stars * 20, stars)).dex;
  }
  return dex;
}

/** Dex with every recipe in the Chapter 1 chain already discovered at ★2 (10 totalStars for 5
 *  recipes before quattro-formaggi/fugazza, satisfying both stars gates) -- used by tests that
 *  need every recipe unlocked (EP1's recipe-unlock axis) so they can focus on a different
 *  concern (order rotation, ingredient-ownership gating, ...). */
const ALL_RECIPES_UNLOCKED_DEX: DexState = dexDiscovering(
  ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
  3 as QualityStars,
);

/** Plays through PREPARE -> BAKE -> RESULT for the initial (Margherita) order, placing every
 *  required ingredient so the round scores well, then confirms the bake at `bakeValue`. */
function playToResult(bakeValue: number): GameState {
  let state = createInitialGameState();
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
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue });
  return state;
}

describe("REGISTER_TO_DEX (reducer)", () => {
  it("registers a first-ever result into the Dex with the round's score as BEST", () => {
    const resultState = playToResult(70); // 60-80 is Margherita's perfect zone
    expect(resultState.phase).toBe("RESULT");
    expect(resultState.score).not.toBeNull();

    const after = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("DISCOVERED");
    expect(after.justDiscovered).toBe(true);
    expect(after.justGotNewBest).toBe(true);

    const entry = after.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.timesMade).toBe(1);
    expect(entry?.bestScore).toBe(resultState.score?.total);
    expect(entry?.bestStars).toBe(resultState.score?.stars);
  });

  it("registers the round into the Dex exactly once, even if dispatched twice", () => {
    const resultState = playToResult(70);
    const afterFirst = gameReducer(resultState, { type: "REGISTER_TO_DEX" });

    // A stray/repeated dispatch after the phase has already moved on must be a no-op —
    // this is the atomicity guarantee: one round can never double-count into the Dex.
    const afterSecond = gameReducer(afterFirst, { type: "REGISTER_TO_DEX" });
    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.dex.find((e) => e.recipeId === "margherita")?.timesMade).toBe(1);
  });

  it("is a no-op when dispatched outside of RESULT (e.g. before any bake)", () => {
    const orderState = createInitialGameState();
    const after = gameReducer(orderState, { type: "REGISTER_TO_DEX" });
    expect(after).toBe(orderState);
  });
});

describe("createInitialGameState hydration", () => {
  it("always starts at ORDER, with no dex, when given no saved progression", () => {
    const state = createInitialGameState();
    expect(state.phase).toBe("ORDER");
    expect(state.dex).toEqual(EMPTY_DEX);
  });

  it("starts at ORDER even when hydrated with a non-empty Dex (round in progress never persists)", () => {
    const { dex } = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(91, 5));
    const state = createInitialGameState(dex);
    expect(state.phase).toBe("ORDER");
  });

  it("carries a loaded Dex's BEST and timesMade into the hydrated state", () => {
    let dex = EMPTY_DEX;
    dex = registerScoreToDex(dex, "margherita", scoreOf(72, 3)).dex;
    dex = registerScoreToDex(dex, "margherita", scoreOf(91, 5)).dex;

    const state = createInitialGameState(dex);
    const entry = state.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.bestScore).toBe(91);
    expect(entry?.bestStars).toBe(5);
    expect(entry?.timesMade).toBe(2);
  });

  it("defaults ownedIngredientIds to the full Starter Set when none is given", () => {
    const state = createInitialGameState();
    expect([...state.ownedIngredientIds].sort()).toEqual([...STARTER_INGREDIENT_IDS].sort());
  });

  it("carries a hydrated ownedIngredientIds through into the initial state", () => {
    const owned = ["tomato-sauce", "mozzarella"];
    const state = createInitialGameState(EMPTY_DEX, owned);
    expect(state.ownedIngredientIds).toEqual(owned);
  });

  it("defaults pitzBalance to 0 when none is given", () => {
    const state = createInitialGameState();
    expect(state.pitzBalance).toBe(0);
  });

  it("carries a hydrated pitzBalance through into the initial state", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 120);
    expect(state.pitzBalance).toBe(120);
  });

  it("starts with no claimed Mission run", () => {
    const state = createInitialGameState();
    expect(state.lastClaimedMissionRunId).toBeNull();
  });
});

describe("pitzBalance carry-over (Phase 3C-5)", () => {
  it("PLAY_AGAIN carries pitzBalance forward unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 75);
    state = gameReducer(state, { type: "PLAY_AGAIN" });
    expect(state.pitzBalance).toBe(75);
  });

  it("MISSION_RESET_ORDER carries pitzBalance forward unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 75);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(state.pitzBalance).toBe(75);
  });

  it("MISSION_NEXT_ORDER carries pitzBalance forward unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 75);
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    state = gameReducer(state, { type: "MISSION_NEXT_ORDER" });
    expect(state.pitzBalance).toBe(75);
  });
});

describe("PURCHASE_INGREDIENT (reducer)", () => {
  // Production does have one purchasable ingredient since Phase 3C-6 (`onion`, gating the
  // `fugazza` recipe), but this describe block still uses a mock ingredient for its own
  // reducer-wiring tests below -- the pure `purchaseIngredient` function's own tests
  // (src/logic/economy.test.ts) and the purchase -> OWNED -> recipe-available integration
  // tests (src/state/progression.test.ts) already cover the real `onion` data directly, so
  // these tests only need to cover this reducer's own wiring/guards in isolation.

  it("purchasing an already-OWNED (starter) ingredient is a complete no-op", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 500);
    const after = gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "tomato-sauce" });
    expect(after).toBe(state);
  });

  it("purchasing an unknown ingredient id is a no-op and never throws", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 500);
    expect(() =>
      gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "not-a-real-ingredient" }),
    ).not.toThrow();
    const after = gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "not-a-real-ingredient" });
    expect(after).toBe(state);
  });

  it("a no-op purchase never changes pitzBalance or ownedIngredientIds", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 500);
    const after = gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "mozzarella" });
    expect(after.pitzBalance).toBe(500);
    expect(after.ownedIngredientIds).toEqual(state.ownedIngredientIds);
  });
});

describe("SELECT_RECIPE (Issue #39 Pizza Select)", () => {
  // Issue #47 Finding C: Pizza Select already made the recipe choice explicit, so SELECT_RECIPE
  // now lands straight at PREPARE, skipping the old, redundant FREE-mode ORDER gate.
  // bismarck needs margherita->funghi->marinara discovered first (Economy & Progression 1.0
  // EP1's recipe-unlock chain), so these tests seed a Dex with that chain already discovered.
  const bismarckUnlockedDex = dexDiscovering(["margherita", "funghi", "marinara"], 1 as QualityStars);

  it("starts a fresh PREPARE-phase round for the explicitly chosen, available recipe", () => {
    const state = createInitialGameState(bismarckUnlockedDex, STARTER_INGREDIENT_IDS, 75);
    const after = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "bismarck" });
    expect(after.recipe.id).toBe("bismarck");
    expect(after.order.recipeId).toBe("bismarck");
    expect(after.phase).toBe("PREPARE");
    expect(after.pizza.toppings).toHaveLength(0);
    // Issue #33 D1: a fresh round now starts at DOUGH, the new first step.
    expect(after.makingStep).toBe("DOUGH");
    expect(after.isMissionRound).toBe(false);
    expect(after.hint).not.toBeNull();
  });

  it("carries dex/pitzBalance/ownedIngredientIds forward unchanged", () => {
    const state = createInitialGameState(bismarckUnlockedDex, STARTER_INGREDIENT_IDS, 75);
    const after = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "bismarck" });
    expect(after.dex).toBe(bismarckUnlockedDex);
    expect(after.pitzBalance).toBe(75);
    expect(after.ownedIngredientIds).toEqual(STARTER_INGREDIENT_IDS);
  });

  it("rebuilds a fresh round even mid-PREPARE/RESULT of a different recipe", () => {
    let state = createInitialGameState(bismarckUnlockedDex, STARTER_INGREDIENT_IDS, 0);
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    const after = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "bismarck" });
    expect(after.recipe.id).toBe("bismarck");
    expect(after.phase).toBe("PREPARE");
    expect(after.pizza.sauceIds).toHaveLength(0);
  });

  it("rejects a recipe whose EP1 recipe-unlock chain isn't discovered yet and returns state unchanged", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
    const after = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "bismarck" });
    expect(after).toBe(state);
  });

  it("rejects a locked recipe (fugazza before onion is owned) even once its recipe-unlock chain/stars gate is satisfied", () => {
    const chainDex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const state = createInitialGameState(chainDex, STARTER_INGREDIENT_IDS, 0);
    const after = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "fugazza" });
    expect(after).toBe(state);
  });

  it("selects fugazza once both its recipe-unlock chain/stars gate and onion ownership hold", () => {
    const chainDex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const ownedWithOnion = [...STARTER_INGREDIENT_IDS, "onion"];
    const state = createInitialGameState(chainDex, ownedWithOnion, 0);
    const after = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "fugazza" });
    expect(after.recipe.id).toBe("fugazza");
    expect(after.phase).toBe("PREPARE");
  });

  it("never touches Mission's own random order selection", () => {
    let state = createInitialGameState(bismarckUnlockedDex, STARTER_INGREDIENT_IDS, 0);
    const before = state;
    state = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "bismarck" });
    // Mission's own order picker still works after a SELECT_RECIPE dispatch -- selecting a
    // recipe for FREE never mutates or bypasses pickMissionOrder/getNextOrder.
    const missionState = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(missionState.isMissionRound).toBe(true);
    expect(before.recipe.id).toBe("margherita");
  });
});

describe("RETRY_SAME_RECIPE (Issue #47 Finding D)", () => {
  it("retries the exact same recipe just played, landing straight at PREPARE with a fresh pizza", () => {
    const discovered = gameReducer(playToResult(70), { type: "REGISTER_TO_DEX" });
    expect(discovered.phase).toBe("DISCOVERED");
    expect(discovered.recipe.id).toBe("margherita");

    const retried = gameReducer(discovered, { type: "RETRY_SAME_RECIPE" });
    expect(retried.recipe.id).toBe("margherita");
    expect(retried.order.recipeId).toBe("margherita");
    expect(retried.phase).toBe("PREPARE");
    // Issue #33 D1: a fresh round now starts at DOUGH, the new first step.
    expect(retried.makingStep).toBe("DOUGH");
    expect(retried.pizza.sauceIds).toHaveLength(0);
    expect(retried.pizza.toppings).toHaveLength(0);
    expect(retried.score).toBeNull();
    expect(retried.bakeState).toBeNull();
    expect(retried.hint).not.toBeNull();
  });

  it("never falls back to a different recipe (unlike PLAY_AGAIN's excludeRecipeId)", () => {
    // A fresh save only owns the Starter Set, so margherita/marinara/genovese are the only
    // available recipes -- run RETRY_SAME_RECIPE many times and confirm it never drifts off
    // the current recipe the way PLAY_AGAIN's random selection would.
    let state = gameReducer(playToResult(70), { type: "REGISTER_TO_DEX" });
    for (let i = 0; i < 10; i++) {
      state = gameReducer(state, { type: "RETRY_SAME_RECIPE" });
      expect(state.recipe.id).toBe("margherita");
    }
  });

  it("preserves dex/pitzBalance/ownedIngredientIds (progression) unchanged", () => {
    const dex = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(96, 5)).dex;
    const seeded: GameState = {
      ...gameReducer(playToResult(70), { type: "REGISTER_TO_DEX" }),
      dex,
      pitzBalance: 75,
      ownedIngredientIds: STARTER_INGREDIENT_IDS,
    };
    const retried = gameReducer(seeded, { type: "RETRY_SAME_RECIPE" });
    expect(retried.dex).toBe(dex);
    expect(retried.pitzBalance).toBe(75);
    expect(retried.ownedIngredientIds).toEqual(STARTER_INGREDIENT_IDS);
  });
});

// Codex review follow-up (PR #20, P2, originally filed against the salami/salami-pizza draft
// but the underlying gap applies equally to onion): IngredientTray only ever *offers* owned
// ingredients (src/components/IngredientTray.tsx filters by `ownedIngredientIds`), but until
// this fix APPLY_SAUCE/PLACE_TOPPING themselves had no ownership check at all -- a LOCKED or
// AVAILABLE_TO_BUY (not yet purchased) ingredient id reaching the reducer by any other path (a
// stray dispatch, a future UI bug, a devtools call) would have been silently accepted and
// placed on the pizza. These tests dispatch directly against the reducer, bypassing the UI
// entirely, to prove the action boundary itself now rejects an unowned ingredient -- not just
// that the tray happens to hide it.
describe("Ownership boundary on APPLY_SAUCE/PLACE_TOPPING (Phase 3C-6 follow-up)", () => {
  // Issue #32 Phase 2: onion is a "topping"-category ingredient, so exercising its ownership
  // gate now also requires the making flow to have reached the TOPPING step -- advance via
  // the same CONFIRM_MAKING_STEP a real player's "次へ"/焼く！ taps would dispatch, never by
  // constructing `makingStep` by hand.
  function preparedState(
    ownedIngredientIds: readonly string[],
    dex = EMPTY_DEX,
    makingStep: MakingStep = "SAUCE",
    inventory: InventoryState = EMPTY_INVENTORY,
  ): GameState {
    let state = gameReducer(createInitialGameState(dex, ownedIngredientIds, 0, inventory), {
      type: "BEGIN_PREPARE",
    });
    while (state.makingStep !== makingStep) {
      state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    }
    return state;
  }

  it("PLACE_TOPPING is a complete no-op for onion while LOCKED (fresh save, 0 totalStars)", () => {
    const state = preparedState(STARTER_INGREDIENT_IDS, EMPTY_DEX, "TOPPING");
    const after = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(after).toBe(state);
    expect(after.pizza.toppings).toHaveLength(0);
  });

  it("PLACE_TOPPING is still a no-op for onion once AVAILABLE_TO_BUY but not yet purchased", () => {
    // totalStars = 15 (>= onion's minTotalStars of 12) via 3 discovered Starter recipes, but
    // onion itself is not in ownedIngredientIds -- AVAILABLE_TO_BUY, not OWNED.
    const dex = [
      { recipeId: "margherita", discovered: true, bestScore: 95, bestStars: 5 as const, timesMade: 1 },
      { recipeId: "marinara", discovered: true, bestScore: 95, bestStars: 5 as const, timesMade: 1 },
      { recipeId: "genovese", discovered: true, bestScore: 95, bestStars: 5 as const, timesMade: 1 },
    ];
    const state = preparedState(STARTER_INGREDIENT_IDS, dex, "TOPPING");
    const after = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(after).toBe(state);
    expect(after.pizza.toppings).toHaveLength(0);
  });

  it("PLACE_TOPPING succeeds for onion once it is OWNED and has stock (Economy & Progression 1.0 EP3 Stock Gate)", () => {
    // EP3: ownership alone is no longer sufficient for a finite ingredient -- onion also needs
    // remaining stock (`inventory.onion > 0`), exactly like every other finite ingredient's
    // placement gate below. This test seeds a nonzero stock so it keeps testing what it always
    // tested (the *ownership* boundary), not a stock boundary covered separately in
    // gameReducer.restock.test.ts.
    const state = preparedState([...STARTER_INGREDIENT_IDS, "onion"], EMPTY_DEX, "TOPPING", { onion: 1 });
    const after = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(after.pizza.toppings).toHaveLength(1);
    expect(after.pizza.toppings[0].ingredientId).toBe("onion");
  });

  it("APPLY_SAUCE is a complete no-op for an unowned ingredient (direct reducer attempt)", () => {
    // No production sauce is ever unowned today (all 3 are Starter Set) -- this constructs
    // that situation directly against the reducer to prove the guard itself, independent of
    // whether the UI could ever produce it.
    const owned = STARTER_INGREDIENT_IDS.filter((id) => id !== "olive-oil");
    const state = preparedState(owned);
    const after = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "olive-oil", x: 50, y: 50 });
    expect(after).toBe(state);
    expect(after.pizza.sauceIds).toEqual([]);
  });

  it("Starter ingredients remain placeable (regression)", () => {
    const state = preparedState(STARTER_INGREDIENT_IDS);
    const withSauce = gameReducer(state, {
      type: "APPLY_SAUCE",
      ingredientId: "tomato-sauce",
      x: 50,
      y: 50,
    });
    const atCheese = gameReducer(withSauce, { type: "CONFIRM_MAKING_STEP" });
    const withTopping = gameReducer(atCheese, {
      type: "PLACE_TOPPING",
      ingredientId: "mozzarella",
      x: 40,
      y: 50,
    });
    expect(withSauce.pizza.sauceIds).toEqual(["tomato-sauce"]);
    expect(withTopping.pizza.toppings).toHaveLength(1);
    expect(withTopping.pizza.toppings[0].ingredientId).toBe("mozzarella");
  });

  it("FREE and Mission share the same ownership rule (both go through this same reducer)", () => {
    // MISSION_RESET_ORDER builds its ORDER-phase state through the exact same buildOrderState
    // path as free play (see gameReducer.ts's top comment) -- there is no separate Mission
    // round state, so a PLACE_TOPPING dispatched mid-Mission is guarded identically.
    const missionState = gameReducer(
      preparedState(STARTER_INGREDIENT_IDS),
      { type: "MISSION_RESET_ORDER" },
    );
    const prepared = gameReducer(missionState, { type: "BEGIN_PREPARE" });
    const after = gameReducer(prepared, { type: "PLACE_TOPPING", ingredientId: "onion", x: 50, y: 50 });
    expect(after.pizza.toppings).toHaveLength(0);
  });
});

describe("CLAIM_MISSION_REWARD (reducer, Phase 3C-5)", () => {
  it("adds the reward amount to pitzBalance and records the claimed runId", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 100);
    const after = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(after.pitzBalance).toBe(180);
    expect(after.lastClaimedMissionRunId).toBe(1);
  });

  it("granting the same runId a second time is a complete no-op (no double grant)", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 100);
    const first = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    const second = gameReducer(first, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(second).toBe(first);
    expect(second.pitzBalance).toBe(180);
  });

  it("granting the same runId many times (simulating rerenders/StrictMode) never compounds", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
    for (let i = 0; i < 10; i++) {
      state = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 5, amount: 90 });
    }
    expect(state.pitzBalance).toBe(90);
  });

  it("a retry (fresh runId) after a claimed run grants a new reward on top of the previous one", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
    state = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(state.pitzBalance).toBe(80);
    // Retrying re-dispatches the *previous* run's id once more before the new run's own claim
    // fires (mirrors the shape of App.tsx's granting effect across a retry) -- must still be a
    // no-op even interleaved with the new run's claim.
    state = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(state.pitzBalance).toBe(80);
    state = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 2, amount: 60 });
    expect(state.pitzBalance).toBe(140);
    expect(state.lastClaimedMissionRunId).toBe(2);
  });

  it("a 0-amount grant still records the runId as claimed (so a later duplicate dispatch is a no-op)", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
    const after = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 0 });
    expect(after.pitzBalance).toBe(0);
    expect(after.lastClaimedMissionRunId).toBe(1);
  });

  it("never applies a negative amount even if one is somehow dispatched", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 100);
    const after = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: -50 });
    expect(after.pitzBalance).toBe(100);
  });

  it("claiming a reward never touches Dex or ownedIngredientIds", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
    const after = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(after.dex).toEqual(state.dex);
    expect(after.ownedIngredientIds).toEqual(state.ownedIngredientIds);
  });
});

describe("order selection availability (Phase 3C-3)", () => {
  it("all 6 Chapter 1 recipes remain reachable when every starter ingredient is owned and their EP1 recipe-unlock chain is already discovered", () => {
    const seen = new Set<string>();
    let state = createInitialGameState(ALL_RECIPES_UNLOCKED_DEX, STARTER_INGREDIENT_IDS);
    for (let i = 0; i < 60 && seen.size < 6; i++) {
      seen.add(state.recipe.id);
      state = gameReducer(state, { type: "PLAY_AGAIN" });
    }
    expect(seen.size).toBe(6);
  });

  it("only margherita is reachable on a fresh save (empty Dex), regardless of ingredient ownership (Economy & Progression 1.0 EP1)", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS);
    for (let i = 0; i < 20; i++) {
      expect(state.recipe.id).toBe("margherita");
      state = gameReducer(state, { type: "PLAY_AGAIN" });
    }
  });

  it("never selects a recipe whose required ingredients are not owned", () => {
    // Only margherita's ingredients are owned -- every other recipe needs an ingredient
    // this list doesn't have (mozzarella-only recipes still need their own extra
    // ingredient, e.g. marinara needs garlic/oregano instead of mozzarella at all).
    const marginallyOwned = ["tomato-sauce", "mozzarella", "basil"];
    let state = createInitialGameState(EMPTY_DEX, marginallyOwned);
    for (let i = 0; i < 30; i++) {
      expect(state.recipe.id).toBe("margherita");
      state = gameReducer(state, { type: "PLAY_AGAIN" });
    }
  });

  it("carries ownedIngredientIds forward across PLAY_AGAIN", () => {
    const owned = ["tomato-sauce", "mozzarella", "basil"];
    let state = createInitialGameState(EMPTY_DEX, owned);
    state = gameReducer(state, { type: "PLAY_AGAIN" });
    expect(state.ownedIngredientIds).toEqual(owned);
  });
});

describe("Mission order actions (Phase 3C-4)", () => {
  it("MISSION_RESET_ORDER picks a fresh available-pool order from any phase, including PREPARE/BAKE mid-round", () => {
    let state = createInitialGameState();
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    expect(state.phase).toBe("PREPARE");

    const reset = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(reset.phase).toBe("ORDER");
    expect(reset.pizza.toppings).toEqual([]);
    expect(reset.pizza.sauceIds).toEqual([]);
  });

  it("MISSION_RESET_ORDER never repeats the just-active recipe when another is available", () => {
    const owned = ["tomato-sauce", "mozzarella", "basil", "garlic", "oregano"]; // margherita + marinara
    // marinara needs funghi discovered first (Economy & Progression 1.0 EP1 chain) --
    // margherita/funghi discovered so both margherita and marinara are unlocked recipes.
    const dex = dexDiscovering(["margherita", "funghi"], 1 as QualityStars);
    let state = createInitialGameState(dex, owned);
    for (let i = 0; i < 30; i++) {
      const before = state.recipe.id;
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
      expect(state.recipe.id).not.toBe(before);
    }
  });

  it("MISSION_RESET_ORDER only ever selects a recipe from the currently-owned/available pool", () => {
    const marginallyOwned = ["tomato-sauce", "mozzarella", "basil"]; // margherita only
    let state = createInitialGameState(EMPTY_DEX, marginallyOwned);
    for (let i = 0; i < 20; i++) {
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
      expect(state.recipe.id).toBe("margherita");
    }
  });

  it("MISSION_NEXT_ORDER is a no-op outside of RESULT (mirrors REGISTER_TO_DEX's atomicity guard)", () => {
    const orderState = createInitialGameState();
    expect(gameReducer(orderState, { type: "MISSION_NEXT_ORDER" })).toBe(orderState);
  });

  it("MISSION_NEXT_ORDER registers the round to the Dex (discovery, BEST, timesMade) and advances straight to a fresh ORDER, skipping DISCOVERED", () => {
    const resultState = playToResult(70); // Margherita's perfect zone is 60-80
    expect(resultState.phase).toBe("RESULT");

    const next = gameReducer(resultState, { type: "MISSION_NEXT_ORDER" });
    expect(next.phase).toBe("ORDER"); // never DISCOVERED during Mission

    const entry = next.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.discovered).toBe(true);
    expect(entry?.timesMade).toBe(1);
    expect(entry?.bestScore).toBe(resultState.score?.total);
    expect(entry?.bestStars).toBe(resultState.score?.stars);
  });

  it("MISSION_NEXT_ORDER updates Dex BEST on a repeat play the same way REGISTER_TO_DEX does", () => {
    let state = playToResult(70);
    state = gameReducer(state, { type: "MISSION_NEXT_ORDER" }); // first margherita registered, BEST set

    // Force the Mission loop back onto margherita specifically (MISSION_NEXT_ORDER's own
    // rotation may have picked a different recipe) by forcing a fresh order until it lands on
    // margherita again, then play it through exactly like `playToResult` does.
    for (let i = 0; i < 30 && state.recipe.id !== "margherita"; i++) {
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    }
    expect(state.recipe.id).toBe("margherita");

    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 65 }); // still in the perfect zone
    expect(state.phase).toBe("RESULT");

    const beforeEntry = state.dex.find((e) => e.recipeId === "margherita");
    expect(beforeEntry?.timesMade).toBe(1);

    const after = gameReducer(state, { type: "MISSION_NEXT_ORDER" });
    const afterEntry = after.dex.find((e) => e.recipeId === "margherita");
    expect(afterEntry?.timesMade).toBe(2);
  });

  it("MISSION_NEXT_ORDER registers exactly once even if dispatched twice in a row", () => {
    const resultState = playToResult(70);
    const first = gameReducer(resultState, { type: "MISSION_NEXT_ORDER" });
    // The phase has already moved to ORDER, so a stray repeat must be a true no-op (ORDER has
    // no `score`, which is exactly the guard MISSION_NEXT_ORDER shares with REGISTER_TO_DEX).
    const second = gameReducer(first, { type: "MISSION_NEXT_ORDER" });
    expect(second).toBe(first);
  });
});

/**
 * Phase 4A-2 Scoring 2.0 -> A1 Authority Cutover: P0-2 (canonical CONFIRM_BAKE computation,
 * shared by FREE and Lunch Rush) still holds unchanged, but the authority boundary itself
 * flipped in A1 (docs/reports/TETO_SCORING2-A1_AUTHORITY_Result.md): `state.score` is now
 * Scoring 2.0-derived (via `toLegacyScoreBreakdown`), not legacy `scorePizza`'s own output.
 * See ../logic/scoringV2/scoringV2.test.ts for the scoring module's own unit tests (tolerance
 * validation, component formulas, golden ordering) and ./gameReducer.scoringV2Authority.test.ts
 * for the full 7-recipe authority regression matrix -- these tests are specifically about when
 * and from what `scoringV2Result` itself is computed, and (post-A1) that `state.score` really
 * is derived from it, not independently.
 */
describe("Phase 4A-2 Scoring 2.0 / A1 Authority Cutover (gameReducer integration)", () => {
  const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

  /** PREPARE -> BAKE -> RESULT for Margherita, committing a Reference-like sauce dispense
   *  (not the legacy one-shot APPLY_SAUCE `playToResult` above uses, which never populates
   *  `sauceDeposits` -- COMMIT_SAUCE_DISPENSE is the real PAINT-profile path PizzaStage.tsx
   *  actually dispatches) and Reference-exact piece placements, so the resulting Scoring 2.0
   *  score is meaningfully high rather than the near-zero an empty sauceDeposits log would
   *  produce. */
  function playMargheritaToResultWithShadowSauce(bakeValue: number): GameState {
    let state = createInitialGameState(); // preferFirst -> margherita
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    state = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: buildIdealMargheritaSauceFixture(),
    });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
    for (const p of MOZZARELLA_GROUP.positions) {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
    }
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
    for (const p of BASIL_GROUP.positions) {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
    }
    state = gameReducer(state, { type: "START_BAKE" });
    return gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue });
  }

  it("scoringV2Result is null before the first CONFIRM_BAKE of a round (ORDER/PREPARE/BAKE)", () => {
    let state = createInitialGameState();
    expect(state.scoringV2Result).toBeNull();
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    expect(state.scoringV2Result).toBeNull();
    state = gameReducer(state, { type: "START_BAKE" });
    expect(state.scoringV2Result).toBeNull();
  });

  it("FREE: CONFIRM_BAKE computes an available Scoring 2.0 result from the canonical, just-committed sauce/pieces (P0-2)", () => {
    const state = playMargheritaToResultWithShadowSauce(70);
    expect(state.phase).toBe("RESULT");
    expect(state.scoringV2Result).not.toBeNull();
    expect(state.scoringV2Result?.available).toBe(true);
    expect(state.scoringV2Result?.totalScore).not.toBeNull();
    expect(state.scoringV2Result?.totalScore as number).toBeGreaterThan(90);
  });

  it("scoringV2Result resets to null for a fresh round (PLAY_AGAIN) -- a stale previous round's result can never leak into the next one", () => {
    const resultState = playMargheritaToResultWithShadowSauce(70);
    expect(resultState.scoringV2Result).not.toBeNull();
    const fresh = gameReducer(resultState, { type: "PLAY_AGAIN" });
    expect(fresh.scoringV2Result).toBeNull();
  });

  it("Lunch Rush: CONFIRM_BAKE computes the Scoring 2.0 result from that exact mission pizza's canonical bake state (P0-2, same reducer path as FREE)", () => {
    const marginallyOwned = ["tomato-sauce", "mozzarella", "basil"]; // margherita is the only available recipe
    let state = createInitialGameState(EMPTY_DEX, marginallyOwned);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(state.recipe.id).toBe("margherita");
    expect(state.isMissionRound).toBe(true);

    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    state = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: buildIdealMargheritaSauceFixture(),
    });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
    for (const p of MOZZARELLA_GROUP.positions) {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
    }
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
    for (const p of BASIL_GROUP.positions) {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
    }
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });

    expect(state.phase).toBe("RESULT");
    expect(state.isMissionRound).toBe(true);
    expect(state.scoringV2Result).not.toBeNull();
    expect(state.scoringV2Result?.available).toBe(true);
    expect(state.scoringV2Result?.totalScore as number).toBeGreaterThan(90);
  });

  it("A1: Dex BEST/timesMade registration is driven by state.score, which now *is* scoringV2Result.totalScore", () => {
    const state = playMargheritaToResultWithShadowSauce(70);
    const after = gameReducer(state, { type: "REGISTER_TO_DEX" });
    const entry = after.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.bestScore).toBe(state.score?.total);
    expect(entry?.bestStars).toBe(state.score?.stars);
    // Post-cutover, state.score.total IS Scoring 2.0's own total (via the adapter) -- this is
    // the authority boundary this cutover exists to flip, re-asserted here rather than just in
    // ./gameReducer.scoringV2Authority.test.ts's own dedicated suite.
    expect(entry?.bestScore).toBe(state.scoringV2Result?.totalScore);
  });

  it("A1: Mission serve/reward metrics are driven by state.score.total, which now *is* scoringV2Result.totalScore", () => {
    const state = playMargheritaToResultWithShadowSauce(70);
    const metrics = recordServe(EMPTY_MISSION_METRICS, state.score!.total);
    expect(metrics.totalQualityScore).toBe(state.score!.total);
    expect(metrics.totalQualityScore).toBe(state.scoringV2Result?.totalScore);
  });
});

/** Save v2 / Inventory E1: `inventory` carry-through across every "start a new round"/round-
 *  machinery path, mirroring this file's own existing `ownedIngredientIds`/`pitzBalance`
 *  carry-through tests 1:1 (see docs/reports/TETO_INVENTORY-E1_Implementation-Preflight.md
 *  section 6/12). `inventory` itself is never mutated by any reducer case in E1 -- these tests
 *  confirm every path threads the same value through unchanged, never resetting it to
 *  `EMPTY_INVENTORY`/`undefined`. */
describe("inventory carry-through (Save v2 / Inventory E1)", () => {
  const seededInventory: InventoryState = { onion: 3 };

  /** Same shape as this file's own `playToResult`, but seeded with an explicit inventory and
   *  owned-ingredient set so MISSION_NEXT_ORDER (fugazza-eligible) and FREE flows can both
   *  reuse it. */
  function playToResultWithInventory(
    inventory: InventoryState,
    ownedIngredientIds: readonly string[] = STARTER_INGREDIENT_IDS,
    bakeValue = 70,
  ): GameState {
    let state = createInitialGameState(EMPTY_DEX, ownedIngredientIds, 0, inventory);
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
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue });
    return state;
  }

  it("createInitialGameState defaults inventory to EMPTY_INVENTORY when none is given", () => {
    const state = createInitialGameState();
    expect(state.inventory).toEqual(EMPTY_INVENTORY);
  });

  it("carries a hydrated inventory through into the initial state", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0, seededInventory);
    expect(state.inventory).toEqual(seededInventory);
  });

  it("a normal in-round action (CONFIRM_MAKING_STEP) carries inventory through unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0, seededInventory);
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    expect(state.inventory).toEqual(seededInventory);
  });

  it("BAKE/RESULT (CONFIRM_BAKE) carries inventory through unchanged", () => {
    const state = playToResultWithInventory(seededInventory);
    expect(state.phase).toBe("RESULT");
    expect(state.inventory).toEqual(seededInventory);
  });

  it("REGISTER_TO_DEX / DISCOVERED carries inventory through unchanged", () => {
    const resultState = playToResultWithInventory(seededInventory);
    const discovered = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    expect(discovered.phase).toBe("DISCOVERED");
    expect(discovered.inventory).toEqual(seededInventory);
  });

  it("FREE retry (RETRY_SAME_RECIPE) carries inventory through unchanged", () => {
    const discovered = gameReducer(playToResultWithInventory(seededInventory), {
      type: "REGISTER_TO_DEX",
    });
    const retried = gameReducer(discovered, { type: "RETRY_SAME_RECIPE" });
    expect(retried.phase).toBe("PREPARE");
    expect(retried.inventory).toEqual(seededInventory);
  });

  it("PLAY_AGAIN carries inventory through unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0, seededInventory);
    state = gameReducer(state, { type: "PLAY_AGAIN" });
    expect(state.inventory).toEqual(seededInventory);
  });

  it("SELECT_RECIPE carries inventory through unchanged", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0, seededInventory);
    const after = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "margherita" });
    expect(after.phase).toBe("PREPARE");
    expect(after.inventory).toEqual(seededInventory);
  });

  it("RESET_PIZZA carries inventory through unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0, seededInventory);
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "RESET_PIZZA" });
    expect(state.pizza.sauceIds).toHaveLength(0);
    expect(state.inventory).toEqual(seededInventory);
  });

  it("MISSION_RESET_ORDER carries inventory through unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0, seededInventory);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(state.isMissionRound).toBe(true);
    expect(state.inventory).toEqual(seededInventory);
  });

  it("MISSION_NEXT_ORDER (nextMissionOrderState, the one hand-built carry-object site) carries inventory through unchanged", () => {
    const resultState = playToResultWithInventory(seededInventory);
    const next = gameReducer(resultState, { type: "MISSION_NEXT_ORDER" });
    expect(next.phase).toBe("ORDER"); // Lunch Rush: straight to the next order, skipping DISCOVERED
    expect(next.inventory).toEqual(seededInventory);
  });

  it("ownedIngredientIds and inventory vary independently -- an ingredient can be owned/unlocked with zero stock", () => {
    const ownedWithOnion = [...STARTER_INGREDIENT_IDS, "onion"];
    const state = createInitialGameState(EMPTY_DEX, ownedWithOnion, 0, EMPTY_INVENTORY);
    expect(state.ownedIngredientIds).toContain("onion");
    expect(state.inventory.onion ?? 0).toBe(0);
  });

  it("ownedIngredientIds and inventory changes never leak into each other across PURCHASE_INGREDIENT", () => {
    // totalStars = 15 (>= onion's minTotalStars of 12), same fixture as the ownership-boundary
    // suite above, so onion is AVAILABLE_TO_BUY rather than LOCKED for this purchase.
    const dex = [
      { recipeId: "margherita", discovered: true, bestScore: 95, bestStars: 5 as const, timesMade: 1 },
      { recipeId: "marinara", discovered: true, bestScore: 95, bestStars: 5 as const, timesMade: 1 },
      { recipeId: "genovese", discovered: true, bestScore: 95, bestStars: 5 as const, timesMade: 1 },
    ];
    const state = createInitialGameState(dex, STARTER_INGREDIENT_IDS, 500, seededInventory);
    const after = gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "onion" });
    expect(after.ownedIngredientIds).toContain("onion");
    // PURCHASE_INGREDIENT (E1 scope) only ever grants ownership -- it must not touch inventory.
    expect(after.inventory).toEqual(seededInventory);
  });
});
