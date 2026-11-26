import { describe, expect, it } from "vitest";
import { getIngredient } from "./ingredients";
import { MATERIAL_CHAPTER_OVERRIDES, MENU_CATALOG, MENU_CATALOG_ID } from "./menuCatalog";
import { RECIPES } from "./recipes";
import { SHOP_CHAPTER_COUNT } from "../logic/progression/reputationTable";

/**
 * B案 Phase 1b (Issue #901), design §3.2.4: the curated catalog's shape. Phase 1b ships it empty (the selection is the
 * Owner's, Phase 3); the integrity checks below hold for any future content.
 */
describe("MENU_CATALOG", () => {
  it("Phase 1b: empty (the curated 60 and their chapters are not selected yet)", () => {
    expect(MENU_CATALOG).toHaveLength(0);
    expect(Object.keys(MATERIAL_CHAPTER_OVERRIDES)).toHaveLength(0);
    expect(MENU_CATALOG_ID).toBe("curated-60-v1");
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
