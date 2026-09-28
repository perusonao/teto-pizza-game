/**
 * Phase 4A-2 / A1: Scoring 2.0 -- the single entry point (`computeScoringV2`) every caller
 * uses. Authoritative for `state.score`/RESULT/Dex BEST/Mission/progression (see
 * `toLegacyScoreBreakdown`, exported below, which is how CONFIRM_BAKE derives the legacy
 * `ScoreBreakdown` shape from this function's result) -- see ./types.ts's file header for the
 * full detail.
 *
 * P0-2 (Canonical bake-time computation): the one caller of this function is
 * src/state/gameReducer.ts's CONFIRM_BAKE case, which calls it with the exact `PizzaState`
 * that was just baked (`state.pizza` plus the confirmed `bakeResult`) and `state.recipe` --
 * never App.tsx's UI-only live-preview `useMemo` (`sauceMetrics`/`sauceShadowScore`/
 * `pieceShadowMetrics`), which reads uncommitted `pendingSauceDeposits` and is gated off
 * during Mission play. This file has no opinion on *when* it's called; gameReducer.ts is what
 * makes that true for both FREE and Lunch Rush, since both dispatch the exact same
 * CONFIRM_BAKE action.
 */
import { getIngredient } from "../../data/ingredients";
import { getReferencePizza, listReferencePizzas } from "../../data/referencePizza";
import type { Recipe } from "../../data/recipes";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { REFERENCE_SLOT_MAX_RADIUS } from "../pizzaReferenceLayout";
import { computeSauceMetrics } from "../sauceField";
import { scoreBakeComponentV2 } from "./bakeComponent";
import { sanitizeSauceDeposits } from "./boundary";
import { scoreSauceComponentV2 } from "./sauceComponent";
import { scorePiecesComponentV2 } from "./piecesComponent";
import { scoreQuantityComponentV2 } from "./quantityComponent";
import { scoreRecipeComponentV2 } from "./recipeComponent";
import { safeUnit } from "./tolerance";
import type {
  ScoringReferencePizza,
  ScoringV2Result,
  ScoringV2WeightProfile,
  ScoringV2WeightProfileId,
} from "./types";

/** Issue #215: bumped from `phase-4a-2-shadow-3` for the quantity factor Q (./quantityComponent.ts).
 *  Existing Dex BEST values are kept as-is (BEST only ever goes up; never recomputed). */
export const SCORING_V2_RULESET_VERSION = "phase-4a-2-shadow-4-quantity";

const REFERENCE_UNAVAILABLE_REASON =
  "この料理はまだ Reference Pizza（お手本データ）がありません。Phase 4A-2時点ではマルゲリータのみ対応しています。";

/**
 * B1 weight split (see docs/reports/TETO_SCORING2-B1_BAKE_Result.md's "Bake formula / weight
 * decision" for the full reasoning this comment summarizes): adding a real Bake weight is a
 * genuine calibration decision, so rather than inventing four fresh numbers, this keeps the
 * *existing*, already-iPhone-calibrated Sauce:Pieces:Recipe ratio (65:20:15) completely
 * unchanged and only rescales it down to make room for Bake -- 65/20/15 each multiplied by 0.8
 * gives 52/16/12 (same ratio to each other, verified: 52/16 = 65/20 = 3.25, 52/12 = 65/15 =
 * 4.333, 16/12 = 20/15 = 1.333). Bake itself takes the freed 20 points: the smaller of
 * the two anchors this task named (legacy's own Bake weight is 30/100, its single heaviest --
 * the Fresh Audit's cited historical conceptual direction is Recipe15/Sauce35/Pieces30/Bake20),
 * chosen deliberately conservative since this new formula has no iPhone Human-Feel evidence of
 * its own yet, unlike the Sauce/Pieces/Recipe ratio it's being weighed against. All four sum to
 * 100. Ruleset version bumped (-shadow-2 -> -shadow-3) so a stored/logged Shadow result can
 * never be misread against the pre-Bake formula. */
const SAUCE_WEIGHT = 52;
const PIECES_WEIGHT = 16;
const RECIPE_WEIGHT = 12;
const BAKE_WEIGHT = 20;

