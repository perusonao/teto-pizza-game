import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../../data/ingredients";
import type { DexEntry, DexState } from "../../state/dex";
import { getDinnerMission, type DinnerMissionDefinition } from "./dinnerMission";
import {
  DINNER_PHASE1_REWARD_TABLE_ID,
  getDinnerRewardTable,
  type DinnerClearTier,
  type DinnerRewardTable,
} from "./dinnerReward";
import { dinnerRunReducer, startDinnerRun, type DinnerAttempt, type DinnerRunState } from "./dinnerRun";
import {
  DINNER_DEFAULT_REVISION_POLICY,
  decideDinnerSettlement,
  dinnerMissionRecordProblems,
  dinnerRecordForRevision,
  dinnerRunKey,
  emptyDinnerMissionRecord,
  isBetterDinnerTier,
  isValidDinnerMissionRecord,
  validateDinnerRewardEconomy,
  type DinnerMissionRecord,
  type DinnerSettlementDecision,
  type DinnerSettlementInput,
} from "./dinnerSettlement";

/**
 * DM-4-1 (Issue #257): the pure settlement model. Every Pitz amount and threshold below is a
 * TEST FIXTURE -- the production values are DM-5-2's (OD-DM4-1 / OD-DM5-2 / OD-DM5-3). IDs E01..E24
 * refer to the Phase 4-0 exploit matrix (docs/reports/TETO_DINNER-MISSION_DM-4_Phase4-0_Plan.md §9).
 */

const DM_A = getDinnerMission("dm-a")!;
const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const T0 = 1_000_000;
const DURATION = 300_000;

/** RW-B-shaped test table (not production numbers). */
const TABLE: DinnerRewardTable = {
  tableId: "test-rw-b",
  thresholds: { goldMaxClearMs: 90_000, silverMaxClearMs: 150_000, bronzeMaxClearMs: 300_000 },
  pitz: {
    firstClear: { clear: 150, tierBonus: { GOLD: 100, SILVER: 50, BRONZE: 20 } },
    repeatClear: { clear: 30, tierBonus: { GOLD: 30, SILVER: 15, BRONZE: 5 } },
  },
};

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
}

/** A run built through the real DM-1 run machine, cleared (or not) at `T0 + elapsedMs`. */
function realRun(completeCount: number, lastAtMs: number): DinnerRunState {
  const started = startDinnerRun(
    DM_A,
    { dex: dexOf(DM_A_IDS), ownedIngredientIds: INGREDIENTS.map((i) => i.id), inventory: { egg: 9, bacon: 9, mushroom: 9 } },
    T0,
    DURATION,
  );
  if (!started.ok) throw new Error("start blocked");
  let run = started.state;
  const stock = { ownedIngredientIds: INGREDIENTS.map((i) => i.id), inventory: { egg: 9, bacon: 9, mushroom: 9 } };
  DM_A_IDS.slice(0, completeCount).forEach((id, i) => {
    const attempt: DinnerAttempt = {
      at: 0,
      category: "TARGET_PASS",
      identityRecipeId: id,
      displayedRecipeId: id,
      completedTargetId: id,
      stars: 4,
      consumed: {},
    };
    const now = i === completeCount - 1 ? T0 + lastAtMs : T0 + 1_000 * (i + 1);
    run = dinnerRunReducer(run, { type: "RESOLVE_ATTEMPT", attempt, stock, now });
  });
  return run;
}

/** Long enough for every fixture clear time (the boundaries go past 300 000 ms). */
const SYNTHETIC_DURATION = 1_000_000;

/** A synthetic CLEARED run of DM-A (for fine-grained clear times). The outcome is derived from the
 *  clock exactly as the run machine does (`endedAt = startedAt + clearMs`) unless overridden. */
function clearedRun(clearMs: number, overrides: Partial<DinnerRunState> = {}): DinnerRunState {
  const startedAt = overrides.clock?.startedAt ?? T0;
  return {
    missionId: "dm-a",
    revision: DM_A.revision,
    status: "CLEARED",
    targetRecipeIds: DM_A_IDS,
    completedRecipeIds: DM_A_IDS,
    clock: { startedAt, endsAt: startedAt + SYNTHETIC_DURATION },
    attempts: [],
    outcome: { kind: "CLEAR", endedAt: startedAt + clearMs, clearMs },
    ...overrides,
  };
}

