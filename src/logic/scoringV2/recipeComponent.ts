/**
 * Phase 4A-2: Scoring 2.0 Shadow Recipe correctness component -- required ingredient *type*
 * presence, reusing ../scoring.ts's `countUsedIngredient` primitive wholesale, plus (Issue #32)
 * a purity check for ingredient types the recipe never asked for at all.
 *
 * Deliberately distinct from ../scoring.ts's legacy `matchScore` (which requires each
 * ingredient's own `minCount` to be met) and from ./piecesComponent.ts (which scores *how
 * many* and *how well placed* mozzarella/basil are): this component only asks "is the right
 * ingredient TYPE on the pizza, and only the right types", never "how much" or "placed how
 * well" -- see scoringV2.test.ts's "recipe correctness / pieces separation" tests, which pin
 * that a pizza with too few mozzarella pieces (a Pieces concern) still reads as full Recipe
 * correctness as long as mozzarella is present at all, and that a pizza with many extra
 * mozzarella pieces of an already-required type never lowers Recipe (Pieces' own quantity
 * concern), so the same mistake is never penalized twice across these two components.
 *
 * Issue #32 purity: presence alone used to be the whole story, so a stray, unspecified
 * ingredient (e.g. pepperoni on a Margherita) was completely invisible here -- see
 * docs/reports/TETO_ISSUE-32_RECIPE-CORRECTNESS_Fresh-Audit.md section 5, case G/H. The fix
 * below keeps presence as the base score and multiplies in a purity term for *distinct extra
 * ingredient types* (ids used on the pizza that are not in `recipe.requiredIngredients`),
 * mirroring ../scoring.ts's legacy `ingredientScore`'s own dilute-by-used-type-count shape
 * (`extraCount / usedTypesTotal`) rather than inventing a new one -- the Fresh Audit's §9
 * explicitly calls a single "anything not required is impure" rule, diluted the same way
 * Legacy already dilutes it, "the smaller change". Quantity of an extra type never matters
 * (six stray pepperoni pieces count as exactly one extra *type*, same as one) -- purity is a
 * type-correctness question, never a quantity one, so it stays out of Pieces' domain.
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

/** Distinct ingredient ids actually used on the (already-sanitized) pizza -- a sauce id present
 *  in `sauceIds`, or any topping's `ingredientId`. Mirrors ../scoring.ts's own private
 *  `usedIngredientIds`, kept local here rather than exported/shared since it only ever needs to
 *  run against this file's own `safePizzaForRecipeCheck` output. Duplicates of the same type
 *  collapse to one entry -- purity counts extra *types*, never extra *quantity* (that stays
 *  Pieces' concern). */
function usedIngredientTypeIds(safePizza: PizzaState): Set<string> {
  const ids = new Set<string>(safePizza.sauceIds);
  for (const t of safePizza.toppings) ids.add(t.ingredientId);
  return ids;
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
    return {
      available: true,
      requiredTypesPresent: 0,
      requiredTypesTotal: 0,
      usedTypesTotal: 0,
      extraTypesCount: 0,
      purityMultiplier: 1,
      score: 100,
    };
  }

  const safePizza = safePizzaForRecipeCheck(pizza);
  const requiredTypesPresent = required.filter(
    (req) => countUsedIngredient(safePizza, req.ingredientId) >= 1,
  ).length;
  const presenceScore = safeUnit(requiredTypesPresent / required.length) * 100;

  // Issue #32 purity: distinct used ingredient types not asked for by this recipe at all.
  const requiredIds = new Set(required.map((req) => req.ingredientId));
  const usedTypeIds = usedIngredientTypeIds(safePizza);
  const extraTypesCount = Array.from(usedTypeIds).filter((id) => !requiredIds.has(id)).length;
  // Diluted by total distinct types actually used (Legacy `ingredientScore`'s own shape) --
  // one stray ingredient on an otherwise-sparse pizza costs proportionally more than the same
  // stray ingredient among many correctly-used types. No extras used at all (including an
  // empty pizza, already reflected by `presenceScore` above) is full purity, never a penalty.
  const purityMultiplier =
    usedTypeIds.size === 0 ? 1 : safeUnit(1 - extraTypesCount / usedTypeIds.size);
  const score = safeUnit((presenceScore * purityMultiplier) / 100) * 100;

  return {
    available: true,
    requiredTypesPresent,
    requiredTypesTotal: required.length,
    usedTypesTotal: usedTypeIds.size,
    extraTypesCount,
    purityMultiplier,
    score,
  };
}
