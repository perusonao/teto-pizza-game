import { describe, expect, it } from "vitest";
import { gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { missionScore, averageQualityScore } from "../logic/missionScoring";
import { totalStars } from "../logic/mastery";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { createEmptyPizza } from "./pizzaState";
import { EMPTY_INVENTORY, type InventoryState } from "./inventory";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/**
 * Phase 4A-1A regression suite (SSOT section 10/13's "Scope Guard"): confirms the Phase
 * 4A-1A additions (COMMIT_SAUCE_DISPENSE, PizzaState.sauceDeposits, the Reference/shadow-
 * scoring modules) cannot influence anything they aren't explicitly wired into --
 * authoritative scoring, Dex, Mission, non-Margherita sauce, or a reducer phase transition.
 * See gameReducer.commitSauceDispense.test.ts for the full reducer scope-guard suite this
 * complements (Codex Broad Review MUST FIX 2).
 */

function preparedState(
  recipeIdOwned: readonly string[],
  inventory: InventoryState = EMPTY_INVENTORY,
): GameState {
  // Discovery 2.0: a guided round of an already-discovered margherita.
  const state = createGuidedInitialState("margherita", { ownedIngredientIds: recipeIdOwned, inventory });
  const prepared = gameReducer(state, { type: "BEGIN_PREPARE" });
  // Issue #33 D1: BEGIN_PREPARE now lands at DOUGH, the new first step -- every caller in
  // this file exercises SAUCE-step sauce-dispense actions, so advance past DOUGH once here.
  return gameReducer(prepared, { type: "CONFIRM_MAKING_STEP" });
}

describe("Regression: PizzaState shape unaffected by sauceDeposits", () => {
  it("createEmptyPizza's shape addition (sauceDeposits: []) doesn't change any other field's default", () => {
    const pizza = createEmptyPizza();
    expect(pizza.sauceIds).toEqual([]);
    expect(pizza.sauceOrigin).toBeNull();
    expect(pizza.sauceToken).toBe(0);
    expect(pizza.toppings).toEqual([]);
    expect(pizza.bakeResult).toBeNull();
    expect(pizza.sauceDeposits).toEqual([]);
  });
});

describe("Regression: Dex BEST/★ semantics untouched", () => {
  it("registerScoreToDex behaves exactly as before, independent of DEPOSIT_SAUCE ever having run", () => {
    const score = { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 95, stars: 5 as const };
    const { dex, wasNewDiscovery, isNewBest } = registerScoreToDex(EMPTY_DEX, "margherita", score);
    expect(wasNewDiscovery).toBe(true);
    expect(isNewBest).toBe(true);
    expect(dex.find((e) => e.recipeId === "margherita")?.bestStars).toBe(5);
    expect(totalStars(dex)).toBe(5);
  });
});

describe("Regression: Mission scoring untouched", () => {
  it("missionScore/averageQualityScore are pure functions of MissionMetrics, unaware sauceDeposits exists", () => {
    const metrics = { servedCount: 3, totalQualityScore: 240, bestQualityScore: 90 };
    expect(missionScore(metrics)).toBe(missionScore({ ...metrics }));
    expect(averageQualityScore(metrics)).toBeCloseTo(80);
  });
});

describe("Regression: non-Margherita sauce interaction", () => {
  it("APPLY_SAUCE for marinara's tomato-sauce still works exactly as before (single commit, no deposits)", () => {
    const owned = ["tomato-sauce", "garlic", "oregano"]; // marinara's own ingredients only
    // Test Reliability 1A: marinara's `unlockCondition` is `{ requiresRecipeId: "funghi" }`
    // (src/data/recipes.ts), so it stays LOCKED against EMPTY_DEX regardless of ingredient
    // ownership -- `availableRecipeIds` (src/state/progression.ts) then comes back empty and
    // `getNextOrder` (src/data/orders.ts) falls back to a uniform-random pick across every
    // recipe. The old fixture relied on a `MISSION_RESET_ORDER` retry loop to land on marinara
    // by chance (P(miss) = ((N-1)/N)^20 for N recipes -- worse as the catalog grows), a
    // pre-existing flake this test never needed: marking `funghi` discovered satisfies
    // marinara's own unlock condition directly, without discovering it "for real" via
    // margherita/funghi rounds. With `funghi` discovered and only marinara's three ingredients
    // owned, marinara is the one and only entry in the available pool -- deterministic
    // regardless of `RECIPES`' length.
    // Discovery 2.0: marinara itself is discovered, with stock for garlic/oregano.
    const funghiDiscoveredDex: DexState = [
      { recipeId: "funghi", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
    ];
    let state = createGuidedInitialState("marinara", { dex: funghiDiscoveredDex, ownedIngredientIds: owned });
    expect(state.recipe.id).toBe("marinara");
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    expect(state.pizza.sauceIds).toEqual(["tomato-sauce"]);
    expect(state.pizza.sauceDeposits).toEqual([]);
  });

  it("Issue #32 sauce parity fix: COMMIT_SAUCE_DISPENSE now accepts a non-recipe sauce ingredient on Margherita, instead of rejecting it", () => {
    // Pre-fix, this reducer guard rejected any sauce that didn't match the current recipe's
    // own required ingredient -- PizzaStage's UI then fell back to the legacy one-shot
    // APPLY_SAUCE path for that case (Fresh Audit Finding 1-B: instant full-pizza fill instead
    // of the incremental dispense/heatmap gesture). Recipe/Purity scoring already reacted to
    // a wrong `sauceIds[0]` normally either way, so loosening this guard to "any sauce-
    // category ingredient" (still gated by phase/step/ownership/deposit-shape below) changes
    // nothing scoring reads -- only which gesture pipeline paints it.
    // EP4: `olive-oil` is no longer trivially Starter-owned or unconditionally in stock -- own
    // it and seed a unit of stock explicitly, since this test is about the sauce-parity reducer
    // guard, not ownership/the Stock Gate.
    const state = preparedState([...STARTER_INGREDIENT_IDS, "olive-oil"], { "olive-oil": 1 });
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "olive-oil",
      deposits: [{ x: 50, y: 50, amount: 0.02 }],
    });
    expect(after.pizza.sauceIds).toEqual(["olive-oil"]);
    expect(after.pizza.sauceDeposits).toEqual([{ x: 50, y: 50, amount: 0.02 }]);
  });

  it("COMMIT_SAUCE_DISPENSE is still a complete no-op for a non-sauce ingredient, even on Margherita where the recipe/phase would otherwise qualify", () => {
    const state = preparedState(STARTER_INGREDIENT_IDS);
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "mozzarella",
      deposits: [{ x: 50, y: 50, amount: 0.02 }],
    });
    expect(after).toBe(state);
    expect(after.pizza.sauceIds).toEqual([]);
  });
});