/** A later run (retry / next session) starting at `startedAt`. */
function laterRun(clearMs: number, startedAt: number): DinnerRunState {
  return clearedRun(clearMs, { clock: { startedAt, endsAt: startedAt + SYNTHETIC_DURATION } });
}

function input(over: Partial<DinnerSettlementInput> = {}): DinnerSettlementInput {
  return { run: clearedRun(120_000), mission: DM_A, record: undefined, table: TABLE, settledRunKey: null, ...over };
}

function settle(over: Partial<DinnerSettlementInput> = {}) {
  const d = decideDinnerSettlement(input(over));
  if (d.kind !== "SETTLE") throw new Error(`expected SETTLE, got ${JSON.stringify(d)}`);
  return d;
}

function record(over: Partial<DinnerMissionRecord> = {}): DinnerMissionRecord {
  return { revision: DM_A.revision, clears: 1, bestClearMs: 120_000, bestTier: "SILVER", firstClearRewarded: true, ...over };
}

describe("first clear / repeat clear (OD-DM4-1, E01, E06)", () => {
  it("E01: the first clear pays the first-clear schedule once and records the clear", () => {
    const d = settle({ run: clearedRun(80_000) });
    expect(d).toMatchObject({ schedule: "FIRST_CLEAR", tier: "GOLD", pitz: 250, newBestTime: true, newBestTier: true });
    expect(d.record).toEqual({ revision: 1, clears: 1, bestClearMs: 80_000, bestTier: "GOLD", firstClearRewarded: true });
  });

  it("E06: once the first clear is rewarded, a later run (retry / reload) pays the repeat schedule", () => {
    const first = settle({ run: clearedRun(120_000) });
    const retryRun = laterRun(120_000, T0 + 5_000_000);
    const second = settle({ run: retryRun, record: first.record, settledRunKey: first.runKey });
    expect(second).toMatchObject({ schedule: "REPEAT_CLEAR", tier: "SILVER", pitz: 45 });
    expect(second.record.clears).toBe(2);
    expect(second.record.firstClearRewarded).toBe(true);
  });

  it("first-clear status comes only from the persisted record, never from run state", () => {
    // Same run, two records: the flag alone flips the schedule.
    expect(settle({ record: undefined }).schedule).toBe("FIRST_CLEAR");
    expect(settle({ record: record({ firstClearRewarded: false }) }).schedule).toBe("FIRST_CLEAR");
    expect(settle({ record: record({ firstClearRewarded: true }) }).schedule).toBe("REPEAT_CLEAR");
  });

  it("a clear slower than BRONZE still clears: base pay, no tier", () => {
    expect(settle({ run: clearedRun(300_001) })).toMatchObject({ tier: null, pitz: 150, schedule: "FIRST_CLEAR" });
  });
});

