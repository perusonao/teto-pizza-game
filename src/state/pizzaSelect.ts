import { getRecipe, type Recipe } from "../data/recipes";
import type { QualityStars } from "../logic/scoring";
import { discoveredRecipeIds, getDexEntry, isDiscovered, type DexState } from "./dex";
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
  | { kind: "NEW"; recipe: Recipe; preDiscoveryLocked?: boolean }
  | { kind: "LOCKED"; recipe: Recipe; mystery: boolean; unlockHint: string | null };

/**
 * EP1: a locked card's optional hint, built only from `recipe.unlockCondition` (Fresh Design
 * sec. 9) -- never an invented condition. `recipe.mysteryLock` (フガッサ only) keeps the hint to
 * a star-count progress line, never revealing the chain prerequisite by name; every other
 * chain-gated recipe (#2-#6) names the specific recipe still needed. `null` once the recipe's
 * own unlock gate is already satisfied (a LOCKED card can still result from the separate
 * ingredient-ownership axis, e.g. フガッサ before its Starter Grant has landed `onion` --
 * that resolves itself automatically the moment fugazza unlocks, so there is nothing for
 * this hint or Shop to surface for it).
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
  // Progression 2.0 Phase 3-3 (Issue #198): before the player's first-ever discovery, an
  // available-but-undiscovered ("NEW") card is not directly guided-selectable -- Free Cooking
  // is the discovery path. Margherita is the only recipe unlocked at Dex 0 (every other recipe
  // chains off a `requiresRecipeId`), so this only ever fires for a brand-new save's first
  // round; `preDiscoveryLocked` is omitted entirely (not just `false`) once any recipe has ever
  // been discovered, so an existing player's NEW cards keep their exact pre-Phase-3-3 shape.
  if (discoveredRecipeIds(dex).length === 0) {
    return { kind: "NEW", recipe, preDiscoveryLocked: true };
  }
  return { kind: "NEW", recipe };
}

/**
 * Recipe Select 2.0A (see docs/design/TETO_RECIPE-SELECT_2.0.md sec. 4/8): position-based
 * section headers over whatever recipe collection the caller passes in (`PizzaSelectScreen`'s
 * `recipes` prop, `RECIPES` by default). Sections are derived purely from array position, never
 * from a `category` field (none exists on `Recipe`, and the design doc's sec. 8 explicitly
 * defers real flavor categories) and never from unlock-chain order (RECIPES' own declared
 * order is preserved, matching test 11's pre-existing guarantee).
 *
 * `RECIPE_SECTION_BOUNDARIES` names the two authored boundaries that already exist in
 * production data: index 0 ("第1章", the original 7 Issue #88 recipes) and index 7 ("第2章",
 * where Batch 1A's salsiccia begins) -- the same split the Phase 0 Fresh Audit's own sec. 2
 * table already documents. Any recipe appended beyond the last authored boundary is grouped
 * automatically into further `RECIPE_SECTION_FALLBACK_CHUNK_SIZE`-sized "第N章" sections, so a
 * future recipe-expansion phase (15 -> 30 -> 50) needs no edit here -- this is the single named
 * place section boundaries live, not scattered magic numbers inside a UI component.
 */

export interface RecipeSectionBoundary {
  /** 0-based index into the recipe collection where this section begins. */
  startIndex: number;
  titleJa: string;
}

export const RECIPE_SECTION_BOUNDARIES: readonly RecipeSectionBoundary[] = [
  { startIndex: 0, titleJa: "第1章" },
  { startIndex: 7, titleJa: "第2章" },
];

/** How many recipes an auto-generated section (beyond the last authored boundary above) holds.
 *  Matches Chapter 2's own current size (15 - 7 = 8) so a future batch that grows the catalog
 *  keeps roughly the same section granularity without a manual edit. */
export const RECIPE_SECTION_FALLBACK_CHUNK_SIZE = 8;

export interface RecipeSection {
  titleJa: string;
  recipes: readonly Recipe[];
}

/** Groups `recipes` (in their own given order) into position-based sections. Never reorders
 *  the input -- purely a display grouping over RECIPES' own declared order (or whatever
 *  collection a test/future filter passes in). Degenerate/small collections (e.g. a
 *  single-recipe test fixture) still return exactly one section rather than an empty boundary
 *  set. */
export function buildRecipeSections(recipes: readonly Recipe[]): RecipeSection[] {
  if (recipes.length === 0) return [];

  const sortedBoundaries = [...RECIPE_SECTION_BOUNDARIES].sort(
    (a, b) => a.startIndex - b.startIndex,
  );
  const starts: RecipeSectionBoundary[] = sortedBoundaries.filter(
    (b) => b.startIndex < recipes.length,
  );
  if (starts.length === 0) {
    starts.push({ startIndex: 0, titleJa: "第1章" });
  }

  let nextChapterNumber = starts.length + 1;
  const lastAuthoredStart = starts[starts.length - 1].startIndex;
  for (
    let i = lastAuthoredStart + RECIPE_SECTION_FALLBACK_CHUNK_SIZE;
    i < recipes.length;
    i += RECIPE_SECTION_FALLBACK_CHUNK_SIZE
  ) {
    starts.push({ startIndex: i, titleJa: `第${nextChapterNumber}章` });
    nextChapterNumber++;
  }

  return starts.map((boundary, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].startIndex : recipes.length;
    return { titleJa: boundary.titleJa, recipes: recipes.slice(boundary.startIndex, end) };
  });
}
