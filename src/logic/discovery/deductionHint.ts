/**
 * Discovery Hint 4.0 (Issue #253), DH4-1: the Deduction Hint pure layer. UNWIRED: no reducer, sheet,
 * save, Pitz or near-miss reads this module yet (DH4-2 wires it). Nothing here is priced (OD-DH4-9).
 *
 * Authority: Issue #253 OD-DH4-1..10 and the Fresh Design
 * docs/reports/TETO_DISCOVERY-HINT-4_DEDUCTION-HINTS_Fresh-Design.md. It builds on the Hint 3.0
 * authority without changing it: the target model, the free key and the Rule W reserve all come from
 * `buildSelectableHintModel` (./selectableHint.ts).
 *
 * Two new hint families next to Hint 3.0's material facts (`ing:`):
 *
 * - **構成ヒント (structure), OD-DH4-2.** Only the recipe's *total* number of distinct ingredients
 *   (`meta:ingredient-total`). There is no remaining count, no per-category count and so no
 *   "0 kinds" statement. The total is never 0, so it is never a negative fact.
 *
 * - **特徴ヒント (attribute), OD-DH4-3/5.** A positive statement about the Rule W reserve (the one
 *   ingredient Hint 3.0 never sells), never its name. The system chooses it deterministically;
 *   there are no yes/no questions. The answer is the finest level that passes the k >= 2 guard:
 *
 *     family (../../data/ingredientTaxonomy.ts) -> group -> category -> existence
 *
 *   Existence is the floor. "There is one more ingredient" is always true under Rule W, so it
 *   carries nothing that is not already implied.
 *
 * ## Candidate universe (the k >= 2 guard) — the authority
 *
 * `candidates(level) = { reserve } ∪ { i ∈ OWNED : i matches the level, i ∉ recipe }`
 *
 * - **OWNED** (`ownedIngredientIds`): the player's owned ingredients that exist in the catalog,
 *   de-duplicated. The target is always makeable from owned ingredients (its H0 line says so), so an
 *   ingredient the player does not own is not a real decoy. Unlocked-but-unbought, catalog-wide or
 *   progression-reachable universes would all inflate k with decoys the player can rule out.
 * - **∉ recipe**: every other ingredient of the recipe is excluded, *even the ones the player does
 *   not know yet*. This is the worst case of what the player can come to know about this recipe:
 *   every other ingredient is a sellable material fact or the free key. Future purchases for this
 *   recipe therefore can never shrink the set.
 * - **Monotonic safety.** Ownership only grows (a purchase appends; only Full Reset clears it, and
 *   Full Reset also clears every hint ledger), and nothing a player buys for the recipe can remove
 *   a decoy. So an answer that passed k >= 2 when it was given stays at k >= 2 afterwards, at every
 *   later progression state.
 * - The level chosen depends only on the recipe and the owned set. It never depends on what the
 *   player already bought, and the result carries no candidate count (OD-DH4-10: no FREE LEAK).
 *
 * Inputs from outside are untrusted: an unknown recipe or the Dex-0 onboarding returns `null` (not
 * a target), and owned ids that are not catalog ingredients are ignored. Lookups use arrays, Sets and
 * Maps, never object keys.
 */
import { getIngredient } from "../../data/ingredients";
import {
  attributeFamily,
  attributeGroup,
  ingredientAttributeFamily,
  ingredientAttributeGroup,
  type AttributeFamilyId,
  type AttributeGroupId,
} from "../../data/ingredientTaxonomy";
import { RECIPES, type Recipe } from "../../data/recipes";
import type { DiscoveryHintPurchases } from "./hintPurchase";
import { legacyHintMapping } from "./hintFactMigration";
import { buildSelectableHintModel, type HintCategory } from "./selectableHint";

/** OD-DH4-2: the one structure fact. */
export const INGREDIENT_TOTAL_FACT_ID = "meta:ingredient-total";

/** OD-DH4-3: an attribute answer must leave at least this many candidates, the reserve included. */
export const MIN_ATTRIBUTE_CANDIDATES = 2;

