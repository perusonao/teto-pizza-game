import { describe, expect, it } from "vitest";
import { getDinnerMission } from "../mission/dinner/dinnerMission";
import {
  decideDinnerSettlement,
  type DinnerMissionRecord,
} from "../mission/dinner/dinnerSettlement";
import type { DinnerRewardTable } from "../mission/dinner/dinnerReward";
import type { DinnerRunState } from "../mission/dinner/dinnerRun";
import {
  EMPTY_DINNER_MISSION_RECORDS_STATE,
  isDinnerMissionRecordBlocked,
  mergeDinnerMissionRecord,
  mergeDinnerMissionRecordsForWrite,
  parseDinnerMissionRecords,
} from "./dinnerMissionRecordsSave";
import {
  createDefaultSave,
  loadSave,
  persistDex,
  persistMissionBest,
  persistProgress,
  resetSave,
  SAVE_STORAGE_KEY,
  type ProgressionSnapshot,
  type StorageLike,
} from "./persistence";

/**
 * Dinner Mission DM-4-2 (Issue #274): `dinnerMissionRecords` persistence. Authority: Phase 4-0 §6 and
 * the Owner Decisions of 2026-09-27 (revision policy V-1; a broken saved record is fail-closed:
 * never deleted, repaired, rebuilt, replaced or read as first-clear-not-rewarded; its mission is
 * blocked; nothing else is). Numbered cases refer to the DM-4-2 request (1..20).
 */

function fakeStorage(initial?: unknown): StorageLike & { raw(): Record<string, unknown> | undefined; text(): string | null; writes: number } {
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
    text: () => store.get(SAVE_STORAGE_KEY) ?? null,
  };
  return s;
}

/** A save as stored on disk (never a stringified `PersistentSaveV2`: its Dinner field is parsed state). */
function storedSave(extra: Record<string, unknown> = {}) {
  const { dinnerMissionRecords: _parsed, ...stored } = createDefaultSave();
  void _parsed;
  return {
    ...stored,
    dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
    pitzBalance: 100,
    ...extra,
  };
}

function snapshotOf(storage: StorageLike, over: Partial<ProgressionSnapshot> = {}): ProgressionSnapshot {
  const s = loadSave(storage);
  return {
    dex: s.dex,
    pitzBalance: s.pitzBalance,
    ownedIngredientIds: s.ownedIngredientIds,
    inventory: s.inventory,
    starterGrantClaimedRecipeIds: s.starterGrantClaimedRecipeIds,
    ...over,
  };
}

const REC: DinnerMissionRecord = { revision: 1, clears: 2, bestClearMs: 95_000, bestTier: "SILVER", firstClearRewarded: true };
const REC_B: DinnerMissionRecord = { revision: 1, clears: 1, bestClearMs: 200_000, bestTier: null, firstClearRewarded: true };
const BROKEN = { revision: 1, clears: -3, bestClearMs: "fast", bestTier: "PLATINUM", firstClearRewarded: "yes" };

