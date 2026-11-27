/**
 * B案再構成 Phase 1b (Issue #901): the curated menu catalog (the adopted recipe set). Design §3.2.4 / §6 Q4 / Q10 / Q12.
 *
 * - Recipes are never removed from `RECIPES`; adoption is this list. A recipe not listed here stays in `RECIPES`,
 *   `ORDERS`, the matcher and the Dex, and is simply not part of the shop model's menu, chapters or counts.
 * - Each entry names its chapter explicitly (1..5, Q12). A material's chapter is derived: the lowest chapter of an adopted
 *   recipe that uses it, unless `MATERIAL_CHAPTER_OVERRIDES` says otherwise.
 * - Phase 1b shipped it empty; Phase 3a fills it with the Owner's selection (60 recipes, 12 per stage). Re-issue
 *   `MENU_CATALOG_ID` whenever the list changes (the same idea as the ladder's population id).
 * - Phase 3a read only the recipes' stages (menu, orders, Dex). **Phase 3b** derives the materials' stages from this list too
 *   (77 materials: 17 / 9 / 13 / 23 / 15, starters included in stage 1), with one split inside stage 4
 *   (`MATERIAL_MID_STAGE_ARRIVALS`) and no override.
 */
import type { RecipeId } from "./recipes";

export interface MenuCatalogEntry {
  recipeId: RecipeId;
  /** 1-based chapter (1..5). */
  chapter: number;
}

export const MENU_CATALOG_ID = "curated-60-v1";

/**
 * The adopted recipes: the Owner's curated 60, five stages x 12 (Phase 3a, Owner 2026-11-26). A stage opens at the
 * reputation floor of the same index in `REPUTATION_TABLE.chapterFloors` (0 / 40 / 110 / 210 / 340). Within a stage the
 * order is the Owner's list order; screens keep `RECIPES` declaration order. Pinned by ./menuCatalog.test.ts.
 */
