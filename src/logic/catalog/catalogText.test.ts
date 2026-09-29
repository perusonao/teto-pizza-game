import { describe, expect, it } from "vitest";
import { compareReading, matchesSearch, normalizeForSearch } from "./catalogText";
import type { CatalogIngredient } from "./catalogTypes";

const item = (over: Partial<CatalogIngredient>): CatalogIngredient => ({
  id: "x",
  category: "topping",
  nameJa: "ベーコン",
  shelf: "meat",
  catalogIndex: 0,
  ...over,
});

describe("normalizeForSearch", () => {
  it("folds katakana, half width, long vowels, dots and spaces", () => {
    expect(normalizeForSearch("ベーコン")).toBe("べこん");
    expect(normalizeForSearch("ﾍﾞｰｺﾝ")).toBe("べこん");
    expect(normalizeForSearch("べ こ・ん")).toBe("べこん");
    expect(normalizeForSearch("ABC")).toBe("abc");
  });

  it("never throws on non-strings", () => {
    expect(normalizeForSearch(undefined as unknown as string)).toBe("");
  });
});

describe("matchesSearch", () => {
  it("matches by name or reading, empty query matches all", () => {
    expect(matchesSearch(item({}), "べーこ")).toBe(true);
    expect(matchesSearch(item({ nameJa: "茄子", readingJa: "なす" }), "ナス")).toBe(true);
    expect(matchesSearch(item({}), "  ")).toBe(true);
    expect(matchesSearch(item({}), "はむ")).toBe(false);
  });
});

describe("compareReading", () => {
  it("is a total order ending in catalog order", () => {
    const a = item({ id: "a", nameJa: "あ", catalogIndex: 2 });
    const b = item({ id: "b", nameJa: "あ", catalogIndex: 1 });
    const c = item({ id: "c", nameJa: "い", catalogIndex: 0 });
    expect([a, c, b].sort(compareReading).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
});
