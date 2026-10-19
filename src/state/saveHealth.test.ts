import { describe, expect, it } from "vitest";
import {
  SAVE_STORAGE_KEY,
  createDefaultSave,
  loadSave,
  persistProgress,
  resetSaveResult,
  type StorageLike,
} from "./persistence";
import { inspectSaveHealth } from "./saveHealth";
import { acknowledgeQuarantine, discardQuarantine, quarantineKey, quarantineRaw, readQuarantine } from "./saveQuarantine";
import { faultyStorage } from "./testSupport/faultyStorage";

function memory(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** A write that changes something, built the way App.tsx's persistence effect builds it. */
function writeSaveForTest(storage: StorageLike) {
  return persistProgress(
    {
      ...loadSave(storage),
      dex: [{ recipeId: "fugazza", discovered: true, bestScore: 64, bestStars: 3, timesMade: 1 }],
      pitzBalance: 50,
    },
    storage,
  );
}

const FUTURE = JSON.stringify({ schemaVersion: 3, dex: [], pitzBalance: 777 });
const BROKEN = "{not json";

describe("inspectSaveHealth: the four situations stay apart", () => {
  it("healthy / empty save: no notice, no backup", () => {
    const s = memory();
    expect(inspectSaveHealth(s, null)).toEqual({ notice: null, quarantineCount: 0 });
    s.setItem(SAVE_STORAGE_KEY, JSON.stringify(createDefaultSave()));
    expect(inspectSaveHealth(s, null)).toEqual({ notice: null, quarantineCount: 0 });
  });

  it("no storage at all: no notice (unchanged behaviour)", () => {
    expect(inspectSaveHealth(null, null).notice).toBeNull();
  });

  it("unknown future version: future-version, with the version", () => {
    const s = memory();
    s.setItem(SAVE_STORAGE_KEY, FUTURE);
    expect(inspectSaveHealth(s, "unknown-schema").notice).toEqual({ kind: "future-version", schemaVersion: 3 });
    expect(inspectSaveHealth(s, null).notice).toEqual({ kind: "future-version", schemaVersion: 3 });
  });

  it("corrupt data not yet copied vs already copied", () => {
    const s = memory();
    s.setItem(SAVE_STORAGE_KEY, BROKEN);
    expect(inspectSaveHealth(s, null).notice).toEqual({ kind: "corrupt", backedUp: false });
    quarantineRaw(s, BROKEN, "corrupt", "2026-10-19T00:00:00.000Z", SAVE_STORAGE_KEY);
    expect(inspectSaveHealth(s, null).notice).toEqual({ kind: "corrupt", backedUp: true });
  });

  it("quarantine failure and too-large are backup-failed, distinct from storage-unavailable", () => {
    const s = memory();
    s.setItem(SAVE_STORAGE_KEY, BROKEN);
    expect(inspectSaveHealth(s, "quarantine-failed").notice).toEqual({ kind: "backup-failed", reason: "quarantine-failed" });
    expect(inspectSaveHealth(s, "quarantine-too-large").notice).toEqual({
      kind: "backup-failed",
      reason: "quarantine-too-large",
    });
    expect(inspectSaveHealth(s, "storage-error").notice).toEqual({ kind: "storage-unavailable" });
  });

  it("an unreadable save key is storage-unavailable even with no write attempted", () => {
    const s = faultyStorage(memory(), { getThrows: (k) => k === SAVE_STORAGE_KEY });
    expect(inspectSaveHealth(s, null).notice).toEqual({ kind: "storage-unavailable" });
  });

  it("a real write against a failing quarantine is reported as backup-failed end to end", () => {
    const inner = memory();
    inner.setItem(SAVE_STORAGE_KEY, BROKEN);
    const s = faultyStorage(inner, { setThrows: (k) => k.includes("quarantine") });
    const result = writeSaveForTest(s);
    expect(result.blocked).toBe("quarantine-failed");
    expect(inner.getItem(SAVE_STORAGE_KEY)).toBe(BROKEN);
    expect(inspectSaveHealth(s, result.blocked ?? null).notice?.kind).toBe("backup-failed");
  });
});

describe("backup-kept notice and acknowledge", () => {
  it("after a successful write over corrupt data: backup-kept (corrupt), then acknowledged -> no notice, backup kept", () => {
    const s = memory();
    s.setItem(SAVE_STORAGE_KEY, BROKEN);
    expect(writeSaveForTest(s).blocked).toBeUndefined();
    expect(inspectSaveHealth(s, null)).toEqual({
      notice: { kind: "backup-kept", entryKind: "corrupt" },
      quarantineCount: 1,
    });
    const before = readQuarantine(s, "first", SAVE_STORAGE_KEY);
    expect(acknowledgeQuarantine(s, SAVE_STORAGE_KEY)).toBe(true);
    expect(inspectSaveHealth(s, null)).toEqual({ notice: null, quarantineCount: 1 });
    const after = readQuarantine(s, "first", SAVE_STORAGE_KEY);
    if (before.kind !== "ok" || after.kind !== "ok") throw new Error("entry missing");
    expect(after.entry.raw).toBe(BROKEN);
    expect(after.entry).toEqual({ ...before.entry, acknowledged: true });
  });

  it("a Reset of a future-version save leaves a backup-kept (unknown-schema) notice and the future text intact", () => {
    const s = memory();
    s.setItem(SAVE_STORAGE_KEY, FUTURE);
    expect(resetSaveResult(s)).toEqual({ ok: true });
    expect(s.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(inspectSaveHealth(s, null).notice).toEqual({ kind: "backup-kept", entryKind: "unknown-schema" });
    const first = readQuarantine(s, "first", SAVE_STORAGE_KEY);
    expect(first.kind === "ok" && first.entry.raw).toBe(FUTURE);
  });

  it("acknowledge restores a slot whose rewrite fails and reports false; the raw text is never lost", () => {
    const inner = memory();
    quarantineRaw(inner, BROKEN, "corrupt", "2026-10-19T00:00:00.000Z", SAVE_STORAGE_KEY);
    const key = quarantineKey("first", SAVE_STORAGE_KEY);
    const s = faultyStorage(inner, { setThrows: (k) => k === key });
    expect(acknowledgeQuarantine(s, SAVE_STORAGE_KEY)).toBe(false);
    const entry = readQuarantine(inner, "first", SAVE_STORAGE_KEY);
    expect(entry.kind === "ok" && entry.entry.raw).toBe(BROKEN);
    expect(entry.kind === "ok" && entry.entry.acknowledged).toBe(false);
  });

  it("Reset never deletes quarantined data; only discardQuarantine does", () => {
    const s = memory();
    s.setItem(SAVE_STORAGE_KEY, BROKEN);
    writeSaveForTest(s);
    expect(resetSaveResult(s)).toEqual({ ok: true });
    expect(inspectSaveHealth(s, null).quarantineCount).toBe(1);
    expect(discardQuarantine(s, SAVE_STORAGE_KEY)).toBe(true);
    expect(inspectSaveHealth(s, null)).toEqual({ notice: null, quarantineCount: 0 });
  });
});