/**
 * TQ-1B (Issue #263, Owner Decision OD-TQ-S1 = option B, which also answers Wave 2 OD-W2-8): the
 * weight profiles. `STANDARD` is the B1 split above, unchanged, and is used for every recipe whose
 * Reference has a sauce -- every production recipe today. `NO_SAUCE` is used only when the
 * Reference has no sauce: the sauce component does not apply, and its 52 points move to Pieces,
 * the other hand-skill component, so Recipe + Bake keep exactly the same weight (32) they have in
 * `STANDARD`. At equal skill (sauce skill = pieces skill) a no-sauce pizza therefore lands on
 * exactly the same total -- and the same stars and Pitz band -- as a sauce pizza (the Gate's
 * 11-point comparison, pinned by scoringV2.noSauceProfile.test.ts). The alternatives the Gate
 * rejected give free credit instead: proportional redistribution puts pieces 0 at ★3, and
 * "sauce counts as full" puts it at ★4.
 *
 * No constant above changes, and neither does `SCORING_V2_RULESET_VERSION` (OD-TQ-S2): no existing
 * result can change, because only a Reference without a sauce reaches `NO_SAUCE`.
 */
export const SCORING_V2_WEIGHT_PROFILES: Readonly<Record<ScoringV2WeightProfileId, ScoringV2WeightProfile>> = {
  STANDARD: { id: "STANDARD", sauce: SAUCE_WEIGHT, pieces: PIECES_WEIGHT, recipe: RECIPE_WEIGHT, bake: BAKE_WEIGHT },
  NO_SAUCE: { id: "NO_SAUCE", sauce: 0, pieces: PIECES_WEIGHT + SAUCE_WEIGHT, recipe: RECIPE_WEIGHT, bake: BAKE_WEIGHT },
};

/** The weighted 0-1 unit total of four 0-100 component scores under `profile`. The expression
 *  (term order, then `/ 100 / 100`) is exactly the pre-TQ-1B one, so `STANDARD` is bit-identical. */
export function combineWeightedComponents(
  scores: { sauce: number; pieces: number; recipe: number; bake: number },
  profile: ScoringV2WeightProfile,
): number {
  return safeUnit(
    (scores.sauce * profile.sauce +
      scores.pieces * profile.pieces +
      scores.recipe * profile.recipe +
      scores.bake * profile.bake) /
      100 /
      100,
  );
}

const NO_SAUCE_NOT_APPLICABLE_REASON = "このピザはソースを使わないため、ソースは評価しません。";
const NO_SAUCE_REFERENCE_MISMATCH_REASON =
  "お手本にソースがないのに、レシピはソースを必要としています（データ不整合のため採点しません）。";

const REFERENCE_RECIPE_MISMATCH_REASON = "お手本が別のレシピのものです（採点しません）。";
const REFERENCE_MALFORMED_REASON = "お手本データの形が正しくありません（採点しません）。";

function isUnitNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Null when `reference` can be scored for `recipe`; otherwise why not. Every production
 *  Reference passes (pinned by the score-parity snapshot): its `recipeId` is its own recipe's id
 *  and its sauce is a well-formed target. `sauce: null` is the one valid "no sauce" value --
 *  anything else that is not a target (absent, `undefined`, a partial object) is malformed. */
function invalidReferenceReason(recipe: Recipe, reference: ScoringReferencePizza): string | null {
  return invalidReferenceShapeReason(recipe, reference) ?? invalidReferenceValueReason(recipe, reference);
}

const REFERENCE_NOT_AUTHORITATIVE_REASON = "お手本が正式なお手本データと一致しません（採点しません）。";
/** Reference pieces are laid out on a 0..100 dough-percent square centred here. */
const REFERENCE_CENTER = 50;

let approvedToleranceBandsByIngredient: ReadonlyMap<string, ReadonlySet<string>> | null = null;
function toleranceBandKey(full: unknown, zero: unknown): string {
  return `${String(full)}/${String(zero)}`;
}
/** Whether production References use this placement tolerance band for this ingredient (today
 *  8/22 everywhere, plus 14/30 for the single egg). The lookup is per ingredient, so one
 *  ingredient's lenient band can never be borrowed by another (Codex review on #271); an
 *  ingredient no production Reference places has no approved band at all. */
