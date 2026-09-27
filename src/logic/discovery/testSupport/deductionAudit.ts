/**
 * Discovery Hint 4.0 DH4-1 (Issue #253): the machine-readable 25-recipe information audit, computed
 * from the real pure layer on the real Discovery Ladder. Test/analysis support only. The snapshot
 * lives in docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json (`deductionHint.audit.test.ts`).
 *
 * Each recipe is audited at the state where it becomes the hint target: the Dex holds the recipes of
 * the earlier ladder steps, and the owned set is the starter set plus every material unlocked so far
 * (`ownedAtLadderStep`).
 *
 * The ladder is passed in by the tests (`W1_25_DISCOVERY_LADDER`): the runtime wiring boundary
 * (../../discoveryLadder.test.ts) allows only its bridges to import the ladder module, so this
 * support file takes a structural ladder instead of importing it.
 */

/** The part of a Discovery Ladder this audit reads (structurally `DiscoveryLadder`). */
export interface AuditLadder {
  steps: readonly { step: number; ingredientIds: readonly string[]; keyRecipeId: string }[];
}
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../../data/ingredients";
import { ingredientAttributeFamily } from "../../../data/ingredientTaxonomy";
import { RECIPES, type Recipe } from "../../../data/recipes";
import { reserveAttributeAnswer, reserveAttributeAudit, structureTotalFact } from "../deductionHint";
import { hintKeyIngredientId } from "../hintSteps";
import { buildSelectableHintModel } from "../selectableHint";

/** Ladder order: margherita (the onboarding) first, then each step's key recipe. */
export function ladderOrder(ladder: AuditLadder): string[] {
  return ["margherita", ...ladder.steps.map((s) => s.keyRecipeId)];
}

/** Owned ingredients when the recipe at `index` of `ladderOrder` is the target. */
export function ownedAtLadderStep(index: number, ladder: AuditLadder): string[] {
  return [...STARTER_INGREDIENT_IDS, ...ladder.steps.filter((s) => s.step <= index).flatMap((s) => [...s.ingredientIds])];
}

const round = (n: number) => Math.round(n * 100) / 100;

export interface DeductionAuditRow {
  ladderIndex: number;
  recipeId: string;
  signature: { sauce: string[]; cheese: string[]; topping: string[] };
  total: number | null;
  key: string | null;
  sellable: string[];
  reserve: string | null;
  reserveFamily: string | null;
  owned: number;
  answer: string | null;
  /** privacyWorstCaseCandidates counts per level (the authority: OWNED, ∉ recipe, reserve included). */
  privacyWorstCaseCandidates: Record<string, number>;
  /** The same counts if the universe were the full runtime catalog (comparison only, not authority). */
  catalogComparisonCandidates: Record<string, number>;
  /** Information value in bits at the endgame (only the reserve unknown): log2(pool before / after). */
  bits: { material: number; attribute: number } | null;
}

function signatureOf(recipe: Recipe) {
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  const by = (c: string) => ids.filter((id) => getIngredient(id)?.category === c).sort();
  return { sauce: by("sauce"), cheese: by("cheese"), topping: by("topping") };
}

export function buildDeductionAudit(ladder: AuditLadder): DeductionAuditRow[] {
  const allIds = INGREDIENTS.map((i) => i.id);
  return ladderOrder(ladder).map((recipeId, ladderIndex) => {
    const recipe = RECIPES.find((r) => r.id === recipeId)!;
    const ctx = { discoveredCount: ladderIndex, ownedIngredientIds: ownedAtLadderStep(ladderIndex, ladder) };
    const model = buildSelectableHintModel(recipeId, ctx)!;
    const audit = reserveAttributeAudit(recipeId, ctx);
    const catalogAudit = reserveAttributeAudit(recipeId, { ...ctx, ownedIngredientIds: allIds });
    const answer = reserveAttributeAnswer(recipeId, ctx);
    const counts = (a: typeof audit) => Object.fromEntries((a?.levels ?? []).map((l) => [l.level, l.privacyWorstCaseCandidates.length]));
    let bits: DeductionAuditRow["bits"] = null;
    if (audit && answer) {
      // Endgame: every other recipe ingredient known, so the reserve is one of the owned non-recipe
      // ingredients or itself. A material fact pins it; the attribute answer leaves its level's pool.
      const recipeIds = new Set<string>(recipe.requiredIngredients.map((r) => r.ingredientId));
      const base = ctx.ownedIngredientIds.filter((id) => !recipeIds.has(id)).length + 1;
      const level = audit.levels.find((l) => l.level === answer.level);
      const after = level ? level.privacyWorstCaseCandidates.length : base;
      bits = { material: round(Math.log2(base)), attribute: round(Math.log2(base / after)) };
    }
    return {
      ladderIndex,
      recipeId,
      signature: signatureOf(recipe),
      total: structureTotalFact(recipeId, ctx)?.total ?? null,
      key: hintKeyIngredientId(recipe),
      sellable: model.purchasableFacts.map((f) => f.ingredientId),
      reserve: model.reservedIngredientId,
      reserveFamily: ingredientAttributeFamily(model.reservedIngredientId),
      owned: ctx.ownedIngredientIds.length,
      answer: answer?.factId ?? null,
      privacyWorstCaseCandidates: counts(audit),
      catalogComparisonCandidates: counts(catalogAudit),
      bits,
    };
  });
}
