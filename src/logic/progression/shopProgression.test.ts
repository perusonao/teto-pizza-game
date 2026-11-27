import { describe, expect, it } from "vitest";
import { MENU_CATALOG } from "../../data/menuCatalog";
import { RECIPES } from "../../data/recipes";
import type { DexState } from "../../state/dex";
import { legacyRecipeChapter } from "../../state/recipeChapters";
import type { CutEvaluation } from "../cut/types";
import type { ScoreBreakdown } from "../scoring";
import { REPUTATION_TABLE, isReputationTableComplete, type CompleteReputationTable } from "./reputationTable";
import { orderReputationGain, serviceQualityOf } from "./serviceQuality";
import { EMPTY_SHOP_PROGRESS } from "./shopProgress";
import {
  SHOP_FIRST_MENU_RECIPE_IDS,
  activeShopCatalog,
  addReputation,
  catalogChapterOf,
  catalogRecipes,
  chapterForReputation,
  interimMenuCatalog,
  isOnShopMenu,
  materialChapterOf,
  materialOpenReputationOf,
  nextChapterFloor,
  resolveShopModelEntitlement,
  shopMenuRecipeIds,
  type ShopCatalog,
} from "./shopProgression";

/** B案 Phase 2a (Issue #901): the shop model's pure rules (./shopProgression.ts) and the evaluation adapter. */

if (!isReputationTableComplete(REPUTATION_TABLE)) throw new Error("the production reputation table must be complete in Phase 2a");
const TABLE: CompleteReputationTable = REPUTATION_TABLE;
const FLOORS = TABLE.chapterFloors;

const discovered = (...ids: string[]): DexState =>
  ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 0, bestStars: 1 as const, timesMade: 0 }));

describe("chapters from the reputation", () => {
  it.each([
    [0, 1],
    [39, 1],
    [40, 2],
    [109, 2],
    [110, 3],
    [209, 3],
    [210, 4],
    [339, 4],
    [340, 5],
    [10_000, 5],
  ])("reputation %i -> chapter %i", (reputation, chapter) => {
    expect(chapterForReputation(reputation, FLOORS)).toBe(chapter);
  });

  it("the next floor is the following chapter's, then null at the last chapter", () => {
    expect(nextChapterFloor(0, FLOORS)).toBe(40);
    expect(nextChapterFloor(40, FLOORS)).toBe(110);
    expect(nextChapterFloor(339, FLOORS)).toBe(340);
    expect(nextChapterFloor(340, FLOORS)).toBeNull();
  });
});

describe("the catalog (Phase 3a: the curated 60; Phase 3b: the materials derived from it)", () => {
  it("the curated catalog drives the recipes", () => {
    const catalog = activeShopCatalog();
    expect(catalog.interim).toBe(false);
    expect(catalog.entries).toBe(MENU_CATALOG);
    expect(activeShopCatalog()).toBe(catalog);
    for (const e of MENU_CATALOG) expect(catalogChapterOf(e.recipeId, catalog)).toBe(e.chapter);
    expect(catalogRecipes(catalog).map((r) => r.id)).toEqual(
      RECIPES.map((r) => r.id).filter((id) => MENU_CATALOG.some((e) => e.recipeId === id)),
    );
  });

  it("a recipe the catalog does not adopt has no stage (it stays in RECIPES)", () => {
    const rejected = RECIPES.find((r) => !MENU_CATALOG.some((e) => e.recipeId === r.id));
    expect(rejected).toBeDefined();
    expect(catalogChapterOf(rejected!.id, activeShopCatalog())).toBeNull();
  });

  it("Phase 3b: every material's stage comes from the curated catalog (no interim material catalog, no override)", () => {
    const curated = activeShopCatalog();
    expect(curated.materialEntries).toBeUndefined();
    expect(curated.materialOverrides).toEqual({});
    // A material's stage = the lowest stage of an adopted recipe that uses it.
    for (const id of new Set(RECIPES.flatMap((r) => r.requiredIngredients.map((x) => x.ingredientId)))) {
      const stages = MENU_CATALOG.filter((e) => RECIPES.find((r) => r.id === e.recipeId)!.requiredIngredients.some((x) => x.ingredientId === id)).map((e) => e.chapter);
      const expected = stages.length === 0 ? null : Math.min(...stages);
      const got = materialChapterOf(id, curated);
      if (got === 0) continue; // a starter
      expect(got, id).toBe(expected);
    }
  });

  it("the interim catalog is every recipe at its legacy chapter -- no chapter invented", () => {
    const entries = interimMenuCatalog();
    expect(entries.map((e) => e.recipeId)).toEqual(RECIPES.map((r) => r.id));
    for (const r of RECIPES) expect(entries.find((e) => e.recipeId === r.id)?.chapter).toBe(legacyRecipeChapter(r));
  });

  it("every ladder material has a chapter under the interim catalog (none is unsellable)", () => {
    // Phase 3b: the active catalog no longer derives materials from the interim one, so this pins the interim catalog itself.
    const catalog: ShopCatalog = { entries: interimMenuCatalog(), materialOverrides: {}, interim: true };
    const unlocked = resolveShopModelEntitlement(
      { ownedIngredientIds: [], unlockedForShopIngredientIds: [], shop: { reputation: 10_000, grantedMenuRecipeIds: [] } },
      TABLE,
      catalog,
    ).unlockedForShopIngredientIds;
    for (const id of unlocked) expect(materialChapterOf(id, catalog)).not.toBeNull();
    expect(unlocked.length).toBeGreaterThan(100);
  });
});

