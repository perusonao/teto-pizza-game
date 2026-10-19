import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SAVE_STORAGE_KEY,
  clearSave,
  createDefaultSave,
  loadSave,
  persistDex,
  persistMissionBest,
  persistProgress,
  resetSave,
  resetSaveResult,
  type ProgressionSnapshot,
  type StorageLike,
} from "./persistence";
import type { DexEntry } from "./dex";
import {
  MAX_QUARANTINE_RAW_LENGTH,
  QUARANTINE_KEY_SUFFIX,
  discardQuarantine,
  quarantineKey,
  readQuarantine,
} from "./saveQuarantine";
import { FUTURE_V3, GOLDEN_ERAS, UNUSABLE_ROOTS } from "./testSupport/saveGoldenFixtures";
import { faultyStorage } from "./testSupport/faultyStorage";
import { memoryStorage, type MemoryStorage } from "./testSupport/memoryStorage";

/**
 * Save Compatibility Phase B PR-1 (Issue #560): a save this build cannot read is never destroyed by a write or a reset.
 * These are the DESIRED behaviours (the Phase A characterization of the old, destructive behaviour is gone).
 *
 *   R1  a newer build's save (schemaVersion > 2): every write is refused, the stored bytes never change.
 *   R3  a damaged save: its text is copied into the quarantine and verified BEFORE it is replaced; if that cannot be
 *       done, it is not replaced.
 *   Reset  an explicit Full Game Reset still clears the game, but it keeps a copy of an unreadable save first; only
 *       `discardQuarantine` deletes quarantined data.
 */

const FIRST = quarantineKey("first", SAVE_STORAGE_KEY);
const LATEST = quarantineKey("latest", SAVE_STORAGE_KEY);
const isQuarantineKey = (key: string) => key.includes(QUARANTINE_KEY_SUFFIX);

const FUGAZZA: DexEntry = { recipeId: "fugazza", discovered: true, bestScore: 64, bestStars: 3, timesMade: 1 };

/** The ordinary "the player did something" save, built the way App.tsx's persistence effect builds it. */
function playedPizza(storage: StorageLike, pitz = 50): ProgressionSnapshot {
  return { ...loadSave(storage), dex: [FUGAZZA], pitzBalance: pitz };
}

function rawOf(storage: StorageLike): string | null {
  return storage.getItem(SAVE_STORAGE_KEY);
}

function quarantinedRaw(storage: StorageLike, slot: "first" | "latest"): { raw: string; kind: string } {
  const read = readQuarantine(storage, slot, SAVE_STORAGE_KEY);
  if (read.kind !== "ok") throw new Error(`quarantine ${slot} is ${read.kind}`);
  return { raw: read.entry.raw, kind: read.entry.kind };
}

afterEach(() => vi.useRealTimers());

describe("R1: a newer build's save (schemaVersion > 2) is never overwritten", () => {
  const futures = [3, 4, 99, 999, 2 ** 31].map((v) => JSON.stringify({ ...JSON.parse(FUTURE_V3), schemaVersion: v }));

  it("persistProgress refuses, reports why, and leaves every stored byte as it was", () => {
    for (const raw of futures) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      const result = persistProgress(playedPizza(storage), storage);
      expect(result.blocked, raw).toBe("unknown-schema");
      expect(result.refusedDinnerMissionIds).toEqual([]);
      expect(rawOf(storage)).toBe(raw);
      expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]); // nothing is quarantined: the save itself is the safe copy
    }
  });

  it("persistDex and persistMissionBest refuse the same way", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    expect(persistDex([FUGAZZA], storage)).toEqual({ blocked: "unknown-schema" });
    expect(persistMissionBest("lunch-rush", 5000, storage)).toEqual({ blocked: "unknown-schema" });
    expect(rawOf(storage)).toBe(FUTURE_V3);
  });

  it("a v3 root without a dex (or with a nonsense one) is still protected, because the version alone decides", () => {
    for (const raw of [JSON.stringify({ schemaVersion: 3 }), JSON.stringify({ schemaVersion: 3, dex: "x" }), JSON.stringify({ schemaVersion: 7, whatever: [1, 2, 3] })]) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      expect(persistProgress(playedPizza(storage), storage).blocked).toBe("unknown-schema");
      expect(rawOf(storage)).toBe(raw);
    }
  });

  it("auto-save, ordinary play and reloads over many sessions never change it", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    for (let session = 1; session <= 6; session += 1) {
      const hydrated = loadSave(storage); // a fresh default every time
      expect(hydrated).toEqual(createDefaultSave());
      persistProgress(hydrated, storage); // App's mount-time effect: nothing changed
      persistProgress({ ...hydrated, pitzBalance: 10 * session }, storage); // a round finishes
      persistDex([FUGAZZA], storage);
      persistMissionBest("lunch-rush", 100 * session, storage);
      expect(rawOf(storage)).toBe(FUTURE_V3);
    }
    expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
  });

  it("the Dinner all-or-nothing option cannot sneak a write through", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    persistProgress({ ...playedPizza(storage), requireDinnerRecords: true }, storage);
    expect(rawOf(storage)).toBe(FUTURE_V3);
  });

  it("a write is not blocked once the stored save is a readable one (the block is about the stored text, not a latch)", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    expect(persistProgress(playedPizza(storage), storage).blocked).toBe("unknown-schema");
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(createDefaultSave())); // e.g. the player updated and the newer build was rolled back and reset
    expect(persistProgress(playedPizza(storage), storage).blocked).toBeUndefined();
    expect(loadSave(storage).dex.map((e) => e.recipeId)).toEqual(["fugazza"]);
  });
});

