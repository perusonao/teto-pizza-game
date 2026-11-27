import { describe, expect, it, vi } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { MENU_CATALOG } from "../data/menuCatalog";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { getRecipe } from "../data/recipes";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { discoverableHintCandidates, selectHintTarget } from "../logic/discovery/hintTarget";
import { dinnerMissionUnlock, getDinnerMission } from "../mission/dinner/dinnerMission";
import { resolveDinnerAttempt } from "../mission/dinner/dinnerResultDetection";
import { getDinnerRewardTable, quoteDinnerReward, SHOP_DINNER_REWARD_TABLE_ID } from "../mission/dinner/dinnerReward";
import type { DexState } from "./dex";
import { dinnerMenuMembership } from "./dinnerProgression";
import { isValidResearchTarget, needsResearchTargetChoice, researchEntryViews, resolveHintSession } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { createEmptyPizza } from "./pizzaState";

vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

const ingredients = INGREDIENTS.map((i) => i.id);
const inventory = Object.fromEntries(ingredients.map((id) => [id, 30]));
const excludedId = "pesto-patate";
const now = 10_000;

function stateWith(discovered: readonly string[], grantedMenuRecipeIds: readonly string[] = []): GameState {
  const dex: DexState = discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 75, bestStars: 3, timesMade: 1 }));
  const base = createInitialGameState(dex, ingredients, 500, inventory, [], ingredients);
  return {
    ...base,
    shop: { ...base.shop, grantedMenuRecipeIds },
  };
}

function startDinner(state: GameState, missionId = "dm-a"): GameState {
  // The shop rules are authoritative even if a caller supplies old Preview overrides.
  return gameReducer(state, { type: "DINNER_START", missionId, now, durationMs: 1000, minimumStars: 1 });
}

describe("Phase 3e shop Dinner", () => {
  it("uses initial, granted and discovered menu recipes together, while keeping the stock guard", () => {
    const locked = stateWith(["bismarck", excludedId], ["funghi", excludedId]);
    expect(dinnerMissionUnlock(getDinnerMission("dm-a")!, locked.dex, dinnerMenuMembership(locked))).toMatchObject({
      unlocked: false,
      undiscoveredCount: 1,
    });
    expect(startDinner(locked)).toBe(locked);
    const ready = stateWith(["bismarck", excludedId], ["funghi", "breakfast-pizza", excludedId]);
    expect(dinnerMenuMembership(ready)?.(excludedId)).toBe(false);
    const short = { ...ready, inventory: { ...ready.inventory, egg: 1 } };
    expect(startDinner(short)).toBe(short);
    const started = startDinner(ready);
    expect(started.dinner?.run.targetRecipeIds).toEqual(["margherita", "bismarck", "breakfast-pizza", "funghi"]);
    expect(started.dinner?.run.clock.endsAt).toBe(now + 360_000);
    expect(started.dinner?.minimumStars).toBe(3);
    expect(started.dinner?.rewardTable?.tableId).toBe(SHOP_DINNER_REWARD_TABLE_ID);

    const other = startDinner(stateWith(["funghi"], ["melanzane-pizza", "parmigiana-pizza"]), "dm-b");
    expect(other.dinner?.run.targetRecipeIds).toEqual(["margherita", "funghi", "melanzane-pizza", "parmigiana-pizza"]);
    expect(other.dinner?.run.clock.endsAt).toBe(now + 360_000);
    expect(other.dinner?.minimumStars).toBe(3);
  });

  it.each([
    [240_000, "GOLD", 250, 100],
    [240_001, "SILVER", 200, 80],
    [300_000, "SILVER", 200, 80],
    [300_001, "BRONZE", 170, 60],
    [359_999, "BRONZE", 170, 60],
  ] as const)("clears at %i ms earn %s and the specified Pitz", (clearMs, tier, first, repeat) => {
    const table = getDinnerRewardTable(SHOP_DINNER_REWARD_TABLE_ID)!;
    const outcome = { kind: "CLEAR" as const, clearMs };
    expect(quoteDinnerReward(outcome, table, { isFirstClear: true })).toMatchObject({ tier, pitz: { total: first } });
    expect(quoteDinnerReward(outcome, table, { isFirstClear: false })).toMatchObject({ tier, pitz: { total: repeat } });
  });

  it.each([
    [0.5, 2, "QUALITY_FAIL", null],
    [0.6, 3, "TARGET_PASS", "funghi"],
  ] as const)("applies the live ★3 gate with sauce fraction %f and a completed pizza scoring ★%i", (fraction, stars, category, completed) => {
    const state = startDinner(stateWith(["bismarck"], ["funghi", "breakfast-pizza"]));
    const session = state.dinner!;
    const reference = referencePizza("funghi", "tomato-sauce");
    const pizza = {
      ...reference,
      bakeResult: 68,
      sauceDeposits: reference.sauceDeposits.slice(0, Math.round(reference.sauceDeposits.length * fraction)),
      toppings: reference.toppings.map((piece) => ({ ...piece, x: 16, y: 17 })),
    };
    const attempt = resolveDinnerAttempt({
      run: session.run,
      pizza,
      cutCompleted: true,
      preConsumptionInventory: state.inventory,
      ownedIngredientIds: state.ownedIngredientIds,
      dex: state.dex,
      isOnMenu: dinnerMenuMembership(state),
      minimumStars: session.minimumStars,
      now: now + 1000,
    });
    expect(attempt).toMatchObject({
      status: "RESOLVED",
      completedTargetId: completed,
      classification: category === "TARGET_PASS"
        ? { category, stars, minimumStars: 3 }
        : { category, failure: { kind: "BELOW_MINIMUM_STARS", stars, minimumStars: 3 } },
    });
  });

  it("a discovered non-menu exact match is anonymous and makes no Dinner progress", () => {
    const started = startDinner(stateWith(["bismarck", excludedId], ["funghi", "breakfast-pizza"]));
    const baking = gameReducer({ ...started, pizza: referencePizza(excludedId, "pesto") }, { type: "START_BAKE", now: now + 100 });
    const result = gameReducer(baking, { type: "CONFIRM_BAKE", value: 68, now: now + 200 });
    expect(result.dinner?.lastResult).toEqual({ category: "ORIGINAL" });
    expect(result.dinner?.run.completedRecipeIds).toEqual([]);
    expect(result.dex).toBe(started.dex);
    expect(result.inventory.potato).toBe(started.inventory.potato - 3);
  });
});