export const MENU_CATALOG: readonly MenuCatalogEntry[] = Object.freeze(
  (
    [
      // 第1段階（評判 0〜）
      { recipeId: "margherita", chapter: 1 },
      { recipeId: "marinara", chapter: 1 },
      { recipeId: "funghi", chapter: 1 },
      { recipeId: "bismarck", chapter: 1 },
      { recipeId: "breakfast-pizza", chapter: 1 },
      { recipeId: "pepperoni", chapter: 1 },
      { recipeId: "salsiccia", chapter: 1 },
      { recipeId: "bambino", chapter: 1 },
      { recipeId: "hawaiian", chapter: 1 },
      { recipeId: "melanzane-pizza", chapter: 1 },
      { recipeId: "parmigiana-pizza", chapter: 1 },
      { recipeId: "fugazza", chapter: 1 },
      // 第2段階（評判 40〜）
      { recipeId: "napoletana", chapter: 2 },
      { recipeId: "tonno-e-cipolla", chapter: 2 },
      { recipeId: "genovese", chapter: 2 },
      { recipeId: "capricciosa", chapter: 2 },
      { recipeId: "meat-lovers", chapter: 2 },
      { recipeId: "pizza-portuguesa", chapter: 2 },
      { recipeId: "aussie", chapter: 2 },
      { recipeId: "brazilian-calabresa", chapter: 2 },
      { recipeId: "grandma-pizza", chapter: 2 },
      { recipeId: "pizza-bianca", chapter: 2 },
      { recipeId: "quattro-formaggi", chapter: 2 },
      { recipeId: "pesto-caprese", chapter: 2 },
      // 第3段階（評判 110〜）
      { recipeId: "spinach-artichoke-pizza", chapter: 3 },
      { recipeId: "full-english-pizza", chapter: 3 },
      { recipeId: "pesto-pollo", chapter: 3 },
      { recipeId: "pesto-gamberi", chapter: 3 },
      { recipeId: "puttanesca-pizza", chapter: 3 },
      { recipeId: "vongole", chapter: 3 },
      { recipeId: "chilean-napolitana", chapter: 3 },
      { recipeId: "new-haven-apizza", chapter: 3 },
      { recipeId: "pesto-vegetariana", chapter: 3 },
      { recipeId: "ratatouille-pizza", chapter: 3 },
      { recipeId: "prosciutto-funghi", chapter: 3 },
      { recipeId: "veggie-supreme-pizza", chapter: 3 },
      // 第4段階（評判 210〜）
      { recipeId: "flammkuchen", chapter: 4 },
      { recipeId: "sichuan-eggplant-pizza", chapter: 4 },
      { recipeId: "curry-pizza-japan", chapter: 4 },
      { recipeId: "cuban-pizza", chapter: 4 },
      { recipeId: "california-style-pizza", chapter: 4 },
      { recipeId: "shirasu-pizza", chapter: 4 },
      { recipeId: "yuzu-shrimp-pizza", chapter: 4 },
      { recipeId: "boscaiola", chapter: 4 },
      { recipeId: "pescatore", chapter: 4 },
      { recipeId: "frutti-di-mare", chapter: 4 },
      { recipeId: "peking-duck-pizza", chapter: 4 },
      { recipeId: "thai-chicken-pizza", chapter: 4 },
      // 第5段階（評判 340〜）
      { recipeId: "diavola-pizza", chapter: 5 },
      { recipeId: "porcini-pizza", chapter: 5 },
      { recipeId: "goulash-pizza", chapter: 5 },
      { recipeId: "baingan-bharta-pizza", chapter: 5 },
      { recipeId: "pesto-burrata-pizza", chapter: 5 },
      { recipeId: "pesto-noci-pizza", chapter: 5 },
      { recipeId: "buffalo-chicken", chapter: 5 },
      { recipeId: "speck-e-brie", chapter: 5 },
      { recipeId: "apple-cinnamon-dessert", chapter: 5 },
      { recipeId: "peruvian-aji-amarillo", chapter: 5 },
      { recipeId: "south-african-boerewors", chapter: 5 },
      { recipeId: "ikura-salmon-pizza", chapter: 5 },
    ] satisfies MenuCatalogEntry[]
  ).map((e) => Object.freeze(e)),
);

/**
 * Exceptions to the derived material chapter (ingredient id -> chapter). Phase 3b (Owner 2026-11-27): kept empty -- a
 * material's stage is always the stage its first adopted recipe appears in, and no recipe is pulled into an earlier or later
 * stage by moving its materials (a recipe waits for its own stage instead: ../logic/progression/shopProgression.ts).
 */
export const MATERIAL_CHAPTER_OVERRIDES: Readonly<Record<string, number>> = {};

/**
 * Phase 3b (Owner 2026-11-27): the one split inside a stage. Stage 4 opens at reputation 210, but half of its new materials
 * arrive only at 275 (the middle of the stage). They are exactly the materials stage 4's last four recipes (cuban-pizza,
 * california-style-pizza, peking-duck-pizza, thai-chicken-pizza) are the first to use, so those four can be developed
 * from 275 (pinned by ./menuCatalog.test.ts and ../logic/progression/shopMaterialStages.test.ts). The first eleven of
 * stage 4 (fromage-blanc-sauce, doubanjiang, green-onion, curry-ketchup, lemon, shiso, whitebait, yuzu-kosho, porcini,
 * mussel, squid) arrive at 210 with the stage.
 */
export interface MaterialMidStageArrival {
  chapter: number;
  reputation: number;
  ingredientIds: readonly string[];
}

export const MATERIAL_MID_STAGE_ARRIVALS: readonly MaterialMidStageArrival[] = Object.freeze([
  Object.freeze({
    chapter: 4,
    reputation: 275,
    ingredientIds: Object.freeze([
      "mustard",
      "swiss-cheese",
      "pork",
      "pickles",
      "goat-cheese",
      "arugula",
      "avocado",
      "sweet-bean-sauce",
      "cucumber",
      "peking-duck",
      "peanut-sauce",
      "cilantro",
    ]),
  }),
]);
