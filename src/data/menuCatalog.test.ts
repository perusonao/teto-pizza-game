import { describe, expect, it } from "vitest";
import { getIngredient } from "./ingredients";
import { MATERIAL_CHAPTER_OVERRIDES, MENU_CATALOG, MENU_CATALOG_ID } from "./menuCatalog";
import { RECIPES } from "./recipes";
import { SHOP_CHAPTER_COUNT } from "../logic/progression/reputationTable";

/**
 * B案 Phase 1b (Issue #901), design §3.2.4: the curated catalog's shape. Phase 1b shipped it empty; Phase 3a fills it with
 * the Owner's selection (2026-11-26). The exact list is pinned here: a change needs a new Owner decision and a new
 * `MENU_CATALOG_ID`.
 */

/** The Owner's list (Phase 3a instruction, 2026-11-26), stage -> recipe ids in the Owner's order. */
const OWNER_STAGES: Record<number, readonly string[]> = {
  1: ["margherita", "marinara", "funghi", "bismarck", "breakfast-pizza", "pepperoni", "salsiccia", "bambino", "hawaiian", "melanzane-pizza", "parmigiana-pizza", "fugazza"],
  2: ["napoletana", "tonno-e-cipolla", "genovese", "capricciosa", "meat-lovers", "pizza-portuguesa", "aussie", "brazilian-calabresa", "grandma-pizza", "pizza-bianca", "quattro-formaggi", "pesto-caprese"],
  3: ["spinach-artichoke-pizza", "full-english-pizza", "pesto-pollo", "pesto-gamberi", "puttanesca-pizza", "vongole", "chilean-napolitana", "new-haven-apizza", "pesto-vegetariana", "ratatouille-pizza", "prosciutto-funghi", "veggie-supreme-pizza"],
  4: ["flammkuchen", "sichuan-eggplant-pizza", "curry-pizza-japan", "cuban-pizza", "california-style-pizza", "shirasu-pizza", "yuzu-shrimp-pizza", "boscaiola", "pescatore", "frutti-di-mare", "peking-duck-pizza", "thai-chicken-pizza"],
  5: ["diavola-pizza", "porcini-pizza", "goulash-pizza", "baingan-bharta-pizza", "pesto-burrata-pizza", "pesto-noci-pizza", "buffalo-chicken", "speck-e-brie", "apple-cinnamon-dessert", "peruvian-aji-amarillo", "south-african-boerewors", "ikura-salmon-pizza"],
};

describe("MENU_CATALOG", () => {
  it("Phase 3a: exactly the Owner's 60, stage by stage, in the Owner's order", () => {
    expect(MENU_CATALOG_ID).toBe("curated-60-v1");
    expect(MENU_CATALOG).toHaveLength(60);
    for (let stage = 1; stage <= SHOP_CHAPTER_COUNT; stage++) {
      expect(MENU_CATALOG.filter((e) => e.chapter === stage).map((e) => e.recipeId)).toEqual(OWNER_STAGES[stage]);
    }
  });

  it("12 recipes per stage, five stages (Q12)", () => {
    for (let stage = 1; stage <= SHOP_CHAPTER_COUNT; stage++) {
      expect(MENU_CATALOG.filter((e) => e.chapter === stage)).toHaveLength(12);
    }
  });

  it("the first menu (margherita, Q2) is a stage-1 recipe", () => {
    expect(MENU_CATALOG.find((e) => e.recipeId === "margherita")?.chapter).toBe(1);
  });

  it("is frozen (no runtime edit can change the adopted set)", () => {
    expect(Object.isFrozen(MENU_CATALOG)).toBe(true);
    expect(MENU_CATALOG.every((e) => Object.isFrozen(e))).toBe(true);
  });

  it("no material override yet (the material stages are Phase 3b)", () => {
    expect(Object.keys(MATERIAL_CHAPTER_OVERRIDES)).toHaveLength(0);
  });

  it("recipes are not removed: RECIPES still holds the recipes the catalog does not adopt (legacy / later releases)", () => {
    const adopted = new Set(MENU_CATALOG.map((e) => e.recipeId as string));
    expect(RECIPES.length).toBeGreaterThan(60);
    expect(RECIPES.filter((r) => !adopted.has(r.id)).length).toBe(RECIPES.length - 60);
  });

  it("every entry is a known recipe, listed once, with a chapter in 1..5", () => {
    const ids = MENU_CATALOG.map((e) => e.recipeId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of MENU_CATALOG) {
      expect(RECIPES.some((r) => r.id === e.recipeId)).toBe(true);
      expect(Number.isInteger(e.chapter) && e.chapter >= 1 && e.chapter <= SHOP_CHAPTER_COUNT).toBe(true);
    }
  });

  it("every override names a known ingredient and a chapter in 1..5", () => {
    for (const [id, chapter] of Object.entries(MATERIAL_CHAPTER_OVERRIDES)) {
      expect(getIngredient(id)).toBeDefined();
      expect(Number.isInteger(chapter) && chapter >= 1 && chapter <= SHOP_CHAPTER_COUNT).toBe(true);
    }
  });
});