describe("R3: a damaged save is quarantined (verified) before it is replaced", () => {
  for (const { name, raw } of UNUSABLE_ROOTS) {
    it(`${name}: the exact text is kept in the quarantine, then the game saves normally`, () => {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      const result = persistProgress(playedPizza(storage), storage);

      expect(result.blocked).toBeUndefined();
      expect(quarantinedRaw(storage, "first")).toEqual({ raw, kind: "corrupt" });
      expect(loadSave(storage).dex.map((e) => e.recipeId)).toEqual(["fugazza"]);
      expect(storage.keys().sort()).toEqual([SAVE_STORAGE_KEY, FIRST].sort());
    });
  }

  it("persistDex and persistMissionBest quarantine too", () => {
    for (const write of [(s: StorageLike) => persistDex([FUGAZZA], s), (s: StorageLike) => persistMissionBest("lunch-rush", 900, s)]) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: "{broken" });
      expect(write(storage)).toEqual({});
      expect(quarantinedRaw(storage, "first").raw).toBe("{broken");
      expect(loadSave(storage).schemaVersion).toBe(2);
    }
  });

  it("loading alone, or an unchanged auto-save, never quarantines or writes", () => {
    for (const { raw } of UNUSABLE_ROOTS) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      persistProgress(loadSave(storage), storage);
      expect(rawOf(storage)).toBe(raw);
      expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
    }
  });

  it("the createdAt is the time of the quarantine", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T03:04:05.000Z"));
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: "{broken" });
    persistProgress(playedPizza(storage), storage);
    const read = readQuarantine(storage, "first", SAVE_STORAGE_KEY);
    expect(read.kind === "ok" && read.entry.createdAt).toBe("2026-11-02T03:04:05.000Z");
  });
});

