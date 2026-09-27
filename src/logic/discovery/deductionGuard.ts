/**
 * Discovery Hint 4.0 (Issue #253), DH4-2A: the privacy guard around the DH4-1 Deduction Hint pure
 * layer. UNWIRED: no reducer, sheet, save, Pitz, flag or near-miss reads this module (DH4-2B wires
 * it behind the DEV / Preview flag). Nothing here is priced (OD-DH4-2-5).
 *
 * Authority: the DH4-2 Owner Decisions OD-DH4-2-1..13 (Final Owner Decision Gate, audit commit
 * 2f0ffaa): docs/reports/TETO_DISCOVERY-HINT-4_DH4-2_Pre-Implementation-Audit.md §0, §4, §5.3.
 *
 * ## Why a guard (OD-DH4-2-2)
 *
 * DH4-1 (`attributeAnswerForReserve`, ./deductionHint.ts) picks the answer LEVEL from the reserve's
 * own class. A player who knows the rule and knows the ingredient total (bought, or free through
 * near-miss ADD_ONE) can test every remaining owned ingredient x: "would x, as the reserve, have
 * produced this level?". On the 25-recipe runtime that names the Rule W reserve in 29 of 300
 * target x ladder-inventory states (bismarck, funghi, breakfast-pizza, meat-lovers,
 * quattro-formaggi). The DH4-1 answer function is NOT changed; this module wraps it.
 *
 * - **Hypothetical reserves H.** Every ingredient the player cannot rule out as the missing one when
 *   every other ingredient is known: the reserve, plus every owned catalog ingredient outside the
 *   recipe, under the one-sauce prior (every runtime pizza has exactly one sauce): when the rest of
 *   the recipe has a sauce, no sauce is a hypothesis; when it has none, only sauces are.
 * - **Partition guard.** For every x in H, h(x) = the DH4-1 answer of the hypothetical recipe
 *   (recipe - reserve + x) whose reserve is x. When every answer class { x : h(x) = a } has at
 *   least MIN_ATTRIBUTE_CANDIDATES members, the DH4-1 answer is given; otherwise the strict answer
 *   below is given. The branch depends on H only, and H is the same set for every hypothesis, so
 *   the answer level can never single one out.
 * - **Strict ("level before value") answer.** Over W = the reserve plus the owned catalog
 *   ingredients outside the recipe (sauces dropped when the recipe has another sauce), choose the
 *   finest level (family -> group -> category) at which EVERY member of W shares its class with at
 *   least one other member (classes are total: an ingredient with no family or group is classed by
 *   its category, never guessed), then answer the reserve's class there; else existence.
 * - **TC-G (OD-DH4-2-1).** The topping total may be told only when it is >= 1 and every category
 *   side present in W (topping / cheese / sauce) has at least 2 members. W-only; never for 0.
 *
 * The taxonomy is not changed for privacy (OD-DH4-2-3). Ingredients without a family row are
 * classed by category only; nothing is inferred from names. Lookups use arrays, Sets and Maps.
 */
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { ingredientAttributeFamily, ingredientAttributeGroup } from "../../data/ingredientTaxonomy";
import { RECIPES, type Recipe } from "../../data/recipes";
import {
  attributeAnswerForReserve,
  INGREDIENT_TOTAL_FACT_ID,
  MIN_ATTRIBUTE_CANDIDATES,
  ownedCatalogIds,
  structureTotalFact,
  type AttributeContext,
  type ReserveAttributeAnswer,
} from "./deductionHint";
import { buildSelectableHintModel } from "./selectableHint";

/** OD-DH4-2-1: the optional structure fact, stored only when it was told. */
export const TOPPING_TOTAL_FACT_ID = "meta:topping-total";

/** The inputs of one (real or hypothetical) reserve. Ids are catalog ids. */
export interface ReserveParts {
  recipeIngredientIds: readonly string[];
  reserveId: string;
  /** Owned catalog ids (already normalised). */
  owned: readonly string[];
}

const CATALOG_ORDER = new Map(INGREDIENTS.map((ingredient, index) => [ingredient.id, index]));