describe("Regression: no direct invalid state transition (Codex MUST FIX 2 -- inverted from the pre-fix spec)", () => {
  // Pre-Codex-Fix, this exact scenario asserted DEPOSIT_SAUCE *was* accepted (only `phase`
  // itself was checked as "unchanged", since DEPOSIT_SAUCE never touched it either way).
  // MUST FIX 2 explicitly calls for that spec to be inverted: COMMIT_SAUCE_DISPENSE must now
  // reject entirely (state identity-equal, no fields touched) when dispatched from ORDER.
  it("COMMIT_SAUCE_DISPENSE is rejected outright when dispatched from ORDER, not merely 'accepted without changing phase'", () => {
    const orderState = createGuidedInitialState();
    expect(orderState.phase).toBe("ORDER");
    const after = gameReducer(orderState, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [{ x: 50, y: 50, amount: 0.02 }],
    });
    expect(after).toBe(orderState); // full rejection, not a partial/silent accept
  });

  it("REGISTER_TO_DEX is still a no-op outside RESULT even with a committed deposit log on the pizza", () => {
    let state = preparedState(STARTER_INGREDIENT_IDS);
    state = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [{ x: 50, y: 50, amount: 0.02 }],
    });
    expect(state.phase).toBe("PREPARE");
    expect(state.pizza.sauceDeposits.length).toBeGreaterThan(0);
    const after = gameReducer(state, { type: "REGISTER_TO_DEX" });
    expect(after).toBe(state);
  });
});