describe("load (cases 1, 2, 3, 4, 7-10)", () => {
  it("1: a fresh save has no records and nothing blocked", () => {
    expect(loadSave(fakeStorage()).dinnerMissionRecords).toEqual(EMPTY_DINNER_MISSION_RECORDS_STATE);
    expect(createDefaultSave().dinnerMissionRecords).toEqual(EMPTY_DINNER_MISSION_RECORDS_STATE);
  });

  it("2: an old save without the key loads as empty, and the rest of it is unchanged", () => {
    const old = storedSave();
    const loaded = loadSave(fakeStorage(old));
    expect(loaded.dinnerMissionRecords).toEqual(EMPTY_DINNER_MISSION_RECORDS_STATE);
    expect(loaded.pitzBalance).toBe(100);
    expect(loaded.dex).toEqual(old.dex);
  });

  it("3 / 7-10: a valid record loads with every field intact", () => {
    const loaded = loadSave(fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": REC } })));
    expect(loaded.dinnerMissionRecords).toEqual({ records: { "dm-a": REC }, blockedMissionIds: [], containerCorrupt: false });
  });

  it("4: several missions load independently", () => {
    const loaded = loadSave(fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": REC, "dm-b": REC_B } })));
    expect(loaded.dinnerMissionRecords.records).toEqual({ "dm-a": REC, "dm-b": REC_B });
  });

  it("an older (pre-DM-4-2) save with no key, and a v1 save, both load as empty", () => {
    const v1 = { schemaVersion: 1, dex: [], pitzBalance: 5, ownedIngredientIds: [], missionBest: {} };
    expect(loadSave(fakeStorage(v1)).dinnerMissionRecords).toEqual(EMPTY_DINNER_MISSION_RECORDS_STATE);
  });
});

describe("fail-closed broken records (cases 12, 13, 14)", () => {
  it("12: a broken record blocks only its own mission, and is NOT normalized to a fresh/default record", () => {
    const loaded = loadSave(fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": BROKEN, "dm-b": REC_B } })));
    const state = loaded.dinnerMissionRecords;
    expect(state.blockedMissionIds).toEqual(["dm-a"]);
    expect(state.records).toEqual({ "dm-b": REC_B });
    expect(state.records["dm-a"]).toBeUndefined();
    expect(isDinnerMissionRecordBlocked(state, "dm-a")).toBe(true);
    expect(isDinnerMissionRecordBlocked(state, "dm-b")).toBe(false);
    // Nothing else in the save is affected.
    expect(loaded.pitzBalance).toBe(100);
  });

  it.each([
    ["negative clears", { ...REC, clears: -1 }],
    ["bad tier", { ...REC, bestTier: "PLATINUM" }],
    ["flag as a string", { ...REC, firstClearRewarded: "true" }],
    ["NaN best", { ...REC, bestClearMs: Number.NaN }],
    ["rewarded with no clears", { ...REC, clears: 0 }],
    ["not an object", 7],
    ["null", null],
    ["array", [REC]],
    ["missing field", { revision: 1, clears: 1, bestClearMs: null, bestTier: null }],
  ])("12: %s is blocked", (_n, value) => {
    expect(parseDinnerMissionRecords({ "dm-a": value }).blockedMissionIds).toEqual(["dm-a"]);
  });

  it("13: a broken record survives every write path verbatim (never deleted, never repaired)", () => {
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": BROKEN, "dm-b": REC_B } }));
    persistProgress(snapshotOf(storage, { pitzBalance: 250 }), storage);
    persistDex([{ recipeId: "funghi", discovered: true, bestScore: 60, bestStars: 3, timesMade: 1 }], storage);
    persistMissionBest("lunch-rush", 500, storage);
    const raw = storage.raw()!;
    expect(raw.pitzBalance).toBe(250);
    expect((raw.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual(BROKEN);
    expect((raw.dinnerMissionRecords as Record<string, unknown>)["dm-b"]).toEqual(REC_B);
  });

  it("13: a write aimed at a blocked mission is refused -- the broken record is not overwritten", () => {
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": BROKEN } }));
    const fresh: DinnerMissionRecord = { revision: 1, clears: 1, bestClearMs: 80_000, bestTier: "GOLD", firstClearRewarded: true };
    persistProgress(snapshotOf(storage, { pitzBalance: 999, dinnerMissionRecordUpdates: { "dm-a": fresh } }), storage);
    expect((storage.raw()!.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual(BROKEN);
    // The rest of the snapshot is still saved (other progress is never blocked).
    expect(storage.raw()!.pitzBalance).toBe(999);
    expect(mergeDinnerMissionRecordsForWrite({ "dm-a": BROKEN }, { "dm-a": fresh })).toMatchObject({
      changed: false,
      refusedMissionIds: ["dm-a"],
    });
  });

  it("13: an update that touches only a blocked mission causes no write at all", () => {
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": BROKEN } }));
    const text = storage.text();
    const writes = storage.writes;
    persistProgress(snapshotOf(storage, { dinnerMissionRecordUpdates: { "dm-a": REC } }), storage);
    expect(storage.writes).toBe(writes);
    expect(storage.text()).toBe(text);
  });

  it("14: a broken record never reads as first-clear-not-rewarded, so settlement is refused", () => {
    const loaded = loadSave(fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": BROKEN } }))).dinnerMissionRecords;
    expect(isDinnerMissionRecordBlocked(loaded, "dm-a")).toBe(true);
    // The DM-4-1 authority refuses the raw broken record too (fail closed, never re-pays).
    const run = clearedRun();
    const decision = decideDinnerSettlement({
      run,
      mission: getDinnerMission("dm-a"),
      record: BROKEN as unknown as DinnerMissionRecord,
      table: TABLE,
      settledRunKey: null,
    });
    expect(decision).toMatchObject({ kind: "NO_SETTLEMENT", reason: "INVALID_INPUT" });
  });

  it("a broken container blocks every Dinner mission, is kept verbatim, and blocks nothing else", () => {
    for (const bad of [null, 3, "x", [REC]]) {
      const storage = fakeStorage(storedSave({ dinnerMissionRecords: bad }));
      const loaded = loadSave(storage);
      expect(loaded.dinnerMissionRecords.containerCorrupt).toBe(true);
      expect(isDinnerMissionRecordBlocked(loaded.dinnerMissionRecords, "dm-a")).toBe(true);
      persistProgress(snapshotOf(storage, { pitzBalance: 7, dinnerMissionRecordUpdates: { "dm-a": REC } }), storage);
      expect(storage.raw()!.dinnerMissionRecords).toEqual(bad);
      expect(storage.raw()!.pitzBalance).toBe(7);
    }
  });
});

describe("forward compatibility (cases 5, 6, 19)", () => {
  it("5: future mission ids are loaded as records and kept on every write", () => {
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-z-future": REC } }));
    expect(loadSave(storage).dinnerMissionRecords.records["dm-z-future"]).toEqual(REC);
    persistProgress(snapshotOf(storage, { dinnerMissionRecordUpdates: { "dm-a": REC_B } }), storage);
    expect(storage.raw()!.dinnerMissionRecords).toEqual({ "dm-z-future": REC, "dm-a": REC_B });
  });

  it("5: keys outside the id grammar are neither read nor dropped", () => {
    const stored = { "Not An Id": { any: 1 }, "dm-a": REC };
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: stored }));
    expect(loadSave(storage).dinnerMissionRecords).toEqual({ records: { "dm-a": REC }, blockedMissionIds: [], containerCorrupt: false });
    persistProgress(snapshotOf(storage, { pitzBalance: 1 }), storage);
    expect(storage.raw()!.dinnerMissionRecords).toEqual(stored);
  });

  it("6: unknown fields inside a record (a newer build's) survive, also when this build updates the record", () => {
    const future = { ...REC, attempts: 9, medal: { shiny: true } };
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": future } }));
    expect(loadSave(storage).dinnerMissionRecords.records["dm-a"]).toEqual(REC); // gameplay sees only its fields
    const better: DinnerMissionRecord = { ...REC, clears: 3, bestClearMs: 70_000, bestTier: "GOLD" };
    persistProgress(snapshotOf(storage, { dinnerMissionRecordUpdates: { "dm-a": better } }), storage);
    expect((storage.raw()!.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual({ ...better, attempts: 9, medal: { shiny: true } });
  });

  it("19: a pre-DM-4-2 build's rule keeps the whole key (unknown top-level keys are carried through)", () => {
    // Older builds do not know `dinnerMissionRecords`; they keep any unknown top-level key verbatim
    // (persistence.forwardCompat.test.ts pins that rule). This build keeps it too when it writes.
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": REC }, futureTopLevel: { x: 1 } }));
    persistProgress(snapshotOf(storage, { pitzBalance: 3 }), storage);
    expect(storage.raw()).toMatchObject({ dinnerMissionRecords: { "dm-a": REC }, futureTopLevel: { x: 1 }, pitzBalance: 3 });
  });

  it("__proto__ keys are never copied into the stored map", () => {
    const raw = JSON.parse('{"__proto__": {"polluted": true}, "dm-a": {"revision":1,"clears":1,"bestClearMs":null,"bestTier":null,"firstClearRewarded":true}}');
    const write = mergeDinnerMissionRecordsForWrite(raw, {});
    expect(Object.prototype.hasOwnProperty.call(write.value, "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("write semantics (cases 3, 7-11, 16-18)", () => {
  it("3: a record written through persistProgress round-trips exactly (with Pitz, in one write)", () => {
    const storage = fakeStorage(storedSave());
    const before = storage.writes;
    persistProgress(snapshotOf(storage, { pitzBalance: 350, dinnerMissionRecordUpdates: { "dm-a": REC } }), storage);
    expect(storage.writes - before).toBe(1);
    expect(storage.raw()).toMatchObject({ pitzBalance: 350, dinnerMissionRecords: { "dm-a": REC } });
    expect(loadSave(storage).dinnerMissionRecords.records["dm-a"]).toEqual(REC);
  });

  it("7-10: a stale snapshot never lowers stored progress", () => {
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": REC } }));
    const stale: DinnerMissionRecord = { revision: 1, clears: 1, bestClearMs: 120_000, bestTier: "BRONZE", firstClearRewarded: false };
    // `firstClearRewarded: false` with clears 1 is a *valid* record shape; the merge must still keep true.
    persistProgress(snapshotOf(storage, { dinnerMissionRecordUpdates: { "dm-a": stale } }), storage);
    expect((storage.raw()!.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual(REC);
  });

  it("7-10: improvements are merged per field", () => {
    expect(mergeDinnerMissionRecord(REC, { ...REC, clears: 3, bestClearMs: 99_000, bestTier: "GOLD" })).toEqual({
      ...REC,
      clears: 3,
      bestClearMs: 95_000,
      bestTier: "GOLD",
    });
    expect(mergeDinnerMissionRecord({ ...REC, bestClearMs: null, bestTier: null }, REC)).toEqual(REC);
  });

  it("11: V-1 -- a newer revision keeps firstClearRewarded and clears, its bests replace the old ones", () => {
    const rev2: DinnerMissionRecord = { revision: 2, clears: 3, bestClearMs: 150_000, bestTier: "BRONZE", firstClearRewarded: true };
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": { ...REC, bestClearMs: 60_000, bestTier: "GOLD" } } }));
    persistProgress(snapshotOf(storage, { dinnerMissionRecordUpdates: { "dm-a": rev2 } }), storage);
    expect((storage.raw()!.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual(rev2);
  });

  it("11: V-1 -- first-clear is never claimable again, whatever revision a stale write carries", () => {
    const rewarded = { ...REC, revision: 2 };
    expect(mergeDinnerMissionRecord(rewarded, { ...REC_B, revision: 3, firstClearRewarded: false, clears: 1 })).toMatchObject({
      revision: 3,
      firstClearRewarded: true,
      clears: 2,
    });
    // An older revision never overwrites a newer one.
    expect(mergeDinnerMissionRecord(rewarded, { ...REC_B, revision: 1 })).toMatchObject({ revision: 2, bestTier: "SILVER" });
    // Loading does not migrate: the stored revision is kept as written (settlement applies V-1).
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": REC } }));
    persistProgress(snapshotOf(storage, { pitzBalance: 2 }), storage);
    expect((storage.raw()!.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual(REC);
  });

  it("an invalid record in a snapshot is refused (never written)", () => {
    const storage = fakeStorage(storedSave());
    persistProgress(snapshotOf(storage, { pitzBalance: 4, dinnerMissionRecordUpdates: { "dm-a": BROKEN as unknown as DinnerMissionRecord } }), storage);
    expect(storage.raw()!.dinnerMissionRecords).toBeUndefined();
    expect(storage.raw()!.pitzBalance).toBe(4);
  });

  it("16 / 17: a save that never met Dinner keeps its exact bytes and keys through every write path", () => {
    const storage = fakeStorage(storedSave());
    persistProgress(snapshotOf(storage, { pitzBalance: 101 }), storage);
    persistDex([{ recipeId: "funghi", discovered: true, bestScore: 60, bestStars: 3, timesMade: 1 }], storage);
    persistMissionBest("lunch-rush", 10, storage);
    const raw = storage.raw()!;
    expect(raw).not.toHaveProperty("dinnerMissionRecords");
    expect(Object.keys(raw).sort()).toEqual(Object.keys(storedSave()).sort());
  });

  it("16: writing a record changes no other field", () => {
    const storage = fakeStorage(storedSave({ inventory: { egg: 3 }, missionBest: { "lunch-rush": 9 } }));
    const before = storage.raw()!;
    persistProgress(snapshotOf(storage, { dinnerMissionRecordUpdates: { "dm-a": REC } }), storage);
    const { dinnerMissionRecords, ...rest } = storage.raw()!;
    expect(dinnerMissionRecords).toEqual({ "dm-a": REC });
    expect(rest).toEqual(before);
  });

  it("18: write / read / write is idempotent (the second write is skipped, bytes unchanged)", () => {
    const storage = fakeStorage(storedSave());
    persistProgress(snapshotOf(storage, { dinnerMissionRecordUpdates: { "dm-a": REC, "dm-b": REC_B } }), storage);
    const text = storage.text();
    const writes = storage.writes;
    const again = loadSave(storage).dinnerMissionRecords.records;
    persistProgress(snapshotOf(storage, { dinnerMissionRecordUpdates: again }), storage);
    persistProgress(snapshotOf(storage, { dinnerMissionRecordUpdates: { "dm-a": REC } }), storage);
    expect(storage.writes).toBe(writes);
    expect(storage.text()).toBe(text);
  });
});

describe("Full Reset (case 15)", () => {
  it("resetSave removes the records with the rest of the save", () => {
    const storage = fakeStorage(storedSave({ dinnerMissionRecords: { "dm-a": REC, "dm-x": BROKEN } }));
    expect(resetSave(storage)).toBe(true);
    expect(storage.text()).toBeNull();
    expect(loadSave(storage).dinnerMissionRecords).toEqual(EMPTY_DINNER_MISSION_RECORDS_STATE);
  });
});

describe("settlement -> persistence round trip (DM-4-1 authority unchanged)", () => {
  it("a settled record persists, reloads and makes the next clear a repeat", () => {
    const storage = fakeStorage(storedSave());
    const first = decideDinnerSettlement({ run: clearedRun(), mission: getDinnerMission("dm-a"), record: undefined, table: TABLE, settledRunKey: null });
    if (first.kind !== "SETTLE") throw new Error("expected SETTLE");
    persistProgress(snapshotOf(storage, { pitzBalance: 100 + first.pitz, dinnerMissionRecordUpdates: { "dm-a": first.record } }), storage);
    const reloaded = loadSave(storage).dinnerMissionRecords.records["dm-a"];
    expect(reloaded).toEqual(first.record);
    const second = decideDinnerSettlement({
      run: clearedRun(T0 + 5_000_000),
      mission: getDinnerMission("dm-a"),
      record: reloaded,
      table: TABLE,
      settledRunKey: null,
    });
    expect(second).toMatchObject({ kind: "SETTLE", schedule: "REPEAT_CLEAR" });
  });
});

describe("boundaries (case 20: DM-1..DM-3 runtime unaffected)", () => {
  const sources = import.meta.glob<string>(["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx"], {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("only the persistence layer imports the records-save module (no reducer / runtime / UI wiring yet)", () => {
    const importers = Object.entries(sources)
      .filter(([, text]) => /from\s+["'][^"']*dinnerMissionRecordsSave["']/.test(text))
      .map(([path]) => path);
    expect(importers).toEqual(["./persistence.ts"]);
  });

  it("nothing outside persistence passes `dinnerMissionRecordUpdates` yet (settlement is not wired: DM-4-3)", () => {
    const users = Object.entries(sources)
      .filter(([path, text]) => path !== "./persistence.ts" && /dinnerMissionRecordUpdates/.test(text))
      .map(([path]) => path);
    expect(users).toEqual([]);
  });

  it("the records-save module imports only DM-4-1's pure settlement", () => {
    const src = sources["./dinnerMissionRecordsSave.ts"];
    expect([...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1])).toEqual(["../mission/dinner/dinnerSettlement"]);
  });
});

// ---- fixtures for the settlement round trip (test-only amounts, not production values) ----
const T0 = 1_000_000;
const TABLE: DinnerRewardTable = {
  tableId: "test",
  thresholds: { goldMaxClearMs: 90_000, silverMaxClearMs: 150_000, bronzeMaxClearMs: 300_000 },
  pitz: {
    firstClear: { clear: 150, tierBonus: { GOLD: 100, SILVER: 50, BRONZE: 20 } },
    repeatClear: { clear: 30, tierBonus: { GOLD: 30, SILVER: 15, BRONZE: 5 } },
  },
};
function clearedRun(startedAt = T0): DinnerRunState {
  const clearMs = 120_000;
  return {
    missionId: "dm-a",
    revision: 1,
    status: "CLEARED",
    targetRecipeIds: ["margherita", "bismarck", "breakfast-pizza", "funghi"],
    completedRecipeIds: ["margherita", "bismarck", "breakfast-pizza", "funghi"],
    clock: { startedAt, endsAt: startedAt + 1_000_000 },
    attempts: [],
    outcome: { kind: "CLEAR", endedAt: startedAt + clearMs, clearMs },
  };
}