export interface StructureTotalFact {
  id: typeof INGREDIENT_TOTAL_FACT_ID;
  /** Distinct ingredients of the recipe (sauce + cheese + topping). Always >= 1. */
  total: number;
}

export type AttributeAnswerLevel = "family" | "group" | "category" | "existence";

export type ReserveAttributeAnswer =
  | { level: "family"; family: AttributeFamilyId; factId: `attr:reserve:family:${AttributeFamilyId}` }
  | { level: "group"; group: AttributeGroupId; factId: `attr:reserve:group:${AttributeGroupId}` }
  | { level: "category"; category: HintCategory; factId: `attr:reserve:category:${HintCategory}` }
  | { level: "existence"; factId: "attr:reserve:existence" };

export interface DeductionContext {
  /** The Dex discovered count (Dex 0 + margherita is the free onboarding, never a target here). */
  discoveredCount: number;
}

export interface AttributeContext extends DeductionContext {
  /** The player's owned ingredient ids (untrusted: anything that is not a catalog id is ignored). */
  ownedIngredientIds: readonly unknown[] | unknown;
}

function findRecipe(recipeId: unknown, recipes: readonly Recipe[]): Recipe | null {
  if (typeof recipeId !== "string") return null;
  return recipes.find((r) => r.id === recipeId) ?? null;
}

function distinctIngredientIds(recipe: Recipe): string[] {
  return [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
}

/** OD-DH4-2: the recipe's total ingredient count, or `null` when it is not a target. */
export function structureTotalFact(
  recipeId: unknown,
  context: DeductionContext,
  recipes: readonly Recipe[] = RECIPES,
): StructureTotalFact | null {
  const model = buildSelectableHintModel(recipeId, context, recipes);
  const recipe = findRecipe(recipeId, recipes);
  if (!model || model.onboarding || !recipe) return null;
  return { id: INGREDIENT_TOTAL_FACT_ID, total: distinctIngredientIds(recipe).length };
}

function ownedCatalogIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const value of raw) if (typeof value === "string" && getIngredient(value)) out.add(value);
  return [...out];
}

type LevelMatch = (ingredientId: string) => boolean;

interface ReserveLevels {
  reserve: string;
  recipeIds: ReadonlySet<string>;
  owned: readonly string[];
  levels: readonly { answer: ReserveAttributeAnswer; matches: LevelMatch }[];
}

function reserveLevels(recipeId: unknown, context: AttributeContext, recipes: readonly Recipe[]): ReserveLevels | null {
  const model = buildSelectableHintModel(recipeId, context, recipes);
  const recipe = findRecipe(recipeId, recipes);
  if (!model || model.onboarding || !recipe || model.reservedIngredientId === null) return null;
  const reserve = model.reservedIngredientId;
  const category = getIngredient(reserve)?.category;
  if (!category) return null;
  const levels: { answer: ReserveAttributeAnswer; matches: LevelMatch }[] = [];
  const sameCategory = (id: string) => getIngredient(id)?.category === category;
  const family = category === "topping" ? ingredientAttributeFamily(reserve) : null;
  if (family) {
    const group = ingredientAttributeGroup(reserve)!;
    levels.push({
      answer: { level: "family", family, factId: `attr:reserve:family:${family}` },
      matches: (id) => sameCategory(id) && ingredientAttributeFamily(id) === family,
    });
    levels.push({
      answer: { level: "group", group, factId: `attr:reserve:group:${group}` },
      matches: (id) => sameCategory(id) && ingredientAttributeGroup(id) === group,
    });
  }
  levels.push({ answer: { level: "category", category, factId: `attr:reserve:category:${category}` }, matches: sameCategory });
  return { reserve, recipeIds: new Set(distinctIngredientIds(recipe)), owned: ownedCatalogIds(context.ownedIngredientIds), levels };
}

function candidates(levels: ReserveLevels, matches: LevelMatch): string[] {
  const decoys = levels.owned.filter((id) => !levels.recipeIds.has(id) && matches(id));
  return [levels.reserve, ...decoys];
}

