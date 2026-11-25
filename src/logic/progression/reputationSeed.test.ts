import { describe, expect, it } from "vitest";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import type { MenuCatalogEntry } from "../../data/menuCatalog";
import type { RecipeId } from "../../data/recipes";
import {
  applyReputationSeed,
  canEnableShopProgression,
  legacyReputationSeed,
  materialChaptersOf,
  reachedChapterOf,
  startupShopProgress,
  type ReputationSeedData,
} from "./reputationSeed";
import type { ReputationTable } from "./reputationTable";
import { EMPTY_SHOP_PROGRESS, type ShopProgressState } from "./shopProgress";

/**
 * B案 Phase 1b (Issue #901), design §3.3 / Q3 / R9: the seed rule on a SYNTHETIC catalog and table (the real curated 60 and
 * the real numbers are not decided; nothing here is a proposal for them).
 *
 * Catalog (finite materials in brackets): ch1 margherita [], funghi [mushroom] · ch2 salsiccia [sausage], bismarck [egg] ·
 * ch3 pepperoni [pepperoni], breakfast-pizza [egg, bacon] · ch4 melanzane-pizza [eggplant] · ch5 hawaiian [ham, pineapple].
 * Not adopted: tonno-e-cipolla [onion, tuna] -- its materials must never count.
 */
const entry = (recipeId: string, chapter: number): MenuCatalogEntry => ({ recipeId: recipeId as RecipeId, chapter });
const CATALOG: readonly MenuCatalogEntry[] = [
  entry("margherita", 1),
  entry("funghi", 1),
  entry("salsiccia", 2),
  entry("bismarck", 2),
  entry("pepperoni", 3),
  entry("breakfast-pizza", 3),
  entry("melanzane-pizza", 4),
  entry("hawaiian", 5),
];
const TABLE: ReputationTable = { chapterFloors: [0, 100, 250, 500, 900], perOrderGain: 10, menuDevelopmentBonus: 20 };
const DATA: ReputationSeedData = { table: TABLE, catalog: CATALOG };

const CH1 = ["mushroom"];
const CH2 = ["sausage", "egg"];
const CH3 = ["pepperoni", "bacon"];
const CH4 = ["eggplant"];
const CH5 = ["ham", "pineapple"];

const unlocked = (...ids: string[]) => ({ ownedIngredientIds: [...STARTER_INGREDIENT_IDS], unlockedForShopIngredientIds: ids });

describe("material chapters: the lowest adopted chapter that uses the material", () => {
  it("derives each finite material's chapter from the catalog (egg: ch2 via bismarck, not ch3 via breakfast-pizza)", () => {
    const chapters = materialChaptersOf(CATALOG);
    expect(Object.fromEntries(chapters)).toEqual({
      mushroom: 1,
      sausage: 2,
      egg: 2,
      pepperoni: 3,
      bacon: 3,
      eggplant: 4,
      ham: 5,
      pineapple: 5,
    });
  });

  it("starters are never a chapter's material, and a non-adopted recipe's materials are absent", () => {
    const chapters = materialChaptersOf(CATALOG);
    for (const id of STARTER_INGREDIENT_IDS) expect(chapters.has(id)).toBe(false);
    expect(chapters.has("onion")).toBe(false);
    expect(chapters.has("tuna")).toBe(false);
  });

  it("an override moves an adopted material; an override for a material no adopted recipe uses is ignored", () => {
    const chapters = materialChaptersOf(CATALOG, { bacon: 5, onion: 1 });
    expect(chapters.get("bacon")).toBe(5);
    expect(chapters.has("onion")).toBe(false);
  });

  it("a catalog id with no recipe contributes nothing", () => {
    expect(materialChaptersOf([entry("no-such-recipe", 1)]).size).toBe(0);
  });
});

describe("reached chapter: every material of that chapter and below is unlocked", () => {
  const chapters = materialChaptersOf(CATALOG);
  const cases: Array<[string, string[], number]> = [
    ["nothing unlocked (a new save) -> chapter 1", [], 1],
    ["chapter 1 complete only", [...CH1], 1],
    ["chapter 2 complete", [...CH1, ...CH2], 2],
    ["chapter 2 missing one material (egg) -> stays 1", [...CH1, "sausage"], 1],
    ["chapter 3 complete", [...CH1, ...CH2, ...CH3], 3],
    ["chapter 4 materials without chapter 3's -> cumulative, stays 2", [...CH1, ...CH2, ...CH4], 2],
    ["chapter 4 complete", [...CH1, ...CH2, ...CH3, ...CH4], 4],
    ["everything -> chapter 5", [...CH1, ...CH2, ...CH3, ...CH4, ...CH5], 5],
    ["only non-adopted materials (onion, tuna) -> chapter 1", ["onion", "tuna"], 1],
  ];
  for (const [name, ids, expected] of cases) {
    it(name, () => expect(reachedChapterOf(unlocked(...ids), chapters)).toBe(expected));
  }

  it("an owned material counts like an unlocked one (both are unions that never re-lock)", () => {
    expect(reachedChapterOf({ ownedIngredientIds: [...CH1, ...CH2], unlockedForShopIngredientIds: [] }, chapters)).toBe(2);
  });
});

