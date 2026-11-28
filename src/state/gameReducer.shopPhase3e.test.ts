import { describe, expect, it, vi } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { MENU_CATALOG } from "../data/menuCatalog";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { getRecipe } from "../data/recipes";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { requiredCutCount } from "../logic/cut/evaluation";
import { resolveRequestedSliceCount } from "../logic/cut/types";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import { discoverableHintCandidates, selectHintTarget } from "../logic/discovery/hintTarget";
import { dinnerMissionUnlock, getDinnerMission } from "../mission/dinner/dinnerMission";
import { resolveDinnerAttempt } from "../mission/dinner/dinnerResultDetection";
import { getDinnerRewardTable, quoteDinnerReward, SHOP_DINNER_REWARD_TABLE_ID } from "../mission/dinner/dinnerReward";
import type { DexState } from "./dex";
import { dinnerMenuMembership } from "./dinnerProgression";
import { isValidResearchTarget, needsResearchTargetChoice, researchEntryViews, resolveHintSession } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { createEmptyPizza } from "./pizzaState";
import { loadSave, persistProgress, SAVE_STORAGE_KEY } from "./persistence";
import { progressionSnapshotOf, runDinnerClear, runHomeMenuSettlement } from "./roundCommit";
import { buildStartup } from "./startup";
import { faultyStorage } from "./testSupport/faultyStorage";
import { memoryStorage } from "./testSupport/memoryStorage";

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

const awaitingRecipe = "tonno-e-cipolla";
const clearRecord = { revision: 1, clears: 1, bestClearMs: 120_000, bestTier: null, firstClearRewarded: false };

function savedDinner(reputation?: number, record: unknown = clearRecord, paid: string[] = []) {
  const { dex } = stateWith(["bismarck", "breakfast-pizza", "funghi", awaitingRecipe]);
  return {
    schemaVersion: 2,
    dex,
    pitzBalance: 500,
    ownedIngredientIds: ingredients,
    inventory,
    dinnerMissionRecords: { "dm-a": record },
    ...(reputation === undefined ? {} : {
      shopProgress: { reputation, grantedMenuRecipeIds: [], awaitingMenuRecipeIds: [awaitingRecipe], menuEntryPaidRecipeIds: paid },
    }),
  };
}

function finalDinnerCut(initial: GameState): GameState {
  const started = startDinner(initial);
  const dinner = started.dinner!;
  // Seed the first three completed targets, then run the real bake and CUT of the final target.
  const nearClear = { ...started, dinner: { ...dinner, run: { ...dinner.run, completedRecipeIds: ["margherita", "bismarck", "breakfast-pizza"] } } };
  const bake = gameReducer({ ...nearClear, pizza: referencePizza("funghi", "tomato-sauce") }, { type: "START_BAKE", now: now + 500 });
  const cutting = gameReducer(bake, { type: "CONFIRM_BAKE", value: 68, now: now + 700 });
  expect(cutting.makingStep).toBe("CUT");
  const count = requiredCutCount(resolveRequestedSliceCount(cutting.cutState.config));
  const lines = Array.from({ length: count }, (_, index) => {
    const angle = Math.PI * index / count;
    const dx = Math.cos(angle) * DOUGH_RADIUS;
    const dy = Math.sin(angle) * DOUGH_RADIUS;
    return { start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy }, end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy } };
  });
  return lines.reduce((state, line) => gameReducer(state, { type: "ADD_CUT_LINE", line }), cutting);
}

const clearAction = { type: "CONFIRM_MAKING_STEP", now: now + 1_000 } as const;

