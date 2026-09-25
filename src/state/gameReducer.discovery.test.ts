import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, getDexEntry, registerScoreToDex, type DexState } from "./dex";
import { getRecipe, RECIPES, type RecipeId } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createEmptyPizza, type PizzaState, type PlacedTopping } from "./pizzaState";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { computeScoringV2, toLegacyScoreBreakdown } from "../logic/scoringV2";
import { totalStars } from "../logic/mastery";
import { applyPitzCredit } from "../logic/pitzReward";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Progression 2.0 Phase 3-1 (Issue #192): discovery at the REGISTER_TO_DEX integration layer --
 * idempotency, duplicate RESULT events, legacy BEST/★ compatibility, the cross-recipe write, and
 * old-save compatibility. Pure matcher coverage lives in ../logic/discovery/matcher.test.ts.
 */

const OWNED = [...STARTER_INGREDIENT_IDS, "egg", "bacon", "mushroom", "onion"];
const BAKE = 65; // inside every bake window used below

function referencePieces(recipeId: RecipeId): PlacedTopping[] {
  const reference = getReferencePizza(recipeId)!;
  return reference.pieceGroups.flatMap((group, gi) =>
    group.positions.map((p, i) => ({ id: `${recipeId}-${gi}-${i}`, ingredientId: group.ingredientId, ...p })),
  );
}

function idealPizzaFor(recipeId: RecipeId, bakeResult = BAKE): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: [getReferencePizza(recipeId)!.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: referencePieces(recipeId),
    bakeResult,
  };
}

/** Drives a FREE round for `recipeId` to RESULT with exactly `pizza` (same direct-injection
 *  pattern as gameReducer.completionGate.test.ts). */
function playToResult(
  recipeId: RecipeId,
  pizza: PizzaState,
  dex: DexState = EMPTY_DEX,
  isMissionRound = false,
): GameState {
  const recipe = getRecipe(recipeId)!;
  const cookingProfile = getCookingProfile(recipeId);
  let state = createInitialGameState(dex, OWNED, 0, {}, []);
  state = {
    ...state,
    recipe,
    order: findOrderForRecipe(recipeId)!,
    pizza,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
    isMissionRound,
  };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult ?? BAKE });
  return walkPostBakeToResult(state);
}

function register(state: GameState): GameState {
  return gameReducer(state, { type: "REGISTER_TO_DEX" });
}

function withExtraPieces(pizza: PizzaState, ingredientId: string, count: number): PizzaState {
  const extra = Array.from({ length: count }, (_, i) => ({
    id: `extra-${ingredientId}-${i}`,
    ingredientId,
    x: 40 + i * 5,
    y: 62,
  }));
  return { ...pizza, toppings: [...pizza.toppings, ...extra] };
}

