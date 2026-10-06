import { describe, expect, it } from "vitest";
import { loadSave, SAVE_STORAGE_KEY } from "../state/persistence";
import { applyEditableState } from "./apply";
import { restoreBackup } from "./backup";
import { productionCatalog } from "./editorCatalog";
import { createMemoryStorage } from "./memoryStorage";
import { PRESETS, buildPreset } from "./presets";
import { classifyRawSave, mergeEditedSave } from "./saveMerge";
import { canonicalSaveObject, EDITABLE_STATE_KEYS, freshEditableState } from "./stateModel";

/**
 * Research 2.0 Phase 2 S3: the DEV State Editor never edits, presets or loses the persisted negative ledger
 * (`researchExclusions`). It is carried over from the stored save by merge / apply / backup / restore, whatever the
 * preserve options say, and the canonical side never writes an (empty) ledger over it.
 */
const catalog = productionCatalog();
const LEDGER = { margherita: ["egg", "future-ingredient"], bismarck: ["onion"], "future-recipe": ["egg", "future-ingredient"] };
const stored = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 2, dex: [], pitzBalance: 9, researchExclusions: LEDGER, futureTopLevel: { a: 1 }, ...extra });
const NOW = () => new Date("2026-10-05T00:00:00.000Z");

describe("the ledger is neither editable nor preset", () => {
  it("is not an EditableState key and no preset's canonical save carries the key", () => {
    expect((EDITABLE_STATE_KEYS as readonly string[]).includes("researchExclusions")).toBe(false);
    for (const p of PRESETS) {
      const canonical = canonicalSaveObject(buildPreset(p.id));
      expect(canonical === null || !("researchExclusions" in canonical), p.id).toBe(true);
    }
    expect("researchExclusions" in freshEditableState()).toBe(false);
  });
});

describe("mergeEditedSave carries the stored ledger verbatim", () => {
  for (const preserveUnknown of [true, false]) {
    for (const p of PRESETS) {
      it(`${p.id} (preserveUnknown=${preserveUnknown}) keeps the whole ledger, including unknown ids`, () => {
        const result = mergeEditedSave(canonicalSaveObject(buildPreset(p.id)), classifyRawSave(JSON.stringify(stored())), catalog, {
          preserveMissionBest: true,
          preserveDinnerRecords: true,
          preserveUnknown,
        });
        expect(result.value?.researchExclusions).toEqual(LEDGER);
        expect(result.preserved.researchExclusions).toBe(true);
      });
    }
  }
  it("a canonical that is null (Fresh Start) still keeps the ledger", () => {
    const result = mergeEditedSave(null, classifyRawSave(JSON.stringify(stored())), catalog);
    expect(result.value?.researchExclusions).toEqual(LEDGER);
    expect(result.value).not.toBeNull();
  });
  it("the ledger and the other unknown top-level keys survive together", () => {
    const result = mergeEditedSave(canonicalSaveObject(buildPreset("all-ingredients")), classifyRawSave(JSON.stringify(stored())), catalog);
    expect(result.value?.futureTopLevel).toEqual({ a: 1 });
    expect(result.value?.researchExclusions).toEqual(LEDGER);
  });
  it("a save without a ledger gets none (no empty key is created)", () => {
    const { researchExclusions: _gone, ...without } = stored();
    const result = mergeEditedSave(canonicalSaveObject(buildPreset("all-recipes")), classifyRawSave(JSON.stringify(without)), catalog);
    expect(result.value).not.toHaveProperty("researchExclusions");
    expect(result.preserved.researchExclusions).toBe(false);
    expect(mergeEditedSave(canonicalSaveObject(buildPreset("fresh-start")), { kind: "empty" }, catalog).value).toBeNull();
  });
  it("an opaque stored ledger shape is carried verbatim too", () => {
    const result = mergeEditedSave(canonicalSaveObject(buildPreset("all-recipes")), classifyRawSave(JSON.stringify(stored({ researchExclusions: [["future"]] }))), catalog);
    expect(result.value?.researchExclusions).toEqual([["future"]]);
  });
});

describe("apply / backup / restore with a stored ledger", () => {
  const RAW = JSON.stringify(stored());
  it("every preset applied over a stored ledger leaves the ledger byte-equal and still loadable", () => {
    for (const p of PRESETS) {
      const storage = createMemoryStorage({ [SAVE_STORAGE_KEY]: RAW });
      const result = applyEditableState(buildPreset(p.id), storage, { now: NOW });
      expect(result.ok, p.id).toBe(true);
      const after = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!);
      expect(after.researchExclusions, p.id).toEqual(LEDGER);
      expect(after.futureTopLevel, p.id).toEqual({ a: 1 });
      expect(after.schemaVersion).toBe(2);
      expect(loadSave(storage).researchExclusions, p.id).toEqual({ margherita: LEDGER.margherita, bismarck: LEDGER.bismarck });
    }
  });
  it("preserve options OFF still keep the ledger (game-owned progression)", () => {
    const storage = createMemoryStorage({ [SAVE_STORAGE_KEY]: RAW });
    expect(applyEditableState(buildPreset("all-recipes"), storage, { now: NOW, preserveUnknown: false, preserveMissionBest: false, preserveDinnerRecords: false }).ok).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!).researchExclusions).toEqual(LEDGER);
  });
  it("the backup holds the original raw text, and restore brings the ledger back exactly", () => {
    const storage = createMemoryStorage({ [SAVE_STORAGE_KEY]: RAW });
    expect(applyEditableState(buildPreset("everything-unlocked"), storage, { now: NOW }).ok).toBe(true);
    for (const slot of ["original", "previous"] as const) {
      storage.setItem(SAVE_STORAGE_KEY, "{}");
      expect(restoreBackup(storage, slot).ok, slot).toBe(true);
      expect(storage.getItem(SAVE_STORAGE_KEY), slot).toBe(RAW);
    }
  });
  it("applying to a save with no ledger does not create the key", () => {
    const storage = createMemoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 2, dex: [] }) });
    expect(applyEditableState(buildPreset("all-recipes"), storage, { now: NOW }).ok).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!)).not.toHaveProperty("researchExclusions");
  });
});
