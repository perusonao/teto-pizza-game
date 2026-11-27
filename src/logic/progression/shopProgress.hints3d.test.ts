import { describe, expect, it } from "vitest";
import {
  EMPTY_SHOP_PROGRESS,
  hintRevealsOf,
  isDefaultShopProgress,
  mergeShopProgress,
  researchPointBalanceOf,
  researchPointsSpentOf,
  sameShopProgress,
  sanitizeShopProgress,
  shopProgressForWrite,
  type ShopProgressState,
} from "./shopProgress";

/**
 * B案 Phase 3d (Issue #901): the spent total (`researchPointsSpent`, cumulative, max) and the hint reveals (`hintRevealsByRecipe`,
 * a per-recipe union) in `shopProgress`. The balance is earned - spent, never below 0. In its own file so the Phase 1b-3c suite
 * stays as it was.
 */
const KNOWN = new Set(["margherita", "fugazza", "funghi"]);
const isKnown = (id: string) => KNOWN.has(id);
const base: ShopProgressState = { reputation: 10, grantedMenuRecipeIds: ["margherita"], researchPointsEarned: 9 };

describe("balance = earned - spent", () => {
  it("no spent total: the balance is everything earned (the Phase 3c reading)", () => {
    expect(researchPointBalanceOf(base)).toBe(9);
    expect(researchPointsSpentOf(base)).toBe(0);
  });

  it("spent lowers it; a spent total above the earned one reads as 0, never a debt", () => {
    expect(researchPointBalanceOf({ ...base, researchPointsSpent: 4 })).toBe(5);
    expect(researchPointBalanceOf({ ...base, researchPointsSpent: 9 })).toBe(0);
    expect(researchPointBalanceOf({ ...base, researchPointsSpent: 30 })).toBe(0);
  });
});

describe("sanitize", () => {
  it("a Phase 3c state keeps its exact shape (no new key)", () => {
    expect(sanitizeShopProgress({ ...base }, isKnown)).toEqual(base);
    expect(Object.keys(sanitizeShopProgress({ ...base }, isKnown)!)).not.toContain("researchPointsSpent");
    expect(Object.keys(sanitizeShopProgress({ ...base }, isKnown)!)).not.toContain("hintRevealsByRecipe");
  });

  it("reads spent and reveals back as written", () => {
    const raw = { ...base, researchPointsSpent: 3, hintRevealsByRecipe: { margherita: ["sauce", "ing:mozzarella"] } };
    const read = sanitizeShopProgress(raw, isKnown)!;
    expect(read.researchPointsSpent).toBe(3);
    expect(hintRevealsOf(read, "margherita")).toEqual(["sauce", "ing:mozzarella"]);
  });

  it("invalid values are repaired fail-soft", () => {
    for (const researchPointsSpent of [-1, Number.NaN, "3", null]) {
      expect(researchPointsSpentOf(sanitizeShopProgress({ ...base, researchPointsSpent }, isKnown)!)).toBe(0);
    }
    const raw = {
      ...base,
      hintRevealsByRecipe: { margherita: ["sauce", 3, "Bad Id", "sauce", "ing:basil"], "future-pizza": ["sauce"], funghi: "sauce", fugazza: [] },
    };
    const read = sanitizeShopProgress(raw, isKnown)!;
    expect(read.hintRevealsByRecipe && Object.keys(read.hintRevealsByRecipe)).toEqual(["margherita"]);
    expect(hintRevealsOf(read, "margherita")).toEqual(["sauce", "ing:basil"]);
    expect(sanitizeShopProgress({ ...base, hintRevealsByRecipe: ["sauce"] }, isKnown)).toEqual(base);
  });

  it("an untrusted recipe id never reads a prototype member", () => {
    expect(hintRevealsOf(base, "constructor")).toEqual([]);
    expect(hintRevealsOf(base, "__proto__")).toEqual([]);
  });
});