describe("best time / best tier move only one way (E14)", () => {
  it("a better time replaces the best; a worse one keeps it", () => {
    expect(settle({ run: clearedRun(100_000), record: record() })).toMatchObject({ newBestTime: true, record: { bestClearMs: 100_000 } });
    const worse = settle({ run: clearedRun(140_000), record: record() });
    expect(worse.newBestTime).toBe(false);
    expect(worse.record.bestClearMs).toBe(120_000);
  });

  it("an equal time is not a new best", () => {
    expect(settle({ run: clearedRun(120_000), record: record() }).newBestTime).toBe(false);
  });

  it.each<[DinnerClearTier | null, number, DinnerClearTier | null, boolean]>([
    ["SILVER", 80_000, "GOLD", true],
    ["SILVER", 140_000, "SILVER", false],
    ["SILVER", 200_000, "SILVER", false],
    ["SILVER", 400_000, "SILVER", false],
    ["BRONZE", 150_000, "SILVER", true],
    [null, 300_000, "BRONZE", true],
    ["GOLD", 90_001, "GOLD", false],
  ])("best %s + clear at %i ms -> best %s (new: %s)", (best, ms, expected, isNew) => {
    const d = settle({ run: clearedRun(ms), record: record({ bestTier: best, bestClearMs: 1 }) });
    expect(d.record.bestTier).toBe(expected);
    expect(d.newBestTier).toBe(isNew);
  });

  it("tier and time are independent: a faster time with no tier keeps the tier best", () => {
    const d = settle({ run: clearedRun(500_000), record: record({ bestClearMs: 600_000, bestTier: "BRONZE" }) });
    expect(d.record).toMatchObject({ bestClearMs: 500_000, bestTier: "BRONZE" });
  });

  it("isBetterDinnerTier is strict: GOLD > SILVER > BRONZE > none", () => {
    expect(isBetterDinnerTier("GOLD", "SILVER")).toBe(true);
    expect(isBetterDinnerTier("BRONZE", null)).toBe(true);
    expect(isBetterDinnerTier("SILVER", "SILVER")).toBe(false);
    expect(isBetterDinnerTier(null, "BRONZE")).toBe(false);
    expect(isBetterDinnerTier("BRONZE", "GOLD")).toBe(false);
  });
});

describe("exact threshold boundaries (inclusive upper bounds)", () => {
  it.each<[number, DinnerClearTier | null, number]>([
    [0, "GOLD", 250],
    [90_000, "GOLD", 250],
    [90_001, "SILVER", 200],
    [150_000, "SILVER", 200],
    [150_001, "BRONZE", 170],
    [300_000, "BRONZE", 170],
    [300_001, null, 150],
  ])("%i ms -> %s, first clear pays %i", (ms, tier, pitz) => {
    expect(settle({ run: clearedRun(ms) })).toMatchObject({ tier, pitz });
  });
});

describe("FAILED / TIME_UP / ABANDON / partial: 0 Pitz and no record change (OD-DM4-2, E09, E10, E11)", () => {
  const failures: [string, DinnerRunState][] = [
    ["TIME_UP", dinnerRunReducer(realRun(0, 0), { type: "TICK", now: T0 + DURATION })],
    ["ABANDONED", dinnerRunReducer(realRun(0, 0), { type: "ABANDON", now: T0 + 5_000 })],
    ["INFEASIBLE", { ...clearedRun(1), status: "FAILED", outcome: { kind: "FAILED", reason: "INFEASIBLE", endedAt: T0 + 1, shortages: [] } }],
    ["E11 3/4 then TIME_UP", dinnerRunReducer(realRun(3, 3_000), { type: "TICK", now: T0 + DURATION })],
    ["still PLAYING", realRun(3, 3_000)],
  ];

  it.each(failures)("%s -> NO_SETTLEMENT, nothing to pay or record", (_name, run) => {
    const rec = deepFreeze(record());
    const d = decideDinnerSettlement({ run, mission: DM_A, record: rec, table: TABLE, settledRunKey: null });
    expect(d).toEqual({ kind: "NO_SETTLEMENT", reason: "NOT_CLEARED", problems: [] });
    expect(d).not.toHaveProperty("pitz");
    expect(d).not.toHaveProperty("record");
  });

  it.each<[string, Partial<DinnerRunState>]>([
    ["status FAILED with a CLEAR outcome", { status: "FAILED" }],
    ["status PLAYING with a CLEAR outcome", { status: "PLAYING" }],
    ["status CLEARED with a FAILED outcome", { outcome: { kind: "FAILED", reason: "TIME_UP", endedAt: T0 } }],
    ["status CLEARED with no outcome", { outcome: null }],
  ])("adversarial: %s is not a clear", (_name, over) => {
    expect(decideDinnerSettlement(input({ run: clearedRun(80_000, over) }))).toMatchObject({ kind: "NO_SETTLEMENT", reason: "NOT_CLEARED" });
  });

  it("a failed run needs neither a table, a mission nor a valid record to be refused", () => {
    const run = dinnerRunReducer(realRun(0, 0), { type: "ABANDON", now: T0 + 1 });
    expect(decideDinnerSettlement({ run, mission: undefined, record: undefined, table: undefined, settledRunKey: null }).kind).toBe(
      "NO_SETTLEMENT",
    );
  });

  it("E09: the last pizza resolved exactly at the deadline is TIME_UP, not a clear", () => {
    const run = realRun(4, DURATION);
    expect(run.status).toBe("FAILED");
    expect(decideDinnerSettlement(input({ run }))).toMatchObject({ kind: "NO_SETTLEMENT", reason: "NOT_CLEARED" });
  });

  it("the real run machine's CLEAR settles with its own clearMs", () => {
    const run = realRun(4, 100_000);
    expect(run.status).toBe("CLEARED");
    expect(settle({ run })).toMatchObject({ clearMs: 100_000, tier: "SILVER", schedule: "FIRST_CLEAR", pitz: 200 });
  });
});

