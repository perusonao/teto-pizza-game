import { FREE_COOK_BAKE_TARGET } from "../data/freeCook";
import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, getDexEntry, registerScoreToDex, type DexState } from "./dex";
import { getRecipe, RECIPES, type RecipeId } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getReferencePizza } from "../data/referencePizza";
import { idealSauceDepositsFor, panFieldsFor, requiredSauceIds } from "../logic/testSupport/requiredSauces";
import { createEmptyPizza, type PizzaState, type PlacedTopping } from "./pizzaState";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { computeScoringV2, toLegacyScoreBreakdown } from "../logic/scoringV2";
import { totalStars } from "../logic/mastery";
import { applyPitzCredit } from "../logic/pitzReward";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { discoveredDex } from "./testSupport/guidedRound";
import { registerDiscoveryToDex } from "./discoveryRegistration";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { evaluateDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { starsFromTotal } from "../logic/scoring";
import { ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";


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
    sauceIds: requiredSauceIds(recipeId),
    ...panFieldsFor(recipeId), // Square Dough E-2: grandma-pizza is only itself cooked on the tray
    sauceDeposits: idealSauceDepositsFor(recipeId),
    toppings: referencePieces(recipeId),
    bakeResult,
  };
}

/** Drives a guided FREE round for `recipeId` to RESULT with exactly `pizza` (same
 *  direct-injection pattern as gameReducer.completionGate.test.ts). Discovery 2.0: a guided
 *  round is only ever for an already-discovered recipe, so callers pass a Dex that has it. */
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
    freeCook: false,
  };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult ?? BAKE });
  return walkPostBakeToResult(state);
}

/** Discovery 2.0: the discovery path -- a Free Cooking round (START_FREE_COOK) baked with exactly
 *  `pizza`; the matcher (CONFIRM_BAKE) decides which recipe it is. */
function freeCookToResult(pizza: PizzaState, dex: DexState = EMPTY_DEX): GameState {
  let state = gameReducer(createInitialGameState(dex, OWNED, 0, {}, []), { type: "START_FREE_COOK" });
  state = { ...state, pizza };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult ?? BAKE });
  return walkPostBakeToResult(state);
}