describe("a material's chapter", () => {
  const synthetic: ShopCatalog = {
    entries: [
      { recipeId: "margherita", chapter: 1 },
      { recipeId: "pepperoni", chapter: 3 },
      { recipeId: "quattro-formaggi", chapter: 2 },
    ],
    materialOverrides: {},
    interim: false,
  };

  it("a starter is chapter 0 (always usable)", () => {
    expect(materialChapterOf("mozzarella", synthetic)).toBe(0);
  });

  it("is the lowest chapter of an adopted recipe requiring it", () => {
    expect(materialChapterOf("pepperoni", synthetic)).toBe(3);
  });

  it("an override wins", () => {
    expect(materialChapterOf("pepperoni", { ...synthetic, materialOverrides: { pepperoni: 1 } })).toBe(1);
  });

  it("is null when no adopted recipe requires it", () => {
    expect(materialChapterOf("pineapple", synthetic)).toBeNull();
    expect(materialChapterOf("no-such-ingredient", synthetic)).toBeNull();
  });
});

describe("the shop entitlement", () => {
  const catalog = activeShopCatalog();

  it("is a union with the ledger and the owned finite materials (never re-locks)", () => {
    const result = resolveShopModelEntitlement(
      { ownedIngredientIds: ["truffle"], unlockedForShopIngredientIds: ["salmon"], shop: EMPTY_SHOP_PROGRESS },
      TABLE,
      catalog,
    );
    expect(result.unlockedForShopIngredientIds.slice(0, 2)).toEqual(["salmon", "truffle"]);
    expect(result.newlyUnlockedMaterialIds).not.toContain("salmon");
    expect(result.newlyUnlockedMaterialIds).not.toContain("truffle");
  });

  it("returns the input ledger by reference when nothing changes", () => {
    const first = resolveShopModelEntitlement(
      { ownedIngredientIds: [], unlockedForShopIngredientIds: [], shop: EMPTY_SHOP_PROGRESS },
      TABLE,
      catalog,
    );
    const again = resolveShopModelEntitlement(
      { ownedIngredientIds: [], unlockedForShopIngredientIds: first.unlockedForShopIngredientIds, shop: EMPTY_SHOP_PROGRESS },
      TABLE,
      catalog,
    );
    expect(again.unlockedForShopIngredientIds).toBe(first.unlockedForShopIngredientIds);
    expect(again.newlyUnlockedMaterialIds).toEqual([]);
  });

  it("each chapter adds exactly its own materials (Phase 3b: stage 4's second half at its mid-stage reputation 275)", () => {
    let ledger: readonly string[] = [];
    for (const reputation of [...FLOORS.slice(0, 4), 275, FLOORS[4]]) {
      const r = resolveShopModelEntitlement(
        { ownedIngredientIds: [], unlockedForShopIngredientIds: ledger, shop: { reputation, grantedMenuRecipeIds: [] } },
        TABLE,
        catalog,
      );
      expect(r.newlyUnlockedMaterialIds.length).toBeGreaterThan(0);
      for (const id of r.newlyUnlockedMaterialIds) expect(materialOpenReputationOf(id, TABLE, catalog), id).toBe(reputation);
      ledger = r.unlockedForShopIngredientIds;
    }
  });
});

