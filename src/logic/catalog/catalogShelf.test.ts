import { describe, expect, it } from "vitest";
import catalog62 from "../../../data/recipes/ingredient_master_catalog.json";
import { INGREDIENTS } from "../../data/ingredients";
import {
  auditShelfAuthority,
  filterByShelf,
  ingredientShelf,
  INGREDIENT_SHELF_ORDER,
  shelvesPresent,
  type IngredientShelfId,
} from "../../data/ingredientShelf";
import { ingredientAttributeFamily, TAXONOMY_INGREDIENT_IDS } from "../../data/ingredientTaxonomy";
import type { HintSheetView } from "../../state/discoveryHint";
import { runtimeCatalog } from "./catalogSource";
import { queryCatalog } from "./catalogQuery";
import type { CatalogIngredient, OwnershipView } from "./catalogTypes";
import { disclosedHintsFromSheetView, NO_DISCLOSED_HINTS } from "./hintDisclosure";
import { emptyUsageSession, recordUse } from "./usageSignals";
import { selectWorkingSet } from "./workingSet";
import { largeCatalogFixture, mulberry32 } from "./testSupport/largeCatalogFixtures";

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id);
const ownAll = (catalog: readonly CatalogIngredient[]): OwnershipView => ({ ownedIds: catalog.map((i) => i.id), stock: () => 1 });
const usage = emptyUsageSession();

/** Test-only projection of the production rule for a catalog that is not the production one (the 62
 *  catalog): category for sauce / cheese, the DH4-1 family for toppings, null when the audit says
 *  unclassified. It is cross-checked against `ingredientShelf()` on every production id below, so it can
 *  never drift into being a second authority. */
function project62(): CatalogIngredient[] {
  const rows = catalog62.ingredients as { id: string; nameJa: string; category: "sauce" | "cheese" | "topping" }[];
  const audit = auditShelfAuthority({ ingredients: rows, familyRowIds: TAXONOMY_INGREDIENT_IDS, familyOf: ingredientAttributeFamily });
  const unclassified = new Set(audit.unclassified);
  return rows.map((r, catalogIndex) => ({
    id: r.id,
    category: r.category,
    nameJa: r.nameJa,
    shelf: r.category !== "topping" ? r.category : unclassified.has(r.id) ? null : (ingredientAttributeFamily(r.id) as IngredientShelfId),
    catalogIndex,
  }));
}

describe("LC-R1: CatalogIngredient.shelf is copied from ingredientShelf (31 production)", () => {
  const catalog = runtimeCatalog();

  it("equals ingredientShelf(id) for every production ingredient and is never null", () => {
    expect(catalog).toHaveLength(35);
    for (const item of catalog) expect(item.shelf).toBe(ingredientShelf(item.id));
    expect(catalog.every((i) => i.shelf !== null)).toBe(true);
  });

  it("matches an independent recount: sauce 3 / cheese 4 / topping 24 and the family distribution", () => {
    const byCategory: Record<string, number> = {};
    const byShelf: Record<string, number> = {};
    for (const i of INGREDIENTS) {
      byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
      const shelf = i.category === "topping" ? ingredientAttributeFamily(i.id) : i.category;
      byShelf[shelf!] = (byShelf[shelf!] ?? 0) + 1;
    }
    expect(byCategory).toEqual({ sauce: 3, cheese: 4, topping: 28 });
    const seen: Record<string, number> = {};
    for (const i of catalog) seen[i.shelf!] = (seen[i.shelf!] ?? 0) + 1;
    expect(seen).toEqual(byShelf);
    expect(seen).toEqual({ sauce: 3, cheese: 4, meat: 5, seafood: 4, vegetable: 10, fruit: 1, herb: 5, spice: 1, other: 2 });
  });
});

