import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { getRecipe, type RecipeId } from "../data/recipes";
import { requiredCutCount } from "../logic/cut/evaluation";
import { resolveRequestedSliceCount, type CutLine } from "../logic/cut/types";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import type { QualityStars } from "../logic/scoring";
import { getDinnerMission } from "../mission/dinner/dinnerMission";
import { getDinnerRewardTable, type DinnerRewardTable } from "../mission/dinner/dinnerReward";
import type { DinnerMissionRecord } from "../mission/dinner/dinnerSettlement";
import type { DexEntry, DexState } from "./dex";
import {
  EMPTY_DINNER_MISSION_RECORDS_STATE,
  parseDinnerMissionRecords,
  type DinnerMissionRecordsState,
} from "./dinnerMissionRecordsSave";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import type { InventoryState } from "./inventory";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type ProgressionSnapshot, type StorageLike } from "./persistence";
import { createEmptyPizza, type PizzaState } from "./pizzaState";

/**
 * Dinner Mission DM-4-3 (runtime settlement wiring): the CLEAR transition settles through the DM-4-1
 * authority (`decideDinnerSettlement`) and the DM-4-2 records (`dinnerRecordForSettlement`), exactly
 * once, with Pitz and the record in one state step and one save write. Numbered cases refer to the
 * DM-4-3 Atomicity / Replay Gate (1..20). Every reward amount / threshold here is a TEST FIXTURE
 * injected into the session; production ships only the untuned table (payout 0) until DM-5-2.
 */

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const T0 = 1_000_000;
const DURATION = 600_000;
const PITZ = 500;
const S: QualityStars = 3;
const EXACT_A: InventoryState = { egg: 2, bacon: 3, mushroom: 3 };
const PLENTY: InventoryState = { egg: 20, bacon: 30, mushroom: 30 };

/** RW-B-shaped fixture (not production numbers): GOLD <= 90 s, SILVER <= 150 s, BRONZE <= 300 s. */
const TUNED: DinnerRewardTable = {
  tableId: "test-tuned",
  thresholds: { goldMaxClearMs: 90_000, silverMaxClearMs: 150_000, bronzeMaxClearMs: 300_000 },
  pitz: {
    firstClear: { clear: 150, tierBonus: { GOLD: 100, SILVER: 50, BRONZE: 20 } },
    repeatClear: { clear: 30, tierBonus: { GOLD: 30, SILVER: 15, BRONZE: 5 } },
  },
};

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
}

function saved(
  inventory: InventoryState,
  discovered: readonly string[] = [...DM_A_IDS, "marinara"],
  records: DinnerMissionRecordsState = EMPTY_DINNER_MISSION_RECORDS_STATE,
): GameState {
  return createInitialGameState(dexOf(discovered), ALL_IDS, PITZ, inventory, [], FINITE_IDS, {}, {}, records);
}

function started(inventory: InventoryState = EXACT_A, minimumStars: QualityStars = S, discovered?: readonly string[]): GameState {
  return startFrom(saved(inventory, discovered), minimumStars);
}

function startFrom(base: GameState, minimumStars: QualityStars = S, now = T0): GameState {
  const state = gameReducer(base, {
    type: "DINNER_START",
    missionId: "dm-a",
    now,
    durationMs: DURATION,
    minimumStars,
  });
  if (state.dinner === null) throw new Error("Dinner did not start");
  return state;
}

/** The Reference pizza of `recipeId`, with piece counts overridden per ingredient (extra pieces
 *  are placed inside the dough; fewer take the first Reference positions), plus extra ingredients. */
