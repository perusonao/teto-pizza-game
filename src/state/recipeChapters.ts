import { DISCOVERY_LADDER, type DiscoveryLadder } from "../data/discoveryLadder";
import { getIngredient } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import { MATERIAL_PRICE_TIERS, materialLadderStep, priceTierForStep } from "../logic/materialShop";
import { isDiscovered, type DexState } from "./dex";

/**
 * Progression 2.0 W1 Discovery 2.0 (OD-DISC-9): the one canonical chapter partition. A recipe's
 * chapter is the Discovery Ladder price tier (../logic/materialShop.ts `MATERIAL_PRICE_TIERS`) of
 * its key step -- the step that brings the last of its required materials. Onboarding-starter-only
 * recipes (margherita) sit in chapter 1. For the 25-recipe ladder this is 6 / 9 / 10 (T1 steps
 * 1-5, T2 6-14, T3 15-24); no boundary is authored anywhere else.
 *
 * Pizza Select, the Dex and Result read chapters only from here (never position-based chunks).
 * Inside a chapter, recipes keep `RECIPES` declaration order (not ladder order).
 */

/** Last ladder step among `recipe`'s finite materials (0 when it needs starters only). */
export function recipeKeyStep(recipe: Recipe, ladder: DiscoveryLadder = DISCOVERY_LADDER): number {
  let key = 0;
  for (const { ingredientId } of recipe.requiredIngredients) {
    if (!getIngredient(ingredientId)?.unlockCondition) continue;
    const step = materialLadderStep(ingredientId, ladder);
    if (step !== null && step > key) key = step;
  }
  return key;
}

/** 1-based chapter number = 1 + index of the key step's price tier (starter-only -> 1). */
export function recipeChapter(recipe: Recipe, ladder: DiscoveryLadder = DISCOVERY_LADDER): number {
  const tier = priceTierForStep(Math.max(1, recipeKeyStep(recipe, ladder)));
  const index = tier ? MATERIAL_PRICE_TIERS.indexOf(tier) : MATERIAL_PRICE_TIERS.length - 1;
  return index + 1;
}

export function chapterTitleJa(chapter: number): string {
  return `第${chapter}章`;
}

export interface RecipeChapter {
  chapter: number;
  titleJa: string;
  /** Every recipe of this chapter, in the input's (declaration) order. */
  recipes: readonly Recipe[];
}

/** Non-empty chapters over `recipes`, ascending. */
export function buildRecipeChapters(
  recipes: readonly Recipe[] = RECIPES,
  ladder: DiscoveryLadder = DISCOVERY_LADDER,
): RecipeChapter[] {
  const byChapter = new Map<number, Recipe[]>();
  for (const recipe of recipes) {
    const chapter = recipeChapter(recipe, ladder);
    const list = byChapter.get(chapter) ?? [];
    list.push(recipe);
    byChapter.set(chapter, list);
  }
  return [...byChapter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([chapter, list]) => ({ chapter, titleJa: chapterTitleJa(chapter), recipes: list }));
}

export interface ChapterProgress {
  discovered: number;
  total: number;
}

export function chapterProgress(chapter: RecipeChapter, dex: DexState): ChapterProgress {
  return {
    discovered: chapter.recipes.filter((r) => isDiscovered(dex, r.id)).length,
    total: chapter.recipes.length,
  };
}

/** 1-based position of `recipe` inside its chapter (the Dex "No." within the chapter). */
export function recipeChapterSlot(
  recipe: Recipe,
  recipes: readonly Recipe[] = RECIPES,
  ladder: DiscoveryLadder = DISCOVERY_LADDER,
): number {
  const chapter = recipeChapter(recipe, ladder);
  return recipes.filter((r) => recipeChapter(r, ladder) === chapter).findIndex((r) => r.id === recipe.id) + 1;
}