describe("REGISTER_TO_DEX discovery integration (P3-1)", () => {
  it("first Margherita: NEW_DISCOVERY, and the Dex write is exactly the legacy write", () => {
    const result = playToResult("margherita", idealPizzaFor("margherita", 70));
    expect(result.completion?.status).toBe("PASS");
    const after = register(result);
    expect(after.lastDiscovery).toEqual({
      kind: "NEW_DISCOVERY",
      recipeId: "margherita",
      targetId: "shipped:margherita",
    });
    expect(after.dex).toEqual(registerScoreToDex(EMPTY_DEX, "margherita", result.score!).dex);
    expect(after.justDiscovered).toBe(true);
    expect(after.justGotNewBest).toBe(true);
  });

  it("9. already discovered: ALREADY_DISCOVERED, legacy BEST/timesMade rules unchanged", () => {
    const first = register(playToResult("margherita", idealPizzaFor("margherita", 70)));
    const secondResult = playToResult("margherita", idealPizzaFor("margherita", 79), first.dex);
    const second = register(secondResult);
    expect(second.lastDiscovery).toEqual({
      kind: "ALREADY_DISCOVERED",
      recipeId: "margherita",
      targetId: "shipped:margherita",
    });
    expect(second.dex).toEqual(registerScoreToDex(first.dex, "margherita", secondResult.score!).dex);
    expect(getDexEntry(second.dex, "margherita")?.timesMade).toBe(2);
    expect(second.justDiscovered).toBe(false);
  });

  it("10. a duplicate REGISTER_TO_DEX (repeated RESULT event / re-render) never discovers twice", () => {
    const once = register(playToResult("margherita", idealPizzaFor("margherita", 70)));
    const twice = register(once);
    expect(twice).toBe(once);
    expect(getDexEntry(twice.dex, "margherita")?.timesMade).toBe(1);
    expect(twice.pitzBalance).toBe(once.pitzBalance);
  });

  it("a FAILED pizza is never evaluated or registered", () => {
    const failed = playToResult("margherita", idealPizzaFor("margherita", 5));
    expect(failed.completion?.status).toBe("FAILED");
    const after = register(failed);
    expect(after.lastDiscovery).toBeNull();
    expect(after.dex).toEqual([]);
  });

  it("a Mission round never runs discovery (Lunch Rush unchanged)", () => {
    const after = register(playToResult("margherita", idealPizzaFor("margherita", 70), EMPTY_DEX, true));
    expect(after.lastDiscovery).toBeNull();
    const served = gameReducer(playToResult("margherita", idealPizzaFor("margherita", 70), EMPTY_DEX, true), {
      type: "MISSION_NEXT_ORDER",
    });
    expect(served.lastDiscovery).toBeNull();
  });

  it("every fresh round starts with lastDiscovery reset", () => {
    const after = register(playToResult("margherita", idealPizzaFor("margherita", 70)));
    expect(after.lastDiscovery).not.toBeNull();
    expect(gameReducer(after, { type: "PLAY_AGAIN" }).lastDiscovery).toBeNull();
    expect(gameReducer(after, { type: "RETRY_SAME_RECIPE" }).lastDiscovery).toBeNull();
  });

  it("7. original pizza (PASS for the selected recipe, no target): ORIGINAL, legacy registration only", () => {
    const result = playToResult("bismarck", withExtraPieces(idealPizzaFor("bismarck"), "mushroom", 3));
    expect(result.completion?.status).toBe("PASS");
    const after = register(result);
    expect(after.lastDiscovery).toEqual({ kind: "ORIGINAL", blockedTargetIds: [] });
    expect(after.dex).toEqual(registerScoreToDex(EMPTY_DEX, "bismarck", result.score!).dex);
  });

  describe("an exact match to a different recipe", () => {
    // Bismarck {tomato-sauce, mozzarella, egg} + 3 bacon = exactly Breakfast Pizza's signature.
    const breakfastOnBismarck = () => withExtraPieces(idealPizzaFor("bismarck"), "bacon", 3);

    it("is written to the Dex as that recipe, scored as that recipe", () => {
      const result = playToResult("bismarck", breakfastOnBismarck());
      expect(result.completion?.status).toBe("PASS");
      const after = register(result);
      expect(after.lastDiscovery).toEqual({
        kind: "NEW_DISCOVERY",
        recipeId: "breakfast-pizza",
        targetId: "shipped:breakfast-pizza",
      });
      const breakfast = getRecipe("breakfast-pizza")!;
      const breakfastScore = toLegacyScoreBreakdown(
        computeScoringV2(breakfast, result.pizza),
        result.pizza.bakeResult,
        breakfast.bakeTarget,
      );
      const legacy = registerScoreToDex(EMPTY_DEX, "bismarck", result.score!).dex;
      expect(after.dex).toEqual(registerScoreToDex(legacy, "breakfast-pizza", breakfastScore).dex);
      // The selected recipe's own legacy flags and Pitz are unchanged. OD-02: bismarck itself is
      // also a first-ever discovery here (dex started empty), so its own credit includes the
      // first-discovery bonus -- breakfast-pizza's own separate discovery is Dex-only (§ above),
      // never a second Pitz credit.
      expect(after.justDiscovered).toBe(true);
      expect(after.lastPitzCredit).toEqual(
        applyPitzCredit(getRecipe("bismarck")!.baseRewardPitz, result.score!.total, 0, true),
      );
    });

    it("is idempotent: making it again never re-writes that recipe", () => {
      const first = register(playToResult("bismarck", breakfastOnBismarck()));
      const second = register(playToResult("bismarck", breakfastOnBismarck(), first.dex));
      expect(second.lastDiscovery).toEqual({
        kind: "ALREADY_DISCOVERED",
        recipeId: "breakfast-pizza",
        targetId: "shipped:breakfast-pizza",
      });
      expect(getDexEntry(second.dex, "breakfast-pizza")).toEqual(getDexEntry(first.dex, "breakfast-pizza"));
    });

    it("Issue #215 OD-5: is written even with an under-ideal quantity of that recipe's ingredient", () => {
      // 1 bacon: the signature is Breakfast Pizza's; Breakfast's ideal is 3 bacon, but the
      // "recipe" Completion Gate policy only needs one, so it is discovered -- scored (with the
      // quantity factor) as Breakfast Pizza.
      const result = playToResult("bismarck", withExtraPieces(idealPizzaFor("bismarck"), "bacon", 1));
      expect(result.completion?.status).toBe("PASS");
      const after = register(result);
      expect(after.lastDiscovery).toEqual({
        kind: "NEW_DISCOVERY",
        recipeId: "breakfast-pizza",
        targetId: "shipped:breakfast-pizza",
      });
      const breakfast = getRecipe("breakfast-pizza")!;
      const breakfastResult = computeScoringV2(breakfast, result.pizza);
      expect(breakfastResult.components.quantity).toMatchObject({
        available: true,
        shortage: { ingredientId: "bacon", playerCount: 1, targetCount: 3 },
      });
      const breakfastScore = toLegacyScoreBreakdown(breakfastResult, result.pizza.bakeResult, breakfast.bakeTarget);
      const legacy = registerScoreToDex(EMPTY_DEX, "bismarck", result.score!).dex;
      expect(after.dex).toEqual(registerScoreToDex(legacy, "breakfast-pizza", breakfastScore).dex);
    });
  });

  it("12. every shipped recipe's reference pizza: discovery matches the selected recipe and Dex/★/Pitz equal the legacy result", () => {
    for (const recipe of RECIPES) {
      const bake = Math.round((recipe.bakeTarget.start + recipe.bakeTarget.end) / 2);
      const result = playToResult(recipe.id, idealPizzaFor(recipe.id, bake));
      expect(result.completion?.status, recipe.id).toBe("PASS");
      const after = register(result);
      expect(after.lastDiscovery, recipe.id).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: recipe.id });
      const legacyDex = registerScoreToDex(EMPTY_DEX, recipe.id, result.score!).dex;
      expect(after.dex, recipe.id).toEqual(legacyDex);
      expect(totalStars(after.dex)).toBe(totalStars(legacyDex));
    }
  });
});

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    dump: () => Object.fromEntries(store),
  };
}