describe("the menu", () => {
  const catalog = activeShopCatalog();

  it("a new player's menu is the first menu (margherita, Q2)", () => {
    expect(SHOP_FIRST_MENU_RECIPE_IDS).toEqual(["margherita"]);
    expect(shopMenuRecipeIds({ dex: [], shop: EMPTY_SHOP_PROGRESS }, catalog)).toEqual(["margherita"]);
  });

  it("adds the discovered and the granted recipes, in RECIPES order", () => {
    const ids = shopMenuRecipeIds({ dex: discovered("pepperoni"), shop: { reputation: 0, grantedMenuRecipeIds: ["marinara"] } }, catalog);
    expect(ids).toEqual(RECIPES.map((r) => r.id).filter((id) => ["margherita", "pepperoni", "marinara"].includes(id)));
    expect(isOnShopMenu("pepperoni", { dex: discovered("pepperoni"), shop: EMPTY_SHOP_PROGRESS }, catalog)).toBe(true);
    expect(isOnShopMenu("pepperoni", { dex: [], shop: EMPTY_SHOP_PROGRESS }, catalog)).toBe(false);
  });

  it("a recipe the catalog does not adopt is never on the menu, even discovered (Q4)", () => {
    const small: ShopCatalog = { entries: [{ recipeId: "margherita", chapter: 1 }], materialOverrides: {}, interim: false };
    expect(shopMenuRecipeIds({ dex: discovered("pepperoni"), shop: EMPTY_SHOP_PROGRESS }, small)).toEqual(["margherita"]);
    expect(isOnShopMenu("pepperoni", { dex: discovered("pepperoni"), shop: EMPTY_SHOP_PROGRESS }, small)).toBe(false);
  });
});

describe("the reputation gain", () => {
  const breakdown = (stars: 1 | 2 | 3 | 4 | 5, total: number): ScoreBreakdown => ({
    total,
    stars,
    matchScore: total,
    ingredientScore: total,
    placementScore: total,
    bakeScore: total,
  });

  it("the adapter passes the existing evaluation through unchanged (Scoring 3.0 changes only the adapter)", () => {
    expect(serviceQualityOf(breakdown(4, 83), null)).toEqual({ total: 83, stars: 4, cutScore: null });
    const cut = { cutScore: 71 } as CutEvaluation;
    expect(serviceQualityOf(breakdown(2, 50), cut)).toEqual({ total: 50, stars: 2, cutScore: 71 });
  });

  it("the order gain follows the approved table by stars", () => {
    expect([1, 2, 3, 4, 5].map((s) => orderReputationGain(serviceQualityOf(breakdown(s as 1, 60), null), TABLE))).toEqual([1, 2, 3, 5, 8]);
  });

  it("addReputation accumulates and reports the chapter change", () => {
    const { shop, gain } = addReputation({ reputation: 38, grantedMenuRecipeIds: [] }, 5, TABLE);
    expect(shop.reputation).toBe(43);
    expect(gain).toEqual({ gained: 5, before: 38, after: 43, chapterBefore: 1, chapterAfter: 2, nextFloor: 110 });
  });

  it("a zero / invalid gain changes nothing (the same object)", () => {
    const shop = { reputation: 7, grantedMenuRecipeIds: [] };
    expect(addReputation(shop, 0, TABLE).shop).toBe(shop);
    expect(addReputation(shop, -3, TABLE).shop).toBe(shop);
    expect(addReputation(shop, Number.NaN, TABLE).shop).toBe(shop);
  });
});
