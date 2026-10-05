import { describe, expect, it } from "vitest";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "../state/persistence";
import { applyEditableState, inspectStoredSave } from "./apply";
import { backupKey, discardBackup, makeBackupEntry, readBackup, restoreBackup, writeBackup } from "./backup";
import { createMemoryStorage } from "./memoryStorage";
import { PRESETS, buildPreset } from "./presets";
import { editableFromSave, loadCanonical, toSnapshot } from "./stateModel";

const KEY = SAVE_STORAGE_KEY;

/** A storage whose writes / reads can be made to fail per key. */
function faultyStorage(seed: Record<string, string> = {}, fail: { set?: (key: string) => boolean; get?: (key: string) => boolean; remove?: (key: string) => boolean; corruptSet?: (key: string) => boolean } = {}) {
  const inner = createMemoryStorage(seed);
  const storage: StorageLike & { inner: StorageLike } = {
    inner,
    getItem(key) {
      if (fail.get?.(key)) throw new Error("get failed");
      return inner.getItem(key);
    },
    setItem(key, value) {
      if (fail.set?.(key)) throw new Error("quota");
      inner.setItem(key, fail.corruptSet?.(key) ? value + "#" : value);
    },
    removeItem(key) {
      if (fail.remove?.(key)) throw new Error("remove failed");
      inner.removeItem(key);
    },
  };
  return storage;
}

const isBackupKey = (key: string) => key.includes(".dev-backup-v1.");
const NOW = () => new Date("2026-10-05T00:00:00.000Z");

/** A v2 save written by a newer build: unknown keys and ids. Its raw text has odd whitespace on purpose. */
const FUTURE_RAW = `{ "schemaVersion":2, "dex":[{"recipeId":"future-recipe","discovered":true,"bestScore":80,"bestStars":4,"timesMade":2}],
  "pitzBalance": 5, "ownedIngredientIds":["tomato-sauce","mozzarella","basil","future-ingredient"], "missionBest":{"lunch-rush":700},
  "inventory":{"future-ingredient":3}, "futureTopLevel":{"a":[1,2]}, "dinnerMissionRecords":{"d":{"x":1}} }`;