describe("legacyReputationSeed: the chapter's lower bound", () => {
  it("is the floor of the reached chapter", () => {
    expect(legacyReputationSeed(unlocked(), DATA)).toBe(0);
    expect(legacyReputationSeed(unlocked(...CH1, ...CH2), DATA)).toBe(100);
    expect(legacyReputationSeed(unlocked(...CH1, ...CH2, ...CH3), DATA)).toBe(250);
    expect(legacyReputationSeed(unlocked(...CH1, ...CH2, ...CH3, ...CH4, ...CH5), DATA)).toBe(900);
  });

  it("is null (not computed) while any table value is null", () => {
    const tables: ReputationTable[] = [
      { ...TABLE, chapterFloors: [0, 100, null, 500, 900] },
      { ...TABLE, perOrderGain: null },
      { ...TABLE, menuDevelopmentBonus: null },
    ];
    for (const table of tables) expect(legacyReputationSeed(unlocked(...CH1, ...CH2), { ...DATA, table })).toBeNull();
  });

  it("is null while the curated catalog is empty", () => {
    expect(canEnableShopProgression({ table: TABLE, catalog: [] })).toBe(false);
    expect(legacyReputationSeed(unlocked(...CH1), { table: TABLE, catalog: [] })).toBeNull();
  });

  it("is null for a table whose floors go down (an invalid table is not complete)", () => {
    expect(legacyReputationSeed(unlocked(), { ...DATA, table: { ...TABLE, chapterFloors: [0, 300, 250, 500, 900] } })).toBeNull();
  });
});

describe("applyReputationSeed: once, never recomputed (R9), never lowering the reputation (Q1)", () => {
  it("records the seed and raises the reputation to it", () => {
    const seeded = applyReputationSeed(EMPTY_SHOP_PROGRESS, unlocked(...CH1, ...CH2), DATA);
    expect(seeded).toEqual({ reputation: 100, grantedMenuRecipeIds: [], reputationSeed: { source: "legacy-dex", value: 100 } });
  });

  it("a recorded seed is never recomputed, whatever the save holds now", () => {
    const once = applyReputationSeed(EMPTY_SHOP_PROGRESS, unlocked(...CH1), DATA);
    const again = applyReputationSeed(once, unlocked(...CH1, ...CH2, ...CH3, ...CH4, ...CH5), DATA);
    expect(again).toBe(once);
    expect(again.reputationSeed).toEqual({ source: "legacy-dex", value: 0 });
  });

  it("keeps a higher reputation (the seed only ever raises it)", () => {
    const shop: ShopProgressState = { reputation: 400, grantedMenuRecipeIds: ["margherita"], reputationSeed: null };
    const seeded = applyReputationSeed(shop, unlocked(...CH1, ...CH2), DATA);
    expect(seeded.reputation).toBe(400);
    expect(seeded.reputationSeed).toEqual({ source: "legacy-dex", value: 100 });
    expect(seeded.grantedMenuRecipeIds).toEqual(["margherita"]);
  });

  it("records nothing (same object) while the seed cannot be computed", () => {
    const shop: ShopProgressState = { reputation: 5, grantedMenuRecipeIds: [], reputationSeed: null };
    expect(applyReputationSeed(shop, unlocked(...CH1), { ...DATA, table: { ...TABLE, perOrderGain: null } })).toBe(shop);
  });
});

describe("startupShopProgress: a shop-model step only", () => {
  it("legacy: the stored state, the same object, even with a complete table", () => {
    expect(startupShopProgress("legacy", EMPTY_SHOP_PROGRESS, unlocked(...CH1, ...CH2), DATA)).toBe(EMPTY_SHOP_PROGRESS);
  });

  it("shop: seeds once with a complete table", () => {
    expect(startupShopProgress("shop", EMPTY_SHOP_PROGRESS, unlocked(...CH1, ...CH2), DATA).reputationSeed).toEqual({
      source: "legacy-dex",
      value: 100,
    });
  });

  it("shop with the PRODUCTION data (null table, empty catalog): records nothing", () => {
    expect(startupShopProgress("shop", EMPTY_SHOP_PROGRESS, unlocked(...CH1, ...CH2))).toBe(EMPTY_SHOP_PROGRESS);
  });
});
