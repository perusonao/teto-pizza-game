import { describe, expect, it } from "vitest";
import {
  MAX_DEX_ENTRIES_WITH_UNKNOWN_KEYS,
  MAX_DEX_UNKNOWN_CHARS_PER_ENTRY,
  MAX_DEX_UNKNOWN_CHARS_TOTAL,
  MAX_DEX_UNKNOWN_KEYS_PER_ENTRY,
  MAX_SAVE_WRITE_LENGTH,
  SAVE_STORAGE_KEY,
  loadSave,
  persistDex,
  persistProgress,
  resetSave,
  type PersistentSaveV2,
  type ProgressionSnapshot,
} from "./persistence";
import { registerScoreToDex, type DexEntry } from "./dex";
import { inspectSaveHealth } from "./saveHealth";
import type { ScoreBreakdown } from "../logic/scoring";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * #668 (R4/R5): the Dex is written from what storage holds, so an older build never erases a newer build's Dex information.
 * Rules (Owner design on the Issue): `next` wins every known field of a valid stored entry; an entry this build rejects
 * ("foreign") is kept verbatim; stored entries `next` lacks are appended; unknown sub-fields are limited, never the core five.
 * `loadSave`, `DexEntry`, the reducer and the schema are untouched, so nothing here reaches gameplay.
 */

const M: DexEntry = { recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 };
const F: DexEntry = { recipeId: "fugazza", discovered: true, bestScore: 64, bestStars: 3, timesMade: 1 };
const FUTURE = (n: number | string): DexEntry => ({ recipeId: `future-${n}`, discovered: true, bestScore: 50, bestStars: 2, timesMade: 1 });

const stored = (dex: unknown[]) =>
  JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 0, ownedIngredientIds: [], missionBest: {}, inventory: {} });
const open = (dex: unknown[]) => memoryStorage({ [SAVE_STORAGE_KEY]: stored(dex) });
const rawDex = (s: { getItem(k: string): string | null }) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null").dex as Record<string, unknown>[];
const snap = (save: PersistentSaveV2, over: Partial<ProgressionSnapshot> = {}): ProgressionSnapshot => ({ ...save, ...over });
/** A write that really happens: persistProgress skips an unchanged snapshot, so the Pitz balance moves by one unless set. */
const write = (s: ReturnType<typeof open>, over: Partial<ProgressionSnapshot> = {}) => {
  const loaded = loadSave(s);
  return persistProgress(snap(loaded, { pitzBalance: loaded.pitzBalance + 1, ...over }), s);
};
const score = (total: number, stars: 1 | 2 | 3 | 4 | 5): ScoreBreakdown => ({
  matchScore: total,
  ingredientScore: total,
  placementScore: total,
  bakeScore: total,
  total,
  stars,
});
/** An object whose JSON text is exactly `n` characters: {"k":"xxx"}. */
const unknownOfLength = (n: number) => ({ k: "x".repeat(n - 8) });

