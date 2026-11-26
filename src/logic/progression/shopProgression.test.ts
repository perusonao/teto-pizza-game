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

describe("the catalog (Phase 3a: the curated 60; materials on the Phase 2a interim rule until Phase 3b)", () => {
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

  it("every material keeps its Phase 2a stage (the interim catalog derives it until Phase 3b)", () => {
    const curated = activeShopCatalog();
    const interim: ShopCatalog = { entries: interimMenuCatalog(), materialOverrides: {}, interim: true };
    expect(curated.materialEntries).toBe(interimMenuCatalog());
    const all = resolveShopModelEntitlement(
      { ownedIngredientIds: [], unlockedForShopIngredientIds: [], shop: { reputation: 10_000, grantedMenuRecipeIds: [] } },
      TABLE,
      interim,
    ).unlockedForShopIngredientIds;
    for (const id of all) expect(materialChapterOf(id, curated)).toBe(materialChapterOf(id, interim));
    for (const reputation of [0, 39, 40, 110, 210, 340]) {
      const inputs = { ownedIngredientIds: [], unlockedForShopIngredientIds: [], shop: { reputation, grantedMenuRecipeIds: [] } };
      expect(resolveShopModelEntitlement(inputs, TABLE, curated)).toEqual(resolveShopModelEntitlement(inputs, TABLE, interim));
    }
  });

  it("the interim catalog is every recipe at its legacy chapter -- no chapter invented", () => {
    const entries = interimMenuCatalog();
    expect(entries.map((e) => e.recipeId)).toEqual(RECIPES.map((r) => r.id));
    for (const r of RECIPES) expect(entries.find((e) => e.recipeId === r.id)?.chapter).toBe(legacyRecipeChapter(r));
  });

  it("every ladder material has a chapter under the interim catalog (none is unsellable)", () => {
    const catalog = activeShopCatalog();
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

  it("each chapter adds exactly its own materials", () => {
    let ledger: readonly string[] = [];
    for (let chapter = 1; chapter <= 5; chapter++) {
      const r = resolveShopModelEntitlement(
        { ownedIngredientIds: [], unlockedForShopIngredientIds: ledger, shop: { reputation: FLOORS[chapter - 1], grantedMenuRecipeIds: [] } },
        TABLE,
        catalog,
      );
      expect(r.newlyUnlockedMaterialIds.every((id) => materialChapterOf(id, catalog) === chapter)).toBe(true);
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
