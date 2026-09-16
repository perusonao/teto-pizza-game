/**
 * Phase 4A-2: Scoring 2.0 Shadow Recipe correctness component -- required ingredient *type*
 * presence only ("did the player use tomato sauce / mozzarella / basil at all"), reusing
 * ../scoring.ts's `countUsedIngredient` primitive wholesale.
 *
 * Deliberately distinct from ../scoring.ts's legacy `matchScore` (which requires each
 * ingredient's own `minCount` to be met) and from ./piecesComponent.ts (which scores *how
 * many* and *how well placed* mozzarella/basil are): this component only asks "is the right
 * ingredient type on the pizza at all", never "how much" or "placed how well" -- see
 * scoringV2.test.ts's "recipe correctness / pieces separation" tests, which pin that a pizza
 * with too few mozzarella pieces (a Pieces concern) still reads as full Recipe correctness as
 * long as mozzarella is present at all, so the same mistake is never penalized twice across
 * these two components.
 */
import { countUsedIngredient } from "../scoring";
import type { Recipe } from "../../data/recipes";
import type { PizzaState } from "../../state/pizzaState";
import {
  MALFORMED_REFERENCE_REASON,
  sanitizeStringArray,
  sanitizeToppings,
  validateRequiredIngredientsStrict,
} from "./boundary";
import { safeUnit } from "./tolerance";
import type { RecipeComponentV2, ScoringV2Unavailable } from "./types";

/**
 * Codex P1 blocker fix: `../scoring.ts`'s `countUsedIngredient` is legacy authoritative
 * plumbing (shared with `scorePizza`/`ScoreBreakdown`) and stays out of this PR's scope --
 * it is never modified here. Instead, `pizza.sauceIds`/`pizza.toppings` are sanitized into a
 * minimal, always-well-formed stand-in (only the two fields that primitive actually reads)
 * *before* being handed to it, so a malformed `pizza` can never reach it at all -- this keeps
 * the legacy function's own valid-input behavior completely untouched while still failing
 * closed here.
 */
function safePizzaForRecipeCheck(pizza: PizzaState): PizzaState {
  return {
    ...pizza,
    sauceIds: sanitizeStringArray(pizza?.sauceIds),
    // `id` is synthesized -- `countUsedIngredient` never reads it, only `ingredientId`, but
    // `PizzaState.toppings`'s own type requires it, so a placeholder keeps this a genuine
    // `PizzaState` rather than a structurally-similar stand-in.
    toppings: sanitizeToppings(pizza?.toppings).map((t, i) => ({ id: `safe-${i}`, ...t })),
  };
}

/**
 * Codex P1 blocker fix, Round 2: `recipe.requiredIngredients` is authoritative Reference data
 * (it defines what "correct" even means for this component), not player input -- so it goes
 * through ./boundary.ts's *strict* `validateRequiredIngredientsStrict` instead of a lenient
 * filter. A non-array container, or even a single malformed requirement mixed in among
 * otherwise-valid ones, fails the whole component closed (`available: false`) rather than
 * silently scoring against whatever subset of requirements happened to survive filtering --
 * see boundary.ts's own doc comment for why a filtered-down authoritative list is unsafe (it
 * can make an incomplete/wrong recipe trivially satisfiable, including a false 100).
 * A genuinely well-formed empty array is still valid: `required.length === 0` below only
 * reaches a real, fully-validated empty list, never a corrupted one that got filtered down to
 * nothing.
 */
export function scoreRecipeComponentV2(
  recipe: Recipe,
  pizza: PizzaState,
): RecipeComponentV2 | ScoringV2Unavailable {
  const validation = validateRequiredIngredientsStrict(recipe?.requiredIngredients);
  if (!validation.valid) {
    return { available: false, reason: MALFORMED_REFERENCE_REASON };
  }
  const required = validation.items;
  if (required.length === 0) {
    return { available: true, requiredTypesPresent: 0, requiredTypesTotal: 0, score: 100 };
  }

  const safePizza = safePizzaForRecipeCheck(pizza);
  const requiredTypesPresent = required.filter(
    (req) => countUsedIngredient(safePizza, req.ingredientId) >= 1,
  ).length;
  const score = safeUnit(requiredTypesPresent / required.length) * 100;

  return {
    available: true,
    requiredTypesPresent,
    requiredTypesTotal: required.length,
    score,
  };
}
