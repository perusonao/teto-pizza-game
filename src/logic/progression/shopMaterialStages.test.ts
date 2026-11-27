import { describe, expect, it, vi } from "vitest";

// B案 Phase 3b: the technique check below reads the active model, so this file runs under the shop model (what
// `?progression=shop` selects on Preview). The flag is a per-page-load constant, so it is replaced before anything imports it.
vi.mock("./progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { getIngredient } from "../../data/ingredients";
import { MATERIAL_CHAPTER_OVERRIDES, MATERIAL_MID_STAGE_ARRIVALS, MENU_CATALOG } from "../../data/menuCatalog";
import { getRecipe } from "../../data/recipes";
import { ingredientUnlockStep } from "../../state/materialEntitlement";
import { materialOffer, priceTierForStep } from "../materialShop";
import { requiredTechniquesOf } from "../techniques/detection";
import { isTechniqueAffordanceOpenFor, productionTechniqueContext } from "../techniques/runtime";
import { REPUTATION_TABLE, isReputationTableComplete, type CompleteReputationTable } from "./reputationTable";
import {
  activeShopCatalog,
  isMaterialOpenAt,
  materialChapterOf,
  materialOpenReputationOf,
  resolveShopModelEntitlement,
} from "./shopProgression";

/**
 * B案 Phase 3b (Issue #901, Owner 2026-11-27): the shop model's material stages come from `MENU_CATALOG`. A material opens
 * at the stage its first adopted recipe appears in; stage 4 splits once (twelve materials at 275). The machine check: every
 * one of the 60 has every material (and every technique it needs) by the time its stage opens -- stage 4's last four at 275.
 */

if (!isReputationTableComplete(REPUTATION_TABLE)) throw new Error("the production reputation table must be complete");
const TABLE: CompleteReputationTable = REPUTATION_TABLE;
const FLOORS = TABLE.chapterFloors;
const catalog = activeShopCatalog();

/** The Owner's list (2026-11-27): each stage's first-appearing materials, in the order the stage's recipes first use them. */
const STAGE_MATERIALS: Readonly<Record<number, readonly string[]>> = {
  1: ["tomato-sauce", "mozzarella", "basil", "garlic", "oregano", "mushroom", "egg", "bacon", "pepperoni", "sausage", "ham", "corn", "pineapple", "eggplant", "parmigiano", "olive-oil", "onion"],
  2: ["anchovy", "tuna", "pesto", "cherry-tomato", "black-olive", "rosemary", "gorgonzola", "fontina", "fresh-tomato"],
  3: ["cream-cheese", "spinach", "artichoke", "baked-beans", "chicken", "shrimp", "capers", "clam", "parsley", "zucchini", "bell-pepper", "prosciutto-crudo", "green-pepper"],
  4: ["fromage-blanc-sauce", "doubanjiang", "green-onion", "curry-ketchup", "mustard", "swiss-cheese", "pork", "pickles", "goat-cheese", "arugula", "avocado", "lemon", "shiso", "whitebait", "yuzu-kosho", "porcini", "mussel", "squid", "sweet-bean-sauce", "cucumber", "peking-duck", "peanut-sauce", "cilantro"],
  5: ["spicy-salami", "sour-cream", "beef", "paprika-powder", "burrata", "honey", "walnut", "buffalo-sauce", "brie", "apple", "cinnamon", "aji-amarillo", "chutney", "salmon", "salmon-roe"],
};
/** Stage 4, first half (210): フロマージュ・ブラン、豆板醤、青ねぎ、カレーケチャップ、レモン、大葉、しらす、柚子胡椒、ポルチーニ、ムール貝、イカ. */
const STAGE_4_FIRST_HALF = ["fromage-blanc-sauce", "doubanjiang", "green-onion", "curry-ketchup", "lemon", "shiso", "whitebait", "yuzu-kosho", "porcini", "mussel", "squid"];
/** Stage 4, second half (275): マスタード、スイスチーズ、豚肉、ピクルス、ヤギチーズ、ルッコラ、アボカド、甜麺醤、きゅうり、北京ダック、ピーナッツソース、パクチー. */
const STAGE_4_SECOND_HALF = ["mustard", "swiss-cheese", "pork", "pickles", "goat-cheese", "arugula", "avocado", "sweet-bean-sauce", "cucumber", "peking-duck", "peanut-sauce", "cilantro"];
/** The four stage-4 recipes whose materials arrive at 275. */
const STAGE_4_SECOND_HALF_RECIPES = ["cuban-pizza", "california-style-pizza", "peking-duck-pizza", "thai-chicken-pizza"];
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];