/** Bismarck already discovered (never made): the guided round the cross-recipe tests start from. */
const BISMARCK_DEX = discoveredDex(["bismarck"]);

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
    const result = freeCookToResult(idealPizzaFor("margherita", 70));
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
    const first = register(freeCookToResult(idealPizzaFor("margherita", 70)));
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
    const once = register(freeCookToResult(idealPizzaFor("margherita", 70)));
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
    const after = register(freeCookToResult(idealPizzaFor("margherita", 70)));
    expect(after.lastDiscovery).not.toBeNull();
    expect(gameReducer(after, { type: "PLAY_AGAIN" }).lastDiscovery).toBeNull();
    expect(gameReducer(after, { type: "RETRY_SAME_RECIPE" }).lastDiscovery).toBeNull();
  });

  it("7. original pizza (PASS for the selected recipe, no target): ORIGINAL, legacy registration only", () => {
    const result = playToResult("bismarck", withExtraPieces(idealPizzaFor("bismarck"), "mushroom", 3), BISMARCK_DEX);
    expect(result.completion?.status).toBe("PASS");
    const after = register(result);
    expect(after.lastDiscovery).toEqual({ kind: "ORIGINAL", blockedTargetIds: [] });
    expect(after.dex).toEqual(registerScoreToDex(BISMARCK_DEX, "bismarck", result.score!).dex);
  });

  describe("an exact match to a different recipe", () => {
    // Bismarck {tomato-sauce, mozzarella, egg} + 3 bacon = exactly Breakfast Pizza's signature.
    const breakfastOnBismarck = () => withExtraPieces(idealPizzaFor("bismarck"), "bacon", 3);

    it("is written to the Dex as that recipe, scored as that recipe", () => {
      const result = playToResult("bismarck", breakfastOnBismarck(), BISMARCK_DEX);
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
      const legacy = registerScoreToDex(BISMARCK_DEX, "bismarck", result.score!).dex;
      expect(after.dex).toEqual(registerScoreToDex(legacy, "breakfast-pizza", breakfastScore).dex);
      // The selected recipe's own legacy flags and Pitz are unchanged. Discovery 2.0: the guided
      // bismarck was already discovered, so its credit has no first-discovery bonus --
      // breakfast-pizza's own separate (matcher) discovery is Dex-only, never a second Pitz credit.
      expect(after.justDiscovered).toBe(false);
      expect(after.lastPitzCredit).toEqual(
        applyPitzCredit(getRecipe("bismarck")!.baseRewardPitz, result.score!.total, 0, false),
      );
    });

    it("is idempotent: making it again never re-writes that recipe", () => {
      const first = register(playToResult("bismarck", breakfastOnBismarck(), BISMARCK_DEX));
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
      const result = playToResult("bismarck", withExtraPieces(idealPizzaFor("bismarck"), "bacon", 1), BISMARCK_DEX);
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
      const legacy = registerScoreToDex(BISMARCK_DEX, "bismarck", result.score!).dex;
      expect(after.dex).toEqual(registerScoreToDex(legacy, "breakfast-pizza", breakfastScore).dex);
    });
  });

  it("12. every shipped recipe's reference pizza: Free Cooking discovers exactly that recipe and Dex/★/Pitz equal the legacy result", () => {
    // E5: the late recipe's pizza is finished in FINISH (post-bake pieces), covered end to end in lateCatalog.ikura.test.ts.
    for (const recipe of ordinaryRecipes(RECIPES)) {
      // Issue #482 (OD-B6 F1): Free Cooking judges by the generic window its gauge shows, so the bake is the middle
      // of the part of the recipe's own window that the generic window covers (every recipe overlaps it).
      const bake = Math.round(
        (Math.max(recipe.bakeTarget.start, FREE_COOK_BAKE_TARGET.start) + Math.min(recipe.bakeTarget.end, FREE_COOK_BAKE_TARGET.end)) / 2,
      );
      const result = freeCookToResult(idealPizzaFor(recipe.id, bake));
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
    const first = register(
      playToResult("bismarck", withExtraPieces(idealPizzaFor("bismarck"), "bacon", 3), discoveredDex(["bismarck"], loadSave(storage).dex)),
    );
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
    // Still v2; the only keys a write adds are I4b-2's Shop entitlement ledger (read back as []),
    // Discovery Hint Economy 1.0's hint purchase ledger and Hint 3.0 H3-2's fact ledger (both {}),
    // and Cooking Techniques TQ-1A's technique ledger ([]; nothing writes it before TQ-1C).
    expect(Object.keys(raw).sort()).toEqual(
      [
        ...Object.keys(V2_SAVE),
        "unlockedForShopIngredientIds",
        "discoveryHintPurchases",
        "discoveryHintFacts",
        "discoveredTechniqueIds",
      ].sort(),
    );
    expect(raw.discoveryHintPurchases).toEqual({});
    expect(raw.discoveryHintFacts).toEqual({});
    expect(raw.discoveredTechniqueIds).toEqual([]);
    expect(raw.schemaVersion).toBe(2);
    expect(raw.missionBest).toEqual(V2_SAVE.missionBest);
    expect(loadSave(storage).dex).toEqual(first.dex);
    expect(first.dex.map((e) => e.recipeId)).toEqual(["margherita", "bismarck", "breakfast-pizza"]);
  });
});

/**
 * Issue #482 (OD-B6 F1 extended to Guided): a Guided pizza is judged by the window the player actually saw -- the selected
 * recipe A's. When its composition is exactly another undiscovered recipe R, the discovery is decided by A's window too; R's
 * own window is Scoring 2.0's Bake component only.
 *
 * The end-to-end reachable (A, R) pairs are the ones where R's composition also satisfies A's own Gate (12 today, e.g. funghi
 * -> veggie-supreme-pizza); the unit tests below also pin the pair Margherita (60-80) -> marinara (45-65) at the registration layer.
 */