describe("LC-R1: queryCatalog shelves filter", () => {
  const catalog = runtimeCatalog();
  const own = ownAll(catalog);

  it("undefined / empty shelves = no shelf filter (すべて)", () => {
    const all = ids(queryCatalog(catalog, own, usage));
    expect(all).toHaveLength(35);
    expect(ids(queryCatalog(catalog, own, usage, { shelves: [] }))).toEqual(all);
    expect(ids(queryCatalog(catalog, own, usage, { shelves: undefined }))).toEqual(all);
  });

  it("parity with filterByShelf for every shelf (one authority, same membership)", () => {
    const ownedRows = catalog.filter((i) => own.ownedIds.includes(i.id));
    for (const shelf of INGREDIENT_SHELF_ORDER) {
      expect(ids(queryCatalog(catalog, own, usage, { shelves: [shelf] }))).toEqual(ids(filterByShelf(ownedRows, shelf)));
    }
  });

  it("multiple shelves = union, in catalog order", () => {
    const got = queryCatalog(catalog, own, usage, { shelves: ["seafood", "meat"] });
    expect(got.every((i) => i.shelf === "meat" || i.shelf === "seafood")).toBe(true);
    expect(got).toHaveLength(9); // meat 5 (incl. No.27 chicken) + seafood 4 (incl. Expansion shrimp)
    expect(ids(got)).toEqual(ids([...got].sort((a, b) => a.catalogIndex - b.catalogIndex)));
  });

  it("「すべて」 is not a shelf id: 'all' or an unknown / hostile id matches nothing (fail-closed)", () => {
    expect(INGREDIENT_SHELF_ORDER as readonly string[]).not.toContain("all");
    for (const bad of ["all", "topping", "", "__proto__", "MEAT"]) {
      expect(queryCatalog(catalog, own, usage, { shelves: [bad as IngredientShelfId] })).toEqual([]);
    }
    expect(queryCatalog(catalog, own, usage, { shelves: "meat" as unknown as IngredientShelfId[] })).not.toEqual(
      queryCatalog(catalog, own, usage),
    );
  });

  it("OWNED only: an unowned ingredient never appears under its shelf; a shelf with no owned row is empty", () => {
    const owned: OwnershipView = { ownedIds: ["tomato-sauce", "mozzarella", "basil"], stock: () => 1 };
    for (const shelf of INGREDIENT_SHELF_ORDER) {
      const rows = queryCatalog(catalog, owned, usage, { shelves: [shelf] });
      expect(rows.every((r) => owned.ownedIds.includes(r.id))).toBe(true);
    }
    expect(ids(queryCatalog(catalog, owned, usage, { shelves: ["meat"] }))).toEqual([]);
    expect(ids(queryCatalog(catalog, owned, usage, { shelves: ["herb"] }))).toEqual(["basil"]);
    // What the pantry chip row would list (shelvesPresent over the query output) never names an unowned shelf.
    expect(shelvesPresent(queryCatalog(catalog, owned, usage))).toEqual(["sauce", "cheese", "herb"]);
  });

  it("text search AND shelf", () => {
    const bacon = INGREDIENTS.find((i) => i.nameJa === "ベーコン");
    if (!bacon) throw new Error("fixture assumption: production has ベーコン");
    expect(ids(queryCatalog(catalog, own, usage, { text: "ベーコン", shelves: ["meat"] }))).toEqual([bacon.id]);
    expect(queryCatalog(catalog, own, usage, { text: "ベーコン", shelves: ["seafood"] })).toEqual([]);
    expect(ids(queryCatalog(catalog, own, usage, { text: "ベーコン" }))).toEqual([bacon.id]);
  });

  it("does not change ordering: a shelf query is the unfiltered result filtered by shelf, for every sort", () => {
    const u = recordUse(emptyUsageSession(), ["basil", "bacon", "mozzarella"]);
    const stock = new Map(catalog.map((i, k) => [i.id, k % 5] as const));
    const partial: OwnershipView = { ownedIds: catalog.map((i) => i.id), stock: (id) => stock.get(id) ?? 0 };
    for (const sort of ["catalog", "recent", "reading", "stock"] as const) {
      for (const zeroStockLast of [true, false]) {
        const full = queryCatalog(catalog, partial, u, { sort, zeroStockLast });
        for (const shelf of INGREDIENT_SHELF_ORDER) {
          expect(ids(queryCatalog(catalog, partial, u, { sort, zeroStockLast, shelves: [shelf] }))).toEqual(
            ids(full.filter((i) => i.shelf === shelf)),
          );
        }
      }
    }
  });

  it("is deterministic and input-order independent with shelves on the 179 fixture", () => {
    const f = largeCatalogFixture("stress-179x172");
    const o = ownAll(f.catalog);
    const q = { shelves: ["vegetable", "spice"] as IngredientShelfId[], sort: "reading" as const };
    const a = queryCatalog(f.catalog, o, usage, q);
    const b = queryCatalog([...f.catalog].reverse(), { ...o, ownedIds: [...o.ownedIds].reverse() }, usage, q);
    expect(ids(b)).toEqual(ids(a));
    expect(a).toHaveLength(40 + 12);
  });

  it("output composes with the Phase 3/4 chip helpers without a second filter authority", () => {
    const rows = queryCatalog(catalog, own, usage);
    expect(shelvesPresent(rows)).toEqual(INGREDIENT_SHELF_ORDER.filter((s) => rows.some((r) => r.shelf === s)));
    expect(ids(filterByShelf(rows, "all"))).toEqual(ids(rows));
  });
});

