import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "./ingredients";
import { INGREDIENT_SHELVES } from "./ingredientShelf";
import { INGREDIENT_SEARCH_ALIASES, searchAliasesFor } from "./ingredientSearchAliases";
import { normalizeForSearch, matchesSearch } from "../logic/catalog/catalogText";
import { queryCatalog } from "../logic/catalog/catalogQuery";
import { runtimeCatalog } from "../logic/catalog/catalogSource";
import { emptyUsageSession } from "../logic/catalog/usageSignals";

/** LC-R5-b Alias Audit gates T-1 .. T-8: the search-only alias table is exactly the Owner-approved three. */
const IDS = new Set(INGREDIENTS.map((i) => i.id));
const entries = Object.entries(INGREDIENT_SEARCH_ALIASES).flatMap(([id, list]) => list.map((e) => ({ id, ...e })));

describe("ingredient search alias authority (OD-A1 .. OD-A3)", () => {
  it("is exactly the three Owner-approved aliases (nothing guessed, nothing staged)", () => {
    expect(INGREDIENT_SEARCH_ALIASES).toEqual({
      onion: [{ alias: "玉ねぎ", provenance: "owner-approved" }],
      egg: [{ alias: "卵", provenance: "owner-approved" }],
      mozzarella: [{ alias: "モッツァレラチーズ", provenance: "owner-approved" }],
    });
    // The unapproved staging candidates are absent.
    for (const id of ["gorgonzola", "parmigiano", "fontina", "pepperoni", "potato"]) expect(searchAliasesFor(id)).toEqual([]);
  });

  it("T-1: every key is a shipped ingredient id and no alias is duplicated", () => {
    for (const id of Object.keys(INGREDIENT_SEARCH_ALIASES)) expect(IDS.has(id), id).toBe(true);
    const normalized = entries.map((e) => normalizeForSearch(e.alias));
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it("T-2: no alias normalizes to the empty string (it would match every row)", () => {
    for (const e of entries) expect(normalizeForSearch(e.alias), e.alias).not.toBe("");
  });

  it("T-3: no alias is redundant (the name alone must not already match it)", () => {
    for (const e of entries) {
      const item = { id: e.id, category: "topping" as const, nameJa: INGREDIENTS.find((i) => i.id === e.id)!.nameJa, shelf: null, catalogIndex: 0 };
      expect(matchesSearch(item, e.alias), e.alias).toBe(false);
    }
  });

  it("T-4: an alias never matches another ingredient's name", () => {
    for (const e of entries) {
      const others = INGREDIENTS.filter((i) => i.id !== e.id);
      const hit = others.filter((i) => normalizeForSearch(i.nameJa).includes(normalizeForSearch(e.alias)));
      expect(hit.map((i) => i.id), e.alias).toEqual([]);
    }
  });

  it("T-5: an alias is never a shelf label or a Hint 5 class word (that would turn a name into an attribute search)", () => {
    const forbidden = new Set(
      [...INGREDIENT_SHELVES.map((s) => s.labelJa), "肉", "肉系", "魚介", "野菜", "きのこ", "ハーブ", "香味", "スパイス", "薬味", "果物", "チーズ", "ソース"].map(normalizeForSearch),
    );
    for (const e of entries) expect(forbidden.has(normalizeForSearch(e.alias)), e.alias).toBe(false);
  });

  it("T-6: every alias carries owner-approved provenance", () => {
    for (const e of entries) expect(e.provenance).toBe("owner-approved");
  });

  it("T-7: the runtime catalog carries exactly the table, and leaves shelf / readingJa alone", () => {
    for (const item of runtimeCatalog()) {
      expect(item.searchAliasesJa ?? [], item.id).toEqual([...searchAliasesFor(item.id)]);
      expect(item.readingJa, item.id).toBeUndefined();
    }
  });

  it("T-8 golden: approved forms find their ingredient (owned only); unapproved forms find nothing", () => {
    const catalog = runtimeCatalog();
    const ownedAll = { ownedIds: INGREDIENTS.map((i) => i.id), stock: () => 9 };
    const find = (text: string, ownership = ownedAll) =>
      queryCatalog(catalog, ownership, emptyUsageSession(), { text }).map((i) => i.id);
    expect(find("玉ねぎ")).toEqual(["onion"]);
    expect(find("たまねぎ")).toEqual(["onion"]);
    expect(find("タマネギ")).toEqual(["onion"]);
    expect(find("ﾀﾏﾈｷﾞ")).toEqual(["onion"]);
    expect(find("卵")).toEqual(["egg"]);
    expect(find("たまご")).toEqual(["egg"]);
    expect(find("モッツァレラチーズ")).toEqual(["mozzarella"]);
    expect(find("ﾓｯﾂｧﾚﾗ")).toEqual(["mozzarella"]);
    // Guessed / unapproved forms stay empty; there is no reverse (query-contains-name) match (OD-A3).
    for (const text of ["ペペロニ", "馬鈴薯", "大蒜", "ゴルゴンゾーラチーズ", "パルミジャーノチーズ", "フォンティーナチーズ", "ブラックオリーブオイル"]) {
      expect(find(text), text).toEqual([]);
    }
    // An alias of an UNOWNED ingredient never surfaces (owned scope comes first).
    expect(find("玉ねぎ", { ownedIds: ["basil"], stock: () => 9 })).toEqual([]);
    expect(find("卵", { ownedIds: ["basil"], stock: () => 9 })).toEqual([]);
  });
});
