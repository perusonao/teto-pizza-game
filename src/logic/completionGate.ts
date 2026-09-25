/**
 * Completion Gate Phase 1 (see docs/reports/TETO_COMPLETION-GATE_PHASE1_Result.md): the
 * "is this even a finished dish" question, deliberately kept separate from Scoring 2.0's own
 * "how well was it made" question (../logic/scoringV2/). A pizza that fails this gate is never
 * scored at all -- it is not a ★1 pizza, it is not a pizza. `evaluatePizzaCompletion` is the one
 * pure entry point `gameReducer.ts`'s `CONFIRM_BAKE` calls, mirroring `computeScoringV2`'s own
 * "one call site, computed from the exact canonical pizza that was just baked" contract.
 *
 * Every threshold below is *derived* from data the recipe/Reference already defines
 * (`Recipe.requiredIngredients[].minCount`, `Recipe.bakeTarget`, `ReferenceSauce.quantity`/
 * `.coverage`) rather than a new hand-picked number per recipe -- see each check's own comment
 * for exactly what it is derived from and why.
 */
import { getIngredient } from "../data/ingredients";
import type { Recipe, RecipeRequirement } from "../data/recipes";
import { getReferencePizza } from "../data/referencePizza";
import type { PizzaState } from "../state/pizzaState";
import { COVERAGE_POOR_RATIO } from "./sauceEvaluation";
import { computeSauceMetrics } from "./sauceField";
import { sanitizeSauceDeposits, sanitizeStringArray, sanitizeToppings } from "./scoringV2/boundary";
import { countUsedIngredient } from "./scoring";

/**
 * Issue #215 (Owner Decision OD-1 = G1, OD-4 = LR-A): how much of each required ingredient a
 * pizza needs to count as that dish at all.
 * - `"recipe"` (recipe mode and Free Cooking / discovery): one piece is enough. Being below the
 *   ideal (`minCount`, which stays the Reference quantity) is a Scoring 2.0 quality question
 *   (../logic/scoringV2/quantityComponent.ts), not a completion one.
 * - `"order"` (Lunch Rush): the ordered quantity (`minCount`) is required, exactly as before
 *   #215 -- keeps Lunch Rush ranking scores comparable (ruleset unchanged).
 * Zero pieces is `MISSING_REQUIRED_INGREDIENT` under both policies.
 */
export type CompletionPolicy = "recipe" | "order";

/** The minimum count of `req` a pizza needs under `policy` (Fresh Audit DS-A: `minCount`
 *  itself keeps meaning the ideal quantity for every other reader). */
export function completionMinimum(req: RecipeRequirement, policy: CompletionPolicy): number {
  return policy === "order" ? req.minCount : 1;
}

export type CompletionFailureReason =
  | "MISSING_REQUIRED_INGREDIENT"
  | "INSUFFICIENT_REQUIRED_AMOUNT"
  | "INSUFFICIENT_SAUCE"
  | "UNDERBAKED"
  | "OVERBAKED";

/** One failed condition. `ingredientId` is only ever set for the three ingredient/sauce
 *  reasons -- UNDERBAKED/OVERBAKED describe the whole pizza, not one ingredient. */
export interface CompletionFailureDetail {
  reason: CompletionFailureReason;
  ingredientId?: string;
}

export interface PizzaCompletionPass {
  status: "PASS";
}

export interface PizzaCompletionFailed {
  status: "FAILED";
  /** The single most important reason to show the player (Human Feel: one big reason, not a
   *  wall of text) -- see PRIORITY_ORDER below for how this is chosen among `failures`. */
  reason: CompletionFailureReason;
  ingredientId?: string;
  /** Every condition that failed, primary first -- kept for a future "詳細を見る" expansion
   *  (Phase 1 itself only ever surfaces the primary reason, per its own Scope Guard). */
  failures: readonly CompletionFailureDetail[];
}

export type PizzaCompletionResult = PizzaCompletionPass | PizzaCompletionFailed;