describe("A-F: the conditions of the Issue", () => {
  it("A: an unknown sub-field of a KNOWN recipe's entry survives; loadSave never shows it", () => {
    const s = open([{ ...M, bestBakeLevel: 3, nested: { a: [1, 2] } }]);
    expect(loadSave(s).dex).toEqual([M]);
    write(s, { pitzBalance: 7 });
    expect(rawDex(s)).toEqual([{ bestBakeLevel: 3, nested: { a: [1, 2] }, ...M }]);
    expect(loadSave(s).dex).toEqual([M]);
  });

  it("B: an unknown sub-field of an UNKNOWN recipe's entry survives", () => {
    const s = open([M, { ...FUTURE("a"), extra: "keep" }]);
    write(s);
    expect(rawDex(s)[1]).toEqual({ extra: "keep", ...FUTURE("a") });
  });

  it("C: an out-of-range KNOWN-recipe entry is kept, and an older build's low BEST does not replace it", () => {
    const wide = { ...M, bestScore: 120, bestStars: 6, timesMade: 9 };
    const s = open([wide]);
    const loaded = loadSave(s);
    expect(loaded.dex).toEqual([]); // not loaded
    // the older build finishes a round: it registers BEST=80 as a brand new entry (timesMade 1)
    const { dex } = registerScoreToDex(loaded.dex, "margherita", score(80, 4));
    write(s, { dex });
    expect(rawDex(s)).toEqual([wide]); // BEST 120 / stars 6 / timesMade 9 untouched; this build's result is not written
  });

  it("D: an unknown-recipe entry that fails validation is kept verbatim", () => {
    const bad = { ...FUTURE("bad"), bestStars: 9, note: "newer" };
    const s = open([M, bad]);
    write(s);
    expect(rawDex(s)).toEqual([M, bad]);
  });

  it("E: duplicate ids -- the entry this build reads (first valid) wins, else the first listed; the other is not carried", () => {
    const s = open([M, { ...M, bestScore: 10, dup: true }]);
    write(s);
    expect(rawDex(s)).toEqual([M]);

    const wide = { ...M, bestScore: 120 };
    const s2 = open([wide, { ...M, bestScore: 10 }]); // first is foreign, second valid: loadSave reads the second
    expect(loadSave(s2).dex).toEqual([{ ...M, bestScore: 10 }]);
    write(s2);
    expect(rawDex(s2)).toEqual([{ ...M, bestScore: 10 }]); // what gameplay holds is never lost

    const s3 = open([{ ...M, bestScore: 120 }, { ...M, bestScore: 121 }]); // both foreign: first only
    write(s3);
    expect(rawDex(s3)).toEqual([{ ...M, bestScore: 120 }]);
  });

  it("F: an id outside SAVE_ID_PATTERN, a non-object and `__proto__` are not carried; a `__proto__` key inside an entry is not copied", () => {
    const s = memoryStorage({
      [SAVE_STORAGE_KEY]:
        '{"schemaVersion":2,"dex":[{"recipeId":"Bad Id","discovered":true,"bestScore":1,"bestStars":1,"timesMade":1},' +
        '{"recipeId":"__proto__","discovered":true,"bestScore":1,"bestStars":1,"timesMade":1},"x",null,[],' +
        '{"recipeId":"margherita","discovered":true,"bestScore":82,"bestStars":4,"timesMade":3,"__proto__":{"polluted":true},"ok":1}],' +
        '"pitzBalance":0,"ownedIngredientIds":[],"missionBest":{},"inventory":{}}',
    });
    write(s);
    expect(rawDex(s)).toEqual([{ ok: 1, ...M }]);
    expect(Object.prototype.hasOwnProperty.call(rawDex(s)[0], "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("collision, order, BEST", () => {
  it("rule 1: next wins every known field; the stored unknown keys are added", () => {
    const s = open([{ ...M, extra: 1 }]);
    write(s, { dex: [{ ...M, timesMade: 4, bestScore: 90 }] });
    expect(rawDex(s)).toEqual([{ extra: 1, ...M, timesMade: 4, bestScore: 90 }]);
  });

  it("rule 3 + stable order: next's entries first, then the stored ones next lacks (known or not, valid or not), in stored order", () => {
    const foreign = { ...F, bestStars: 6 };
    const s = open([FUTURE("u"), foreign, M, { ...FUTURE("v"), x: 1 }]);
    write(s, { dex: [M] });
    expect(rawDex(s).map((e) => e.recipeId)).toEqual(["margherita", "future-u", "fugazza", "future-v"]);
    expect(rawDex(s)[3]).toEqual({ x: 1, ...FUTURE("v") });
    expect(rawDex(s)[2]).toEqual(foreign);
  });

  it("an in-range BEST is not lowered (registerScoreToDex rule, unchanged)", () => {
    const s = open([{ ...M, bestScore: 95, bestStars: 5, extra: 1 }]);
    const { dex } = registerScoreToDex(loadSave(s).dex, "margherita", score(60, 3));
    write(s, { dex });
    expect(rawDex(s)[0]).toMatchObject({ bestScore: 95, bestStars: 5, extra: 1 });
  });

  it("a save without any extras is written exactly as before (no key reorder, no extra fields)", () => {
    const s = open([M, F]);
    write(s, { pitzBalance: 3 });
    expect(rawDex(s)).toEqual([M, F]);
    expect(Object.keys(rawDex(s)[0])).toEqual(["recipeId", "discovered", "bestScore", "bestStars", "timesMade"]);
  });
});

describe("limits (16 keys / 512 chars per entry, 32Ki total, 256 entries): only unknown keys are dropped, and the caller is told", () => {
  it("16 keys are kept, 17 are cut to the first 16 and reported", () => {
    const keys = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, i]));
    const ok = open([{ ...M, ...keys(MAX_DEX_UNKNOWN_KEYS_PER_ENTRY) }]);
    expect(write(ok).dexUnknownKeysDropped).toBeUndefined();
    expect(Object.keys(rawDex(ok)[0])).toHaveLength(MAX_DEX_UNKNOWN_KEYS_PER_ENTRY + 5);

    const over = open([{ ...M, ...keys(MAX_DEX_UNKNOWN_KEYS_PER_ENTRY + 1) }]);
    const result = write(over);
    expect(result.dexUnknownKeysDropped).toBe(true);
    expect(Object.keys(rawDex(over)[0])).toHaveLength(MAX_DEX_UNKNOWN_KEYS_PER_ENTRY + 5);
    expect(rawDex(over)[0]).toMatchObject(M); // the core five are intact
    expect(rawDex(over)[0]).not.toHaveProperty(`k${MAX_DEX_UNKNOWN_KEYS_PER_ENTRY}`);
  });

  it("512 characters are kept, 513 are dropped (and reported); the core five stay", () => {
    const at = open([{ ...M, ...unknownOfLength(MAX_DEX_UNKNOWN_CHARS_PER_ENTRY) }]);
    expect(JSON.stringify(unknownOfLength(MAX_DEX_UNKNOWN_CHARS_PER_ENTRY))).toHaveLength(MAX_DEX_UNKNOWN_CHARS_PER_ENTRY);
    expect(write(at).dexUnknownKeysDropped).toBeUndefined();
    expect(rawDex(at)[0]).toHaveProperty("k");

    const over = open([{ ...M, ...unknownOfLength(MAX_DEX_UNKNOWN_CHARS_PER_ENTRY + 1) }]);
    expect(write(over).dexUnknownKeysDropped).toBe(true);
    expect(rawDex(over)[0]).toEqual(M);
  });

  it("32Ki in total are kept, one more entry's unknown keys are dropped", () => {
    const n = MAX_DEX_UNKNOWN_CHARS_TOTAL / MAX_DEX_UNKNOWN_CHARS_PER_ENTRY; // 64 entries of exactly 512
    const entries = (count: number) => Array.from({ length: count }, (_, i) => ({ ...FUTURE(i), ...unknownOfLength(MAX_DEX_UNKNOWN_CHARS_PER_ENTRY) }));
    const at = open(entries(n));
    expect(write(at).dexUnknownKeysDropped).toBeUndefined();
    expect(rawDex(at).every((e) => "k" in e)).toBe(true);

    const over = open(entries(n + 1));
    expect(write(over).dexUnknownKeysDropped).toBe(true);
    expect(rawDex(over)).toHaveLength(n + 1); // every entry is still there
    expect(rawDex(over).filter((e) => "k" in e)).toHaveLength(n);
  });

  it("unknown keys are kept for 256 entries; the 257th loses them but the entry stays", () => {
    const entries = (count: number) => Array.from({ length: count }, (_, i) => ({ ...FUTURE(i), k: 1 }));
    const at = open(entries(MAX_DEX_ENTRIES_WITH_UNKNOWN_KEYS));
    expect(write(at).dexUnknownKeysDropped).toBeUndefined();

    const over = open(entries(MAX_DEX_ENTRIES_WITH_UNKNOWN_KEYS + 1));
    expect(write(over).dexUnknownKeysDropped).toBe(true);
    expect(rawDex(over)).toHaveLength(MAX_DEX_ENTRIES_WITH_UNKNOWN_KEYS + 1);
    expect(rawDex(over)[MAX_DEX_ENTRIES_WITH_UNKNOWN_KEYS]).toEqual(FUTURE(MAX_DEX_ENTRIES_WITH_UNKNOWN_KEYS));
  });

  it("persistDex reports a drop the same way", () => {
    const s = open([{ ...M, ...unknownOfLength(MAX_DEX_UNKNOWN_CHARS_PER_ENTRY + 1) }]);
    expect(persistDex([M, F], s).dexUnknownKeysDropped).toBe(true);
  });
});

describe("whole-save size check (MAX_SAVE_WRITE_LENGTH)", () => {
  /** Stored foreign entry padded so that the text a write produces is `target` characters long. */
  function padded(target: number, extra: unknown[] = [], extraWithoutUnknownKeys: unknown[] = extra) {
    const pad = (n: number) => ({ ...M, bestScore: 120, note: "x".repeat(n) });
    const probe = open([pad(0), ...extraWithoutUnknownKeys]);
    write(probe);
    const base = probe.getItem(SAVE_STORAGE_KEY)!.length;
    return (delta = 0) => open([pad(target - base + delta), ...extra]);
  }

  it("exactly at the limit is written; one over is refused with `save-too-large`, the save untouched", () => {
    const make = padded(MAX_SAVE_WRITE_LENGTH);
    const at = make(0);
    expect(write(at).blocked).toBeUndefined();
    expect(at.getItem(SAVE_STORAGE_KEY)).toHaveLength(MAX_SAVE_WRITE_LENGTH);

    const over = make(1);
    const before = over.getItem(SAVE_STORAGE_KEY);
    const result = write(over, { pitzBalance: 5 });
    expect(result.blocked).toBe("save-too-large");
    expect(over.getItem(SAVE_STORAGE_KEY)).toBe(before);
    expect(over.keys()).toEqual([SAVE_STORAGE_KEY]);
    expect(inspectSaveHealth(over, result.blocked ?? null).notice).toEqual({ kind: "save-too-large" });
  });

  it("over the limit only because of unknown sub-fields: they are dropped (reported), nothing foreign is lost, the write happens", () => {
    const extra = [{ ...FUTURE("u"), ...unknownOfLength(300) }];
    const s = padded(MAX_SAVE_WRITE_LENGTH - 100, extra, [FUTURE("u")])(0); // fits without the 300-char unknown part, not with it
    const result = write(s);
    expect(result.blocked).toBeUndefined();
    expect(result.dexUnknownKeysDropped).toBe(true);
    expect(s.getItem(SAVE_STORAGE_KEY)!.length).toBeLessThanOrEqual(MAX_SAVE_WRITE_LENGTH);
    expect(rawDex(s).map((e) => e.recipeId)).toEqual(["margherita", "future-u"]);
    expect(rawDex(s)[0]).toHaveProperty("note"); // the foreign entry is verbatim
  });

  it("the limit leaves room below the quarantine cap", () => {
    expect(MAX_SAVE_WRITE_LENGTH).toBeLessThan(256 * 1024);
  });
});

describe("non-change guarantees", () => {
  it("a repeated write is idempotent (same text) and stable across loads", () => {
    const s = open([F, { ...M, extra: 1 }, { ...FUTURE("u"), bestStars: 9 }]);
    write(s, { pitzBalance: 0 });
    const first = s.getItem(SAVE_STORAGE_KEY);
    write(s, { pitzBalance: 0 }); // same value as stored: skipped
    expect(s.getItem(SAVE_STORAGE_KEY)).toBe(first);
    write(s); // a real write again: the Dex part is identical
    expect(rawDex(s)).toEqual(JSON.parse(first!).dex);
  });

  it("persistDex still skips an unchanged Dex (no write at all)", () => {
    const s = open([M, F]);
    const before = s.getItem(SAVE_STORAGE_KEY);
    const writes: string[] = [];
    const spy = { ...s, setItem: (k: string, v: string) => { writes.push(k); s.setItem(k, v); } };
    expect(persistDex(loadSave(s).dex, spy)).toEqual({});
    expect(writes).toEqual([]);
    expect(s.getItem(SAVE_STORAGE_KEY)).toBe(before);
  });

  it("nothing reaches loadSave: unknown keys, foreign entries, huge values", () => {
    const s = open([{ ...M, extra: 1, huge: "x".repeat(100_000) }, { ...F, bestStars: 6 }, FUTURE("u")]);
    expect(loadSave(s).dex).toEqual([M]);
    write(s);
    expect(JSON.stringify(loadSave(s))).not.toContain("extra");
    expect(loadSave(s).dex).toEqual([M]);
  });

  it("resetSave removes the key: raw entries do not come back", () => {
    const s = open([{ ...M, extra: 1 }, { ...F, bestStars: 6 }]);
    write(s);
    expect(resetSave(s)).toBe(true);
    expect(s.getItem(SAVE_STORAGE_KEY)).toBeNull();
    persistProgress(snap(loadSave(s), { dex: [M] }), s);
    expect(rawDex(s)).toEqual([M]);
  });

  it("round trip: new-build fixture -> fixed write -> older-build read (loadSave) -> fixed write again keeps everything", () => {
    const fixture = [{ ...M, bestBakeLevel: 3 }, { ...F, bestScore: 120 }, { ...FUTURE("u"), tier: 2 }];
    const s = open(fixture);
    write(s, { pitzBalance: 10 });
    const afterFirst = rawDex(s);
    const older = loadSave(s); // an older build reads: only what it understands
    expect(older.dex).toEqual([M]);
    write(s, { dex: older.dex, pitzBalance: 20 });
    expect(rawDex(s)).toEqual(afterFirst);
    expect(afterFirst).toEqual([{ bestBakeLevel: 3, ...M }, { ...F, bestScore: 120 }, { tier: 2, ...FUTURE("u") }]);
  });
});