function isApprovedToleranceBand(ingredientId: unknown, full: unknown, zero: unknown): boolean {
  if (approvedToleranceBandsByIngredient === null) {
    const bands = new Map<string, Set<string>>();
    for (const ref of listReferencePizzas()) {
      for (const g of ref.pieceGroups) {
        const set = bands.get(g.ingredientId) ?? new Set<string>();
        set.add(toleranceBandKey(g.matching.fullCreditRadius, g.matching.zeroCreditRadius));
        bands.set(g.ingredientId, set);
      }
    }
    approvedToleranceBandsByIngredient = bands;
  }
  return typeof ingredientId === "string" && approvedToleranceBandsByIngredient.get(ingredientId)?.has(toleranceBandKey(full, zero)) === true;
}

let approvedSauceTargets: ReadonlyMap<string, readonly ScoringSauceTarget[]> | null = null;
type ScoringSauceTarget = { quantity: number; coverage: number };
/** Whether a production Reference uses exactly this sauce target for this sauce (today one
 *  target per sauce). A non-production Reference cannot lower its sauce target to make an
 *  unpainted pizza read as a full sauce score. */
function isApprovedSauceTarget(ingredientId: string, quantity: unknown, coverage: unknown): boolean {
  if (approvedSauceTargets === null) {
    const targets = new Map<string, ScoringSauceTarget[]>();
    for (const ref of listReferencePizzas()) {
      const list = targets.get(ref.sauce.ingredientId) ?? [];
      list.push({ quantity: ref.sauce.quantity, coverage: ref.sauce.coverage });
      targets.set(ref.sauce.ingredientId, list);
    }
    approvedSauceTargets = targets;
  }
  return (approvedSauceTargets.get(ingredientId) ?? []).some((t) => t.quantity === quantity && t.coverage === coverage);
}

/** Structural equality over plain Reference data (objects, arrays, primitives). */
function sameReferenceData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  const bRecord = b as Record<string, unknown>;
  return aKeys.every((key) => Object.prototype.hasOwnProperty.call(bRecord, key) && sameReferenceData((a as Record<string, unknown>)[key], bRecord[key]));
}

/** The Reference's values, after its shape has passed (Codex review on #271). A recipe with a
 *  production Reference is scored only against exactly that data -- any other value (positions,
 *  tolerance radii, sauce targets, ...) is corrupted authoritative data. A recipe without one
 *  (the synthetic no-sauce seam) is held to the values production data uses: the tolerance
 *  bands and the sauce target production uses for that same ingredient, and piece positions
 *  within the reference slot area. */
function invalidReferenceValueReason(recipe: Recipe, reference: ScoringReferencePizza): string | null {
  const production = getReferencePizza(recipe.id);
  if (production) {
    return reference === production || sameReferenceData(reference, production) ? null : REFERENCE_NOT_AUTHORITATIVE_REASON;
  }
  for (const group of reference.pieceGroups as readonly unknown[]) {
    const record = group as Record<string, unknown>;
    const matching = record.matching;
    if (typeof matching !== "object" || matching === null) return REFERENCE_MALFORMED_REASON;
    const { fullCreditRadius, zeroCreditRadius } = matching as Record<string, unknown>;
    if (!isApprovedToleranceBand(record.ingredientId, fullCreditRadius, zeroCreditRadius)) return REFERENCE_NOT_AUTHORITATIVE_REASON;
    for (const position of record.positions as readonly unknown[]) {
      const { x, y } = (typeof position === "object" && position !== null ? position : {}) as Record<string, unknown>;
      const distance = typeof x === "number" && typeof y === "number" ? Math.hypot(x - REFERENCE_CENTER, y - REFERENCE_CENTER) : NaN;
      if (!(distance <= REFERENCE_SLOT_MAX_RADIUS)) return REFERENCE_NOT_AUTHORITATIVE_REASON;
    }
  }
  const sauce = reference.sauce;
  if (sauce !== null && !isApprovedSauceTarget(sauce.ingredientId, sauce.quantity, sauce.coverage)) {
    return REFERENCE_NOT_AUTHORITATIVE_REASON;
  }
  return null;
}