function referencePizza(recipeId: string, sauceId: string) {
  const reference = getReferencePizza(recipeId)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [sauceId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group) => group.positions.map((position, index) => ({
      id: `${group.ingredientId}-${index}`,
      ingredientId: group.ingredientId,
      ...position,
    }))),
  };
}

describe("Phase 3e shop menu development targets", () => {
  it("chooses a sole adopted target even with excluded pins, paid hints and Research entries", () => {
    const state = {
      ...stateWith(MENU_CATALOG.filter((entry) => entry.recipeId !== "margherita").map((entry) => entry.recipeId)),
      discoveryHintFacts: { [excludedId]: ["ing:potato"] },
      hintSession: { targetId: excludedId, revealedIndex: 1, fromDex: true },
    };
    expect(discoverableHintCandidates(state).map((r) => r.id)).toEqual(["margherita"]);
    expect(needsResearchTargetChoice(state)).toBe(false);
    expect(researchEntryViews(state)).toEqual([]);
    expect(isValidResearchTarget(state, excludedId)).toBe(false);
    expect(selectHintTarget(state, { recipes: [getRecipe(excludedId)!], pinnedRecipeId: excludedId })).toEqual({ kind: "COMPLETE" });
    expect(resolveHintSession(state, excludedId)).toEqual({ targetId: "margherita", revealedIndex: 0 });
    const started = gameReducer(state, { type: "START_FREE_COOK", researchTargetId: excludedId });
    expect(started.researchTargetId).toBeNull();
    expect(gameReducer(started, { type: "PURCHASE_SHOP_HINT", recipeId: excludedId, kind: "COUNT", expectedPrice: 1 })).toBe(started);
  });

  it.each([{ discovered: [] }, { discovered: [excludedId] }])("registers an excluded exact match as an original with prior Dex $discovered", ({ discovered }) => {
    const initial = stateWith(discovered);
    const pizza = referencePizza(excludedId, "pesto");
    expect(resolveFreeCookPizza({ ...pizza, bakeResult: 68 }, initial.dex)).toMatchObject({
      kind: "MATCHED",
      recipe: { id: excludedId },
    });
    const started = gameReducer(initial, { type: "START_FREE_COOK" });
    const baking = gameReducer({ ...started, pizza }, { type: "START_BAKE", now });
    const baked = gameReducer(baking, { type: "CONFIRM_BAKE", value: 68, now });
    expect(baked.makingStep).toBe("FINISH");
    const result = gameReducer(baked, { type: "CONFIRM_MAKING_STEP", now });
    expect(result.phase).toBe("RESULT");
    expect(result.score).toBeNull();
    const settled = gameReducer(result, { type: "REGISTER_TO_DEX", now });
    expect(settled.phase).toBe("DISCOVERED");
    expect(settled.lastDiscovery).toEqual({ kind: "ORIGINAL", blockedTargetIds: [] });
    expect(settled.dex).toBe(initial.dex);
    expect(settled.pitzBalance).toBe(initial.pitzBalance);
    expect(settled.shop.reputation).toBe(initial.shop.reputation);
  });
});
