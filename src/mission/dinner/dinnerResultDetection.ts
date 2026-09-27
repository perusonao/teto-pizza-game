import { getCookingProfile, postBakeSteps } from "../../data/cookingProfiles";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { FREE_COOK_BAKE_TARGET } from "../../data/freeCook";
import { getRecipe, type BakeTarget, type Recipe, type RecipeId } from "../../data/recipes";
import {
  evaluatePizzaCompletion,
  type CompletionFailureReason,
  type PizzaCompletionFailed,
} from "../../logic/completionGate";
import { evaluateFreeCookCompletion } from "../../logic/discovery/freeCook";
import { matchDiscovery, type RecipeDiscoveryTarget } from "../../logic/discovery/matcher";
import { signatureOfPizza } from "../../logic/discovery/signature";
import type { QualityStars } from "../../logic/scoring";
import { computeScoringV2, toLegacyScoreBreakdown } from "../../logic/scoringV2";
import { isDiscovered, type DexState } from "../../state/dex";
import { consumePizzaInventory, type InventoryState } from "../../state/inventory";
import type { PizzaState } from "../../state/pizzaState";
import type { SetIngredientShortage } from "../../state/recipeSetFeasibility";
import { completionPolicyForRound } from "../../state/roundKind";
import {
  isDinnerClockExpired,
  remainingTargetIds,
  remainingTargetShortages,
  type DinnerRunState,
} from "./dinnerRun";

/**
 * Dinner Mission DM-3R-1: result detection, pure. Not wired into the runtime yet (DM-3R-2).
 *
 * The redesigned loop (docs/reports/TETO_DINNER-MISSION_DM-3R-1_RESULT-DETECTION_Result.md): the
 * player never declares which pizza they are making (OD-R1 / OD-R3). What the finished pizza *is*
 * comes from its composition alone, through the Free Cooking matcher (`signatureOfPizza` +
 * `matchDiscovery` over `RECIPE_DISCOVERY_CATALOG`) -- no Dinner-specific matcher exists.
 *
 * Two stages:
 * - **A, at START_BAKE** (`planDinnerBake`): the composition is final, so the identity is already
 *   known. It picks the BAKE window and whether a CUT step follows. It changes no progress and
 *   carries no recipe name; `dinnerBakePlanView` is the only part the BAKE UI may read.
 * - **B, at RESULT** (`resolveDinnerAttempt`): after BAKE, or after CUT when the identity needs
 *   one. Identity -> target membership -> duplicate -> Completion Gate -> quality -> progress ->
 *   feasibility of the remaining targets on the post-consumption stock.
 *
 * Quality is Scoring 2.0's ★ (`computeScoringV2` + `toLegacyScoreBreakdown`, bake cap included)
 * against `minimumStars`, which the caller injects: the production value is undecided until DM-5
 * (OD-R2), so this module has no default and no constant for it.
 *
 * Nothing here reads or writes Pitz, and the Dex is read only to decide what may be *shown*
 * (OD-R4): no Discovery evaluation, no registration, no reveal.
 */

type PostBakeStep = ReturnType<typeof postBakeSteps>[number];

/** What the composition is. Never a first-match pick: more than one candidate is AMBIGUOUS. */
export type DinnerIdentity =
  | { kind: "RECIPE"; recipeId: RecipeId }
  | { kind: "NONE" }
  | { kind: "AMBIGUOUS"; targetIds: readonly string[] };

export function resolveDinnerIdentity(
  pizza: PizzaState,
  catalog: readonly RecipeDiscoveryTarget[] = RECIPE_DISCOVERY_CATALOG,
): DinnerIdentity {
  const match = matchDiscovery(signatureOfPizza(pizza), catalog);
  if (match.kind === "UNIQUE_MATCH") return { kind: "RECIPE", recipeId: match.target.recipeId };
  if (match.kind === "AMBIGUOUS") return { kind: "AMBIGUOUS", targetIds: match.targetIds };
  return { kind: "NONE" };
}

/** Stage A. Internal: carries the identity, so never hand it to the UI as is. */
export interface DinnerBakePlan {
  identity: DinnerIdentity;
  bakeWindow: { source: "RECIPE" | "GENERIC"; target: BakeTarget };
  /** The steps after BAKE for the identified recipe (its cooking profile); empty otherwise. */
  postBakeSteps: readonly PostBakeStep[];
  cutRequired: boolean;
}

function identifiedRecipe(identity: DinnerIdentity): Recipe | null {
  return identity.kind === "RECIPE" ? (getRecipe(identity.recipeId) ?? null) : null;
}