/** Null when the Reference's shape and identity fit `recipe` (see `invalidReferenceReason`). */
function invalidReferenceShapeReason(recipe: Recipe, reference: ScoringReferencePizza): string | null {
  if (typeof reference !== "object" || reference === null) return REFERENCE_MALFORMED_REASON;
  if (reference.recipeId !== recipe.id) return REFERENCE_RECIPE_MISMATCH_REASON;
  if (!Array.isArray(reference.pieceGroups)) return REFERENCE_MALFORMED_REASON;
  // The Reference's nested contents must belong to this recipe too (Codex review on #271): a
  // matching `recipeId` with another recipe's piece groups or sauce would still be a hybrid score.
  // A malformed `recipe.requiredIngredients` is the Recipe component's own fail-closed case
  // (./recipeComponent.ts) -- it is not re-judged here, so its existing result stays unchanged.
  const requirements: unknown = recipe.requiredIngredients;
  if (!Array.isArray(requirements)) return null;
  const required = new Set(
    requirements.map((r: unknown) => (typeof r === "object" && r !== null ? (r as Record<string, unknown>).ingredientId : undefined)),
  );
  // Each placed requirement's `minCount` -- the target a Reference group's positions must equal
  // (every production Reference does; referencePizza.w1.test.ts pins it for W1).
  const minCountById = new Map<string, unknown>();
  for (const r of requirements as readonly unknown[]) {
    if (typeof r !== "object" || r === null) continue;
    const { ingredientId, minCount } = r as Record<string, unknown>;
    if (typeof ingredientId === "string") minCountById.set(ingredientId, minCount);
  }
  const seenGroupIds = new Set<string>();
  let groupCount = 0;
  for (const group of reference.pieceGroups as readonly unknown[]) {
    const ingredientId = typeof group === "object" && group !== null ? (group as Record<string, unknown>).ingredientId : undefined;
    if (typeof ingredientId !== "string") return REFERENCE_MALFORMED_REASON;
    if (!required.has(ingredientId)) return REFERENCE_RECIPE_MISMATCH_REASON;
    // A piece group is a placed (non-sauce) ingredient; a sauce there is a role-swapped Reference.
    const category = getIngredient(ingredientId)?.category;
    if (category === undefined || category === "sauce") return REFERENCE_MALFORMED_REASON;
    // The target count is the group's position count (./quantityComponent.ts); it must be the
    // recipe's own `minCount`, or a thinned-out Reference would give full Pieces/Quantity credit
    // for too few pieces (Codex review on #271).
    const positions = (group as Record<string, unknown>).positions;
    if (!Array.isArray(positions)) return REFERENCE_MALFORMED_REASON;
    if (positions.length !== minCountById.get(ingredientId)) return REFERENCE_RECIPE_MISMATCH_REASON;
    seenGroupIds.add(ingredientId);
    groupCount += 1;
  }
  // ...and cover every placed requirement exactly once (Codex review on #271): a missing or a
  // duplicated group would leave a required topping unscored or scored twice.
  const requiredPieceIds = [...required].filter(
    (id): id is string => typeof id === "string" && getIngredient(id)?.category !== "sauce",
  );
  if (groupCount !== seenGroupIds.size || requiredPieceIds.some((id) => !seenGroupIds.has(id))) {
    return REFERENCE_RECIPE_MISMATCH_REASON;
  }
  const sauce: unknown = reference.sauce;
  if (sauce === null) return null;
  if (typeof sauce !== "object" || sauce === undefined) return REFERENCE_MALFORMED_REASON;
  const target = sauce as Record<string, unknown>;
  // `ReferenceSauce.quantity`/`coverage` are normalized 0..1 targets; a finite value outside that
  // range is corrupted data, never silently clamped into a score.
  if (typeof target.ingredientId !== "string" || !isUnitNumber(target.quantity) || !isUnitNumber(target.coverage)) {
    return REFERENCE_MALFORMED_REASON;
  }
  if (!required.has(target.ingredientId)) return REFERENCE_RECIPE_MISMATCH_REASON;
  // The sauce target must name a sauce; a piece ingredient there is a role-swapped Reference.
  if (getIngredient(target.ingredientId)?.category !== "sauce") return REFERENCE_MALFORMED_REASON;
  return null;
}

function recipeRequiresSauce(recipe: Recipe): boolean {
  return recipe.requiredIngredients.some((req) => getIngredient(req.ingredientId)?.category === "sauce");
}

export interface ComputeScoringV2Options {
  /** TQ-1B: the Reference to score against. Omitted = `getReferencePizza(recipe.id)` (every
   *  production caller). Given (including `null` = no Reference) = used as-is -- the seam the
   *  no-sauce foundation is tested through before a production no-sauce recipe exists. */
  reference?: ScoringReferencePizza | null;
}