describe("reward table unavailable (E12)", () => {
  const untuned = getDinnerRewardTable(DINNER_PHASE1_REWARD_TABLE_ID)!;

  it.each<[string, DinnerRewardTable | null | undefined]>([
    ["undefined", undefined],
    ["null", null],
    ["the shipped untuned table", untuned],
    ["thresholds only (pitz null)", { ...TABLE, pitz: null }],
    ["invalid (unordered thresholds)", { ...TABLE, thresholds: { goldMaxClearMs: 3, silverMaxClearMs: 2, bronzeMaxClearMs: 1 } }],
    ["invalid (negative amount)", { ...TABLE, pitz: { ...TABLE.pitz!, repeatClear: { clear: -5, tierBonus: { GOLD: 0, SILVER: 0, BRONZE: 0 } } } }],
    ["malformed (schedule missing)", { ...TABLE, pitz: {} } as unknown as DinnerRewardTable],
  ])("%s: pays 0, keeps the first-clear entitlement, still records the clear", (_name, table) => {
    const d = settle({ table, run: clearedRun(80_000) });
    expect(d.pitz).toBe(0);
    expect(d.schedule).toBe("UNAVAILABLE");
    expect(d.record.firstClearRewarded).toBe(false);
    expect(d.record.clears).toBe(1);
    expect(d.record.bestClearMs).toBe(80_000);
    expect(d.tableProblems.length).toBeGreaterThan(0);
  });

  it("the first-clear entitlement survives an unpaid clear and is used by the first real payment", () => {
    const unpaid = settle({ table: null });
    const paid = settle({ record: unpaid.record, run: laterRun(80_000, T0 + 1) });
    expect(paid).toMatchObject({ schedule: "FIRST_CLEAR", pitz: 250 });
    expect(paid.record).toMatchObject({ clears: 2, firstClearRewarded: true });
  });
});

describe("exactly once / replay (OD-DM4-3, E02, E03, E05)", () => {
  it("the same run key is refused once settled", () => {
    const first = settle();
    expect(decideDinnerSettlement(input({ record: first.record, settledRunKey: first.runKey }))).toEqual({
      kind: "NO_SETTLEMENT",
      reason: "ALREADY_SETTLED",
      problems: [],
    });
  });

  it("a replay of the old input with the backstop set is refused as well (no double pay)", () => {
    const first = settle();
    expect(decideDinnerSettlement(input({ settledRunKey: first.runKey })).kind).toBe("NO_SETTLEMENT");
  });

  it("a run key is mission + revision + start instant", () => {
    expect(dinnerRunKey(clearedRun(1))).toBe(`dm-a@1#${T0}`);
    expect(dinnerRunKey(laterRun(1, T0 + 1))).not.toBe(dinnerRunKey(clearedRun(1)));
  });

  it("E03: TICK / ABANDON after CLEAR cannot change the run, so the decision is unchanged", () => {
    const run = realRun(4, 100_000);
    const after = dinnerRunReducer(dinnerRunReducer(run, { type: "TICK", now: T0 + DURATION + 1 }), { type: "ABANDON", now: T0 + 1 });
    expect(after).toBe(run);
    expect(decideDinnerSettlement(input({ run: after }))).toEqual(decideDinnerSettlement(input({ run })));
  });

  it("feeding the settled record back as the next record never re-pays the first clear (chain of 5 runs)", () => {
    let rec: DinnerMissionRecord | undefined;
    let settledRunKey: string | null = null;
    const pays: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const d = settle({ run: laterRun(80_000, T0 + i * 10_000_000), record: rec, settledRunKey });
      pays.push(d.pitz);
      rec = d.record;
      settledRunKey = d.runKey;
    }
    expect(pays).toEqual([250, 60, 60, 60, 60]);
    expect(rec!.clears).toBe(5);
  });
});