export function planDinnerBake(
  pizza: PizzaState,
  catalog: readonly RecipeDiscoveryTarget[] = RECIPE_DISCOVERY_CATALOG,
): DinnerBakePlan {
  const identity = resolveDinnerIdentity(pizza, catalog);
  const recipe = identifiedRecipe(identity);
  if (!recipe) {
    // No match, an ambiguous match, or an id with no recipe: the Free Cooking fallback -- the
    // generic window and no CUT (the same shape as a Free Cooking round's own profile).
    return { identity, bakeWindow: { source: "GENERIC", target: FREE_COOK_BAKE_TARGET }, postBakeSteps: [], cutRequired: false };
  }
  const steps = postBakeSteps(getCookingProfile(recipe.id));
  return {
    identity,
    bakeWindow: { source: "RECIPE", target: recipe.bakeTarget },
    postBakeSteps: steps,
    cutRequired: steps.includes("CUT"),
  };
}

/** What the BAKE / CUT UI may use: the window and the step list, never the identity. */
export interface DinnerBakePlanView {
  bakeTarget: BakeTarget;
  postBakeSteps: readonly PostBakeStep[];
  cutRequired: boolean;
}

export function dinnerBakePlanView(plan: DinnerBakePlan): DinnerBakePlanView {
  return {
    bakeTarget: { start: plan.bakeWindow.target.start, end: plan.bakeWindow.target.end },
    postBakeSteps: [...plan.postBakeSteps],
    cutRequired: plan.cutRequired,
  };
}

/** Why a target-identity pizza did not complete its target. Pure reason, not UI wording. */
export type DinnerQualityFailure =
  /** The recipe's own Completion Gate (Dinner policy) failed on composition: missing, too few, or
   *  too little sauce. A bake miss never lands here -- that is INVALID_PIZZA (see below). */
  | { kind: "COMPLETION_GATE"; completion: PizzaCompletionFailed }
  | { kind: "BELOW_MINIMUM_STARS"; stars: QualityStars; totalScore: number; minimumStars: QualityStars };

/** Why a pizza gave no safe known result. */
export type DinnerOriginalReason = "NO_MATCH" | "AMBIGUOUS_IDENTITY" | "UNDISCOVERED_RECIPE";

export type DinnerAttemptCategory =
  | "TARGET_PASS"
  | "QUALITY_FAIL"
  | "DUPLICATE_TARGET"
  | "NON_TARGET"
  | "ORIGINAL"
  | "INVALID_PIZZA";

/**
 * Stage B's classification, in resolution order:
 * 1. INVALID_PIZZA -- not a dish: nothing on the dough, or baked outside the acceptable band of the
 *    Stage A window (the Free Cooking rule, with the identified recipe's window when there is one).
 * 2. DUPLICATE_TARGET -- a target already completed (quality not looked at).
 * 3. QUALITY_FAIL / TARGET_PASS -- a remaining target: Completion Gate, then ★ >= minimumStars.
 * 4. NON_TARGET -- a discovered recipe that is not a target.
 * 5. ORIGINAL -- no match, an ambiguous match, or an undiscovered non-target recipe. The last keeps
 *    its id in `internalRecipeId` for logs/tests only; the view never shows it.
 */
export type DinnerAttemptClassification =
  | { category: "TARGET_PASS"; recipeId: RecipeId; stars: QualityStars; totalScore: number; minimumStars: QualityStars }
  | { category: "QUALITY_FAIL"; recipeId: RecipeId; failure: DinnerQualityFailure }
  | { category: "DUPLICATE_TARGET"; recipeId: RecipeId }
  | { category: "NON_TARGET"; recipeId: RecipeId }
  | { category: "ORIGINAL"; reason: DinnerOriginalReason; internalRecipeId?: RecipeId }
  | { category: "INVALID_PIZZA"; completion: PizzaCompletionFailed };

export interface DinnerAttemptInput {
  run: DinnerRunState;
  /** The finished pizza: composition plus the confirmed `bakeResult`. */
  pizza: PizzaState;
  /** Whether the CUT step (when the identity has one) has been confirmed. */
  cutCompleted: boolean;
  /**
   * Stock *before* this pizza's consumption -- in the runtime, `state.inventory` as it was when
   * CONFIRM_BAKE was dispatched. The resolver subtracts the pizza itself (`consumePizzaInventory`),
   * so passing the post-bake stock (e.g. `state.inventory` at CUT confirm, which CONFIRM_BAKE has
   * already reduced) consumes the pizza twice. Pinned against the real CONFIRM_BAKE in the tests.
   */
  preConsumptionInventory: InventoryState;
  ownedIngredientIds: readonly string[];
  /** Read only for what may be shown (OD-R4). Never written. */
  dex: DexState;
  /** The quality gate S, injected (OD-R2: undecided until DM-5). An integer 1..5. */
  minimumStars: QualityStars;
  now: number;
  catalog?: readonly RecipeDiscoveryTarget[];
}