describe("Guided cross-recipe discovery is judged by the selected recipe's window (#482)", () => {
  const MARGHERITA_WINDOW = getRecipe("margherita")!.bakeTarget;
  const MARINARA = getRecipe("marinara")!;
  const dexOfMargherita = discoveredDex(["margherita"]);
  const marinaraPizza = (bake: number) => idealPizzaFor("marinara", bake);

  it("A = Margherita (60-80), R = marinara (45-65), bake 70: discovered although 70 is outside marinara's own window", () => {
    const pizza = marinaraPizza(70);
    expect(MARINARA.bakeTarget.end).toBeLessThan(70);
    const outcome = { kind: "NEW_DISCOVERY" as const, recipeId: "marinara" as RecipeId, targetId: "shipped:marinara" };
    const registered = registerDiscoveryToDex(dexOfMargherita, outcome, "margherita", pizza, MARGHERITA_WINDOW);
    expect(registered.outcome.kind).toBe("NEW_DISCOVERY");
    expect(getDexEntry(registered.dex, "marinara")?.discovered).toBe(true);
  });

  it("outside the selected recipe's window it is not discovered (bake 59 is inside marinara's window but outside Margherita's)", () => {
    const pizza = marinaraPizza(59);
    expect(59).toBeGreaterThanOrEqual(MARINARA.bakeTarget.start);
    expect(59).toBeLessThanOrEqual(MARINARA.bakeTarget.end);
    const outcome = { kind: "NEW_DISCOVERY" as const, recipeId: "marinara" as RecipeId, targetId: "shipped:marinara" };
    const registered = registerDiscoveryToDex(dexOfMargherita, outcome, "margherita", pizza, MARGHERITA_WINDOW);
    expect(registered.outcome.kind).toBe("INCOMPLETE_MATCH");
    expect(registered.dex).toBe(dexOfMargherita);
  });

  it("the discovered recipe's own window stays Scoring 2.0's: the recorded score is marinara's real score at 70 (5 points past its window)", () => {
    const pizza = marinaraPizza(70);
    const outcome = { kind: "NEW_DISCOVERY" as const, recipeId: "marinara" as RecipeId, targetId: "shipped:marinara" };
    const registered = registerDiscoveryToDex(dexOfMargherita, outcome, "margherita", pizza, MARGHERITA_WINDOW);
    const v2 = computeScoringV2(MARINARA, pizza);
    const bake = v2.components.bake;
    expect(bake.available && bake.distanceFromIdeal).toBe(5);
    expect(bake.available && bake.score).toBeLessThan(100);
    const expected = toLegacyScoreBreakdown(v2, pizza.bakeResult, MARGHERITA_WINDOW);
    expect(registered.dex).toEqual(registerScoreToDex(dexOfMargherita, "marinara", expected).dex);
    // not capped by marinara's own window (70 is "burnt" for it): the stars are exactly the total's
    expect(expected.stars).toBe(starsFromTotal(expected.total));
  });

  it("without a judged window the registration still gates by the discovered recipe's own window (pre-#482 default)", () => {
    const outcome = { kind: "NEW_DISCOVERY" as const, recipeId: "marinara" as RecipeId, targetId: "shipped:marinara" };
    expect(registerDiscoveryToDex(dexOfMargherita, outcome, "margherita", marinaraPizza(70)).outcome.kind).toBe("INCOMPLETE_MATCH");
  });

  describe("end to end through the reducer: funghi (58-78) round with the veggie-supreme-pizza (50-70) composition", () => {
    const dex = discoveredDex(["funghi"]);
    const veggie = getRecipe("veggie-supreme-pizza")!;

    it("bake 74 (inside funghi's window, outside veggie's): CONFIRM_BAKE passes and REGISTER_TO_DEX discovers veggie-supreme-pizza", () => {
      expect(74).toBeGreaterThan(veggie.bakeTarget.end);
      const result = playToResult("funghi", idealPizzaFor("veggie-supreme-pizza", 74), dex);
      expect(result.completion?.status).toBe("PASS");
      const after = register(result);
      expect(after.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "veggie-supreme-pizza" });
      expect(getDexEntry(after.dex, "veggie-supreme-pizza")?.discovered).toBe(true);
      // Scoring 2.0 reads veggie's own window: 74 is 4 points past it
      const bake = computeScoringV2(veggie, after.pizza).components.bake;
      expect(bake.available && bake.distanceFromIdeal).toBe(4);
    });

    it("bake 79 (outside funghi's window): the round itself FAILS, so nothing is discovered", () => {
      const result = playToResult("funghi", idealPizzaFor("veggie-supreme-pizza", 79), dex);
      expect(result.completion?.status).toBe("FAILED");
      const after = register(result);
      expect(getDexEntry(after.dex, "veggie-supreme-pizza")?.discovered ?? false).toBe(false);
    });

    it("bake 57 (inside veggie's window, outside funghi's): FAILED, nothing discovered", () => {
      const result = playToResult("funghi", idealPizzaFor("veggie-supreme-pizza", 57), dex);
      expect(result.completion?.status).toBe("FAILED");
      expect(getDexEntry(register(result).dex, "veggie-supreme-pizza")?.discovered ?? false).toBe(false);
    });
  });

  it("every reachable (A, R) pair discovers R when A's window centre is aimed at (the pre-#482 behaviour), across the whole shipped catalog", () => {
    let reachable = 0;
    for (const a of RECIPES) {
      for (const r of RECIPES) {
        if (a.id === r.id) continue;
        const bake = (a.bakeTarget.start + a.bakeTarget.end) / 2;
        const pizza = idealPizzaFor(r.id, bake);
        if (evaluatePizzaCompletion(a, pizza, "recipe").status !== "PASS") continue; // A's own Gate fails first: never reaches registration
        const outcome = evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, [a.id]);
        if (outcome.kind !== "NEW_DISCOVERY" || outcome.recipeId !== r.id) continue;
        reachable += 1;
        const registered = registerDiscoveryToDex(discoveredDex([a.id]), outcome, a.id, pizza, a.bakeTarget);
        expect(registered.outcome.kind, `${a.id} -> ${r.id}`).toBe("NEW_DISCOVERY");
      }
    }
    expect(reachable).toBeGreaterThan(0);
  });
});