describe("LC-R1: 62 catalog (design target, not activated) is fail-closed", () => {
  const catalog = project62();

  it("independent recount: sauce 10 / cheese 10 / topping 42, classified 24, unclassified 18 (No.27 gave chicken its meat row; Expansion Slice 1 gave shrimp its seafood row; Wave 2 gave parsley / bell-pepper / zucchini theirs)", () => {
    const byCategory: Record<string, number> = {};
    for (const i of catalog) byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
    expect(catalog).toHaveLength(62);
    expect(byCategory).toEqual({ sauce: 10, cheese: 10, topping: 42 });
    const toppings = catalog.filter((i) => i.category === "topping");
    expect(toppings.filter((i) => i.shelf !== null)).toHaveLength(24);
    expect(toppings.filter((i) => i.shelf === null)).toHaveLength(18);
    // Recounted straight from the taxonomy table, without the audit helper.
    const rows = catalog62.ingredients as { id: string; category: string }[];
    expect(rows.filter((r) => r.category === "topping" && ingredientAttributeFamily(r.id) === null)).toHaveLength(18);
    // Nulls are exactly what the authority's audit reports; nothing is guessed.
    const audit = auditShelfAuthority({ ingredients: rows, familyRowIds: TAXONOMY_INGREDIENT_IDS, familyOf: ingredientAttributeFamily });
    expect(audit.unclassified.sort()).toEqual(ids(catalog.filter((i) => i.shelf === null)).sort());
  });

  it("the projection equals ingredientShelf() on every id the production catalog knows (no second authority)", () => {
    const production = new Set(INGREDIENTS.map((i) => i.id));
    const overlap = catalog.filter((i) => production.has(i.id));
    expect(overlap.length).toBeGreaterThan(0);
    for (const item of overlap) expect(item.shelf).toBe(ingredientShelf(item.id));
  });

  it("unclassified rows are visible with no shelf filter and never under any shelf filter", () => {
    const own = ownAll(catalog);
    const nulls = catalog.filter((i) => i.shelf === null).map((i) => i.id);
    const everything = ids(queryCatalog(catalog, own, usage));
    expect(everything).toHaveLength(62);
    for (const id of nulls) expect(everything).toContain(id);
    const anyShelf = ids(queryCatalog(catalog, own, usage, { shelves: [...INGREDIENT_SHELF_ORDER] }));
    expect(anyShelf).toHaveLength(62 - 18);
    for (const id of nulls) expect(anyShelf).not.toContain(id);
    for (const shelf of INGREDIENT_SHELF_ORDER) {
      expect(queryCatalog(catalog, own, usage, { shelves: [shelf] }).every((i) => i.shelf === shelf)).toBe(true);
    }
  });
});

describe("LC-R1: shelf authority adds no hint / ingredient-name leak (Hint 5 unchanged)", () => {
  it("the hand (working set) ignores `shelf` completely", () => {
    const catalog = runtimeCatalog();
    const rand = mulberry32(11);
    const scrambled = catalog.map((i) => ({ ...i, shelf: INGREDIENT_SHELF_ORDER[Math.floor(rand() * INGREDIENT_SHELF_ORDER.length)] }));
    const nulled = catalog.map((i) => ({ ...i, shelf: null }));
    const base = { category: "topping" as const, capacity: 9, ownership: ownAll(catalog), placedIds: [], pinnedIds: [], disclosedHints: NO_DISCLOSED_HINTS, usage };
    const a = selectWorkingSet({ ...base, catalog });
    expect(selectWorkingSet({ ...base, catalog: scrambled })).toEqual(a);
    expect(selectWorkingSet({ ...base, catalog: nulled })).toEqual(a);
  });

  it("the disclosure surface is still only named ingredient ids; a Hint 5 ladder view is not read at all", () => {
    expect(Object.keys(NO_DISCLOSED_HINTS)).toEqual(["namedIngredientIds"]);
    const ladder = {
      kind: "HINT5_LADDER",
      board: [{ label: "ヒント1: ソース", ingredientId: "tomato-sauce" }],
      legacyKnownIngredientIds: ["basil"],
    } as unknown as HintSheetView;
    expect(disclosedHintsFromSheetView(ladder)).toEqual(NO_DISCLOSED_HINTS);
  });

  it("a hint can only put NAMED ingredients on the hand; shelves never become hint input", () => {
    const catalog = runtimeCatalog();
    const withHint = selectWorkingSet({
      category: "topping",
      capacity: 3,
      catalog,
      ownership: ownAll(catalog),
      placedIds: [],
      pinnedIds: [],
      disclosedHints: { namedIngredientIds: ["basil"] },
      usage,
    });
    expect(withHint.items[0]).toEqual({ id: "basil", source: "hint" });
    // Extra keys (a shelf or class answer smuggled into the input) change nothing.
    const smuggled = selectWorkingSet({
      category: "topping",
      capacity: 3,
      catalog,
      ownership: ownAll(catalog),
      placedIds: [],
      pinnedIds: [],
      disclosedHints: { namedIngredientIds: ["basil"], shelf: "meat", classIds: ["meat"] } as never,
      usage,
    });
    expect(smuggled).toEqual(withHint);
  });
});