export type DinnerAttemptRejection =
  | "RUN_NOT_PLAYING"
  | "NOT_BAKED"
  | "CUT_PENDING"
  | "INVALID_MINIMUM_STARS"
  | "INVALID_TIME";

export type DinnerAttemptResult =
  /** Nothing is resolved and nothing is consumed; the caller keeps its state. */
  | { status: "REJECTED"; reason: DinnerAttemptRejection }
  /** The deadline passed before this pizza counted: the DM-1 TIME_UP rule, nothing consumed. */
  | { status: "TIME_UP"; run: DinnerRunState }
  | {
      status: "RESOLVED";
      plan: DinnerBakePlan;
      classification: DinnerAttemptClassification;
      /** The target this pizza completed, if any (only ever set for TARGET_PASS). */
      completedTargetId: RecipeId | null;
      /** Always the consumed stock, whatever the category (no refund). */
      postConsumptionInventory: InventoryState;
      /** Shortages of the remaining targets against `postConsumptionInventory` (empty after a CLEAR). */
      remainingShortages: SetIngredientShortage[];
      run: DinnerRunState;
    };

const DINNER_COMPLETION_POLICY = completionPolicyForRound({ roundKind: "DINNER" });

function isValidMinimumStars(value: unknown): value is QualityStars {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function classify(
  input: DinnerAttemptInput,
  plan: DinnerBakePlan,
): DinnerAttemptClassification {
  const { pizza, run, dex, minimumStars } = input;
  const dish = evaluateFreeCookCompletion(pizza, plan.bakeWindow.target);
  if (dish.status === "FAILED") return { category: "INVALID_PIZZA", completion: dish };

  const identity = plan.identity;
  if (identity.kind === "AMBIGUOUS") return { category: "ORIGINAL", reason: "AMBIGUOUS_IDENTITY" };
  const recipe = identifiedRecipe(identity);
  if (!recipe) return { category: "ORIGINAL", reason: "NO_MATCH" };

  if (run.targetRecipeIds.includes(recipe.id)) {
    if (run.completedRecipeIds.includes(recipe.id)) return { category: "DUPLICATE_TARGET", recipeId: recipe.id };
    const completion = evaluatePizzaCompletion(recipe, pizza, DINNER_COMPLETION_POLICY);
    if (completion.status === "FAILED") {
      return { category: "QUALITY_FAIL", recipeId: recipe.id, failure: { kind: "COMPLETION_GATE", completion } };
    }
    const score = toLegacyScoreBreakdown(computeScoringV2(recipe, pizza), pizza.bakeResult, recipe.bakeTarget);
    if (score.stars >= minimumStars) {
      return { category: "TARGET_PASS", recipeId: recipe.id, stars: score.stars, totalScore: score.total, minimumStars };
    }
    return {
      category: "QUALITY_FAIL",
      recipeId: recipe.id,
      failure: { kind: "BELOW_MINIMUM_STARS", stars: score.stars, totalScore: score.total, minimumStars },
    };
  }

  if (isDiscovered(dex, recipe.id)) return { category: "NON_TARGET", recipeId: recipe.id };
  return { category: "ORIGINAL", reason: "UNDISCOVERED_RECIPE", internalRecipeId: recipe.id };
}

/**
 * The run after one resolved pizza -- the DM-1 `RESOLVE_ATTEMPT` rules with the declared target
 * replaced by the detected one: a completed target is added; every target done -> CLEARED, which
 * wins over the stock check (nothing is left to cook); otherwise the remaining targets are checked
 * against the post-consumption stock and a shortage fails the run at once (INFEASIBLE). The
 * per-attempt log shape is DM-3R-2's (the classification is returned alongside), so `attempts` is
 * left as is.
 */
function settleRun(
  run: DinnerRunState,
  completedTargetId: RecipeId | null,
  stock: { ownedIngredientIds: readonly string[]; inventory: InventoryState },
  now: number,
): { run: DinnerRunState; remainingShortages: SetIngredientShortage[] } {
  const next: DinnerRunState =
    completedTargetId === null ? run : { ...run, completedRecipeIds: [...run.completedRecipeIds, completedTargetId] };
  if (remainingTargetIds(next).length === 0) {
    return {
      run: { ...next, status: "CLEARED", outcome: { kind: "CLEAR", endedAt: now, clearMs: now - run.clock.startedAt } },
      remainingShortages: [],
    };
  }
  const shortages = remainingTargetShortages(next, { ownedIngredientIds: [...stock.ownedIngredientIds], inventory: stock.inventory });
  if (shortages.length > 0) {
    return {
      run: {
        ...next,
        status: "FAILED",
        activeRecipeId: null,
        outcome: { kind: "FAILED", reason: "INFEASIBLE", endedAt: now, shortages },
      },
      remainingShortages: shortages,
    };
  }
  return { run: next, remainingShortages: [] };
}

/** Stage B. Pure and total: never throws, never mutates its input. */
export function resolveDinnerAttempt(input: DinnerAttemptInput): DinnerAttemptResult {
  const { run, pizza, now } = input;
  if (!isValidMinimumStars(input.minimumStars)) return { status: "REJECTED", reason: "INVALID_MINIMUM_STARS" };
  if (typeof now !== "number" || !Number.isFinite(now)) return { status: "REJECTED", reason: "INVALID_TIME" };
  if (run.status !== "PLAYING") return { status: "REJECTED", reason: "RUN_NOT_PLAYING" };
  // DM-1: the deadline wins over anything resolved at or after it.
  if (isDinnerClockExpired(now, run.clock)) {
    return {
      status: "TIME_UP",
      run: {
        ...run,
        status: "FAILED",
        activeRecipeId: null,
        outcome: { kind: "FAILED", reason: "TIME_UP", endedAt: run.clock.endsAt },
      },
    };
  }
  if (typeof pizza?.bakeResult !== "number" || !Number.isFinite(pizza.bakeResult)) {
    return { status: "REJECTED", reason: "NOT_BAKED" };
  }

  // The identity is composition-only, so Stage A on the finished pizza is Stage A at START_BAKE.
  const plan = planDinnerBake(pizza, input.catalog);
  if (plan.cutRequired && !input.cutCompleted) return { status: "REJECTED", reason: "CUT_PENDING" };

  const classification = classify(input, plan);
  const completedTargetId = classification.category === "TARGET_PASS" ? classification.recipeId : null;
  // Every category consumed what the pizza used (CONFIRM_BAKE's one consumption authority).
  const postConsumptionInventory = consumePizzaInventory(pizza, input.preConsumptionInventory);
  const settled = settleRun(run, completedTargetId, { ownedIngredientIds: input.ownedIngredientIds, inventory: postConsumptionInventory }, now);
  return {
    status: "RESOLVED",
    plan,
    classification,
    completedTargetId,
    postConsumptionInventory,
    remainingShortages: settled.remainingShortages,
    run: settled.run,
  };
}

/**
 * What the result panel may show. A recipe is named only when it is a mission target or a
 * discovered recipe; anything else is an anonymous ORIGINAL with no reason, candidate or near-miss
 * (OD-R4). Fails closed: a named category whose recipe is somehow undiscovered also becomes
 * ORIGINAL. Wording is the UI's (DM-3R-2); this carries codes and numbers only.
 */
export type DinnerAttemptView =
  | { category: "TARGET_PASS"; recipeId: RecipeId; nameJa: string; stars: QualityStars; minimumStars: QualityStars }
  | {
      category: "QUALITY_FAIL";
      recipeId: RecipeId;
      nameJa: string;
      failure:
        | { kind: "COMPLETION_GATE"; reason: CompletionFailureReason; ingredientId?: string }
        | { kind: "BELOW_MINIMUM_STARS"; stars: QualityStars; minimumStars: QualityStars };
    }
  | { category: "DUPLICATE_TARGET"; recipeId: RecipeId; nameJa: string }
  | { category: "NON_TARGET"; recipeId: RecipeId; nameJa: string }
  | { category: "ORIGINAL" }
  | { category: "INVALID_PIZZA"; reason: CompletionFailureReason };

export function dinnerAttemptView(classification: DinnerAttemptClassification, dex: DexState): DinnerAttemptView {
  if (classification.category === "ORIGINAL") return { category: "ORIGINAL" };
  if (classification.category === "INVALID_PIZZA") {
    return { category: "INVALID_PIZZA", reason: classification.completion.reason };
  }
  const recipe = getRecipe(classification.recipeId);
  if (!recipe || !isDiscovered(dex, recipe.id)) return { category: "ORIGINAL" };
  const named = { recipeId: recipe.id, nameJa: recipe.nameJa };
  switch (classification.category) {
    case "TARGET_PASS":
      return { category: "TARGET_PASS", ...named, stars: classification.stars, minimumStars: classification.minimumStars };
    case "QUALITY_FAIL": {
      const f = classification.failure;
      return {
        category: "QUALITY_FAIL",
        ...named,
        failure:
          f.kind === "COMPLETION_GATE"
            ? {
                kind: "COMPLETION_GATE",
                reason: f.completion.reason,
                ...(f.completion.ingredientId !== undefined ? { ingredientId: f.completion.ingredientId } : {}),
              }
            : { kind: "BELOW_MINIMUM_STARS", stars: f.stars, minimumStars: f.minimumStars },
      };
    }
    case "DUPLICATE_TARGET":
      return { category: "DUPLICATE_TARGET", ...named };
    case "NON_TARGET":
      return { category: "NON_TARGET", ...named };
  }
}