describe("apply: round trips over every kind of stored save", () => {
  it("every preset applied to an EMPTY save reads back as the preset through the game's own loader", () => {
    for (const p of PRESETS) {
      const storage = createMemoryStorage();
      const state = buildPreset(p.id);
      const result = applyEditableState(state, storage, { now: NOW });
      expect(result.ok, p.id).toBe(true);
      expect(editableFromSave(loadSave(storage)), p.id).toEqual(loadCanonical(state));
      expect(editableFromSave(loadSave(storage)), p.id).toEqual(state);
    }
  });

  it("empty save: Fresh Start leaves no save key at all; the original backup records 'there was no save'; restore removes the key", () => {
    const storage = createMemoryStorage();
    const applied = applyEditableState(buildPreset("all-recipes"), storage, { now: NOW });
    expect(applied).toMatchObject({ ok: true, stored: "empty", backedUpOriginal: true });
    expect(storage.getItem(KEY)).not.toBeNull();
    const fresh = applyEditableState(buildPreset("fresh-start"), storage, { now: NOW });
    expect(fresh.ok).toBe(true);
    expect(storage.getItem(KEY)).toBeNull();
    const original = readBackup(storage, "original");
    expect(original).toMatchObject({ kind: "ok", entry: { hadSave: false, raw: null } });
    expect(restoreBackup(storage, "original")).toEqual({ ok: true, slot: "original", hadSave: false });
    expect(storage.getItem(KEY)).toBeNull();
    expect(readBackup(storage, "original").kind).toBe("none");
  });

  it("corrupt JSON: refused without acknowledgement (and nothing written); with it, applied and the raw text restores exactly", () => {
    const raw = "{ this is not json ";
    const storage = createMemoryStorage({ [KEY]: raw });
    const refused = applyEditableState(buildPreset("all-recipes"), storage, { now: NOW });
    expect(refused).toEqual({ ok: false, reason: "unreadable-save", stored: "corrupt" });
    expect(storage.getItem(KEY)).toBe(raw);
    expect(readBackup(storage, "original").kind).toBe("none");
    const applied = applyEditableState(buildPreset("all-recipes"), storage, { acknowledgeUnreadable: true, now: NOW });
    expect(applied).toMatchObject({ ok: true, stored: "corrupt" });
    expect(storage.getItem(KEY)).not.toBe(raw);
    expect(restoreBackup(storage, "original").ok).toBe(true);
    expect(storage.getItem(KEY)).toBe(raw);
  });

  it("unknown schema (a newer build's save): refused without acknowledgement; restore returns the exact bytes", () => {
    const raw = JSON.stringify({ schemaVersion: 3, dex: [], brandNew: { shape: true } });
    const storage = createMemoryStorage({ [KEY]: raw });
    expect(applyEditableState(buildPreset("margherita-discovered"), storage, { now: NOW })).toMatchObject({ ok: false, reason: "unreadable-save", stored: "unknown-schema" });
    expect(storage.getItem(KEY)).toBe(raw);
    expect(applyEditableState(buildPreset("margherita-discovered"), storage, { acknowledgeUnreadable: true, now: NOW }).ok).toBe(true);
    expect(restoreBackup(storage, "original").ok).toBe(true);
    expect(storage.getItem(KEY)).toBe(raw);
  });

  it("unknown keys and unknown ids survive an apply; the edited known fields are replaced; restore is byte-exact", () => {
    const storage = createMemoryStorage({ [KEY]: FUTURE_RAW });
    const state = { ...buildPreset("step12-abc-undiscovered"), pitzBalance: 999 };
    expect(applyEditableState(state, storage, { now: NOW })).toMatchObject({ ok: true, stored: "readable", backedUpOriginal: true });
    const stored = JSON.parse(storage.getItem(KEY)!) as Record<string, unknown>;
    expect(stored.futureTopLevel).toEqual({ a: [1, 2] });
    expect(stored.missionBest).toEqual({ "lunch-rush": 700 });
    expect(stored.dinnerMissionRecords).toEqual({ d: { x: 1 } });
    expect(stored.ownedIngredientIds).toContain("future-ingredient");
    expect((stored.dex as { recipeId: string }[]).map((e) => e.recipeId)).toContain("future-recipe");
    expect((stored.inventory as Record<string, number>)["future-ingredient"]).toBe(3);
    expect(stored.pitzBalance).toBe(999);
    // the game reads the edit, not the stored values it replaced
    expect(editableFromSave(loadSave(storage))).toEqual(loadCanonical(state));
    expect(restoreBackup(storage, "original").ok).toBe(true);
    expect(storage.getItem(KEY)).toBe(FUTURE_RAW);
  });

  it("after an apply the game's ordinary writer keeps the unknown data (forward compatibility is intact)", () => {
    const storage = createMemoryStorage({ [KEY]: FUTURE_RAW });
    applyEditableState(buildPreset("margherita-discovered"), storage, { now: NOW });
    const current = loadSave(storage);
    persistProgress({ ...toSnapshot(editableFromSave(current)), pitzBalance: current.pitzBalance + 1 }, storage);
    const stored = JSON.parse(storage.getItem(KEY)!) as Record<string, unknown>;
    expect(stored.futureTopLevel).toEqual({ a: [1, 2] });
    expect(stored.ownedIngredientIds).toContain("future-ingredient");
    expect(stored.dinnerMissionRecords).toEqual({ d: { x: 1 } });
  });

  it("the preservation switches reach the stored save", () => {
    const storage = createMemoryStorage({ [KEY]: FUTURE_RAW });
    applyEditableState(buildPreset("margherita-discovered"), storage, { now: NOW, preserveMissionBest: false, preserveDinnerRecords: false, preserveUnknown: false });
    const stored = JSON.parse(storage.getItem(KEY)!) as Record<string, unknown>;
    expect(stored).not.toHaveProperty("futureTopLevel");
    expect(stored).not.toHaveProperty("dinnerMissionRecords");
    expect(stored.missionBest).toEqual({});
    expect(stored.ownedIngredientIds).not.toContain("future-ingredient");
  });

  it("a v1 save is migrated forward by the apply (unknown keys kept), and restore is exact", () => {
    const raw = JSON.stringify({ schemaVersion: 1, dex: [], pitzBalance: 4, ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], missionBest: { "lunch-rush": 9 }, legacyKey: 1 });
    const storage = createMemoryStorage({ [KEY]: raw });
    expect(applyEditableState(buildPreset("all-recipes"), storage, { now: NOW }).ok).toBe(true);
    const stored = JSON.parse(storage.getItem(KEY)!) as Record<string, unknown>;
    expect(stored.schemaVersion).toBe(2);
    expect(stored.legacyKey).toBe(1);
    expect(stored.missionBest).toEqual({ "lunch-rush": 9 });
    expect(restoreBackup(storage, "original").ok).toBe(true);
    expect(storage.getItem(KEY)).toBe(raw);
  });
});