/**
 * OD-DH4-3/5: the attribute answer about the Rule W reserve, or `null` when the recipe is not a
 * target (unknown id, the Dex-0 onboarding). Deterministic: the same recipe and the same owned set
 * give the same answer, in any owned order. It never names or ids the reserve and carries no count.
 */
export function reserveAttributeAnswer(
  recipeId: unknown,
  context: AttributeContext,
  recipes: readonly Recipe[] = RECIPES,
): ReserveAttributeAnswer | null {
  const levels = reserveLevels(recipeId, context, recipes);
  if (!levels) return null;
  for (const level of levels.levels) {
    if (candidates(levels, level.matches).length >= MIN_ATTRIBUTE_CANDIDATES) return level.answer;
  }
  return { level: "existence", factId: "attr:reserve:existence" };
}

/**
 * AUDIT ONLY (tests and the information audit; never presentation, never a view model): the
 * candidate ids behind every level, the reserve included. Exposing these to a player would be a
 * FREE LEAK (OD-DH4-10).
 */
export function reserveAttributeAudit(
  recipeId: unknown,
  context: AttributeContext,
  recipes: readonly Recipe[] = RECIPES,
): { reserve: string; levels: { level: AttributeAnswerLevel; candidates: string[] }[] } | null {
  const levels = reserveLevels(recipeId, context, recipes);
  if (!levels) return null;
  return {
    reserve: levels.reserve,
    levels: levels.levels.map((l) => ({ level: l.answer.level, candidates: candidates(levels, l.matches) })),
  };
}

const CATEGORY_JA: Readonly<Record<HintCategory, string>> = { sauce: "ソース", cheese: "チーズ", topping: "トッピング" };

/** Provisional player copy (final wording is DH4-2's). Positive statements only. */
export function deductionHintTextJa(fact: StructureTotalFact | ReserveAttributeAnswer): string {
  if ("total" in fact) return `このピザは全部で${fact.total}種類の材料を使うよ`;
  switch (fact.level) {
    case "family":
      return `まだわかっていない材料に、${attributeFamily(fact.family).labelJa}の仲間があるよ`;
    case "group":
      return `まだわかっていない材料に、${attributeGroup(fact.group).labelJa}の仲間があるよ`;
    case "category":
      return `まだわかっていない${CATEGORY_JA[fact.category]}があるよ`;
    case "existence":
      return "まだわかっていない材料があるよ";
  }
}

/**
 * OD-DH4-8: a legacy Economy 1.0 buyer whose visible lines include the count line
 * (「材料は全部で○種類。…」) already owns the total-count hint for that recipe, so it is never sold
 * again. Read-only: the legacy ledger is not changed and grandfatheredSteps stay display-only.
 */
export function legacyOwnsIngredientTotal(
  recipeId: unknown,
  discoveryHintPurchases: DiscoveryHintPurchases | unknown,
  recipes?: readonly Recipe[],
): boolean {
  const mapping = legacyHintMapping(recipeId, discoveryHintPurchases, recipes);
  return !!mapping && mapping.visibleSteps.some((step) => step.axis === "COUNT_CHEESE");
}

/**
 * Whether the total-count hint is already owned for `recipeId`, read from both persisted ledgers:
 * the legacy grant (OD-DH4-8) or a stored `meta:ingredient-total` id in the Hint 3.0 fact ledger
 * (which already keeps unknown ids verbatim, H3-2). Read-only; no schema change.
 */
export function ingredientTotalOwned(
  recipeId: unknown,
  save: { discoveryHintPurchases: unknown; discoveryHintFacts: unknown },
  recipes?: readonly Recipe[],
): boolean {
  if (legacyOwnsIngredientTotal(recipeId, save.discoveryHintPurchases, recipes)) return true;
  if (typeof recipeId !== "string") return false;
  const facts = save.discoveryHintFacts;
  if (typeof facts !== "object" || facts === null || Array.isArray(facts)) return false;
  if (!Object.prototype.hasOwnProperty.call(facts, recipeId)) return false;
  const stored = (facts as Record<string, unknown>)[recipeId];
  return Array.isArray(stored) && stored.includes(INGREDIENT_TOTAL_FACT_ID);
}