describe("11. existing save compatibility (no schema change)", () => {
  const V2_SAVE = {
    schemaVersion: 2,
    dex: [{ recipeId: "margherita", discovered: true, bestScore: 88, bestStars: 4, timesMade: 7 }],
    pitzBalance: 120,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
    missionBest: { "lunch-rush": 300 },
    inventory: {},
    starterGrantClaimedRecipeIds: [],
  };

  it("an existing v2 save loads unchanged and an already-discovered recipe stays idempotent", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(V2_SAVE) });
    const save = loadSave(storage);
    expect(save.dex).toEqual(V2_SAVE.dex);

    const result = playToResult("margherita", idealPizzaFor("margherita", 65), save.dex);
    const after = register(result);
    expect(after.lastDiscovery?.kind).toBe("ALREADY_DISCOVERED");
    const entry = getDexEntry(after.dex, "margherita")!;
    expect(entry.timesMade).toBe(8);
    expect(entry.bestStars).toBeGreaterThanOrEqual(4);
    expect(after.dex).toEqual(registerScoreToDex(save.dex, "margherita", result.score!).dex);
  });

  it("a save written after a discovery keeps the v2 shape and reloads identically", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(V2_SAVE) });
    const first = register(playToResult("bismarck", withExtraPieces(idealPizzaFor("bismarck"), "bacon", 3), loadSave(storage).dex));
    persistProgress(
      {
        dex: first.dex,
        pitzBalance: first.pitzBalance,
        ownedIngredientIds: first.ownedIngredientIds,
        inventory: first.inventory,
        starterGrantClaimedRecipeIds: first.starterGrantClaimedRecipeIds,
      },
      storage,
    );
    const raw = JSON.parse(storage.dump()[SAVE_STORAGE_KEY]);
    // Still v2; the only key a write adds is I4b-2's Shop entitlement ledger (read back as []).
    expect(Object.keys(raw).sort()).toEqual(
      [...Object.keys(V2_SAVE), "unlockedForShopIngredientIds"].sort(),
    );
    expect(raw.schemaVersion).toBe(2);
    expect(raw.missionBest).toEqual(V2_SAVE.missionBest);
    expect(loadSave(storage).dex).toEqual(first.dex);
    expect(first.dex.map((e) => e.recipeId)).toEqual(["margherita", "bismarck", "breakfast-pizza"]);
  });
});