describe("determinism and no mutation", () => {
  it("the same input gives an equal output, every time", () => {
    const a = decideDinnerSettlement(input({ record: record() }));
    for (let i = 0; i < 20; i += 1) expect(decideDinnerSettlement(input({ record: record() }))).toEqual(a);
  });

  it("nothing passed in is mutated (deep-frozen inputs)", () => {
    const frozen = deepFreeze(input({ record: record(), run: clearedRun(80_000) }));
    const before = JSON.stringify(frozen);
    expect(() => decideDinnerSettlement(frozen)).not.toThrow();
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("the returned record is a new object", () => {
    const rec = record();
    expect(settle({ record: rec }).record).not.toBe(rec);
  });
});

describe("malformed input fails closed (nothing paid, nothing recorded)", () => {
  const cases: [string, Partial<DinnerSettlementInput>][] = [
    ["negative clearMs", { run: clearedRun(-1) }],
    ["NaN clearMs", { run: clearedRun(Number.NaN) }],
    ["Infinity clearMs", { run: clearedRun(Number.POSITIVE_INFINITY) }],
    ["unknown mission", { mission: undefined, run: clearedRun(1, { missionId: "dm-zzz" }) }],
    ["run / mission id mismatch", { mission: getDinnerMission("dm-b") }],
    ["stale run revision", { run: clearedRun(1, { revision: 2 }) }],
    ["mission revision not a positive integer", { mission: { ...DM_A, revision: 0 } as DinnerMissionDefinition }],
    ["broken clock", { run: clearedRun(1, { clock: null as unknown as DinnerRunState["clock"] }) }],
    ["non-finite endsAt", { run: clearedRun(1, { clock: { startedAt: T0, endsAt: Number.POSITIVE_INFINITY } }) }],
    ["endsAt not after startedAt", { run: clearedRun(1, { clock: { startedAt: T0, endsAt: T0 } }) }],
    ["clear at the deadline", { run: clearedRun(1, { clock: { startedAt: T0, endsAt: T0 + 50_000 }, outcome: { kind: "CLEAR", endedAt: T0 + 50_000, clearMs: 50_000 } }) }],
    ["clear after the deadline", { run: clearedRun(1, { clock: { startedAt: T0, endsAt: T0 + 50_000 }, outcome: { kind: "CLEAR", endedAt: T0 + 60_000, clearMs: 60_000 } }) }],
    ["clearMs shorter than endedAt - startedAt (fake GOLD)", { run: clearedRun(1, { outcome: { kind: "CLEAR", endedAt: T0 + 200_000, clearMs: 1_000 } }) }],
    ["clearMs longer than endedAt - startedAt", { run: clearedRun(1, { outcome: { kind: "CLEAR", endedAt: T0 + 1_000, clearMs: 2_000 } }) }],
    ["endedAt before startedAt", { run: clearedRun(1, { outcome: { kind: "CLEAR", endedAt: T0 - 1, clearMs: 0 } }) }],
    ["non-finite endedAt", { run: clearedRun(1, { outcome: { kind: "CLEAR", endedAt: Number.NaN, clearMs: 1 } }) }],
    ["record: string", { record: "x" as unknown as DinnerMissionRecord }],
    ["record: negative clears", { record: record({ clears: -1 }) }],
    ["record: fractional revision", { record: record({ revision: 1.5 }) }],
    ["record: bad tier", { record: record({ bestTier: "PLATINUM" as DinnerClearTier }) }],
    ["record: NaN best", { record: record({ bestClearMs: Number.NaN }) }],
    ["record: flag not boolean", { record: record({ firstClearRewarded: 1 as unknown as boolean }) }],
    ["record: rewarded with zero clears", { record: record({ clears: 0 }) }],
  ];

  it.each(cases)("%s -> INVALID_INPUT", (_name, over) => {
    const d = decideDinnerSettlement(input(over));
    expect(d.kind).toBe("NO_SETTLEMENT");
    expect(d).toMatchObject({ reason: "INVALID_INPUT" });
    expect((d as Extract<DinnerSettlementDecision, { kind: "NO_SETTLEMENT" }>).problems.length).toBeGreaterThan(0);
  });

  it("a missing run is refused, not thrown", () => {
    expect(decideDinnerSettlement(input({ run: null as unknown as DinnerRunState })).kind).toBe("NO_SETTLEMENT");
  });

  it("record validation", () => {
    expect(isValidDinnerMissionRecord(emptyDinnerMissionRecord(1))).toBe(true);
    expect(isValidDinnerMissionRecord(record())).toBe(true);
    expect(dinnerMissionRecordProblems(null)).toEqual(["record is not an object"]);
    expect(dinnerMissionRecordProblems([])).toEqual(["record is not an object"]);
    expect(isValidDinnerMissionRecord({ ...record(), bestClearMs: -1 })).toBe(false);
  });
});

describe("mission revision semantics (U-1: V-1 default, V-2 selectable)", () => {
  const old = record({ revision: 1, clears: 3, bestClearMs: 50_000, bestTier: "GOLD", firstClearRewarded: true });
  const DM_A_R2 = { ...DM_A, revision: 2 };
  const runR2 = clearedRun(140_000, { revision: 2 });

  it("the default policy is the Phase 4-0 proposal V-1", () => {
    expect(DINNER_DEFAULT_REVISION_POLICY).toBe("KEEP_REWARD_RESET_BESTS");
  });

  it("V-1: first-clear payment and clear count survive, the bests restart", () => {
    const d = settle({ mission: DM_A_R2, run: runR2, record: old });
    expect(d.schedule).toBe("REPEAT_CLEAR");
    expect(d.record).toEqual({ revision: 2, clears: 4, bestClearMs: 140_000, bestTier: "SILVER", firstClearRewarded: true });
    expect(d).toMatchObject({ newBestTime: true, newBestTier: true });
  });

  it("V-2: everything is kept", () => {
    const d = settle({ mission: DM_A_R2, run: runR2, record: old, revisionPolicy: "KEEP_ALL" });
    expect(d.record).toEqual({ revision: 2, clears: 4, bestClearMs: 50_000, bestTier: "GOLD", firstClearRewarded: true });
  });

  it("a record from a newer revision is handled by the same policy (never re-pays the first clear)", () => {
    const newer = record({ revision: 5, firstClearRewarded: true });
    expect(settle({ record: newer }).schedule).toBe("REPEAT_CLEAR");
  });

  it("dinnerRecordForRevision: no record starts empty at the mission revision", () => {
    expect(dinnerRecordForRevision(undefined, 3)).toEqual(emptyDinnerMissionRecord(3));
    expect(dinnerRecordForRevision(old, 1)).toEqual(old);
  });
});

describe("economy invariants of a tuned table (OD-DM4-1 I1..I4; limits are inputs)", () => {
  const LIMITS = { maxFirstClearPitz: 250, lunchRushPitzPerMinute: 140 / 3, fastestHumanClearMs: 80_000 };

  it("the RW-B-shaped fixture passes; an untuned table has nothing to check", () => {
    expect(validateDinnerRewardEconomy(TABLE, LIMITS)).toEqual([]);
    expect(validateDinnerRewardEconomy({ ...TABLE, pitz: null }, LIMITS)).toEqual([]);
  });

  it("I1: first clear over the cap", () => {
    const t = { ...TABLE, pitz: { ...TABLE.pitz!, firstClear: { clear: 200, tierBonus: { GOLD: 100, SILVER: 50, BRONZE: 20 } } } };
    expect(validateDinnerRewardEconomy(t, LIMITS).join()).toContain("I1");
  });

  it("I2: repeat farming beating Lunch Rush per minute", () => {
    expect(validateDinnerRewardEconomy(TABLE, { ...LIMITS, fastestHumanClearMs: 60_000 }).join()).toContain("I2");
  });

  it("I3: repeat must pay less than the first clear", () => {
    const t = { ...TABLE, pitz: { firstClear: TABLE.pitz!.repeatClear, repeatClear: TABLE.pitz!.repeatClear } };
    expect(validateDinnerRewardEconomy(t, LIMITS).join()).toContain("I3");
  });

  it("I3 is checked per tier, not only at the maxima (Codex review on 5770016)", () => {
    // Max repeat 110 < max first 200, yet SILVER / BRONZE / no-tier repeats pay 110 > 100.
    const t: DinnerRewardTable = {
      ...TABLE,
      pitz: {
        firstClear: { clear: 100, tierBonus: { GOLD: 100, SILVER: 0, BRONZE: 0 } },
        repeatClear: { clear: 110, tierBonus: { GOLD: 0, SILVER: 0, BRONZE: 0 } },
      },
    };
    const problems = validateDinnerRewardEconomy(t, { ...LIMITS, fastestHumanClearMs: 600_000 });
    expect(problems.filter((p) => p.startsWith("I3"))).toEqual([
      "I3: repeat clear (110) must pay less than the first clear (100) at SILVER",
      "I3: repeat clear (110) must pay less than the first clear (100) at BRONZE",
      "I3: repeat clear (110) must pay less than the first clear (100) at no tier",
    ]);
  });

  it("I4: tier bonuses must be ordered", () => {
    const t = { ...TABLE, pitz: { ...TABLE.pitz!, repeatClear: { clear: 1, tierBonus: { GOLD: 1, SILVER: 5, BRONZE: 0 } } } };
    expect(validateDinnerRewardEconomy(t, LIMITS).join()).toContain("I4");
  });

  it("invalid limits and malformed tables are reported, never assumed", () => {
    expect(validateDinnerRewardEconomy(TABLE, { ...LIMITS, fastestHumanClearMs: 0 })).toContain("limit fastestHumanClearMs is invalid");
    expect(validateDinnerRewardEconomy({ ...TABLE, pitz: {} } as unknown as DinnerRewardTable, LIMITS)).toContain(
      "reward table is malformed",
    );
  });
});

describe("boundaries of the pure layer (OD-DM4-1 / OD-DM4-5 / OD-DM5-2)", () => {
  const source = Object.values(
    import.meta.glob<string>("./dinnerSettlement.ts", { query: "?raw", import: "default", eager: true }),
  )[0];

  it("imports only the Dinner pure modules: no Dex, reducer, save, UI or economy", () => {
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(imports).toEqual(["./dinnerMission", "./dinnerReward", "./dinnerRun"]);
  });

  it("holds no reward amounts or time limits of its own (the table is always an argument)", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(/\b(250|320|355)\b/);
    expect(code).not.toMatch(/(firstClear|repeatClear)\s*:\s*\{/);
    expect(code).not.toMatch(/(gold|silver|bronze)MaxClearMs\s*:/);
  });

  it("a settlement never carries Dex fields", () => {
    const d = settle();
    for (const key of ["dex", "timesMade", "bestScore", "bestStars", "discovered"]) {
      expect(JSON.stringify(d)).not.toContain(`"${key}"`);
    }
  });

  it("the shipped missions still have no production time limit or quality gate (DM-5-2)", () => {
    expect(getDinnerMission("dm-a")!.timeLimit.seconds).toBeNull();
    expect(getDinnerMission("dm-b")!.timeLimit.seconds).toBeNull();
    expect(getDinnerMission("dm-a")!.quality.minimumStars).toBeNull();
    expect(getDinnerRewardTable(DINNER_PHASE1_REWARD_TABLE_ID)).toMatchObject({ thresholds: null, pitz: null });
  });
});
