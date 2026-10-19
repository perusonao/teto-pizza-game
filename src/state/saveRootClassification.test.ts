import { describe, expect, it } from "vitest";
import { classifyStoredSave, NEWEST_READABLE_SCHEMA_VERSION } from "./saveRootClassification";
import { SAVE_STORAGE_KEY, loadSave } from "./persistence";
import { classifyRawSave } from "../devtools/saveMerge";
import { FUTURE_V3, GOLDEN_ERAS, UNUSABLE_ROOTS } from "./testSupport/saveGoldenFixtures";
import { memoryStorage } from "./testSupport/memoryStorage";

/** Save Compatibility Phase B PR-1 (Issue #560): the classification that decides whether stored text may be replaced. */

const root = (over: Record<string, unknown>) => JSON.stringify({ schemaVersion: 2, dex: [], ...over });

describe("classifyStoredSave", () => {
  it("null is empty", () => {
    expect(classifyStoredSave(null)).toEqual({ kind: "empty" });
  });

  it("schemaVersion 1 and 2 with an array dex are readable", () => {
    expect(classifyStoredSave(root({ schemaVersion: 1 }))).toEqual({ kind: "readable", schemaVersion: 1 });
    expect(classifyStoredSave(root({ schemaVersion: 2 }))).toEqual({ kind: "readable", schemaVersion: 2 });
  });

  it("the newest readable version is 2", () => {
    expect(NEWEST_READABLE_SCHEMA_VERSION).toBe(2);
  });

  it("an integer schemaVersion above 2 is unknown-schema, whatever else the root holds", () => {
    for (const version of [3, 4, 99, 999, 2 ** 31, 1e308]) {
      expect(classifyStoredSave(root({ schemaVersion: version }))).toEqual({ kind: "unknown-schema", schemaVersion: version });
    }
    expect(classifyStoredSave(JSON.stringify({ schemaVersion: 3 }))).toMatchObject({ kind: "unknown-schema" }); // no dex at all
    expect(classifyStoredSave(JSON.stringify({ schemaVersion: 3, dex: "not even an array" }))).toMatchObject({ kind: "unknown-schema" });
  });

  it("every other schemaVersion is corrupt, not 'future'", () => {
    for (const version of [0, -1, 1.5, 2.5, "2", "3", null, true, [], {}]) {
      expect(classifyStoredSave(root({ schemaVersion: version }))).toEqual({ kind: "corrupt", reason: "bad-schema-version" });
    }
    expect(classifyStoredSave(JSON.stringify({ dex: [] }))).toEqual({ kind: "corrupt", reason: "bad-schema-version" });
  });

  it("a v1 / v2 root whose dex is not an array is corrupt", () => {
    for (const dex of [{}, null, "x", 3, undefined]) {
      for (const schemaVersion of [1, 2]) {
        expect(classifyStoredSave(JSON.stringify({ schemaVersion, dex }))).toEqual({ kind: "corrupt", reason: "dex-not-an-array" });
      }
    }
  });

  it("text that is not a JSON object is corrupt", () => {
    expect(classifyStoredSave("")).toEqual({ kind: "corrupt", reason: "not-json" });
    expect(classifyStoredSave("{")).toEqual({ kind: "corrupt", reason: "not-json" });
    expect(classifyStoredSave("undefined")).toEqual({ kind: "corrupt", reason: "not-json" });
    for (const text of ["null", "[]", "[1,2]", "42", '"x"', "true"]) {
      expect(classifyStoredSave(text)).toEqual({ kind: "corrupt", reason: "not-an-object" });
    }
  });

  it("the frozen fixtures: every golden era is readable, the v3 save is unknown-schema, every unusable root is corrupt", () => {
    for (const era of GOLDEN_ERAS) expect(classifyStoredSave(era.raw).kind, era.name).toBe("readable");
    expect(classifyStoredSave(FUTURE_V3)).toEqual({ kind: "unknown-schema", schemaVersion: 3 });
    for (const { name, raw } of UNUSABLE_ROOTS) expect(classifyStoredSave(raw).kind, name).toBe("corrupt");
  });
});

describe("classification vs. the loader (differential)", () => {
  // A readable root keeps its Pitz; anything the loader falls back to a default for reads back as 0. The marker therefore
  // tells "loadSave accepted this root" apart from "loadSave returned a fresh default".
  const MARKER = 777;
  const versions: unknown[] = [undefined, 0, 1, 2, 3, 999, 1.5, 2.5, "1", "2", null, true, -1, 1e308];
  const dexes: unknown[] = [undefined, [], [{}], {}, null, "x", 0];
  const candidates: string[] = [];
  for (const schemaVersion of versions) {
    for (const dex of dexes) candidates.push(JSON.stringify({ schemaVersion, dex, pitzBalance: MARKER }));
  }
  candidates.push("null", "[]", "42", '"x"', "{", "", "undefined", ...UNUSABLE_ROOTS.map((u) => u.raw), FUTURE_V3, ...GOLDEN_ERAS.map((e) => e.raw));

  it("'readable' is exactly the set of roots loadSave accepts (so a protected save is never one the loader would read)", () => {
    const marked = candidates.filter((raw) => raw.includes(`"pitzBalance":${MARKER}`));
    expect(marked.length).toBeGreaterThan(50);
    for (const raw of marked) {
      const accepted = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: raw })).pitzBalance === MARKER;
      expect(classifyStoredSave(raw).kind === "readable", raw).toBe(accepted);
    }
    // Roots that carry no marker: whatever is classified readable must load (its Dex survives) -- checked just below for
    // the golden eras; everything else must NOT be readable.
    for (const raw of candidates.filter((r) => !r.includes(`"pitzBalance":${MARKER}`) && !GOLDEN_ERAS.some((e) => e.raw === r))) {
      expect(classifyStoredSave(raw).kind === "readable", raw).toBe(false);
    }
  });

  it("the golden eras (no marker) are accepted by the loader: their Dex survives", () => {
    for (const era of GOLDEN_ERAS) {
      expect(loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: era.raw })).dex.length, era.name).toBeGreaterThan(0);
    }
  });

  it("agrees with the DEV State Editor's own root gate on what is empty and what is readable", () => {
    for (const raw of [null, ...candidates]) {
      expect(classifyStoredSave(raw).kind === "readable", String(raw)).toBe(classifyRawSave(raw).kind === "readable");
      expect(classifyStoredSave(raw).kind === "empty", String(raw)).toBe(classifyRawSave(raw).kind === "empty");
    }
  });
});