const itemsOf = (recipeId: string) => RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === recipeId)!.items;
/** The reputation an adopted recipe can first be developed at: its stage's floor (stage 4's last four: 275). */
const developableAt = (recipeId: string, chapter: number) =>
  STAGE_4_SECOND_HALF_RECIPES.includes(recipeId) ? 275 : FLOORS[chapter - 1];

describe("the material stages (77 materials: 17 / 9 / 13 / 23 / 15)", () => {
  it("each stage's materials are exactly the Owner's list", () => {
    for (const stage of [1, 2, 3, 4, 5]) {
      const derived = [...new Set(MENU_CATALOG.filter((e) => e.chapter <= stage).flatMap((e) => getRecipe(e.recipeId)!.requiredIngredients.map((r) => r.ingredientId)))]
        .filter((id) => !Object.values(STAGE_MATERIALS).slice(0, stage - 1).flat().includes(id));
      expect(new Set(derived), `stage ${stage}`).toEqual(new Set(STAGE_MATERIALS[stage]));
      for (const id of STAGE_MATERIALS[stage]) expect(materialChapterOf(id, catalog), id).toBe(STARTERS.includes(id) ? 0 : stage);
    }
    expect(Object.values(STAGE_MATERIALS).map((l) => l.length)).toEqual([17, 9, 13, 23, 15]);
    expect(new Set(Object.values(STAGE_MATERIALS).flat()).size).toBe(77);
  });

  it("no override; the one split is stage 4 at 275, exactly the Owner's twelve", () => {
    expect(MATERIAL_CHAPTER_OVERRIDES).toEqual({});
    expect(MATERIAL_MID_STAGE_ARRIVALS).toHaveLength(1);
    expect(MATERIAL_MID_STAGE_ARRIVALS[0].chapter).toBe(4);
    expect(MATERIAL_MID_STAGE_ARRIVALS[0].reputation).toBe(275);
    expect(new Set(MATERIAL_MID_STAGE_ARRIVALS[0].ingredientIds)).toEqual(new Set(STAGE_4_SECOND_HALF));
    expect(new Set([...STAGE_4_FIRST_HALF, ...STAGE_4_SECOND_HALF])).toEqual(new Set(STAGE_MATERIALS[4]));
    for (const id of STAGE_4_FIRST_HALF) expect(materialOpenReputationOf(id, TABLE, catalog), id).toBe(210);
    for (const id of STAGE_4_SECOND_HALF) {
      expect(materialOpenReputationOf(id, TABLE, catalog), id).toBe(275);
      expect(isMaterialOpenAt(id, 274, TABLE, catalog), id).toBe(false);
      expect(isMaterialOpenAt(id, 275, TABLE, catalog), id).toBe(true);
    }
    // The first half is exactly the stage-4 materials the other eight stage-4 recipes use; the second half is the rest, all
    // of it used by the last four (peking-duck-pizza also uses green-onion, a first-half material).
    const usedBy = (ids: readonly string[]) =>
      new Set(ids.flatMap((id) => getRecipe(id as never)!.requiredIngredients.map((r) => r.ingredientId)).filter((id) => STAGE_MATERIALS[4].includes(id)));
    const firstEight = MENU_CATALOG.filter((e) => e.chapter === 4 && !STAGE_4_SECOND_HALF_RECIPES.includes(e.recipeId)).map((e) => e.recipeId);
    expect(firstEight).toHaveLength(8);
    expect(usedBy(firstEight)).toEqual(new Set(STAGE_4_FIRST_HALF));
    const lastFour = usedBy(STAGE_4_SECOND_HALF_RECIPES);
    for (const id of STAGE_4_SECOND_HALF) expect(lastFour.has(id), id).toBe(true);
  });

  it("each material opens at its stage's floor -- not one reputation point earlier", () => {
    for (const stage of [2, 3, 4, 5]) {
      for (const id of STAGE_MATERIALS[stage]) {
        const at = materialOpenReputationOf(id, TABLE, catalog)!;
        expect(isMaterialOpenAt(id, at - 1, TABLE, catalog), id).toBe(false);
        expect(isMaterialOpenAt(id, at, TABLE, catalog), id).toBe(true);
      }
    }
    for (const id of STAGE_MATERIALS[1]) expect(isMaterialOpenAt(id, 0, TABLE, catalog), id).toBe(true);
  });

  it("a material no adopted recipe uses is never sold by the shop model (R4 #12)", () => {
    const all = resolveShopModelEntitlement(
      { ownedIngredientIds: [], unlockedForShopIngredientIds: [], shop: { reputation: 100_000, grantedMenuRecipeIds: [] } },
      TABLE,
      catalog,
    ).unlockedForShopIngredientIds;
    expect(new Set(all)).toEqual(new Set(Object.values(STAGE_MATERIALS).flat().filter((id) => !STARTERS.includes(id))));
    expect(all).toHaveLength(74);
  });

  it("prices are the existing ladder prices (R1 / R4 #11): unchanged by the stage move", () => {
    for (const id of Object.values(STAGE_MATERIALS).flat().filter((x) => !STARTERS.includes(x))) {
      const step = ingredientUnlockStep(id);
      expect(step, id).not.toBeNull();
      const offer = materialOffer(getIngredient(id)!);
      expect(offer, id).not.toBeNull();
      expect(offer!.tier, id).toBe(priceTierForStep(step!)!.tier);
    }
  });
});

