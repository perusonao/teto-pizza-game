/**
 * Discovery Hint 2.0 (Issue #229, slice 229-A): the progressive hint lines for one target recipe.
 * Pure and unwired -- 229-B shows them one step at a time in the Free Cooking hint sheet.
 *
 * Authority: docs/reports/TETO_DISCOVERY-HINT-2_FRESH-AUDIT.md §3.2 / §6 (on the audit branch).
 *
 *   H0 existence -> H1 key ingredient -> H2 sauce -> H3 count + cheese yes/no
 *   -> H4 (repeatable) the remaining ingredients one by one, in `requiredIngredients` order.
 *
 * - Every line is built from ingredient names, the coarse "not tomato" sauce line and
 *   numbers only. Never the recipe's name, description, id, image or name length (A-1..A-3).
 * - n-1 cap (A-4): at most |T|-1 of the recipe's distinct ingredients are ever named, so a
 *   normal-progression hint never spells out the whole answer; the last one is withheld.
 *   The only exception is the very first Margherita (Dex 0 onboarding, the existing LK-6 case).
 * - Key is the sauce (fugazza / pesto-tonno): H1 already named it, so count + cheese moves up to
 *   H2. Naming the sauce would break the cap (pizza-bianca, 2 ingredients): H2 is the coarse
 *   「ソースはトマトじゃないみたい」 instead.
 * - The cheese line always says so when the recipe has none (「チーズは使わないみたい」).
 * - No H5 (OD-HINT-4 is out of scope).
 *
 * The returned array is the reveal order; its index is the progress (229-B keeps that index
 * session-only, never in the save). `level` is that index capped at 4, since H4 repeats.
 */
import { getIngredient, type Ingredient } from "../../data/ingredients";
import type { Recipe } from "../../data/recipes";
import { recipeKeyStep } from "../../state/recipeChapters";

export type HintLevel = 0 | 1 | 2 | 3 | 4;

export type HintAxis = "EXISTENCE" | "KEY" | "SAUCE" | "COUNT_CHEESE" | "INGREDIENT";

export interface HintStep {
  level: HintLevel;
  axis: HintAxis;
  textJa: string;
  /** The ingredient this line names by name, if any (the coarse sauce line names none). */
  namedIngredientId?: string;
}

export interface HintStepOptions {
  /** Discovered recipe count. 0 + margherita is the only case allowed to reveal every ingredient. */
  discoveredCount: number;
}

const ONBOARDING_RECIPE_ID = "margherita";
const TOMATO_SAUCE_ID = "tomato-sauce";

export const HINT_EXISTENCE_TEXT = "今の材料で、まだ見つけていないピザが作れそう！";

/** Names only: the glyph is IngredientGlyph's job (229-B renders it from `namedIngredientId`). */
function label(ingredient: Ingredient): string {
  return ingredient.nameJa;
}

function distinctIngredients(recipe: Recipe): Ingredient[] {
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  return ids.map((id) => getIngredient(id)).filter((i): i is Ingredient => !!i);
}

/** The ingredient that made `recipeKeyStep` (the latest-unlocked material; first in
 *  `requiredIngredients` order on a tie). `null` for a starter-only recipe (margherita). */
export function hintKeyIngredientId(recipe: Recipe): string | null {
  const keyStep = recipeKeyStep(recipe);
  if (keyStep === 0) return null;
  // Same rule as recipeKeyStep, read through it (the ladder layer is only reached via its bridges).
  const key = recipe.requiredIngredients.find((r) => recipeKeyStep({ ...recipe, requiredIngredients: [r] }) === keyStep);
  return key ? key.ingredientId : null;
}

/** True only for the Dex-0 Margherita onboarding (the single n-1 cap exception). */
export function isHintOnboarding(recipe: Recipe, options: HintStepOptions): boolean {
  return options.discoveredCount === 0 && recipe.id === ONBOARDING_RECIPE_ID;
}

export function buildHintSteps(recipe: Recipe, options: HintStepOptions): HintStep[] {
  const ingredients = distinctIngredients(recipe);
  const cap = isHintOnboarding(recipe, options) ? ingredients.length : ingredients.length - 1;
  const named = new Set<string>();
  const lines: Omit<HintStep, "level">[] = [{ axis: "EXISTENCE", textJa: HINT_EXISTENCE_TEXT }];

  const name = (ingredient: Ingredient, axis: HintAxis, textJa: string): boolean => {
    if (named.has(ingredient.id) || named.size >= cap) return false;
    named.add(ingredient.id);
    lines.push({ axis, textJa, namedIngredientId: ingredient.id });
    return true;
  };

  const keyId = hintKeyIngredientId(recipe);
  const key = ingredients.find((i) => i.id === keyId);
  if (key) name(key, "KEY", `${label(key)} を使うピザが作れそう！`);

  const sauce = ingredients.find((i) => i.category === "sauce");
  if (sauce && !named.has(sauce.id)) {
    if (!name(sauce, "SAUCE", `ソースは ${label(sauce)} みたい`) && sauce.id !== TOMATO_SAUCE_ID) {
      lines.push({ axis: "SAUCE", textJa: "ソースはトマトじゃないみたい" });
    }
  }

  const hasCheese = ingredients.some((i) => i.category === "cheese");
  lines.push({
    axis: "COUNT_CHEESE",
    textJa: `材料は全部で${ingredients.length}種類。${hasCheese ? "チーズを使うみたい" : "チーズは使わないみたい"}`,
  });

  for (const ingredient of ingredients) {
    if (ingredient.id === sauce?.id) continue;
    name(ingredient, "INGREDIENT", `${label(ingredient)} も使うみたい`);
  }

  return lines.map((line, i) => ({ ...line, level: Math.min(i, 4) as HintLevel }));
}