describe("merge / compare / default", () => {
  it("spent is the max; reveals are a per-recipe union", () => {
    const a: ShopProgressState = { ...base, researchPointsSpent: 3, hintRevealsByRecipe: { margherita: ["sauce"] } };
    const b: ShopProgressState = { ...base, researchPointsSpent: 5, hintRevealsByRecipe: { margherita: ["shape", "sauce"], funghi: ["count"] } };
    const merged = mergeShopProgress(a, b);
    expect(merged.researchPointsSpent).toBe(5);
    expect(hintRevealsOf(merged, "margherita")).toEqual(["sauce", "shape"]);
    expect(hintRevealsOf(merged, "funghi")).toEqual(["count"]);
  });

  it("two merged states never make the balance negative (each tab spends within its own balance)", () => {
    const a: ShopProgressState = { ...base, researchPointsEarned: 9, researchPointsSpent: 9 };
    const b: ShopProgressState = { ...base, researchPointsEarned: 6, researchPointsSpent: 6 };
    expect(researchPointBalanceOf(mergeShopProgress(a, b))).toBe(0);
  });

  it("sameShopProgress sees a spent or reveal change", () => {
    expect(sameShopProgress(base, { ...base, researchPointsSpent: 1 })).toBe(false);
    expect(sameShopProgress(base, { ...base, hintRevealsByRecipe: { margherita: ["sauce"] } })).toBe(false);
    expect(sameShopProgress({ ...base, hintRevealsByRecipe: { margherita: ["sauce"] } }, { ...base, hintRevealsByRecipe: { margherita: ["sauce"] } })).toBe(true);
  });

  it("a state with only spent or only reveals is not the default", () => {
    expect(isDefaultShopProgress({ ...EMPTY_SHOP_PROGRESS, researchPointsSpent: 1 })).toBe(false);
    expect(isDefaultShopProgress({ ...EMPTY_SHOP_PROGRESS, hintRevealsByRecipe: { margherita: ["sauce"] } })).toBe(false);
    expect(isDefaultShopProgress({ ...EMPTY_SHOP_PROGRESS, hintRevealsByRecipe: {} })).toBe(true);
  });
});

describe("shopProgressForWrite", () => {
  it("writes spent and reveals; a Phase 3c state writes neither key", () => {
    const written = shopProgressForWrite({ ...base, researchPointsSpent: 2, hintRevealsByRecipe: { margherita: ["sauce"] } }, undefined) as Record<string, unknown>;
    expect(written.researchPointsSpent).toBe(2);
    expect(written.hintRevealsByRecipe).toEqual({ margherita: ["sauce"] });
    const plain = shopProgressForWrite(base, undefined) as Record<string, unknown>;
    expect(plain).not.toHaveProperty("researchPointsSpent");
    expect(plain).not.toHaveProperty("hintRevealsByRecipe");
  });

  it("merges into what storage holds: spent max, reveals union, a newer build's recipe and item kind stay", () => {
    const stored = {
      ...base,
      researchPointsSpent: 7,
      hintRevealsByRecipe: { margherita: ["shape"], "future-pizza": ["future-kind:x"] },
      futureKey: 1,
    };
    const written = shopProgressForWrite({ ...base, researchPointsSpent: 4, hintRevealsByRecipe: { margherita: ["sauce"] } }, stored) as Record<string, unknown>;
    expect(written.researchPointsSpent).toBe(7);
    expect(written.hintRevealsByRecipe).toEqual({ margherita: ["shape", "sauce"], "future-pizza": ["future-kind:x"] });
    expect(written.futureKey).toBe(1);
  });

  it("an older (lower) snapshot never lowers the stored spent total or drops a stored reveal", () => {
    const stored = { ...base, researchPointsSpent: 7, hintRevealsByRecipe: { margherita: ["shape"] } };
    const written = shopProgressForWrite({ ...base, researchPointsEarned: 10 }, stored) as Record<string, unknown>;
    expect(written.researchPointsSpent).toBe(7);
    expect(written.hintRevealsByRecipe).toEqual({ margherita: ["shape"] });
  });
});