describe("R3: repeated launches do not multiply backups", () => {
  it("the same damaged text quarantined again (e.g. restored by hand twice) writes nothing new", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: "{broken" });
    const storage = faultyStorage(inner);
    persistProgress(playedPizza(storage), storage);
    const firstBytes = inner.getItem(FIRST);
    inner.setItem(SAVE_STORAGE_KEY, "{broken"); // the same breakage again
    persistProgress(playedPizza(storage, 60), storage);
    expect(inner.getItem(FIRST)).toBe(firstBytes);
    expect(storage.setCount(FIRST)).toBe(1);
    expect(storage.setCount(LATEST)).toBe(0);
  });

  it("many sessions over a damaged and then healthy save keep at most the two quarantine keys", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: "{broken" });
    for (let session = 0; session < 30; session += 1) {
      persistProgress({ ...loadSave(storage), pitzBalance: session }, storage);
      if (session % 7 === 3) storage.setItem(SAVE_STORAGE_KEY, `{broken-again-${session % 3}`);
    }
    expect(storage.keys().filter(isQuarantineKey).length).toBeLessThanOrEqual(2);
    expect(quarantinedRaw(storage, "first").raw).toBe("{broken");
  });

  it("a later, different breakage goes to `latest`; `first` keeps the original text", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: "original breakage" });
    persistProgress(playedPizza(storage), storage);
    storage.setItem(SAVE_STORAGE_KEY, "second breakage");
    persistProgress(playedPizza(storage, 70), storage);
    storage.setItem(SAVE_STORAGE_KEY, "third breakage");
    persistProgress(playedPizza(storage, 80), storage);
    expect(quarantinedRaw(storage, "first").raw).toBe("original breakage");
    expect(quarantinedRaw(storage, "latest").raw).toBe("third breakage");
  });

  it("a newer-build save that is later reset and then re-appears does not add a third copy", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    expect(resetSave(storage)).toBe(true);
    storage.setItem(SAVE_STORAGE_KEY, FUTURE_V3);
    expect(resetSave(storage)).toBe(true);
    expect(storage.keys().filter(isQuarantineKey)).toEqual([FIRST]);
  });
});

describe("R3: when the copy cannot be made, the save is NOT overwritten", () => {
  const broken = "{broken";

  it("a quota error on the quarantine key: blocked, the stored text is untouched", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: broken });
    const storage = faultyStorage(inner, { setThrows: isQuarantineKey });
    const result = persistProgress(playedPizza(storage), storage);
    expect(result.blocked).toBe("quarantine-failed");
    expect(rawOf(inner)).toBe(broken);
    expect(inner.keys()).toEqual([SAVE_STORAGE_KEY]);
  });

  it("a write that is silently dropped (caught by the read-back): blocked, untouched", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: broken });
    const storage = faultyStorage(inner, { setDrops: isQuarantineKey });
    expect(persistProgress(playedPizza(storage), storage).blocked).toBe("quarantine-failed");
    expect(rawOf(inner)).toBe(broken);
  });

  it("a read-back mismatch: blocked, untouched, and no half-written slot remains", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: broken });
    const storage = faultyStorage(inner, { getTransform: (key, value) => (isQuarantineKey(key) && value !== null ? value.slice(0, -2) : value) });
    expect(persistProgress(playedPizza(storage), storage).blocked).toBe("quarantine-failed");
    expect(rawOf(inner)).toBe(broken);
    expect(inner.keys()).toEqual([SAVE_STORAGE_KEY]);
  });

  it("a quarantine that cannot even be read: blocked, untouched", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: broken });
    const storage = faultyStorage(inner, { getThrows: isQuarantineKey });
    expect(persistProgress(playedPizza(storage), storage).blocked).toBe("quarantine-failed");
    expect(rawOf(inner)).toBe(broken);
  });

  it("the save key itself cannot be read: blocked as storage-error, and nothing is written at all", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: broken });
    const storage = faultyStorage(inner, { getThrows: (key) => key === SAVE_STORAGE_KEY });
    expect(persistProgress(playedPizza(inner), storage).blocked).toBe("storage-error");
    expect(inner.keys()).toEqual([SAVE_STORAGE_KEY]);
    expect(rawOf(inner)).toBe(broken);
    expect(persistDex([FUGAZZA], storage)).toEqual({ blocked: "storage-error" });
  });

  it("above 256 KB: neither copied nor overwritten, reported as quarantine-too-large", () => {
    const huge = "x".repeat(MAX_QUARANTINE_RAW_LENGTH + 1);
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: huge });
    expect(persistProgress(playedPizza(storage), storage).blocked).toBe("quarantine-too-large");
    expect(rawOf(storage)).toBe(huge);
    expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
  });

  it("exactly 256 KB is still quarantined and the game saves", () => {
    const edge = "x".repeat(MAX_QUARANTINE_RAW_LENGTH);
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: edge });
    expect(persistProgress(playedPizza(storage), storage).blocked).toBeUndefined();
    expect(quarantinedRaw(storage, "first").raw).toBe(edge);
  });

  it("persistDex and persistMissionBest report the block too", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: broken });
    const storage = faultyStorage(inner, { setThrows: isQuarantineKey });
    expect(persistDex([FUGAZZA], storage)).toEqual({ blocked: "quarantine-failed" });
    expect(persistMissionBest("lunch-rush", 900, storage)).toEqual({ blocked: "quarantine-failed" });
    expect(rawOf(inner)).toBe(broken);
  });

  it("the save write itself failing after a good quarantine: nothing throws, the copy stays, and the next attempt completes without a second copy", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: broken });
    const failing = faultyStorage(inner, { setThrows: (key) => key === SAVE_STORAGE_KEY });
    expect(() => persistProgress(playedPizza(failing), failing)).not.toThrow();
    expect(rawOf(inner)).toBe(broken);
    expect(quarantinedRaw(inner, "first").raw).toBe(broken);

    const healed = faultyStorage(inner);
    expect(persistProgress(playedPizza(healed), healed).blocked).toBeUndefined();
    expect(loadSave(inner).dex.map((e) => e.recipeId)).toEqual(["fugazza"]);
    expect(healed.setCount(FIRST)).toBe(0);
    expect(inner.keys().filter(isQuarantineKey)).toEqual([FIRST]);
  });
});