describe("apply: backup is mandatory (Owner Contract 5)", () => {
  it("a failing backup write means NOTHING is applied and no backup is left behind", () => {
    const storage = faultyStorage({ [KEY]: FUTURE_RAW }, { set: isBackupKey });
    const result = applyEditableState(buildPreset("all-recipes"), storage, { now: NOW });
    expect(result).toMatchObject({ ok: false, reason: "backup-failed" });
    expect(storage.inner.getItem(KEY)).toBe(FUTURE_RAW);
  });

  it("a backup that does not read back equal counts as failed", () => {
    const storage = faultyStorage({ [KEY]: FUTURE_RAW }, { corruptSet: isBackupKey });
    expect(applyEditableState(buildPreset("all-recipes"), storage, { now: NOW })).toMatchObject({ ok: false, reason: "backup-failed" });
    expect(storage.inner.getItem(KEY)).toBe(FUTURE_RAW);
  });

  it("when only the second (previous) slot fails, the just-written original slot is removed and nothing is applied", () => {
    const storage = faultyStorage({ [KEY]: FUTURE_RAW }, { set: (k) => k === backupKey("previous") });
    expect(applyEditableState(buildPreset("all-recipes"), storage, { now: NOW })).toMatchObject({ ok: false, reason: "backup-failed" });
    expect(storage.inner.getItem(KEY)).toBe(FUTURE_RAW);
    expect(storage.inner.getItem(backupKey("original"))).toBeNull();
  });

  it("an unreadable existing original slot blocks the apply (it is never overwritten blindly)", () => {
    const storage = createMemoryStorage({ [KEY]: FUTURE_RAW, [backupKey("original")]: "garbage" });
    expect(applyEditableState(buildPreset("all-recipes"), storage, { now: NOW })).toMatchObject({ ok: false, reason: "backup-failed" });
    expect(storage.getItem(KEY)).toBe(FUTURE_RAW);
    expect(storage.getItem(backupKey("original"))).toBe("garbage");
  });

  it("an unavailable storage (null / throwing reads) applies nothing", () => {
    expect(applyEditableState(buildPreset("all-recipes"), null)).toEqual({ ok: false, reason: "storage-unavailable" });
    const throwing = faultyStorage({ [KEY]: FUTURE_RAW }, { get: () => true });
    expect(applyEditableState(buildPreset("all-recipes"), throwing)).toEqual({ ok: false, reason: "storage-unavailable" });
  });

  it("an invalid state is refused before anything is touched (no backup either)", () => {
    const storage = createMemoryStorage({ [KEY]: FUTURE_RAW });
    const bad = { ...buildPreset("all-recipes"), pitzBalance: -5 };
    expect(applyEditableState(bad, storage, { now: NOW })).toMatchObject({ ok: false, reason: "invalid-state" });
    expect(storage.getItem(KEY)).toBe(FUTURE_RAW);
    expect(readBackup(storage, "original").kind).toBe("none");
  });

  it("a failing save write rolls the raw text back", () => {
    const storage = faultyStorage({ [KEY]: FUTURE_RAW }, { set: (k) => k === KEY });
    expect(applyEditableState(buildPreset("all-recipes"), storage, { now: NOW })).toMatchObject({ ok: false, reason: "write-failed", rolledBack: true });
    expect(storage.inner.getItem(KEY)).toBe(FUTURE_RAW);
  });

  it("a save that does not read back as written is detected and rolled back", () => {
    const storage = faultyStorage({ [KEY]: FUTURE_RAW }, { corruptSet: (k) => k === KEY });
    const result = applyEditableState(buildPreset("all-recipes"), storage, { now: NOW });
    expect(result).toMatchObject({ ok: false, reason: "verify-failed" });
  });
});