/**
 * Human Feel priority (section 16): composition failures ("this isn't even the right dish")
 * are more fundamental than a bake mistake ("the right dish, baked a bit wrong"), so they take
 * priority as the one reason shown. A completely missing ingredient outranks a merely
 * insufficient one (a pizza with zero mushrooms is a bigger miss than one with two instead of
 * three), and a bad required-ingredient count outranks a thin sauce (the sauce check only fires
 * once the sauce ingredient itself already passed the generic presence/amount check below).
 */
const PRIORITY_ORDER: readonly CompletionFailureReason[] = [
  "MISSING_REQUIRED_INGREDIENT",
  "INSUFFICIENT_REQUIRED_AMOUNT",
  "INSUFFICIENT_SAUCE",
  "UNDERBAKED",
  "OVERBAKED",
];

/**
 * Below this fraction of the Reference's own quantity/coverage target, there isn't a real
 * sauce application to speak of -- half of `COVERAGE_POOR_RATIO` (../sauceEvaluation.ts, the
 * existing "poor" tier floor players already see in the 広さ tier), so anything that would
 * still read as a genuine (if bad) "poor" sauce stays a completable pizza for Scoring 2.0 to
 * grade, and only something meaningfully thinner than "poor" fails outright.
 */
const SAUCE_MIN_RATIO = COVERAGE_POOR_RATIO / 2;

/**
 * How far outside a recipe's own `bakeTarget` perfect zone counts as "acceptable but degraded"
 * versus a hard failure, as a fraction of that zone's own width -- e.g. a 20-point-wide target
 * gets a 10-point acceptable margin on each side. Derived from the recipe's own authored zone
 * (never a new per-recipe number), and doubles the width of the zone Scoring 2.0's Bake
 * component already grades continuously (../logic/scoringV2/bakeComponent.ts) into a "PASS,
 * but scored down" band before the pizza is unservable.
 */
const BAKE_ACCEPTABLE_MARGIN_RATIO = 0.5;

function ratioOf(value: number, target: number): number {
  if (target <= 0) return value > 0 ? 1 : 0;
  return value / target;
}

/**
 * Same defensive posture as ../logic/scoringV2/recipeComponent.ts's own `safePizzaForRecipeCheck`
 * -- `countUsedIngredient` (./scoring.ts) trusts `pizza.sauceIds`/`pizza.toppings` to already be
 * real arrays and throws on a malformed `PizzaState` (a non-array, or an element missing its own
 * fields) at runtime. Real gameplay can never actually produce one (`PizzaState` is only ever
 * built through gameReducer.ts's own validated actions), but this gate must fail closed the same
 * way Scoring 2.0 does rather than let a malformed pizza crash CONFIRM_BAKE.
 */
function safePizzaForCompletionCheck(pizza: PizzaState): PizzaState {
  return {
    ...pizza,
    sauceIds: sanitizeStringArray(pizza?.sauceIds),
    toppings: sanitizeToppings(pizza?.toppings).map((t, i) => ({ id: `safe-${i}`, ...t })),
  };
}

/**
 * The generic sauce ingredient's minCount is always 1 (§4/§5 -- presence is the whole
 * requirement at this layer), so it can never itself be "insufficient", only missing or
 * present. Its actual *amount* is instead a quality question (§6), checked separately below
 * once presence has already passed.
 */