describe("a healthy save is not affected (no regression)", () => {
  it("every golden era writes exactly as before: no quarantine key, nothing blocked, the progress kept", () => {
    for (const era of GOLDEN_ERAS) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
      const before = loadSave(storage);
      const result = persistProgress({ ...before, pitzBalance: before.pitzBalance + 5 }, storage);
      expect(result.blocked, era.name).toBeUndefined();
      expect(storage.keys(), era.name).toEqual([SAVE_STORAGE_KEY]);
      const after = loadSave(storage);
      expect(after.pitzBalance, era.name).toBe(before.pitzBalance + 5);
      expect(after.dex, era.name).toEqual(before.dex);
    }
  });

  it("a fresh install (no save) writes the first save without any quarantine", () => {
    const storage = memoryStorage();
    expect(persistProgress(playedPizza(storage), storage).blocked).toBeUndefined();
    expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
  });

  it("a v1 save is migrated and written as v2 with no quarantine (the migration is unchanged)", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: GOLDEN_ERAS[1].raw });
    persistProgress({ ...loadSave(storage), pitzBalance: 1 }, storage);
    expect(JSON.parse(rawOf(storage)!).schemaVersion).toBe(2);
    expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
  });

  it("no storage at all stays a no-op", () => {
    expect(persistProgress(createDefaultSave(), null)).toEqual({ refusedDinnerMissionIds: [] });
    expect(persistDex([FUGAZZA], null)).toEqual({});
    expect(persistMissionBest("lunch-rush", 1, null)).toEqual({});
  });

  it("a storage whose setItem always throws still never throws out of a persist call", () => {
    const storage = faultyStorage(memoryStorage(), { setThrows: () => true });
    expect(() => persistProgress(playedPizza(storage), storage)).not.toThrow();
    expect(() => persistDex([FUGAZZA], storage)).not.toThrow();
    expect(() => persistMissionBest("lunch-rush", 1, storage)).not.toThrow();
  });

  it("the save key and the schema version are unchanged", () => {
    expect(SAVE_STORAGE_KEY).toBe("teto-pizza-save-v1");
    expect(createDefaultSave().schemaVersion).toBe(2);
  });
});