function pizzaFor(recipeId: string, counts: Record<string, number> = {}, extra: Record<string, number> = {}): PizzaState {
  const reference = getReferencePizza(recipeId);
  if (!reference) throw new Error(`no reference for ${recipeId}`);
  const groups = [
    ...reference.pieceGroups.map((g) => ({ ingredientId: g.ingredientId, positions: g.positions })),
    ...Object.keys(extra).map((ingredientId) => ({ ingredientId, positions: [] as { x: number; y: number }[] })),
  ];
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: groups.flatMap((group, gi) => {
      const count = counts[group.ingredientId] ?? extra[group.ingredientId] ?? group.positions.length;
      return Array.from({ length: count }, (_, i) => ({
        id: `${recipeId}-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...(group.positions[i] ?? { x: 40 + (i % 4) * 5, y: 45 + Math.floor(i / 4) * 5 }),
      }));
    }),
  };
}

function mid(recipeId: string): number {
  const { start, end } = getRecipe(recipeId as RecipeId)!.bakeTarget;
  return Math.round((start + end) / 2);
}

function idealCutLines(count: number): CutLine[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * i) / count;
    const dx = Math.cos(angle) * DOUGH_RADIUS;
    const dy = Math.sin(angle) * DOUGH_RADIUS;
    return { start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy }, end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy } };
  });
}

/** POST_BAKE -> RESULT with the real CUT actions (bounded: a refused confirm stops the walk). */
function cutToResult(state: GameState, now: number): GameState {
  let next = state;
  for (let guard = 0; guard < 4 && next.phase === "POST_BAKE"; guard += 1) {
    if (next.makingStep === "CUT") {
      for (const line of idealCutLines(requiredCutCount(resolveRequestedSliceCount(next.cutState.config)))) {
        next = gameReducer(next, { type: "ADD_CUT_LINE", line });
      }
    }
    const confirmed = gameReducer(next, { type: "CONFIRM_MAKING_STEP", now });
    if (confirmed === next) break;
    next = confirmed;
  }
  return next;
}

/**
 * Puts `pizza` on the current recipe-free Dinner round (the gestures have their own suites) and
 * bakes it -- START_BAKE, CONFIRM_BAKE, CUT when the plan has one -- with the real actions.
 */
function cookPizza(state: GameState, pizza: PizzaState, bake: number, now: number): GameState {
  expect(state.phase, "a Dinner round is at PREPARE").toBe("PREPARE");
  let next = gameReducer({ ...state, pizza }, { type: "START_BAKE", now });
  next = gameReducer(next, { type: "CONFIRM_BAKE", value: bake, now });
  return cutToResult(next, now);
}

function cook(state: GameState, recipeId: string, now: number, counts: Record<string, number> = {}): GameState {
  return cookPizza(state, pizzaFor(recipeId, counts), mid(recipeId), now);
}

function nextPizza(state: GameState, now: number): GameState {
  return gameReducer(state, { type: "DINNER_NEXT_PIZZA", now });
}

function run(state: GameState) {
  return state.dinner!.run;
}


/** Injects the reward authority for the run (production resolves the untuned table). */
function withTable(state: GameState, table: DinnerRewardTable | null): GameState {
  return { ...state, dinner: { ...state.dinner!, rewardTable: table } };
}

/** Cooks every DM-A target; the last pizza's resolution (at `start + clearMs`) turns the run CLEARED. */
function clearRun(state: GameState, clearMs: number, start = T0): GameState {
  let s = state;
  DM_A_IDS.forEach((id, i) => {
    const at = i === DM_A_IDS.length - 1 ? start + clearMs : start + 1000 * (i + 1);
    s = cook(s, id, at);
    if (i < DM_A_IDS.length - 1) s = nextPizza(s, at + 1);
  });
  return s;
}

function records(state: GameState) {
  return state.dinnerMissionRecordsState;
}

function recordsOf(map: unknown): DinnerMissionRecordsState {
  return parseDinnerMissionRecords(map);
}

const REC_REWARDED: DinnerMissionRecord = { revision: 1, clears: 1, bestClearMs: 120_000, bestTier: "SILVER", firstClearRewarded: true };

describe("production authority: untuned table -> wiring on, payout 0 (Economy Safety, case 11)", () => {
  it("the shipped Phase 1 table is resolved at START and is untuned", () => {
    const state = started(PLENTY);
    expect(state.dinner!.rewardTable).toEqual(getDinnerRewardTable(getDinnerMission("dm-a")!.reward.tableId));
    expect(state.dinner!.rewardTable).toMatchObject({ thresholds: null, pitz: null });
    expect(state.dinner!.settlement).toBeNull();
  });

  it("a production CLEAR records the clear, pays 0 and keeps the first-clear right", () => {
    const cleared = clearRun(started(PLENTY), 100_000);
    expect(run(cleared).status).toBe("CLEARED");
    expect(cleared.pitzBalance).toBe(PITZ);
    expect(cleared.dinner!.settlement).toMatchObject({ kind: "SETTLED", pitz: 0, schedule: "UNAVAILABLE", tier: null, clearMs: 100_000 });
    expect(records(cleared).records["dm-a"]).toEqual({ revision: 1, clears: 1, bestClearMs: 100_000, bestTier: null, firstClearRewarded: false });
  });

  it("11: a missing table (null) behaves the same; a later tuned clear still gets the first-clear schedule", () => {
    const unpaid = clearRun(withTable(started(PLENTY), null), 100_000);
    expect(unpaid.pitzBalance).toBe(PITZ);
    expect(records(unpaid).records["dm-a"]!.firstClearRewarded).toBe(false);
    const home = gameReducer(unpaid, { type: "DINNER_EXIT" });
    const paid = clearRun(withTable(startFrom(home, S, T0 + 5_000_000), TUNED), 80_000, T0 + 5_000_000);
    expect(paid.dinner!.settlement).toMatchObject({ schedule: "FIRST_CLEAR", pitz: 250 });
    expect(records(paid).records["dm-a"]).toMatchObject({ clears: 2, firstClearRewarded: true });
  });
});

describe("settlement at CLEAR (cases 1, 12-15)", () => {
  it("1 / 12: the first clear pays the first-clear schedule once, in the same step as the record", () => {
    const cleared = clearRun(withTable(started(PLENTY), TUNED), 80_000);
    expect(cleared.pitzBalance).toBe(PITZ + 250);
    expect(cleared.dinner!.settlement).toMatchObject({ kind: "SETTLED", pitz: 250, schedule: "FIRST_CLEAR", tier: "GOLD" });
    expect(records(cleared).records["dm-a"]).toEqual({ revision: 1, clears: 1, bestClearMs: 80_000, bestTier: "GOLD", firstClearRewarded: true });
  });

  it("12: after DINNER_EXIT and a new START, the next clear is a repeat (records carried, run key new)", () => {
    const first = clearRun(withTable(started(PLENTY), TUNED), 80_000);
    const home = gameReducer(first, { type: "DINNER_EXIT" });
    expect(home.dinner).toBeNull();
    expect(records(home)).toBe(records(first));
    const again = clearRun(withTable(startFrom(home, S, T0 + 5_000_000), TUNED), 140_000, T0 + 5_000_000);
    expect(again.dinner!.settlement).toMatchObject({ kind: "SETTLED", schedule: "REPEAT_CLEAR", pitz: 45, tier: "SILVER" });
    expect(again.pitzBalance).toBe(PITZ + 250 + 45);
    expect(records(again).records["dm-a"]).toEqual({ revision: 1, clears: 2, bestClearMs: 80_000, bestTier: "GOLD", firstClearRewarded: true });
  });

  it("13 / 14: a faster, better clear improves the bests; a slower, worse one keeps them", () => {
    const base = saved(PLENTY, undefined, recordsOf({ "dm-a": REC_REWARDED }));
    const better = clearRun(withTable(startFrom(base), TUNED), 70_000);
    expect(records(better).records["dm-a"]).toMatchObject({ bestClearMs: 70_000, bestTier: "GOLD", clears: 2 });
    expect(better.dinner!.settlement).toMatchObject({ newBestTime: true, newBestTier: true, schedule: "REPEAT_CLEAR", pitz: 60 });
    const worse = clearRun(withTable(startFrom(base), TUNED), 200_000);
    expect(records(worse).records["dm-a"]).toMatchObject({ bestClearMs: 120_000, bestTier: "SILVER", clears: 2 });
    expect(worse.dinner!.settlement).toMatchObject({ newBestTime: false, newBestTier: false, tier: "BRONZE", pitz: 35 });
  });

  it("15: V-1 -- a record from another revision keeps its first-clear payment and clears, bests restart", () => {
    const base = saved(PLENTY, undefined, recordsOf({ "dm-a": { ...REC_REWARDED, revision: 7, clears: 4, bestClearMs: 10_000, bestTier: "GOLD" } }));
    const cleared = clearRun(withTable(startFrom(base), TUNED), 200_000);
    expect(cleared.dinner!.settlement).toMatchObject({ schedule: "REPEAT_CLEAR", pitz: 35 });
    expect(records(cleared).records["dm-a"]).toEqual({ revision: 1, clears: 5, bestClearMs: 200_000, bestTier: "BRONZE", firstClearRewarded: true });
  });
});

describe("exactly once / replay (cases 1-6)", () => {
  function clearedTuned() {
    return clearRun(withTable(started(PLENTY), TUNED), 80_000);
  }

  it("2 / 3: re-evaluating the settled state (rerender, RESULT shown again, stray actions) never settles again", () => {
    const cleared = clearedTuned();
    for (const action of [
      { type: "DINNER_TICK", now: T0 + 90_000 },
      { type: "DINNER_TICK", now: T0 + DURATION + 10 },
      { type: "CONFIRM_MAKING_STEP", now: T0 + 90_001 },
      { type: "CONFIRM_BAKE", value: 60, now: T0 + 90_002 },
      { type: "START_BAKE", now: T0 + 90_003 },
      { type: "DINNER_NEXT_PIZZA", now: T0 + 90_004 },
      { type: "DINNER_REQUEST_ABANDON" },
      { type: "DINNER_CONFIRM_ABANDON", now: T0 + 90_005 },
      { type: "REGISTER_TO_DEX" },
    ] as GameAction[]) {
      const after = gameReducer(cleared, action);
      expect(after.pitzBalance, action.type).toBe(cleared.pitzBalance);
      expect(records(after), action.type).toBe(records(cleared));
      expect(after.dinner?.settlement ?? null, action.type).toEqual(cleared.dinner!.settlement);
      expect(after.dinner?.run.status, action.type).toBe("CLEARED");
    }
  });

  it("4: HOME -> revisit: leaving keeps the paid state; nothing re-settles the old run", () => {
    const cleared = clearedTuned();
    const home = gameReducer(cleared, { type: "DINNER_EXIT" });
    const back = gameReducer(home, { type: "DINNER_EXIT" }); // nothing left to exit
    expect(back.pitzBalance).toBe(PITZ + 250);
    expect(records(back).records["dm-a"]!.clears).toBe(1);
  });

  it("6: the settlement carries the run key; the final transition replayed on the settled state is refused", () => {
    const cleared = clearedTuned();
    expect(cleared.dinner!.settlement!.runKey).toBe(`dm-a@1#${T0}`);
    expect(gameReducer(cleared, { type: "CONFIRM_MAKING_STEP", now: T0 + 80_000 })).toBe(cleared);
  });

  it("deterministic: the same run cleared twice from the same state settles identically", () => {
    const a = clearedTuned();
    const b = clearedTuned();
    expect(b.pitzBalance).toBe(a.pitzBalance);
    expect(b.dinner!.settlement).toEqual(a.dinner!.settlement);
    expect(records(b)).toEqual(records(a));
  });
});

describe("fail-closed (cases 9, 10, 16) and 0-pay outcomes (cases 17, 18)", () => {
  it("9: a blocked mission (broken saved record) settles nothing: 0 Pitz, records untouched", () => {
    const blocked = recordsOf({ "dm-a": { revision: 1, clears: -1, bestClearMs: "x", bestTier: "P", firstClearRewarded: "y" } });
    expect(blocked.blockedMissionIds).toEqual(["dm-a"]);
    const cleared = clearRun(withTable(startFrom(saved(PLENTY, undefined, blocked)), TUNED), 80_000);
    expect(run(cleared).status).toBe("CLEARED");
    expect(cleared.dinner!.settlement).toEqual({ kind: "BLOCKED", runKey: `dm-a@1#${T0}`, pitz: 0 });
    expect(cleared.pitzBalance).toBe(PITZ);
    expect(records(cleared)).toBe(blocked);
  });

  it("9: a broken container blocks every Dinner mission", () => {
    const corrupt = recordsOf(5);
    const cleared = clearRun(withTable(startFrom(saved(PLENTY, undefined, corrupt)), TUNED), 80_000);
    expect(cleared.dinner!.settlement).toMatchObject({ kind: "BLOCKED", pitz: 0 });
    expect(cleared.pitzBalance).toBe(PITZ);
    expect(records(cleared)).toBe(corrupt);
  });

  it("10: another mission's broken record does not block this one", () => {
    const other = recordsOf({ "dm-b": { broken: true } });
    const cleared = clearRun(withTable(startFrom(saved(PLENTY, undefined, other)), TUNED), 80_000);
    expect(cleared.dinner!.settlement).toMatchObject({ kind: "SETTLED", pitz: 250 });
    expect(records(cleared).blockedMissionIds).toEqual(["dm-b"]);
    expect(records(cleared).records["dm-a"]!.firstClearRewarded).toBe(true);
  });

  it("16: a run the authority refuses (revision mismatch) is REFUSED: 0 Pitz, no record", () => {
    const state = withTable(started(PLENTY), TUNED);
    const stale = { ...state, dinner: { ...state.dinner!, run: { ...state.dinner!.run, revision: 99 } } };
    const cleared = clearRun(stale, 80_000);
    expect(run(cleared).status).toBe("CLEARED");
    expect(cleared.dinner!.settlement).toMatchObject({ kind: "REFUSED", pitz: 0 });
    expect(cleared.pitzBalance).toBe(PITZ);
    expect(records(cleared).records["dm-a"]).toBeUndefined();
  });

  it("17: the last pizza resolved exactly at the deadline is TIME_UP -- no settlement", () => {
    const late = clearRun(withTable(started(PLENTY), TUNED), DURATION);
    expect(run(late).status).toBe("FAILED");
    expect(run(late).outcome).toMatchObject({ reason: "TIME_UP" });
    expect(late.dinner!.settlement).toBeNull();
    expect(late.pitzBalance).toBe(PITZ);
    expect(records(late)).toEqual(EMPTY_DINNER_MISSION_RECORDS_STATE);
  });

  it("17 / 18: one millisecond before the deadline still clears, with clearMs = endedAt - startedAt", () => {
    const edge = clearRun(withTable(started(PLENTY), TUNED), DURATION - 1);
    expect(run(edge).outcome).toEqual({ kind: "CLEAR", endedAt: T0 + DURATION - 1, clearMs: DURATION - 1 });
    expect(edge.dinner!.settlement).toMatchObject({ kind: "SETTLED", clearMs: DURATION - 1, tier: null, pitz: 150 });
  });

  it("FAILED (INFEASIBLE) and ABANDONED runs settle nothing", () => {
    // Exact stock: a second bismarck uses the second egg, so breakfast-pizza can no longer be made.
    let s = withTable(started(EXACT_A), TUNED);
    s = cook(s, "bismarck", T0 + 1000);
    s = nextPizza(s, T0 + 1001);
    s = cook(s, "bismarck", T0 + 2000);
    expect(run(s).outcome).toMatchObject({ reason: "INFEASIBLE" });
    expect(s.dinner!.settlement).toBeNull();
    expect(s.pitzBalance).toBe(PITZ);
    let a = withTable(started(PLENTY), TUNED);
    a = gameReducer(a, { type: "DINNER_REQUEST_ABANDON" });
    a = gameReducer(a, { type: "DINNER_CONFIRM_ABANDON", now: T0 + 10 });
    expect(run(a).outcome).toMatchObject({ reason: "ABANDONED" });
    expect(a.dinner!.settlement).toBeNull();
    expect(a.pitzBalance).toBe(PITZ);
  });
});

describe("records survive every round transition (no stale record -> no second first clear)", () => {
  it("DINNER_EXIT, PLAY_AGAIN, SELECT_RECIPE, RETRY, START_FREE_COOK, Lunch Rush actions keep the records object", () => {
    const paid = gameReducer(clearRun(withTable(started(PLENTY), TUNED), 80_000), { type: "DINNER_EXIT" });
    const kept = records(paid);
    let s = paid;
    for (const action of [
      { type: "PLAY_AGAIN" },
      { type: "SELECT_RECIPE", recipeId: "margherita", now: T0 },
      { type: "RETRY_SAME_RECIPE", now: T0 },
      { type: "START_FREE_COOK", now: T0 },
      { type: "RETRY_SAME_RECIPE", now: T0 },
      { type: "MISSION_RESET_ORDER" },
      { type: "EXIT_TO_FREE" },
    ] as GameAction[]) {
      s = gameReducer(s, action);
      expect(records(s), action.type).toBe(kept);
    }
  });
});

describe("no Dex / discovery / hint / Shop side effects (authority)", () => {
  it("a settled CLEAR leaves the Dex, discovery, hint and Shop state exactly as they were", () => {
    const start = withTable(started(PLENTY), TUNED);
    const cleared = clearRun(start, 80_000);
    expect(cleared.dex).toBe(start.dex);
    expect(cleared.discoveryHintPurchases).toBe(start.discoveryHintPurchases);
    expect(cleared.discoveryHintFacts).toBe(start.discoveryHintFacts);
    expect(cleared.unlockedForShopIngredientIds).toBe(start.unlockedForShopIngredientIds);
    expect(cleared.ownedIngredientIds).toBe(start.ownedIngredientIds);
    expect(cleared.lastDiscovery).toBeNull();
    expect(cleared.lastPitzCredit).toBeNull();
    expect(cleared.lastEfficiencyCredit).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Persistence: the payout and its record in one write (cases 2, 5, 7, 8, 9, 19, 20)
// ---------------------------------------------------------------------------------------------

function fakeStorage(initial?: unknown): StorageLike & { raw(): Record<string, unknown> | undefined; writes: number } {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(SAVE_STORAGE_KEY, JSON.stringify(initial));
  const s = {
    writes: 0,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      s.writes += 1;
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    raw: () => {
      const v = store.get(SAVE_STORAGE_KEY);
      return v === undefined ? undefined : (JSON.parse(v) as Record<string, unknown>);
    },
  };
  return s;
}

/** Exactly the snapshot App's persistence effect builds (src/App.tsx). */
function appSnapshot(state: GameState): ProgressionSnapshot {
  return {
    dex: state.dex,
    pitzBalance: state.pitzBalance,
    ownedIngredientIds: state.ownedIngredientIds,
    inventory: state.inventory,
    starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
    unlockedForShopIngredientIds: state.unlockedForShopIngredientIds,
    discoveryHintPurchases: state.discoveryHintPurchases,
    discoveryHintFacts: state.discoveryHintFacts,
    dinnerMissionRecordUpdates: state.dinnerMissionRecordsState.records,
    requireDinnerRecords: true,
  };
}

/** Hydrates a GameState the way App's lazy initializer does (the ladder resolution is a no-op here). */
function hydrate(storage: StorageLike): GameState {
  const save = loadSave(storage);
  return createInitialGameState(
    save.dex,
    save.ownedIngredientIds,
    save.pitzBalance,
    save.inventory,
    save.starterGrantClaimedRecipeIds,
    save.unlockedForShopIngredientIds,
    save.discoveryHintPurchases,
    save.discoveryHintFacts,
    save.dinnerMissionRecordsState,
  );
}

function seedSave(extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    dex: dexOf([...DM_A_IDS, "marinara"]),
    pitzBalance: PITZ,
    ownedIngredientIds: ALL_IDS,
    missionBest: {},
    inventory: PLENTY,
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: FINITE_IDS,
    ...extra,
  };
}

describe("persistence of a settlement (App's effect)", () => {
  it("5 / 7 / 8: the payout and its record land in ONE save write; reload settles nothing and makes the next clear a repeat", () => {
    const storage = fakeStorage(seedSave());
    const before = storage.writes;
    const cleared = clearRun(withTable(startFrom(hydrate(storage)), TUNED), 80_000);
    persistProgress(appSnapshot(cleared), storage);
    expect(storage.writes - before).toBe(1);
    expect(storage.raw()).toMatchObject({ pitzBalance: PITZ + 250, dinnerMissionRecords: { "dm-a": { clears: 1, firstClearRewarded: true } } });
    const reloaded = hydrate(storage);
    expect(reloaded.pitzBalance).toBe(PITZ + 250);
    expect(reloaded.dinner).toBeNull();
    const again = clearRun(withTable(startFrom(reloaded, S, T0 + 9_000_000), TUNED), 80_000, T0 + 9_000_000);
    expect(again.dinner!.settlement).toMatchObject({ schedule: "REPEAT_CLEAR", pitz: 60 });
  });

  it("2: repeated persistence of the same settled state (rerenders) writes once and never doubles the Pitz", () => {
    const storage = fakeStorage(seedSave());
    const cleared = clearRun(withTable(startFrom(hydrate(storage)), TUNED), 80_000);
    persistProgress(appSnapshot(cleared), storage);
    const writes = storage.writes;
    for (let i = 0; i < 5; i += 1) persistProgress(appSnapshot(cleared), storage);
    expect(storage.writes).toBe(writes);
    expect(storage.raw()!.pitzBalance).toBe(PITZ + 250);
  });

  it("7: a record storage refuses (mission blocked underneath) is never saved -- and neither is its Pitz", () => {
    const storage = fakeStorage(seedSave());
    const cleared = clearRun(withTable(startFrom(hydrate(storage)), TUNED), 80_000);
    // Something else corrupts dm-a in storage while this session is running.
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(seedSave({ dinnerMissionRecords: { "dm-a": { broken: true } } })));
    const writes = storage.writes;
    expect(persistProgress(appSnapshot(cleared), storage)).toEqual({ refusedDinnerMissionIds: ["dm-a"] });
    expect(storage.writes).toBe(writes);
    expect(storage.raw()!.pitzBalance).toBe(PITZ);
    expect((storage.raw()!.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual({ broken: true });
  });

  it("7 (review #1/#2): after a refusal, memory reconciles (payout reverted, mission blocked) and saving resumes", () => {
    const storage = fakeStorage(seedSave());
    const cleared = clearRun(withTable(startFrom(hydrate(storage)), TUNED), 80_000);
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(seedSave({ dinnerMissionRecords: { "dm-a": { broken: true } } })));
    const refused = persistProgress(appSnapshot(cleared), storage);
    // What App does with the result:
    const reconciled = gameReducer(cleared, { type: "DINNER_RECORDS_REFUSED", missionIds: refused.refusedDinnerMissionIds });
    expect(reconciled.pitzBalance).toBe(PITZ); // the unsaved 250 is reverted
    expect(reconciled.dinner!.settlement).toEqual({ kind: "BLOCKED", runKey: `dm-a@1#${T0}`, pitz: 0 });
    expect(records(reconciled).blockedMissionIds).toEqual(["dm-a"]);
    expect(records(reconciled).records["dm-a"]).toBeUndefined();
    // The next save no longer carries dm-a, so it goes through (no session-long freeze), and the
    // broken stored record stays verbatim.
    expect(persistProgress(appSnapshot(reconciled), storage)).toEqual({ refusedDinnerMissionIds: [] });
    expect(storage.raw()!.pitzBalance).toBe(PITZ);
    expect((storage.raw()!.inventory as Record<string, number>).egg).toBe(PLENTY.egg - 2);
    expect((storage.raw()!.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual({ broken: true });
    // Idempotent: a repeated refusal changes nothing; other missions are untouched.
    expect(gameReducer(reconciled, { type: "DINNER_RECORDS_REFUSED", missionIds: ["dm-a"] })).toBe(reconciled);
  });

  it("7: a refusal for a mission that is not the settled one only blocks that mission", () => {
    const base = saved(PLENTY, undefined, recordsOf({ "dm-b": REC_REWARDED }));
    const cleared = clearRun(withTable(startFrom(base), TUNED), 80_000);
    const after = gameReducer(cleared, { type: "DINNER_RECORDS_REFUSED", missionIds: ["dm-b"] });
    expect(after.pitzBalance).toBe(cleared.pitzBalance);
    expect(after.dinner!.settlement).toEqual(cleared.dinner!.settlement);
    expect(records(after).records).toEqual({ "dm-a": records(cleared).records["dm-a"] });
    expect(records(after).blockedMissionIds).toEqual(["dm-b"]);
  });

  it("9: a blocked mission's broken record is carried verbatim; the rest of the progress is saved", () => {
    const broken = { revision: 1, clears: -2, bestClearMs: "?", bestTier: "Z", firstClearRewarded: "no" };
    const storage = fakeStorage(seedSave({ dinnerMissionRecords: { "dm-a": broken } }));
    const cleared = clearRun(withTable(startFrom(hydrate(storage)), TUNED), 80_000);
    expect(cleared.dinner!.settlement!.kind).toBe("BLOCKED");
    expect(persistProgress(appSnapshot(cleared), storage)).toEqual({ refusedDinnerMissionIds: [] });
    expect(storage.raw()!.pitzBalance).toBe(PITZ);
    expect((storage.raw()!.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual(broken);
    expect((storage.raw()!.inventory as Record<string, number>).egg).toBe(PLENTY.egg - 2);
  });

  it("19: after Full Reset the records are gone (the existing reset contract)", () => {
    const storage = fakeStorage(seedSave({ dinnerMissionRecords: { "dm-a": REC_REWARDED } }));
    expect(records(hydrate(storage)).records["dm-a"]).toEqual(REC_REWARDED);
    storage.removeItem(SAVE_STORAGE_KEY); // what resetSave does before App reloads
    expect(records(hydrate(storage))).toEqual(EMPTY_DINNER_MISSION_RECORDS_STATE);
  });

  it("20: an existing save without Dinner records hydrates to empty and is written without the key until a clear", () => {
    const storage = fakeStorage(seedSave());
    const state = hydrate(storage);
    expect(records(state)).toEqual(EMPTY_DINNER_MISSION_RECORDS_STATE);
    persistProgress(appSnapshot({ ...state, pitzBalance: PITZ + 1 }), storage);
    expect(storage.raw()!.pitzBalance).toBe(PITZ + 1);
    expect(storage.raw()).not.toHaveProperty("dinnerMissionRecords");
  });
});

describe("App wiring (the one persistence effect)", () => {
  const app = Object.values(import.meta.glob<string>("../App.tsx", { query: "?raw", import: "default", eager: true }))[0];
  const effect = app.slice(app.indexOf("persistProgress({"), app.indexOf("]);", app.indexOf("persistProgress({")) + 3);

  it("passes the records with the atomic flag, and re-runs when the records change", () => {
    expect(effect).toContain("dinnerMissionRecordUpdates: state.dinnerMissionRecordsState.records");
    expect(effect).toContain("requireDinnerRecords: true");
    expect(effect).toContain("state.dinnerMissionRecordsState,");
    expect(effect).toContain('dispatch({ type: "DINNER_RECORDS_REFUSED", missionIds: persisted.refusedDinnerMissionIds })');
  });

  it("hydrates the records (blocked missions included) from the save", () => {
    expect(app).toContain("save.dinnerMissionRecordsState,");
  });
});