function byCatalogOrder(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort((a, b) => (CATALOG_ORDER.get(a) ?? 0) - (CATALOG_ORDER.get(b) ?? 0));
}

function categoryOf(id: string): string | null {
  return getIngredient(id)?.category ?? null;
}

function distinctIngredientIds(recipe: Recipe): string[] {
  return [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
}

/** A target's real reserve parts, or `null` (unknown recipe, Dex-0 onboarding, non-catalog data). */
export function targetReserveParts(recipeId: unknown, context: AttributeContext, recipes: readonly Recipe[] = RECIPES): ReserveParts | null {
  const model = buildSelectableHintModel(recipeId, context, recipes);
  if (!model || model.onboarding || model.reservedIngredientId === null) return null;
  const recipe = recipes.find((r) => r.id === model.recipeId);
  if (!recipe) return null;
  return {
    recipeIngredientIds: distinctIngredientIds(recipe),
    reserveId: model.reservedIngredientId,
    owned: byCatalogOrder(ownedCatalogIds(context.ownedIngredientIds)),
  };
}

function knownPart(parts: ReserveParts): string[] {
  return parts.recipeIngredientIds.filter((id) => id !== parts.reserveId);
}

/** W: the reserve plus the owned ingredients outside the recipe, sauces dropped when the recipe has
 *  another sauce (the one-sauce prior). Catalog order after the reserve. */
export function privacyPartitionUniverse(parts: ReserveParts): string[] {
  const inRecipe = new Set(parts.recipeIngredientIds);
  const otherSauce = knownPart(parts).some((id) => categoryOf(id) === "sauce");
  const keep = (id: string) => categoryOf(id) !== null && !(otherSauce && categoryOf(id) === "sauce");
  return [parts.reserveId, ...parts.owned.filter((id) => !inRecipe.has(id))].filter(keep);
}

/** H: every hypothetical reserve (see the module header). Always contains the real reserve. */
export function hypotheticalReserves(parts: ReserveParts): string[] {
  const known = knownPart(parts);
  const knownSet = new Set(known);
  const knownHasSauce = known.some((id) => categoryOf(id) === "sauce");
  const candidates = byCatalogOrder([parts.reserveId, ...parts.owned]).filter((id) => !knownSet.has(id) && categoryOf(id) !== null);
  return candidates.filter((id) => (categoryOf(id) === "sauce") !== knownHasSauce);
}

/** The ReserveParts of hypothesis x: the same known part, x as the missing reserve. */
export function hypotheticalParts(parts: ReserveParts, x: string): ReserveParts {
  return { recipeIngredientIds: [...knownPart(parts), x], reserveId: x, owned: parts.owned };
}

function dh41Answer(parts: ReserveParts): ReserveAttributeAnswer | null {
  return attributeAnswerForReserve({ recipeIngredientIds: parts.recipeIngredientIds, reserveId: parts.reserveId, ownedIngredientIds: parts.owned });
}

type StrictLevel = "family" | "group" | "category";

/** Total class of an ingredient at a level; no family / group -> its category (never guessed). */
function classOf(level: StrictLevel, id: string): string {
  const category = categoryOf(id) ?? "unknown";
  if (level !== "category" && category === "topping") {
    const family = ingredientAttributeFamily(id);
    if (family) return level === "family" ? `family:${family}` : `group:${ingredientAttributeGroup(id)}`;
  }
  return `category:${category}`;
}

function answerForClass(cls: string): ReserveAttributeAnswer {
  const [level, value] = cls.split(":");
  if (level === "family") return { level: "family", family: value as never, factId: `attr:family:${value}` as never };
  if (level === "group") return { level: "group", group: value as never, factId: `attr:group:${value}` as never };
  return { level: "category", category: value as never, factId: `attr:category:${value}` as never };
}

/** The strict ("level before value") answer for these parts. The level depends on W only. */
export function strictAnswerForParts(parts: ReserveParts): ReserveAttributeAnswer {
  const w = privacyPartitionUniverse(parts);
  for (const level of ["family", "group", "category"] as const) {
    const sizes = new Map<string, number>();
    for (const id of w) sizes.set(classOf(level, id), (sizes.get(classOf(level, id)) ?? 0) + 1);
    if ([...sizes.values()].every((n) => n >= MIN_ATTRIBUTE_CANDIDATES)) return answerForClass(classOf(level, parts.reserveId));
  }
  return { level: "existence", factId: "attr:existence" };
}

/** Whether the DH4-1 answer may be used: every DH4-1 answer class over H has >= 2 members. H-only. */
export function partitionAllowsDh41(parts: ReserveParts): boolean {
  const sizes = new Map<string, number>();
  for (const x of hypotheticalReserves(parts)) {
    const answer = dh41Answer(hypotheticalParts(parts, x));
    const key = answer ? answer.factId : "none";
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }
  return [...sizes.values()].every((n) => n >= MIN_ATTRIBUTE_CANDIDATES);
}

/** OD-DH4-2-2: the guarded answer for any parts (real or hypothetical). */
export function guardedAnswerForParts(parts: ReserveParts): ReserveAttributeAnswer | null {
  if (categoryOf(parts.reserveId) === null) return null;
  return partitionAllowsDh41(parts) ? dh41Answer(parts) : strictAnswerForParts(parts);
}

/**
 * OD-DH4-2-2: the player-facing 特徴 answer about the Rule W reserve, or `null` when the recipe is
 * not a target. Deterministic (any owned order or duplication), never a name or id, no count.
 */
export function guardedReserveAttributeAnswer(
  recipeId: unknown,
  context: AttributeContext,
  recipes: readonly Recipe[] = RECIPES,
): ReserveAttributeAnswer | null {
  const parts = targetReserveParts(recipeId, context, recipes);
  return parts ? guardedAnswerForParts(parts) : null;
}

function toppingTotalOf(recipeIngredientIds: readonly string[]): number {
  return recipeIngredientIds.filter((id) => categoryOf(id) === "topping").length;
}

/** OD-DH4-2-1 TC-G for any parts: T >= 1 and every category side present in W has >= 2 members. */
export function toppingClauseAllowedForParts(parts: ReserveParts): boolean {
  if (toppingTotalOf(parts.recipeIngredientIds) < 1) return false;
  const sides = new Map<string, number>();
  for (const id of privacyPartitionUniverse(parts)) sides.set(categoryOf(id)!, (sides.get(categoryOf(id)!) ?? 0) + 1);
  return [...sides.values()].every((n) => n >= MIN_ATTRIBUTE_CANDIDATES);
}

export function toppingClauseAllowed(recipeId: unknown, context: AttributeContext, recipes: readonly Recipe[] = RECIPES): boolean {
  const parts = targetReserveParts(recipeId, context, recipes);
  return parts !== null && toppingClauseAllowedForParts(parts);
}

export type StructureFactId = typeof INGREDIENT_TOTAL_FACT_ID | typeof TOPPING_TOTAL_FACT_ID;

export interface StructureAnswer {
  /** Always the total; the topping total only when TC-G passes. Fixed order. */
  factIds: readonly StructureFactId[];
  total: number;
  /** `null` when the clause is not told (never 0). */
  toppingTotal: number | null;
}

/**
 * OD-DH4-2-1 (D-prime): the structure answer. The total is always told; the topping total only when
 * TC-G passes. No remaining count, no per-category count, never a 0. `null` = not a target.
 */
export function structureAnswer(recipeId: unknown, context: AttributeContext, recipes: readonly Recipe[] = RECIPES): StructureAnswer | null {
  const total = structureTotalFact(recipeId, context, recipes);
  const parts = targetReserveParts(recipeId, context, recipes);
  if (!total || !parts) return null;
  const allowed = toppingClauseAllowedForParts(parts);
  return {
    factIds: allowed ? [INGREDIENT_TOTAL_FACT_ID, TOPPING_TOTAL_FACT_ID] : [INGREDIENT_TOTAL_FACT_ID],
    total: total.total,
    toppingTotal: allowed ? toppingTotalOf(parts.recipeIngredientIds) : null,
  };
}
