import { getRecipe, type Recipe } from "../data/recipes";
import type { QualityStars } from "../logic/scoring";
import { getDexEntry, isDiscovered, type DexState } from "./dex";
import { totalStars } from "../logic/mastery";
import { isRecipeAvailable } from "./progression";

/**
 * Pizza Select's per-recipe card state (Issue #39 PS2/PS3, extended by Economy & Progression
 * 1.0 EP1). Purely derived from the same inputs `isRecipeAvailable`/Dex/Shop already share
 * (`RECIPES`, `dex`, `ownedIngredientIds`) -- there is no separate persisted "unlocked"/"seen"
 * flag anywhere, so Pizza Select and the Dex overlay can never disagree about what's locked or
 * discovered.
 */
export type RecipeCardState =
  | { kind: "COMPLETED"; recipe: Recipe; bestStars: QualityStars; bestScore: number }
  | { kind: "NEW"; recipe: Recipe }
  | { kind: "LOCKED"; recipe: Recipe; mystery: boolean; unlockHint: string | null };

/**
 * EP1: a locked card's optional hint, built only from `recipe.unlockCondition` (Fresh Design
 * sec. 9) -- never an invented condition. `recipe.mysteryLock` (フガッサ only) keeps the hint to
 * a star-count progress line, never revealing the chain prerequisite by name; every other
 * chain-gated recipe (#2-#6) names the specific recipe still needed. `null` once the recipe's
 * own unlock gate is already satisfied (a LOCKED card can still result from the separate
 * ingredient-ownership axis, e.g. フガッサ before `onion` is purchased -- Shop is the
 * appropriate place to surface that, not this hint).
 */
function unlockHintFor(recipe: Recipe, dex: DexState): string | null {
  const condition = recipe.unlockCondition;
  if (!condition) return null;

  if (recipe.mysteryLock) {
    if (condition.minTotalStars === undefined) return null;
    const remaining = condition.minTotalStars - totalStars(dex);
    return remaining > 0 ? `あと★${remaining}で解禁` : null;
  }

  if (condition.requiresRecipeId && !isDiscovered(dex, condition.requiresRecipeId)) {
    const prevName = getRecipe(condition.requiresRecipeId)?.nameJa ?? "前のレシピ";
    return `${prevName}を1枚完成させると解禁`;
  }
  if (condition.minTotalStars !== undefined) {
    const remaining = condition.minTotalStars - totalStars(dex);
    return remaining > 0 ? `あと★${remaining}で解禁` : null;
  }
  return null;
}

export function recipeCardState(
  recipe: Recipe,
  dex: DexState,
  ownedIngredientIds: readonly string[],
): RecipeCardState {
  if (!isRecipeAvailable(recipe, dex, ownedIngredientIds)) {
    return {
      kind: "LOCKED",
      recipe,
      mystery: recipe.mysteryLock === true,
      unlockHint: unlockHintFor(recipe, dex),
    };
  }
  const entry = getDexEntry(dex, recipe.id);
  if (entry?.discovered) {
    return { kind: "COMPLETED", recipe, bestStars: entry.bestStars, bestScore: entry.bestScore };
  }
  return { kind: "NEW", recipe };
}

/**
 * Issue #88 (UX-4): Pizza Select single-screen pager. Everything below is pure
 * index/count arithmetic over whatever recipe collection the caller passes in
 * (`PizzaSelectScreen`'s `recipes` prop, `RECIPES` by default) -- nothing here hard-codes the
 * production count of 7, so a future Chapter/Tier filter that narrows `RECIPES` down to a
 * `visibleRecipes` subset before handing it to the pager needs no change here at all.
 */

/** Clamp-at-ends, never wrap: paging past either end is a no-op rather than an infinite
 *  carousel back to the opposite recipe (Issue #88's own "意図しない無限carouselにはしない"
 *  requirement). Works for any `total` >= 1; `total <= 0` degenerately clamps to 0. */
export function clampPagerIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

/** Above this many entries, a row of one-dot-per-recipe stops being scannable (Issue #88
 *  explicitly forbids ever laying out a 53-dot indicator) -- switch to a compact "N / total"
 *  counter instead. 10 keeps today's 7 recipes comfortably in dot mode while already covering
 *  the Scale Gate's own "~10: pager" band from the Fresh Audit. */
export const PAGER_DOT_INDICATOR_MAX = 10;

export type PagerIndicatorKind = "dots" | "counter";

export function pagerIndicatorKind(total: number): PagerIndicatorKind {
  return total <= PAGER_DOT_INDICATOR_MAX ? "dots" : "counter";
}
