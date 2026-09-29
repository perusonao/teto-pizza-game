import { describe, expect, it } from "vitest";
import { queryCatalog } from "./catalogQuery";
import type { CatalogIngredient, OwnershipView } from "./catalogTypes";
import { emptyUsageSession } from "./usageSignals";
import { largeCatalogFixture } from "./testSupport/largeCatalogFixtures";

const catalog: CatalogIngredient[] = [
  { id: "bacon", category: "topping", nameJa: "ベーコン", catalogIndex: 0 },
  { id: "ham", category: "topping", nameJa: "ハム", catalogIndex: 1 },
  { id: "eggplant", category: "topping", nameJa: "茄子", readingJa: "なす", catalogIndex: 2 },
  { id: "tuna", category: "topping", nameJa: "ツナ", catalogIndex: 3 },
  { id: "locked", category: "topping", nameJa: "ロック", catalogIndex: 4 },
  { id: "mozz", category: "cheese", nameJa: "モッツァレラ", catalogIndex: 5 },
];
const stock: Record<string, number | "UNLIMITED"> = { bacon: 0, ham: 3, eggplant: 9, tuna: 1, mozz: "UNLIMITED" };
const ownership: OwnershipView = { ownedIds: ["mozz", "tuna", "eggplant", "ham", "bacon"], stock: (id) => stock[id] ?? 0 };
const ids = (rows: CatalogIngredient[]) => rows.map((r) => r.id);

describe("queryCatalog", () => {
  it("returns OWNED only (never locked / not bought), catalog order, zero stock last", () => {
    expect(ids(queryCatalog(catalog, ownership, emptyUsageSession()))).toEqual(["ham", "eggplant", "tuna", "mozz", "bacon"]);
  });

  it("filters by text, favorites, recent, in-stock (no membership axis in LC-R0)", () => {
    const usage = { favorites: ["tuna"], recent: ["eggplant", "ham"], newlyOwned: [] };
    expect(ids(queryCatalog(catalog, ownership, usage, { text: "ナス" }))).toEqual(["eggplant"]);
    expect(ids(queryCatalog(catalog, ownership, usage, { only: { favorites: true } }))).toEqual(["tuna"]);
    expect(ids(queryCatalog(catalog, ownership, usage, { only: { recent: true }, sort: "recent" }))).toEqual(["eggplant", "ham"]);
    expect(ids(queryCatalog(catalog, ownership, usage, { only: { inStock: true } }))).not.toContain("bacon");
  });

  it("sorts by stock (unlimited first) and reading, deterministically", () => {
    const u = emptyUsageSession();
    expect(ids(queryCatalog(catalog, ownership, u, { sort: "stock" }))).toEqual(["mozz", "eggplant", "ham", "tuna", "bacon"]);
    expect(ids(queryCatalog(catalog, ownership, u, { sort: "reading", zeroStockLast: false }))).toEqual([
      "tuna", "eggplant", "ham", "bacon", "mozz",
    ]);
  });

  it("is input-order independent on the 179-ingredient stress fixture", () => {
    const f = largeCatalogFixture("stress-179x172");
    const own: OwnershipView = { ownedIds: f.catalog.map((i) => i.id), stock: () => 1 };
    const a = queryCatalog(f.catalog, own, emptyUsageSession(), { sort: "reading" });
    const b = queryCatalog([...f.catalog].reverse(), { ...own, ownedIds: [...own.ownedIds].reverse() }, emptyUsageSession(), {
      sort: "reading",
    });
    expect(ids(b)).toEqual(ids(a));
    expect(a).toHaveLength(179);
  });
});

describe("LC-R0 boundary: no membership authority in the query", () => {
  it("has no category / family filter and no counts export (shelf filter arrives in LC-R1, counts in Phase 5)", async () => {
    const mod = (await import("./catalogQuery")) as Record<string, unknown>;
    expect(Object.keys(mod).sort()).toEqual(["ownedCatalog", "queryCatalog"]);
  });
});