describe("backup slots", () => {
  it("the original slot is kept across applies; the previous slot follows each apply; restore original after two applies returns the real save", () => {
    const storage = createMemoryStorage({ [KEY]: FUTURE_RAW });
    expect(applyEditableState(buildPreset("all-recipes"), storage, { now: NOW })).toMatchObject({ ok: true, backedUpOriginal: true });
    const afterFirst = storage.getItem(KEY);
    expect(applyEditableState(buildPreset("all-ingredients"), storage, { now: NOW })).toMatchObject({ ok: true, backedUpOriginal: false });
    const original = readBackup(storage, "original");
    const previous = readBackup(storage, "previous");
    expect(original).toMatchObject({ kind: "ok", entry: { raw: FUTURE_RAW, hadSave: true } });
    expect(previous).toMatchObject({ kind: "ok", entry: { raw: afterFirst } });
    expect(restoreBackup(storage, "previous").ok).toBe(true);
    expect(storage.getItem(KEY)).toBe(afterFirst);
    expect(restoreBackup(storage, "original").ok).toBe(true);
    expect(storage.getItem(KEY)).toBe(FUTURE_RAW);
  });

  it("the backup lives under its own keys: not inside the save, namespaced by the save key, and no marker reaches the save", () => {
    const storage = createMemoryStorage({ [KEY]: FUTURE_RAW });
    applyEditableState(buildPreset("all-recipes"), storage, { now: NOW });
    expect(backupKey("original")).toBe(`${KEY}.dev-backup-v1.original`);
    expect(storage.getItem(KEY)).not.toMatch(/dev-backup|dev-state-editor/);
    expect(storage.getItem(backupKey("original"))).not.toBeNull();
  });

  it("restore failures are reported and leave the backup in place", () => {
    const empty = createMemoryStorage();
    expect(restoreBackup(empty, "original")).toEqual({ ok: false, reason: "no-backup" });
    const bad = createMemoryStorage({ [backupKey("original")]: "{}" });
    expect(restoreBackup(bad, "original")).toEqual({ ok: false, reason: "backup-unreadable" });
    const entry = makeBackupEntry("original", FUTURE_RAW, "t");
    const failing = faultyStorage({}, { set: (k) => k === KEY });
    expect(writeBackup(failing, entry)).toBe(true);
    expect(restoreBackup(failing, "original")).toEqual({ ok: false, reason: "storage-error" });
    expect(readBackup(failing, "original").kind).toBe("ok");
    expect(discardBackup(failing, "original")).toBe(true);
  });

  it("a backup of a different save key is not accepted (a Preview backup is never restored into production)", () => {
    const storage = createMemoryStorage();
    expect(writeBackup(storage, makeBackupEntry("original", FUTURE_RAW, "t", "other-key"), "other-key")).toBe(true);
    storage.setItem(backupKey("original"), storage.getItem(backupKey("original", "other-key"))!);
    expect(readBackup(storage, "original").kind).toBe("corrupt");
  });
});

describe("inspectStoredSave is read-only", () => {
  it("classifies without writing", () => {
    const writes: string[] = [];
    const spy = (seed: Record<string, string>): StorageLike => {
      const inner = createMemoryStorage(seed);
      return { getItem: inner.getItem, setItem: (k, v) => {
          writes.push(k);
          inner.setItem(k, v);
        },
        removeItem: (k) => {
          writes.push(k);
          inner.removeItem(k);
        },
      };
    };
    expect(inspectStoredSave(spy({})).kind).toBe("empty");
    expect(inspectStoredSave(spy({ [KEY]: "{bad" })).kind).toBe("corrupt");
    expect(inspectStoredSave(spy({ [KEY]: JSON.stringify({ schemaVersion: 9, dex: [] }) })).kind).toBe("unknown-schema");
    expect(inspectStoredSave(spy({ [KEY]: FUTURE_RAW })).kind).toBe("readable");
    expect(inspectStoredSave(null).kind).toBe("storage-error");
    expect(writes).toEqual([]);
  });
});
