/**
 * Discovery Hint 3.0 (Issue #238), H3-2: the legacy Hint Economy 1.0 ledger read as Selectable Hint
 * progress. UNWIRED: pure, read-only, and no reducer/UI calls it yet (H3-3 does).
 *
 * Authority: docs/reports/TETO_DISCOVERY-HINT-3_H3-2_Persistence-Migration_Result.md §8, and OD-H3-9
 * (Fresh Design §20): an Economy 1.0 buyer loses nothing already seen, is never charged again for it,
 * and never goes back down the price ladder.
 *
 * - The migration is a **derived view**, never a rewrite: `discoveryHintPurchases` (the legacy level)
 *   stays exactly as stored, and nothing is copied into `discoveryHintFacts` (the Hint 3.0 ledger).
 *   Reading it twice gives the same answer, so it is idempotent by construction.
 * - What the old sheet showed is read from `buildHintSteps` itself (the Hint 2.0 authority), never
 *   estimated: every ingredient a line at or below the level *named* becomes an `ing:` fact the
 *   player owns (`grantedFactIds`). The key it named is free under Hint 3.0 anyway.
 * - A line that named no ingredient -- H3's count + cheese line, the coarse
 *   「ソースはトマトじゃないみたい」 -- has no positive fact to become (OD-H3-7 forbids count and
 *   negative facts, and none is created). It is kept twice instead: as paid progress (`paidRungs` =
 *   the level, so the next price continues the ladder) and as the line itself
 *   (`grandfatheredSteps`), so the text the player already paid for is not lost at cutover. It is
 *   only ever this player's own purchased line, never sold again and never turned into a fact; how
 *   H3-4 shows it is an Owner decision (H3-2 Result Report §25).
 * - The level is clamped to the recipe's own last level (a later build may have stored a higher one),
 *   exactly like `purchasedHintLevel`. Malformed or absent -> H0 (nothing bought).
 */
import { getRecipe, type Recipe, type RecipeId } from "../../data/recipes";
import { purchasedHintLevel, type DiscoveryHintPurchases } from "./hintPurchase";
import { buildHintSteps, type HintStep } from "./hintSteps";
import { hintFactId, type HintFactId, type LegacyHintProgress } from "./selectableHint";

/** Hint 2.0 purchases only ever happened at Dex >= 1 (the Dex-0 Margherita onboarding is free and
 *  never written), so the paid lines are the Dex >= 1 lines. */
const PAID_CONTEXT = { discoveredCount: 1 } as const;

/** `LegacyHintProgress` as this module produces it: always well-typed (assignable to H3-1's
 *  deliberately `unknown`-typed input). */
export interface MigratedLegacyProgress extends LegacyHintProgress {
  paidRungs: number;
  grantedFactIds: readonly HintFactId[];
}

export interface LegacyHintMapping {
  recipeId: string;
  /** The stored level clamped to the recipe's last level (0 = nothing bought). */
  legacyLevel: number;
  /** The Hint 2.0 lines the player could read at that level (H0 included). */
  visibleSteps: readonly HintStep[];
  /** Every ingredient those lines named, as H3-1 fact ids, in line order. */
  grantedFactIds: readonly HintFactId[];
  /** Visible lines that named no ingredient: kept as paid progress, never turned into a fact. */
  progressOnlySteps: readonly HintStep[];
  /** What to hand H3-1 (`selectableHintPresentation` / `purchaseSelectableHint`). */
  legacy: MigratedLegacyProgress;
}

function lastLevel(recipe: Recipe): number {
  const steps = buildHintSteps(recipe, PAID_CONTEXT);
  return steps[steps.length - 1].level;
}

/** The legacy mapping of one recipe, or `null` for an unknown recipe id (fail closed). */
export function legacyHintMapping(
  recipeId: unknown,
  purchases: DiscoveryHintPurchases | unknown,
  recipes?: readonly Recipe[],
): LegacyHintMapping | null {
  if (typeof recipeId !== "string") return null;
  const recipe = recipes ? recipes.find((r) => r.id === recipeId) : getRecipe(recipeId as RecipeId);
  if (!recipe) return null;
  const ledger = typeof purchases === "object" && purchases !== null && !Array.isArray(purchases) ? (purchases as DiscoveryHintPurchases) : {};
  const own = Object.prototype.hasOwnProperty.call(ledger, recipe.id) ? ledger : {};
  const legacyLevel = purchasedHintLevel(own, recipe.id, lastLevel(recipe));
  const steps = buildHintSteps(recipe, PAID_CONTEXT);
  const visibleSteps = legacyLevel === 0 ? steps.slice(0, 1) : steps.filter((s) => s.level <= legacyLevel);
  const granted: HintFactId[] = [];
  for (const step of visibleSteps) {
    if (step.namedIngredientId && !granted.includes(hintFactId(step.namedIngredientId))) granted.push(hintFactId(step.namedIngredientId));
  }
  return {
    recipeId: recipe.id,
    legacyLevel,
    visibleSteps,
    grantedFactIds: granted,
    progressOnlySteps: visibleSteps.filter((s) => s.level > 0 && !s.namedIngredientId),
    legacy: { paidRungs: legacyLevel, grantedFactIds: granted },
  };
}

/** What one recipe's saved Hint 3.0 state is, read from both ledgers. */
export interface SelectableHintSavedState {
  /** The Hint 3.0 ledger for the recipe, as stored (unknown / future fact ids included -- H3-1
   *  ignores what it cannot use; the save never drops them). */
  purchasedFactIds: readonly string[];
  /** The Economy 1.0 progress (paid rungs + the facts its lines showed). */
  legacy: MigratedLegacyProgress;
  /** Already-purchased Hint 2.0 lines that named no ingredient (count + cheese, coarse sauce),
   *  carried verbatim so nothing the player paid for is lost. Display only; never a fact. */
  grandfatheredSteps: readonly HintStep[];
}

/**
 * H3-3's input for one recipe: the Hint 3.0 ledger plus the legacy progress, straight from the two
 * persisted fields. Neither is modified. Unknown recipe -> `null` (fail closed).
 */
export function selectableHintSavedState(
  recipeId: unknown,
  save: { discoveryHintPurchases: unknown; discoveryHintFacts: unknown },
  recipes?: readonly Recipe[],
): SelectableHintSavedState | null {
  const mapping = legacyHintMapping(recipeId, save.discoveryHintPurchases, recipes);
  if (!mapping) return null;
  const facts = save.discoveryHintFacts;
  const ledger = typeof facts === "object" && facts !== null && !Array.isArray(facts) ? (facts as Record<string, unknown>) : {};
  const stored = Object.prototype.hasOwnProperty.call(ledger, mapping.recipeId) ? ledger[mapping.recipeId] : undefined;
  return {
    purchasedFactIds: Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [],
    legacy: mapping.legacy,
    grandfatheredSteps: mapping.progressOnlySteps,
  };
}