describe("reachability: every one of the 60 has everything once its stage opens", () => {
  it("all materials of every adopted recipe are open at its stage's floor (stage 4's last four at 275, not before)", () => {
    expect(MENU_CATALOG).toHaveLength(60);
    for (const entry of MENU_CATALOG) {
      const at = developableAt(entry.recipeId, entry.chapter);
      const items = itemsOf(entry.recipeId);
      expect(items.length, entry.recipeId).toBeGreaterThan(0);
      for (const id of items) {
        expect(getIngredient(id), `${entry.recipeId}: ${id}`).toBeDefined();
        expect(isMaterialOpenAt(id, at, TABLE, catalog), `${entry.recipeId}: ${id} at ${at}`).toBe(true);
      }
      if (STAGE_4_SECOND_HALF_RECIPES.includes(entry.recipeId)) {
        expect(items.every((id) => isMaterialOpenAt(id, 274, TABLE, catalog)), entry.recipeId).toBe(false);
      }
    }
  });

  it("every technique an adopted recipe needs is open once its materials are (the affordance reads the same stages)", () => {
    for (const entry of MENU_CATALOG) {
      const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === entry.recipeId)!;
      const shop = { reputation: developableAt(entry.recipeId, entry.chapter), grantedMenuRecipeIds: [] };
      for (const technique of requiredTechniquesOf(target)) {
        expect(isTechniqueAffordanceOpenFor(technique, [], productionTechniqueContext(), shop), `${entry.recipeId}: ${technique}`).toBe(true);
      }
    }
  });

  it("New Haven apizza (stage 3) misses nothing: olive oil, parmigiano, clam, garlic -- all open at 110", () => {
    const entry = MENU_CATALOG.find((e) => e.recipeId === "new-haven-apizza")!;
    expect(entry.chapter).toBe(3);
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === "new-haven-apizza")!;
    expect([...target.items].sort()).toEqual(["clam", "garlic", "olive-oil", "parmigiano"]);
    // Its sauce is the olive oil (no tomato sauce): the sauce base is a material too, and it is a stage-1 one.
    expect(target.sauceBase).toEqual(["olive-oil"]);
    for (const id of target.items) expect(isMaterialOpenAt(id, 110, TABLE, catalog), id).toBe(true);
    expect(isMaterialOpenAt("clam", 109, TABLE, catalog)).toBe(false);
    for (const technique of requiredTechniquesOf(target)) {
      expect(isTechniqueAffordanceOpenFor(technique, [], productionTechniqueContext(), { reputation: 110, grantedMenuRecipeIds: [] }), technique).toBe(true);
    }
  });
});