describe("Full Game Reset keeps an unreadable save, and only discardQuarantine deletes quarantined data", () => {
  it("a readable save is reset as before: gone, nothing quarantined", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: GOLDEN_ERAS[2].raw });
    expect(resetSave(storage)).toBe(true);
    expect(rawOf(storage)).toBeNull();
    expect(storage.keys()).toEqual([]);
  });

  it("no save, and no storage, are successful resets", () => {
    expect(resetSave(memoryStorage())).toBe(true);
    expect(resetSave(null)).toBe(true);
    expect(resetSaveResult(memoryStorage())).toEqual({ ok: true });
  });

  it("a newer build's save: copied (kind unknown-schema, exact text) BEFORE the key is removed", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    expect(resetSave(storage)).toBe(true);
    expect(rawOf(storage)).toBeNull();
    expect(quarantinedRaw(storage, "first")).toEqual({ raw: FUTURE_V3, kind: "unknown-schema" });
  });

  it("a damaged save: copied (kind corrupt, exact text) before the key is removed", () => {
    for (const { name, raw } of UNUSABLE_ROOTS) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      expect(resetSave(storage), name).toBe(true);
      expect(rawOf(storage), name).toBeNull();
      expect(quarantinedRaw(storage, "first"), name).toEqual({ raw, kind: "corrupt" });
    }
  });

  it("if the copy cannot be made the key is NOT removed and the reset reports failure", () => {
    for (const faults of [{ setThrows: isQuarantineKey }, { setDrops: isQuarantineKey }, { getThrows: isQuarantineKey }]) {
      const inner = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
      const storage = faultyStorage(inner, faults);
      expect(resetSave(storage)).toBe(false);
      expect(resetSaveResult(storage)).toEqual({ ok: false, reason: "quarantine-failed" });
      expect(rawOf(inner)).toBe(FUTURE_V3);
    }
  });

  it("an unreadable save above 256 KB is not removed: the reset reports quarantine-too-large", () => {
    const huge = `{"schemaVersion":3,"pad":"${"x".repeat(MAX_QUARANTINE_RAW_LENGTH)}"}`;
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: huge });
    expect(resetSaveResult(storage)).toEqual({ ok: false, reason: "quarantine-too-large" });
    expect(rawOf(storage)).toBe(huge);
  });

  it("the save key unreadable: not removed, reported as storage-error", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    const storage = faultyStorage(inner, { getThrows: (key) => key === SAVE_STORAGE_KEY });
    expect(resetSaveResult(storage)).toEqual({ ok: false, reason: "storage-error" });
    expect(rawOf(inner)).toBe(FUTURE_V3);
  });

  it("a removal that fails or is dropped after the copy is reported (the copy is kept)", () => {
    for (const faults of [{ removeThrows: (key: string) => key === SAVE_STORAGE_KEY }, { removeDrops: (key: string) => key === SAVE_STORAGE_KEY }]) {
      const inner = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
      expect(resetSaveResult(faultyStorage(inner, faults))).toEqual({ ok: false, reason: "remove-failed" });
      expect(quarantinedRaw(inner, "first").raw).toBe(FUTURE_V3);
    }
  });

  it("a reset never touches existing quarantine entries", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: "{broken" });
    persistProgress(playedPizza(storage), storage); // first = "{broken"
    const firstBytes = storage.getItem(FIRST);
    expect(resetSave(storage)).toBe(true); // a readable save: removed
    expect(storage.getItem(FIRST)).toBe(firstBytes);
    storage.setItem(SAVE_STORAGE_KEY, FUTURE_V3);
    expect(resetSave(storage)).toBe(true);
    expect(storage.getItem(FIRST)).toBe(firstBytes);
    expect(quarantinedRaw(storage, "latest")).toEqual({ raw: FUTURE_V3, kind: "unknown-schema" });
  });

  it("the low-level clearSave and an ordinary persist never remove quarantined data either", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: "{broken" });
    persistProgress(playedPizza(storage), storage);
    clearSave(storage);
    persistProgress(playedPizza(storage, 99), storage);
    expect(quarantinedRaw(storage, "first").raw).toBe("{broken");
  });

  it("only discardQuarantine removes it, and the save is not touched by that", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: "{broken" });
    persistProgress(playedPizza(storage), storage);
    const saveBytes = rawOf(storage);
    expect(discardQuarantine(storage, SAVE_STORAGE_KEY)).toBe(true);
    expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
    expect(rawOf(storage)).toBe(saveBytes);
  });

  it("a reset after many refused writes still preserves the newer build's save", () => {
    const storage: MemoryStorage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    for (let i = 0; i < 5; i += 1) persistProgress({ ...loadSave(storage), pitzBalance: i + 1 }, storage);
    expect(resetSave(storage)).toBe(true);
    expect(quarantinedRaw(storage, "first").raw).toBe(FUTURE_V3);
    expect(loadSave(storage)).toEqual(createDefaultSave());
  });

  it("the boolean Reset that App.tsx calls (resetSave) agrees with the detailed one", () => {
    expect(resetSave(memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 }))).toBe(true);
    const failing = faultyStorage(memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 }), { setThrows: isQuarantineKey });
    expect(resetSave(failing)).toBe(false);
  });
});
