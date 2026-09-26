/**
 * Discovery Hint 2.0 (Issue #229, slice 229-A): which undiscovered recipe a hint talks about.
 * Pure and unwired -- 229-B connects it to the Free Cooking hint sheet, 229-D to the Dex card.
 *
 * Authority: docs/reports/TETO_DISCOVERY-HINT-2_FRESH-AUDIT.md §2 (on the audit branch).
 *
 * - Only DISCOVERABLE recipes are ever a target (`recipeDiscoveryState`, the same derivation the
 *   Dex / HOME / Pizza Select use). DISCOVERED, KNOWN_BUT_MISSING_MATERIAL and UNKNOWN never are.
 * - Order is deterministic, no randomness: `recipeKeyStep` asc -> distinct ingredient count asc ->
 *   `RECIPES` declaration index. It reads nothing else (not the Dex array order, not inventory key
 *   order), so identical state always yields the identical target.
 * - A Dex card pins its own recipe, a revealed target stays sticky; both only while still
 *   DISCOVERABLE, otherwise the automatic order decides.
 * - No DISCOVERABLE recipe -> a `HintEmpty` that names no recipe: SHOP_NEW (a needed material
 *   is in the Shop but not bought yet), REFILL (owned but out of stock), COMPLETE (all found).
 */
import { getIngredient } from "../../data/ingredients";
import { RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { recipeKeyStep } from "../../state/recipeChapters";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "../../state/recipeDiscoveryState";

export type HintTargetSource = "auto" | "dex";

export interface HintTarget {
  kind: "TARGET";
  recipeId: RecipeId;
  /** "dex" only when a Dex card pinned this recipe; "auto" for the automatic / sticky choice. */
  source: HintTargetSource;
}

export type HintEmptyKind = "SHOP_NEW" | "REFILL" | "COMPLETE";

export interface HintEmpty {
  kind: HintEmptyKind;
}

export type HintTargetResult = HintTarget | HintEmpty;

export interface HintTargetOptions {
  /** The recipe of the Dex `？？？` card the sheet was opened from (229-D). */
  pinnedRecipeId?: string | null;
  /** The target whose H1+ was already revealed this session (229-B keeps it, never saved). */
  stickyRecipeId?: string | null;
  /** Recipe population; `RECIPES` in production, injectable for tests. */
  recipes?: readonly Recipe[];
}

function distinctIngredientCount(recipe: Recipe): number {
  return new Set(recipe.requiredIngredients.map((r) => r.ingredientId)).size;
}

/** The §2.2 order. `recipes` gives the declaration index used as the last tie-break. */
export function compareHintCandidates(a: Recipe, b: Recipe, recipes: readonly Recipe[] = RECIPES): number {
  return (
    recipeKeyStep(a) - recipeKeyStep(b) ||
    distinctIngredientCount(a) - distinctIngredientCount(b) ||
    recipes.findIndex((r) => r.id === a.id) - recipes.findIndex((r) => r.id === b.id)
  );
}

/** Every DISCOVERABLE recipe, in hint order (the first one is the automatic target). */
export function discoverableHintCandidates(
  inputs: RecipeDiscoveryInputs,
  recipes: readonly Recipe[] = RECIPES,
): Recipe[] {
  return recipes
    .filter((recipe) => recipeDiscoveryState(recipe, inputs) === "DISCOVERABLE")
    .sort((a, b) => compareHintCandidates(a, b, recipes));
}

function emptyKind(inputs: RecipeDiscoveryInputs, recipes: readonly Recipe[]): HintEmptyKind {
  const states = recipes.map((recipe) => recipeDiscoveryState(recipe, inputs));
  if (states.every((s) => s === "DISCOVERED")) return "COMPLETE";
  const owned = new Set(inputs.ownedIngredientIds);
  const needsPurchase = recipes.some(
    (recipe, i) =>
      states[i] === "KNOWN_BUT_MISSING_MATERIAL" &&
      recipe.requiredIngredients.some((r) => !!getIngredient(r.ingredientId)?.unlockCondition && !owned.has(r.ingredientId)),
  );
  const onlyRefill = states.some((s) => s === "KNOWN_BUT_MISSING_MATERIAL") && !needsPurchase;
  // Only UNKNOWN left: not expected on the shipped ladder (each step's key recipe is DISCOVERABLE or
  // KBMM). The ladder only moves forward through the Shop, so point there without naming a recipe.
  return onlyRefill ? "REFILL" : "SHOP_NEW";
}

export function selectHintTarget(inputs: RecipeDiscoveryInputs, options: HintTargetOptions = {}): HintTargetResult {
  const recipes = options.recipes ?? RECIPES;
  const candidates = discoverableHintCandidates(inputs, recipes);
  const pinned = candidates.find((r) => r.id === options.pinnedRecipeId);
  if (pinned) return { kind: "TARGET", recipeId: pinned.id, source: "dex" };
  const sticky = candidates.find((r) => r.id === options.stickyRecipeId);
  if (sticky) return { kind: "TARGET", recipeId: sticky.id, source: "auto" };
  const first = candidates[0];
  if (first) return { kind: "TARGET", recipeId: first.id, source: "auto" };
  return { kind: emptyKind(inputs, recipes) };
}