export function computeScoringV2(
  recipe: Recipe,
  pizza: PizzaState,
  options: ComputeScoringV2Options = {},
): ScoringV2Result {
  // Codex P1 blocker fix: `pizza` itself (not just its fields) is a public-API argument that
  // can violate its own TypeScript type at runtime -- a `null`/`undefined`/non-object value
  // here would throw on the very first `pizza.sauceDeposits` read below. Falls back to a
  // genuinely empty pizza rather than special-casing "no pizza" as its own result shape, so
  // every downstream component still sees one consistent, always-valid `PizzaState`.
  const safePizza: PizzaState = typeof pizza === "object" && pizza !== null ? pizza : createEmptyPizza();
  // B1: computed unconditionally, ahead of the Reference-availability gate below -- Bake needs
  // no Reference fixture (see ./bakeComponent.ts's file header), so it is real for all 7
  // recipes from this PR onward, even though `reference`-gated Sauce/Pieces/Recipe (and
  // therefore the whole result's `available`/`totalScore`) still are not, pending B2.
  const bake = scoreBakeComponentV2(safePizza.bakeResult, recipe.bakeTarget);
  // An `options` value that is not an object (`null`, a primitive -- only reachable from an
  // untyped caller) fails closed as "no Reference" rather than throwing on `in` (Codex review on #271).
  const optionsValue: unknown = options;
  const reference: ScoringReferencePizza | null | undefined =
    typeof optionsValue !== "object" || optionsValue === null
      ? null
      : "reference" in optionsValue
        ? (optionsValue as ComputeScoringV2Options).reference
        : getReferencePizza(recipe.id);

  // TQ-1B (Codex review on #271): an injected Reference is untrusted input like `pizza` -- a
  // Reference for another recipe, or one whose shape is broken (e.g. `sauce` missing rather than
  // an explicit `null`), fails closed here instead of producing a hybrid score or throwing.
  const unavailableReason = !reference ? REFERENCE_UNAVAILABLE_REASON : invalidReferenceReason(recipe, reference);
  if (!reference || unavailableReason !== null) {
    const reason = unavailableReason ?? REFERENCE_UNAVAILABLE_REASON;
    return {
      rulesetVersion: SCORING_V2_RULESET_VERSION,
      recipeId: recipe.id,
      available: false,
      unavailableReason: reason,
      totalScore: null,
      components: {
        sauce: { available: false, reason },
        pieces: { available: false, reason },
        recipe: { available: false, reason },
        bake,
        quantity: { available: false, reason },
      },
      weightProfile: null,
    };
  }

  // P0-2: `pizza.sauceDeposits` is the canonical authoritative deposit log -- populated by
  // COMMIT_SAUCE_DISPENSE for both PAINT and PAINT_TEMPORARY sauce profiles alike (see
  // ../../data/recipeSauceProfiles.ts; both interaction kinds go through the exact same
  // dispense/commit path in PizzaStage.tsx -- pinned by scoringV2.test.ts's PAINT_TEMPORARY
  // scoreable test).
  //
  // Codex P1 blocker fix: sanitized via ./boundary.ts's `sanitizeSauceDeposits` before ever
  // reaching `computeSauceMetrics` (../sauceField.ts, legacy Phase 4A-1A code this PR does not
  // modify) -- that primitive assumes a well-formed array and does not itself validate, so a
  // malformed `sauceDeposits` (non-array, or containing null/malformed/non-finite elements)
  // is normalized to a clean subset here, at the Scoring 2.0 boundary, instead.
  //
  // TQ-1B: a Reference without a sauce has no sauce target to compare against -- the component
  // does not apply (never a fabricated 0 or 100), and the NO_SAUCE profile below drops its weight.
  const referenceSauce = reference.sauce;
  const sauce =
    referenceSauce === null
      ? ({ available: false, reason: NO_SAUCE_NOT_APPLICABLE_REASON } as const)
      : scoreSauceComponentV2(computeSauceMetrics(sanitizeSauceDeposits(safePizza.sauceDeposits)), referenceSauce);
  const profile = SCORING_V2_WEIGHT_PROFILES[referenceSauce === null ? "NO_SAUCE" : "STANDARD"];
  const pieces = scorePiecesComponentV2(safePizza.toppings, reference.pieceGroups);
  const recipeComponent = scoreRecipeComponentV2(recipe, safePizza);
  const quantity = pieces.available
    ? scoreQuantityComponentV2(pieces.groups)
    : ({ available: false, reason: pieces.reason } as const);

  // Codex P1 blocker fix, Round 2: `pieces`/`recipeComponent` can now themselves be
  // `{ available: false }` -- ./piecesComponent.ts's and ./recipeComponent.ts's own strict
  // validation of their authoritative Reference/requirement data rejected it outright, rather
  // than scoring against a filtered-down subset. A `totalScore` partially built from an
  // unavailable component would be exactly the "normal-looking score built on corrupted
  // Reference data" the blocker exists to prevent, so the whole result fails closed here too
  // -- same shape as the P0-1 "no Reference fixture at all" branch above, just triggered by
  // "a Reference fixture exists, but its own data failed strict validation" instead.
  if (!pieces.available) {
    return {
      rulesetVersion: SCORING_V2_RULESET_VERSION,
      recipeId: recipe.id,
      available: false,
      unavailableReason: pieces.reason,
      totalScore: null,
      components: { sauce, pieces, recipe: recipeComponent, bake, quantity },
      weightProfile: null,
    };
  }
  if (!recipeComponent.available) {
    return {
      rulesetVersion: SCORING_V2_RULESET_VERSION,
      recipeId: recipe.id,
      available: false,
      unavailableReason: recipeComponent.reason,
      totalScore: null,
      components: { sauce, pieces, recipe: recipeComponent, bake, quantity },
      weightProfile: null,
    };
  }
  // B1: `bake` can only be unavailable here if `recipe.bakeTarget` itself is malformed (see
  // ./bakeComponent.ts) -- never happens for real authored recipes, but the same fail-closed
  // discipline as the two branches above applies: a `totalScore` cannot be built from a
  // malformed weighted input.
  if (!bake.available) {
    return {
      rulesetVersion: SCORING_V2_RULESET_VERSION,
      recipeId: recipe.id,
      available: false,
      unavailableReason: bake.reason,
      totalScore: null,
      components: { sauce, pieces, recipe: recipeComponent, bake, quantity },
      weightProfile: null,
    };
  }

  // TQ-1B: a Reference without a sauce for a recipe that *requires* a sauce is inconsistent data --
  // fail closed like the branches above rather than silently scoring without the sauce.
  if (referenceSauce === null && recipeRequiresSauce(recipe)) {
    return {
      rulesetVersion: SCORING_V2_RULESET_VERSION,
      recipeId: recipe.id,
      available: false,
      unavailableReason: NO_SAUCE_REFERENCE_MISMATCH_REASON,
      totalScore: null,
      components: { sauce, pieces, recipe: recipeComponent, bake, quantity },
      weightProfile: null,
    };
  }

  const weightedUnit = combineWeightedComponents(
    {
      sauce: sauce.available ? sauce.score : 0,
      pieces: pieces.score,
      recipe: recipeComponent.score,
      bake: bake.score,
    },
    profile,
  );
  // Issue #215: the quantity factor multiplies the whole weighted total (never rounded here --
  // stars, the Pitz band and Lunch Rush quality all read this unrounded value; only the final
  // display / `missionScore` round). `quantity.available` is guaranteed by the `pieces` gate
  // above; the fallback keeps the expression total. factor === 1 for an ideal-quantity pizza,
  // so its total is bit-identical to the pre-#215 formula.
  const quantityFactor = quantity.available ? quantity.factor : 1;
  const totalScore = safeUnit(weightedUnit * quantityFactor) * 100;

  return {
    rulesetVersion: SCORING_V2_RULESET_VERSION,
    recipeId: recipe.id,
    available: true,
    unavailableReason: null,
    totalScore,
    components: { sauce, pieces, recipe: recipeComponent, bake, quantity },
    weightProfile: profile.id,
  };
}

export type {
  ScoringV2Result,
  ScoringV2Components,
  ScoringV2Unavailable,
  SauceComponentV2,
  PiecesComponentV2,
  PieceGroupScoreV2,
  RecipeComponentV2,
  BakeComponentV2,
  BakeComponentV2Available,
  QuantityComponentV2,
  QuantityGroupDeviation,
} from "./types";

export { toLegacyScoreBreakdown } from "./toLegacyScoreBreakdown";