function checkSauceQuantity(
  recipe: Recipe,
  pizza: PizzaState,
  safeSauceIds: readonly string[],
): CompletionFailureDetail | null {
  const reference = getReferencePizza(recipe.id);
  if (!reference) return null;
  const sauceIngredientId = reference.sauce.ingredientId;
  const isRequired = recipe.requiredIngredients.some((req) => req.ingredientId === sauceIngredientId);
  if (!isRequired || !safeSauceIds.includes(sauceIngredientId)) return null;

  const deposits = sanitizeSauceDeposits(pizza.sauceDeposits);
  // The legacy one-shot `APPLY_SAUCE` action (gameReducer.ts) always applies full coverage
  // instantly and never populates `sauceDeposits` at all (see that action's own comment). In
  // practice every real sauce (spread) ingredient tap or drag now goes through
  // COMMIT_SAUCE_DISPENSE's incremental session instead -- PizzaStage.tsx's own `isPaintMode`
  // starts that session unconditionally on pointerdown for any spread ingredient, so APPLY_SAUCE
  // is effectively unreachable from the real touch/mouse UI today -- but it remains a real,
  // directly dispatchable reducer action (tests, a future non-drag interaction). An empty
  // deposit log with a sauce ingredient present means "applied via that instant-fill action",
  // not "barely touched", so it is exempted from this quantity check rather than misread as a
  // near-empty gesture. A real single-tap dispense session (COMMIT_SAUCE_DISPENSE, one starter
  // tick's worth of deposits) is NOT exempted -- see ../logic/sauceDispenseController.ts's own
  // `start()` doc comment -- so "a single touch must not pass" (the spec's own Human Feel
  // requirement) still holds for actual gameplay.
  if (deposits.length === 0) return null;

  const metrics = computeSauceMetrics(deposits);
  const quantityRatio = ratioOf(metrics.quantity, reference.sauce.quantity);
  const coverageRatio = ratioOf(metrics.coverage, reference.sauce.coverage);
  if (quantityRatio < SAUCE_MIN_RATIO || coverageRatio < SAUCE_MIN_RATIO) {
    return { reason: "INSUFFICIENT_SAUCE", ingredientId: sauceIngredientId };
  }
  return null;
}

function checkBake(recipe: Recipe, pizza: PizzaState): CompletionFailureDetail | null {
  const { start, end } = recipe.bakeTarget;
  const bakeResult = pizza.bakeResult;
  if (typeof bakeResult !== "number" || !Number.isFinite(bakeResult)) return null;

  const margin = (end - start) * BAKE_ACCEPTABLE_MARGIN_RATIO;
  if (bakeResult < start - margin) return { reason: "UNDERBAKED" };
  if (bakeResult > end + margin) return { reason: "OVERBAKED" };
  return null;
}

/**
 * The Completion Gate: PASS (this pizza is a real, servable dish -- Scoring 2.0 may now grade
 * *how well*) or FAILED (it never became one -- no score, no reward, no Dex/progression credit,
 * see the Result Report's FAILED semantics section for the full list of what a FAILED round
 * never does). Pure and total: never throws, and only ever reads `recipe`/`pizza`, exactly like
 * `computeScoringV2` (../logic/scoringV2/index.ts) -- the two are deliberately independent, so
 * this gate has no opinion on score/stars and Scoring 2.0 has no opinion on PASS/FAILED.
 */
export function evaluatePizzaCompletion(
  recipe: Recipe,
  pizza: PizzaState,
  policy: CompletionPolicy = "recipe",
): PizzaCompletionResult {
  const failures: CompletionFailureDetail[] = [];
  const safePizza = safePizzaForCompletionCheck(pizza);

  for (const req of recipe.requiredIngredients) {
    const count = countUsedIngredient(safePizza, req.ingredientId);
    if (count === 0) {
      failures.push({ reason: "MISSING_REQUIRED_INGREDIENT", ingredientId: req.ingredientId });
    } else if (count < completionMinimum(req, policy)) {
      failures.push({ reason: "INSUFFICIENT_REQUIRED_AMOUNT", ingredientId: req.ingredientId });
    }
  }

  const sauceFailure = checkSauceQuantity(recipe, pizza, safePizza.sauceIds);
  if (sauceFailure) failures.push(sauceFailure);

  const bakeFailure = checkBake(recipe, pizza);
  if (bakeFailure) failures.push(bakeFailure);

  if (failures.length === 0) return { status: "PASS" };

  let primary = failures[0];
  for (const failure of failures) {
    if (PRIORITY_ORDER.indexOf(failure.reason) < PRIORITY_ORDER.indexOf(primary.reason)) {
      primary = failure;
    }
  }

  return {
    status: "FAILED",
    reason: primary.reason,
    ingredientId: primary.ingredientId,
    failures,
  };
}

/** Convenience re-export so callers that only need an ingredient's display name for a failure
 *  don't need their own import of ../data/ingredients. */
export function completionFailureIngredientName(ingredientId: string | undefined): string | null {
  if (!ingredientId) return null;
  return getIngredient(ingredientId)?.nameJa ?? null;
}
