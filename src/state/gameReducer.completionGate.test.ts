import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, type DexState } from "./dex";
import { getRecipe, type RecipeId } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";
import { isRecipeAvailable } from "./progression";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "./pizzaState";
import type { InventoryState } from "./inventory";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Completion Gate Phase 1 (docs/reports/TETO_COMPLETION-GATE_PHASE1_Result.md): FAILED
 * semantics at the CONFIRM_BAKE/REGISTER_TO_DEX integration layer -- reward, Dex/BEST/
 * timesMade, recipe unlock, Starter Grant, and finite inventory consumption. Pure gate-logic
 * coverage (PASS/FAILED boundaries themselves) lives in ../logic/completionGate.test.ts; this
 * file is about what a FAILED round does and does not do to the rest of `GameState`.
 */

function pizzaWith(overrides: Partial<PizzaState>): PizzaState {
  return { ...createEmptyPizza(), ...overrides };
}

function ring(radius: number, count: number, amount = 0.02): SauceDeposit[] {
  const deposits: SauceDeposit[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    deposits.push({ x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, amount });
  }
  return deposits;
}

function idealPizzaFor(recipeId: RecipeId, bakeResult: number): PizzaState {
  const reference = getReferencePizza(recipeId)!;
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((p, i) => ({
        id: `${recipeId}-ideal-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...p,
      })),
    ),
    bakeResult,
  });
}

/** Same direct-injection pattern as gameReducer.scoringV2Authority.test.ts's own
 *  `playToResultForRecipe` -- bypasses SELECT_RECIPE/progression gating (orthogonal to what
 *  this suite tests) and drives straight to CONFIRM_BAKE for a specific canonical `pizza`. */
function playToResultForRecipe(
  recipeId: RecipeId,
  pizza: PizzaState,
  extra: Partial<Pick<GameState, "dex" | "ownedIngredientIds" | "inventory" | "starterGrantClaimedRecipeIds">> = {},
): GameState {
  const recipe = getRecipe(recipeId)!;
  const order = findOrderForRecipe(recipeId)!;
  let state = createInitialGameState(
    extra.dex ?? EMPTY_DEX,
    extra.ownedIngredientIds ?? [...STARTER_INGREDIENT_IDS, "onion", "mushroom"],
    0,
    extra.inventory ?? {},
    extra.starterGrantClaimedRecipeIds ?? [],
  );
  // Pizza Cutting 1.0 Phase 2: `createInitialGameState` always seeds margherita's own profile
  // (../data/orders.ts's `preferFirst`) -- overriding `recipe` without also re-resolving
  // `cookingProfile`/`cutState` for the *actual* `recipeId` under test would otherwise wrongly
  // carry margherita's CUT-enabled profile onto every other recipe this helper simulates.
  const cookingProfile = getCookingProfile(recipeId);
  // Discovery 2.0: an injected guided round (a Dex-0 initial state is a Free Cooking round now).
  state = { ...state, recipe, order, pizza, cookingProfile, cutState: createCutState(cookingProfile.cutConfig), freeCook: false };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult ?? recipe.bakeTarget.start });
  return walkPostBakeToResult(state);
}

describe("Completion Gate Phase 1: FAILED semantics", () => {
  it("16. FAILED -> reward is 0 (REGISTER_TO_DEX never credits Pitz)", () => {
    const failed = playToResultForRecipe("margherita", idealPizzaFor("margherita", 20)); // clear underbake
    expect(failed.completion?.status).toBe("FAILED");
    const after = gameReducer(failed, { type: "REGISTER_TO_DEX" });
    expect(after.lastPitzCredit).toBeNull();
    expect(after.pitzBalance).toBe(0);
  });

  it("17. FAILED -> never becomes a ★1 result (no Dex entry is ever created for it)", () => {
    const failed = playToResultForRecipe("margherita", idealPizzaFor("margherita", 20));
    const after = gameReducer(failed, { type: "REGISTER_TO_DEX" });
    expect(after.dex.find((e) => e.recipeId === "margherita")).toBeUndefined();
  });

  it("18. FAILED -> Dex registration is a complete no-op (phase stays RESULT, not DISCOVERED)", () => {
    const failed = playToResultForRecipe("margherita", idealPizzaFor("margherita", 20));
    const after = gameReducer(failed, { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("RESULT");
    expect(after.justDiscovered).toBe(false);
    expect(after.justGotNewBest).toBe(false);
  });

  it("19. FAILED -> bestScore never updates (no entry at all, not even a floor)", () => {
    const failed = playToResultForRecipe("margherita", idealPizzaFor("margherita", 20));
    const after = gameReducer(failed, { type: "REGISTER_TO_DEX" });
    expect(after.dex.find((e) => e.recipeId === "margherita")?.bestScore).toBeUndefined();
  });

  it("20. FAILED -> bestStars never updates", () => {
    const failed = playToResultForRecipe("margherita", idealPizzaFor("margherita", 20));
    const after = gameReducer(failed, { type: "REGISTER_TO_DEX" });
    expect(after.dex.find((e) => e.recipeId === "margherita")?.bestStars).toBeUndefined();
  });

  it("21. FAILED -> never satisfies a chained recipe's own unlock condition", () => {
    // funghi's unlockCondition is `{ requiresRecipeId: "margherita" }` -- a FAILED margherita
    // round must never discover it, so funghi must stay locked.
    const failed = playToResultForRecipe("margherita", idealPizzaFor("margherita", 20));
    const after = gameReducer(failed, { type: "REGISTER_TO_DEX" });
    const funghi = getRecipe("funghi")!;
    expect(isRecipeAvailable(funghi, after.dex, after.ownedIngredientIds)).toBe(false);
  });

  it("22. FAILED -> Starter Grant never triggers", () => {
    // margherita already discovered (so funghi is recipeUnlocked), but funghi's own round
    // itself FAILS -- its Starter Grant (mushroom stock) must never be credited.
    const dexWithMargherita: DexState = [
      { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
    ];
    const failedFunghi = playToResultForRecipe(
      "funghi",
      idealPizzaFor("funghi", 5), // clear underbake -- funghi's bakeTarget is {58, 78}
      { dex: dexWithMargherita, ownedIngredientIds: [...STARTER_INGREDIENT_IDS], inventory: {} },
    );
    expect(failedFunghi.completion?.status).toBe("FAILED");
    const after = gameReducer(failedFunghi, { type: "REGISTER_TO_DEX" });
    expect(after.starterGrantClaimedRecipeIds).toEqual([]);
    expect(after.ownedIngredientIds).not.toContain("mushroom");
    // 0, not a Starter Grant floor (`minCount * STARTER_STOCK_PLAYS_CHAPTER_1`, e.g. 30) --
    // CONFIRM_BAKE's own unconditional consumption (see test 23 below) clamps the placed
    // mushroom usage against a starting stock of 0, it is never topped up by a grant.
    expect(after.inventory.mushroom ?? 0).toBe(0);
    // I4b-3: nor does a FAILED round advance the Discovery Ladder.
    expect(after.unlockedForShopIngredientIds).toEqual([]);
    expect(after.lastMaterialUnlockNotice).toBeNull();
  });

  // Progression 2.0 I4b-3: EP4 is retired, so the PASS contrast no longer grants anything -- it
  // advances the Discovery Ladder instead (Dex count 2 -> egg + bacon unlocked for the Shop at
  // stock 0), which a FAILED round (22 above) never does.
  it("22b (contrast): the same funghi round, PASSing, advances the Discovery Ladder but grants nothing", () => {
    const dexWithMargherita: DexState = [
      { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
    ];
    const passedFunghi = playToResultForRecipe(
      "funghi",
      idealPizzaFor("funghi", 68), // funghi's bakeTarget midpoint
      { dex: dexWithMargherita, ownedIngredientIds: [...STARTER_INGREDIENT_IDS], inventory: {} },
    );
    expect(passedFunghi.completion?.status).toBe("PASS");
    const after = gameReducer(passedFunghi, { type: "REGISTER_TO_DEX" });
    expect(after.starterGrantClaimedRecipeIds).toEqual([]);
    expect(after.unlockedForShopIngredientIds).toEqual(["egg", "bacon"]);
    expect(after.lastMaterialUnlockNotice?.ingredientIds).toEqual(["egg", "bacon"]);
  });

  it("23. FAILED -> a finite ingredient placed on the pizza is still consumed, not refunded", () => {
    // fugazza requires 4 onion (finite, Mastery-gated) -- FAILED here via a missing oregano
    // (minCount 1), never via the onion itself, so the finite consumption question is isolated.
    const reference = getReferencePizza("fugazza")!;
    const onionGroup = reference.pieceGroups.find((g) => g.ingredientId === "onion")!;
    const pizza = pizzaWith({
      sauceIds: [reference.sauce.ingredientId],
      sauceDeposits: buildIdealSauceFixture(),
      // oregano deliberately omitted -- fugazza requires { ingredientId: "oregano", minCount: 1 }.
      toppings: onionGroup.positions.map((p, i) => ({
        id: `fugazza-onion-${i}`,
        ingredientId: "onion",
        ...p,
      })),
      bakeResult: Math.round((getRecipe("fugazza")!.bakeTarget.start + getRecipe("fugazza")!.bakeTarget.end) / 2),
    });
    const startingInventory: InventoryState = { onion: 10 };
    const result = playToResultForRecipe("fugazza", pizza, {
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion"],
      inventory: startingInventory,
    });
    expect(result.completion?.status).toBe("FAILED");
    expect(result.completion?.status === "FAILED" && result.completion.reason).toBe(
      "MISSING_REQUIRED_INGREDIENT",
    );
    // Exactly the placed amount (4 onion) was consumed, same as any bake regardless of PASS/
    // FAILED -- inventory consumption happens unconditionally at CONFIRM_BAKE (../state/
    // inventory.ts's own consumePizzaInventory), before/independent of the Completion Gate.
    expect(result.inventory.onion).toBe(10 - onionGroup.positions.length);
    // FAILED never runs REGISTER_TO_DEX's own logic, so there is no separate "refund" path to
    // even consider -- the round stays parked at RESULT with the consumption already applied.
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.inventory.onion).toBe(10 - onionGroup.positions.length);
  });
});

describe("Completion Gate Phase 1: PASS regression (existing Scoring 2.0 / reward / Dex unaffected)", () => {
  it("24. PASS -> state.score is still the real Scoring 2.0-derived ScoreBreakdown", () => {
    const passed = playToResultForRecipe("margherita", idealPizzaFor("margherita", 70));
    expect(passed.completion?.status).toBe("PASS");
    expect(passed.score?.total).toBe(passed.scoringV2Result?.totalScore);
    expect(passed.score?.stars).toBeGreaterThanOrEqual(1);
  });

  it("25. PASS -> the existing Pitz reward formula is unchanged", () => {
    const passed = playToResultForRecipe("margherita", idealPizzaFor("margherita", 70));
    const after = gameReducer(passed, { type: "REGISTER_TO_DEX" });
    expect(after.lastPitzCredit).not.toBeNull();
    expect(after.lastPitzCredit!.earnedPitz).toBeGreaterThan(0);
    // OD-02: this is margherita's first-ever discovery (a fresh dex), so pitzBalance also
    // includes the first-discovery bonus folded into lastPitzCredit.balanceAfter.
    expect(after.pitzBalance).toBe(after.lastPitzCredit!.balanceAfter);
  });

  it("26. PASS -> Dex/progression register normally (discovery, BEST, timesMade)", () => {
    const passed = playToResultForRecipe("margherita", idealPizzaFor("margherita", 70));
    const after = gameReducer(passed, { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("DISCOVERED");
    const entry = after.dex.find((e) => e.recipeId === "margherita");
    expect(entry).toBeDefined();
    expect(entry!.discovered).toBe(true);
    expect(entry!.timesMade).toBe(1);
    expect(entry!.bestScore).toBe(passed.score!.total);
    expect(entry!.bestStars).toBe(passed.score!.stars);
  });
});

describe("Completion Gate Phase 1: sauce minimum uses ring()'s own PASS boundary", () => {
  it("a mediocre-but-real sauce (ring(25, 16)) still PASSes and registers normally", () => {
    const reference = getReferencePizza("margherita")!;
    const pizza = pizzaWith({
      sauceIds: [reference.sauce.ingredientId],
      sauceDeposits: ring(25, 16),
      toppings: reference.pieceGroups.flatMap((group, gi) =>
        group.positions.map((p, i) => ({
          id: `margherita-ring-${gi}-${i}`,
          ingredientId: group.ingredientId,
          ...p,
        })),
      ),
      bakeResult: 70,
    });
    const result = playToResultForRecipe("margherita", pizza);
    expect(result.completion?.status).toBe("PASS");
  });
});

// Sanity: `getIngredient` used above must resolve real ingredients, not silently no-op.
describe("fixture sanity", () => {
  it("onion/mushroom are real, finite (unlockCondition-bearing) ingredients", () => {
    expect(getIngredient("onion")?.unlockCondition).toBeDefined();
    expect(getIngredient("mushroom")?.unlockCondition).toBeDefined();
  });
});