describe("Phase 4b Dinner and HOME save boundary", () => {
  it("keeps the unpaid legacy right through startup and uses the repeat schedule after reload", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(savedDinner()) });
    const initial = buildStartup(storage).state;
    expect(runHomeMenuSettlement(initial, undefined, storage).status).toBe("ignored");
    expect(initial).toMatchObject({ pitzBalance: 500, shop: { reputation: 0 } });
    expect(loadSave(storage).dinnerMissionRecordsState.records["dm-a"]).toEqual(clearRecord);

    const first = runDinnerClear(finalDinnerCut(initial), clearAction, storage);
    expect(first.status).toBe("committed");
    if (first.status !== "committed") return;
    expect(first.next.dinner?.settlement).toMatchObject({ schedule: "FIRST_CLEAR", pitz: 250, reputation: 5 });
    expect(runDinnerClear(first.next, clearAction, storage).status).toBe("ignored");
    expect(loadSave(storage)).toMatchObject({
      pitzBalance: 750, shopProgress: { reputation: 5 },
      dinnerMissionRecordsState: { records: { "dm-a": { clears: 2, firstClearRewarded: true } } },
    });

    const retryTab = storage.view();
    const retry = runDinnerClear(finalDinnerCut(buildStartup(retryTab).state), clearAction, retryTab);
    expect(retry.status).toBe("committed");
    if (retry.status !== "committed") return;
    expect(retry.next.dinner?.settlement).toMatchObject({ schedule: "REPEAT_CLEAR", pitz: 100 });
    expect(retry.next.shop.reputation).toBe(5);
    expect(loadSave(retryTab)).toMatchObject({
      pitzBalance: 850, shopProgress: { reputation: 5 },
      dinnerMissionRecordsState: { records: { "dm-a": { clears: 3, firstClearRewarded: true } } },
    });
  });

  it.each([
    { name: "below the stage", initialReputation: 34, firstClearRewarded: false, paid: [], gain: 5, pitz: 250 },
    { name: "already paid menu entry", initialReputation: 39, firstClearRewarded: false, paid: [awaitingRecipe], gain: 5, pitz: 250 },
    { name: "already rewarded Dinner", initialReputation: 39, firstClearRewarded: true, paid: [], gain: 0, pitz: 100 },
  ])("has no HOME bonus for $name", ({ initialReputation, firstClearRewarded, paid, gain, pitz }) => {
    const storage = memoryStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify(savedDinner(initialReputation, { ...clearRecord, firstClearRewarded }, paid)),
    });
    const step = runDinnerClear(finalDinnerCut(buildStartup(storage).state), clearAction, storage);
    expect(step.status).toBe("committed");
    if (step.status !== "committed") return;
    expect(step.next.shop.reputation).toBe(initialReputation + gain);
    expect(step.next.dinner?.settlement).toMatchObject({ pitz });
    const home = gameReducer(step.next, { type: "DINNER_EXIT" });
    expect(runHomeMenuSettlement(home, undefined, storage).status).toBe("ignored");
    expect(loadSave(storage).pitzBalance).toBe(500 + pitz);
  });

  it("keeps a broken Dinner record and the exact deadline from opening the stage", () => {
    const broken = savedDinner(39, { ...clearRecord, clears: "invalid" });
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(broken) });
    const cut = finalDinnerCut(buildStartup(storage).state);
    expect(runDinnerClear(cut, clearAction, storage).status).toBe("ignored");
    const blocked = gameReducer(cut, clearAction);
    expect(blocked.dinner?.settlement).toMatchObject({ kind: "BLOCKED", pitz: 0 });
    expect(blocked.shop.reputation).toBe(39);
    const timeout = { ...clearAction, now: now + 360_000 };
    expect(runDinnerClear(cut, timeout, storage).status).toBe("ignored");
    expect(gameReducer(cut, timeout).dinner?.run).toMatchObject({ status: "FAILED", outcome: { reason: "TIME_UP" } });
    expect(loadSave(storage)).toMatchObject({ pitzBalance: 500, shopProgress: { reputation: 39 } });
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(JSON.stringify(broken));
  });

  it("refuses a record broken after startup without committing the Dinner award", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(savedDinner(39)) });
    const cut = finalDinnerCut(buildStartup(storage).state);
    const broken = JSON.stringify(savedDinner(39, { revision: 1, clears: "invalid" }));
    storage.setItem(SAVE_STORAGE_KEY, broken);
    const step = runDinnerClear(cut, clearAction, storage);
    expect(step.status).toBe("records-refused");
    if (step.status !== "records-refused") return;
    const result = step.actions.reduce(gameReducer, cut);
    expect(result.dinner?.settlement).toMatchObject({ kind: "BLOCKED", pitz: 0 });
    expect(runHomeMenuSettlement(gameReducer(result, { type: "DINNER_EXIT" }), undefined, storage).status).toBe("ignored");
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(broken);
  });

  it.each(["quota", "dropped"] as const)("recovers from a %s write at either boundary", (failure) => {
    const seed = JSON.stringify(savedDinner(39));
    const storage = faultyStorage(memoryStorage({ [SAVE_STORAGE_KEY]: seed }));
    const cut = finalDinnerCut(buildStartup(storage).state);
    const fail = failure === "quota" ? "setThrows" : "setDrops";
    storage.faults[fail] = () => true;
    expect(runDinnerClear(cut, clearAction, storage)).toMatchObject({ status: "refused", commit: { status: "failed", failure } });
    const provisional = gameReducer(gameReducer(cut, clearAction), { type: "DINNER_EXIT" });
    expect(runHomeMenuSettlement(provisional, undefined, storage).status).toBe("ignored");
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(seed);

    delete storage.faults[fail];
    const clear = runDinnerClear(cut, clearAction, storage);
    expect(clear.status).toBe("committed");
    if (clear.status !== "committed") return;
    expect(clear.next.shop.reputation).toBe(44);
    expect(runHomeMenuSettlement(clear.next, undefined, storage).status).toBe("ignored");
    const dinnerSaved = storage.getItem(SAVE_STORAGE_KEY);
    storage.faults[fail] = () => true;
    const home = gameReducer(clear.next, { type: "DINNER_EXIT" });
    expect(runHomeMenuSettlement(home, undefined, storage)).toMatchObject({ status: "refused", commit: { status: "failed", failure } });
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(dinnerSaved);

    const restarted = memoryStorage({ [SAVE_STORAGE_KEY]: dinnerSaved! });
    const recovery = runHomeMenuSettlement(buildStartup(restarted).state, undefined, restarted);
    expect(recovery).toMatchObject({ status: "committed", notice: { bonusPitz: 50, reputation: 3, recipeIds: [awaitingRecipe] } });
    expect(loadSave(restarted)).toMatchObject({
      pitzBalance: 800, shopProgress: { reputation: 47, menuEntryPaidRecipeIds: [awaitingRecipe] },
      dinnerMissionRecordsState: { records: { "dm-a": { clears: 2, firstClearRewarded: true } } },
    });
    expect(runHomeMenuSettlement(buildStartup(restarted).state, undefined, restarted).status).toBe("ignored");
  });

  it("settles multiple entries through a stage cascade and commits the final menu and stock entitlements", () => {
    const recipes = [awaitingRecipe, "genovese", "spinach-artichoke-pizza"];
    const seed = savedDinner(109, { ...clearRecord, firstClearRewarded: true });
    seed.dex = [...seed.dex, ...stateWith(recipes.slice(1)).dex];
    seed.ownedIngredientIds = [];
    seed.shopProgress!.awaitingMenuRecipeIds = recipes;
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(seed) });
    const before = buildStartup(storage).state;
    const step = runHomeMenuSettlement(before, undefined, storage);
    expect(step.status).toBe("committed");
    if (step.status !== "committed") return;
    const model = activeProgressionModel();
    expect(step.notice).toEqual({ recipeIds: recipes, reputation: 9, bonusPitz: 150 });
    expect(step.next.shop.reputation).toBe(118);
    expect(model.isOnMenu("spinach-artichoke-pizza", before)).toBe(false);
    expect(model.isOnMenu("spinach-artichoke-pizza", step.next)).toBe(true);
    const newStock = step.next.unlockedForShopIngredientIds.filter((id) => !before.unlockedForShopIngredientIds.includes(id));
    expect(newStock.length).toBeGreaterThan(0);
    expect(loadSave(storage).unlockedForShopIngredientIds).toEqual(expect.arrayContaining(newStock));
    expect(loadSave(storage)).toMatchObject({ pitzBalance: 650, shopProgress: { reputation: 118, menuEntryPaidRecipeIds: recipes } });
  });

  it("refuses a competing legacy-mode balance write between HOME load and settlement", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(savedDinner(44)) });
    const staleHome = buildStartup(storage).state;
    const legacyTab = storage.view();
    const legacy = loadSave(legacyTab);
    const { shopProgress: _shopProgress, dinnerMissionRecordsState: _records, ...legacySnapshot } = legacy;
    const editedInventory = { ...legacySnapshot.inventory, egg: 29 };
    persistProgress({ ...legacySnapshot, inventory: editedInventory }, legacyTab);
    expect(runHomeMenuSettlement(staleHome, undefined, storage)).toMatchObject({
      status: "refused", commit: { status: "blocked", block: "stale-save" },
    });
    persistProgress({ ...legacySnapshot, inventory: editedInventory, pitzBalance: 510 }, legacyTab);
    expect(runHomeMenuSettlement(staleHome, undefined, storage).status).toBe("ignored");
    const freshTab = storage.view();
    expect(runHomeMenuSettlement(buildStartup(freshTab).state, undefined, freshTab).status).toBe("committed");
    expect(runHomeMenuSettlement(staleHome, undefined, storage).status).toBe("ignored");
    expect(loadSave(storage)).toMatchObject({
      pitzBalance: 560, inventory: { egg: 29 }, shopProgress: { reputation: 47, menuEntryPaidRecipeIds: [awaitingRecipe] },
    });
    expect(persistProgress(progressionSnapshotOf(staleHome, undefined), storage).blocked).toBe("stale-save");
  });
});

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
    const settled = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(settled.phase).toBe("DISCOVERED");
    expect(settled.lastDiscovery).toEqual({ kind: "ORIGINAL", blockedTargetIds: [] });
    expect(settled.dex).toBe(initial.dex);
    expect(settled.pitzBalance).toBe(initial.pitzBalance);
    expect(settled.shop.reputation).toBe(initial.shop.reputation);
  });
});
