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
 * - **Hypothetical reserves H** (hardened at the DH4-2B Pre-Implementation Gate, P2-1). Every owned
 *   ingredient the player cannot rule out as the missing one when every other ingredient is known:
 *   outside the known part, not the key, Rule W-consistent (its category ranks at least as high
 *   as every non-key known ingredient) and key-consistent (not unlocked later than the free key,
 *   which would have made it the key: the Codex review of PR #267). No catalog prior is assumed: the DH4-2A one-sauce prior
 *   dropped the real reserve of a sauceless recipe from H, so an answer class could name it.
 *   H depends on the known part, the key and the owned set only: it is the same set for every
 *   hypothesis. **Fail closed:** when the real reserve is not in H (not owned; never at runtime,
 *   where every target is DISCOVERABLE), the answer is existence and the clause is not told.
 * - **Purchase timing (Owner Decision T1a, P1-1).** H and every DH4-1 decoy come only from the
 *   ingredients owned when the target became makeable (`makeablePrefix`, rebuilt from the
 *   acquisition order of `ownedIngredientIds`). A player who saw the target knows anything bought
 *   later is not the reserve, so a later purchase never makes an answer finer. An order that cannot
 *   be trusted fails closed (`ownedAcquisitionOrder` -> not a target).
 * - **Partition guard.** For every x in H, h(x) = the DH4-1 answer of the hypothetical recipe
 *   (recipe - reserve + x) whose reserve is x. When every answer class { x : h(x) = a } has at
 *   least MIN_ATTRIBUTE_CANDIDATES members **within each category side** (so any category-defined
 *   prior an attacker adds still leaves >= 2), the DH4-1 answer is given; otherwise the strict
 *   answer below is given. The branch depends on H only.
 * - **Strict ("level before value") answer.** Over H, choose the finest level
 *   (family -> group -> category) at which EVERY member of H shares its class with at least one
 *   other member (classes are total: an ingredient with no family or group is classed by its
 *   category, never guessed), then answer the reserve's class there; else existence.
 * - **TC-G (OD-DH4-2-1, hardened for P2-2).** The topping total may be told only when every
 *   hypothesis in H gives a topping total >= 1 (so it is never 0 and a missing clause never implies
 *   0) and every category side present in H has at least 2 members. H-only.
 *
 * The taxonomy is not changed for privacy (OD-DH4-2-3). Ingredients without a family row are
 * classed by category only; nothing is inferred from names. Lookups use arrays, Sets and Maps.
 */
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { ingredientAttributeFamily, ingredientAttributeGroup } from "../../data/ingredientTaxonomy";
import { RECIPES, type Recipe } from "../../data/recipes";
import {
  attributeAnswerForReserve,
  INGREDIENT_TOTAL_FACT_ID,
  MIN_ATTRIBUTE_CANDIDATES,
  structureTotalFact,
  type AttributeContext,
  type ReserveAttributeAnswer,
} from "./deductionHint";
import { recipeKeyStep } from "../../state/recipeChapters";
import { buildSelectableHintModel } from "./selectableHint";

/** OD-DH4-2-1: the optional structure fact, stored only when it was told. */
export const TOPPING_TOTAL_FACT_ID = "meta:topping-total";

/** The inputs of one (real or hypothetical) reserve. Ids are catalog ids. */
export interface ReserveParts {
  recipeIngredientIds: readonly string[];
  reserveId: string;
  /** The recipe's free key (public: the player gets it for free), or `null` when it has none. */
  keyId: string | null;
  /** Owned catalog ids in ACQUISITION ORDER (`ownedIngredientIds` order: the starters, then every
   *  later acquisition appended; see `ownedAcquisitionOrder`). Only the prefix owned when the
   *  target became makeable is ever read (`makeablePrefix`, Owner Decision T1a). */
  owned: readonly string[];
}

const CATALOG_ORDER = new Map(INGREDIENTS.map((ingredient, index) => [ingredient.id, index]));

function byCatalogOrder(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort((a, b) => (CATALOG_ORDER.get(a) ?? 0) - (CATALOG_ORDER.get(b) ?? 0));
}

function categoryOf(id: string): string | null {
  return getIngredient(id)?.category ?? null;
}

/** Rule W's category order (OD-H3-5): the reserve is in the highest category among the non-key
 *  ingredients. A category this build does not rank is `null` (fail closed). */
const RULE_W_RANK = new Map<string, number>([
  ["sauce", 0],
  ["cheese", 1],
  ["topping", 2],
]);

function ruleWRank(id: string): number | null {
  const category = categoryOf(id);
  return category === null ? null : (RULE_W_RANK.get(category) ?? null);
}

function distinctIngredientIds(recipe: Recipe): string[] {
  return [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
}

/** A target's real reserve parts, or `null` (unknown recipe, Dex-0 onboarding, non-catalog data, or
 *  a recipe the owned set cannot make). */
export function targetReserveParts(recipeId: unknown, context: AttributeContext, recipes: readonly Recipe[] = RECIPES): ReserveParts | null {
  const model = buildSelectableHintModel(recipeId, context, recipes);
  if (!model || model.onboarding || model.reservedIngredientId === null) return null;
  const recipe = recipes.find((r) => r.id === model.recipeId);
  if (!recipe) return null;
  const owned = ownedAcquisitionOrder(context.ownedIngredientIds);
  // T1a: an acquisition order that cannot be trusted is not guessed: nothing is answered.
  if (owned === null) return null;
  const recipeIngredientIds = distinctIngredientIds(recipe);
  // Precondition (DH4-2B Gate, P3): a hint target is DISCOVERABLE, so every ingredient is owned. An
  // input that breaks it is not a target: nothing is answered (no existence, no clause), because
  // answering would split owned from unowned hypotheses.
  const ownedSet = new Set(owned);
  if (!recipeIngredientIds.every((id) => ownedSet.has(id))) return null;
  return { recipeIngredientIds, reserveId: model.reservedIngredientId, keyId: model.freeFacts[0]?.ingredientId ?? null, owned };
}

/**
 * Owner Decision T1a (P1-1, purchase timing): the owned ids in acquisition order, or `null` when that
 * order cannot be trusted. The APPEND-ORDER INVARIANT this relies on (docs/reports/
 * TETO_DISCOVERY-HINT-4_DH4-2B_Pre-Implementation-Gate.md §11, pinned by
 * src/state/persistence.ownedOrder.test.ts): `ownedIngredientIds` lists the starter ingredients
 * first, then every later acquisition in the order it happened; every writer appends, and load /
 * migration / merge never sort or move a known id earlier.
 *
 * Fail closed (never guess a candidate): not an array, a non-string or non-catalog entry, a
 * duplicate, or a starter after a non-starter makes the order ambiguous -> `null`.
 */
export function ownedAcquisitionOrder(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  let nonStarterSeen = false;
  for (const value of raw) {
    if (typeof value !== "string" || !getIngredient(value) || seen.has(value)) return null;
    const starter = STARTER_IDS.has(value);
    if (starter && nonStarterSeen) return null;
    if (!starter) nonStarterSeen = true;
    seen.add(value);
    out.push(value);
  }
  return out;
}

const STARTER_IDS = new Set(STARTER_INGREDIENT_IDS);

/**
 * Owner Decision T1a: the ingredients owned when the target became makeable -- the acquisition-order
 * prefix up to the last-acquired ingredient of the KNOWN part (everything but the reserve, the key
 * included). The starters count as acquired together at the start, so the prefix always holds them. Anything acquired later cannot be the reserve for a player who saw the target, so it is
 * never a hypothesis or a decoy.
 *
 * The prefix is taken from the known part, not from the whole recipe, so it is the same for every
 * hypothesis (the known part is): the guard stays H-only. When the real reserve was itself acquired
 * after every other ingredient of the recipe (the purchase that made the target makeable), it is not
 * in this prefix, so it is not in H and the guard fails closed (existence, no clause) -- the privacy
 * side of T1a; see the Gate report §11. `null` when a known ingredient is not owned (fail closed).
 */
export function makeablePrefix(parts: ReserveParts): string[] | null {
  // The starters are owned together from the start (they lead the list): acquired at time 0.
  let last = parts.owned.filter((id) => STARTER_IDS.has(id)).length - 1;
  for (const id of knownPart(parts)) {
    const index = parts.owned.indexOf(id);
    if (index < 0) return null;
    last = Math.max(last, index);
  }
  return parts.owned.slice(0, last + 1);
}

function knownPart(parts: ReserveParts): string[] {
  return parts.recipeIngredientIds.filter((id) => id !== parts.reserveId);
}

/**
 * H (DH4-2B Pre-Implementation Gate, P2-1): every hypothetical reserve, i.e. every ingredient the
 * player cannot rule out as the missing one when every other ingredient of the recipe is known.
 *
 * H = { x in OWNED : x not in the known part, x is not the key, x is Rule W-consistent }, where
 * Rule W-consistent means x's category ranks at least as high as every non-key known ingredient
 * (Rule W, OD-H3-5, holds for every recipe by construction; it is not a catalog assumption).
 *
 * No catalog prior (such as "every pizza has exactly one sauce") narrows H: a sauceless,
 * cheese-based or multi-spread recipe keeps its real reserve in H. H depends on the known part, the
 * key and the owned set only, so it is the same set for every hypothesis. Catalog order.
 */
export function hypotheticalReserves(parts: ReserveParts): string[] {
  const known = new Set(knownPart(parts));
  const floor = Math.max(-1, ...[...known].filter((id) => id !== parts.keyId).map((id) => ruleWRank(id) ?? Number.POSITIVE_INFINITY));
  // The free key is public too (hintKeyIngredientId: the ingredient with the recipe's key step). An
  // ingredient unlocked later than the key would itself have been the key, so it is no hypothesis;
  // with no key, every ingredient is a starter (step 0). A tie keeps it: the order is not public.
  const keyStep = parts.keyId === null ? 0 : ingredientKeyStep(parts.keyId);
  const prefix = makeablePrefix(parts);
  if (prefix === null) return [];
  return byCatalogOrder(prefix).filter((id) => {
    const rank = ruleWRank(id);
    return !known.has(id) && id !== parts.keyId && rank !== null && rank >= floor && ingredientKeyStep(id) <= keyStep;
  });
}

/** The key step one ingredient alone gives (`recipeKeyStep`, the rule behind the free key). */
function ingredientKeyStep(id: string): number {
  return recipeKeyStep({ requiredIngredients: [{ ingredientId: id }] } as unknown as Recipe);
}

/** W, the strict answer's universe: the same set as H (kept as its own name for the audit). */
export function privacyPartitionUniverse(parts: ReserveParts): string[] {
  return hypotheticalReserves(parts);
}

/**
 * The guard's precondition (fail closed): the real reserve is in H. It fails only for inputs the
 * runtime never produces (the reserve is not owned: targets are DISCOVERABLE, so every ingredient is
 * owned; or a reserve Rule W could not have chosen). The answer is then existence and no clause.
 */
export function reserveInHypotheses(parts: ReserveParts): boolean {
  return hypotheticalReserves(parts).includes(parts.reserveId);
}

/** The ReserveParts of hypothesis x: the same known part, x as the missing reserve. */
export function hypotheticalParts(parts: ReserveParts, x: string): ReserveParts {
  return { recipeIngredientIds: [...knownPart(parts), x], reserveId: x, keyId: parts.keyId, owned: parts.owned };
}

function dh41Answer(parts: ReserveParts): ReserveAttributeAnswer | null {
  // T1a: the DH4-1 decoys come from the same makeable prefix as H, never from later purchases.
  return attributeAnswerForReserve({ recipeIngredientIds: parts.recipeIngredientIds, reserveId: parts.reserveId, ownedIngredientIds: makeablePrefix(parts) ?? [] });
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

const EXISTENCE: ReserveAttributeAnswer = { level: "existence", factId: "attr:existence" };

/** Every value is 0 or >= MIN_ATTRIBUTE_CANDIDATES. */
function allClassesSafe(sizes: ReadonlyMap<string, number>): boolean {
  return [...sizes.values()].every((n) => n >= MIN_ATTRIBUTE_CANDIDATES);
}

/** The strict ("level before value") answer for these parts. The level depends on H only. */
export function strictAnswerForParts(parts: ReserveParts): ReserveAttributeAnswer {
  const h = hypotheticalReserves(parts);
  if (!h.includes(parts.reserveId)) return EXISTENCE;
  for (const level of ["family", "group", "category"] as const) {
    const sizes = new Map<string, number>();
    for (const id of h) sizes.set(classOf(level, id), (sizes.get(classOf(level, id)) ?? 0) + 1);
    if (allClassesSafe(sizes)) return answerForClass(classOf(level, parts.reserveId));
  }
  return EXISTENCE;
}

/**
 * Whether the DH4-1 answer may be used. H-only. Every DH4-1 answer class over H must have >= 2
 * members **within every category side** (sauce / cheese / topping): an attacker who narrows H by
 * any category-defined prior (one sauce per pizza, a known reserve category, a future base
 * category...) still finds >= 2 candidates in the class the answer names.
 */
export function partitionAllowsDh41(parts: ReserveParts): boolean {
  const h = hypotheticalReserves(parts);
  if (!h.includes(parts.reserveId)) return false;
  const sizes = new Map<string, number>();
  for (const x of h) {
    const answer = dh41Answer(hypotheticalParts(parts, x));
    const key = `${categoryOf(x)}|${answer ? answer.factId : "none"}`;
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }
  return allClassesSafe(sizes);
}

/** OD-DH4-2-2: the guarded answer for any parts (real or hypothetical). Fails closed to existence
 *  when the real reserve is not in H (the partition check refuses and the strict answer is existence). */
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

/**
 * OD-DH4-2-1 TC-G for any parts, decided from H only (DH4-2B Pre-Implementation Gate, P2-2):
 * - the real reserve is in H (fail closed);
 * - every hypothesis in H gives a topping total >= 1 (the known part has a topping, or every
 *   hypothesis is a topping), so a missing clause never implies 「トッピング0」 and a told clause is
 *   never 0;
 * - every category side present in H has >= 2 members.
 */
export function toppingClauseAllowedForParts(parts: ReserveParts): boolean {
  const h = hypotheticalReserves(parts);
  if (!h.includes(parts.reserveId)) return false;
  const knownToppings = toppingTotalOf(knownPart(parts));
  // The real reserve is in H, so this also gives the real recipe T >= 1: never 0.
  if (h.some((x) => knownToppings + (categoryOf(x) === "topping" ? 1 : 0) < 1)) return false;
  const sides = new Map<string, number>();
  for (const id of h) sides.set(categoryOf(id)!, (sides.get(categoryOf(id)!) ?? 0) + 1);
  return allClassesSafe(sides);
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
