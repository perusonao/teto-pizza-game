/**
 * Discovery Hint 4.0 (Issue #253), DH4-2A: the pure request authority for the two Deduction Hint
 * families, 構成 (structure) and 特徴 (attribute), and the lines that show what the player already
 * owns. UNWIRED: DH4-2B calls it from the reducer behind the DEV / Preview flag (OD-DH4-2-5).
 *
 * Authority: OD-DH4-2-1..13 (docs/reports/TETO_DISCOVERY-HINT-4_DH4-2_Pre-Implementation-Audit.md §0).
 *
 * - **Price is an input, not an authority** (OD-DH4-2-5). The caller supplies `requestPrice`; this
 *   module only checks it is a whole number >= 0 and never picks one. The material ESC ladder is
 *   untouched.
 * - **Order of evaluation** is fixed so that a refusal never depends on what is left (the H3-1
 *   pattern): family -> target -> price -> STALE -> balance, and only then the answer. Nothing about
 *   availability, granularity or candidates exists before the request is resolved (OD-DH4-10).
 * - **One outcome charges:** ANSWERED. EXISTENCE_ONLY (OD-DH4-2-4), GUIDANCE_ONLY and ALREADY_OWNED
 *   charge 0 and add no fact id, so the caller changes nothing persistent for them.
 * - **Single-shot families.** The attribute family answers once (an informative answer); the
 *   structure family tells the total once and the TC-G topping clause once. A legacy
 *   「材料は全部で○種類」 line owns the total (OD-DH4-8) and is never resold.
 * - **No negative fact** is created: no 0, no remaining count, no category-zero, no `attr:existence`
 *   stored.
 *
 * Inputs from outside (a save, an event) are untrusted and fail closed.
 */
import type { Recipe } from "../../data/recipes";
import { RECIPES } from "../../data/recipes";
import { getIngredient } from "../../data/ingredients";
import { ATTRIBUTE_FAMILIES, ATTRIBUTE_GROUPS } from "../../data/ingredientTaxonomy";
import {
  deductionHintTextJa,
  INGREDIENT_TOTAL_FACT_ID,
  legacyOwnsIngredientTotal,
  structureTotalFact,
  type AttributeContext,
  type ReserveAttributeAnswer,
} from "./deductionHint";
import { guardedReserveAttributeAnswer, structureAnswer, targetReserveParts, TOPPING_TOTAL_FACT_ID } from "./deductionGuard";
import type { DiscoveryHintPurchases } from "./hintPurchase";

export type DeductionFamily = "structure" | "attribute";

export const DEDUCTION_FAMILIES: readonly DeductionFamily[] = ["structure", "attribute"];

export interface DeductionRequestInput {
  family: unknown;
  recipeId: unknown;
  context: AttributeContext;
  /** The recipe's stored Hint fact ids (`discoveryHintFacts[recipeId]`), untrusted. */
  storedFactIds: readonly unknown[] | unknown;
  /** The legacy Economy 1.0 ledger (`discoveryHintPurchases`), untrusted. */
  legacyPurchases: DiscoveryHintPurchases | unknown;
  /** Supplied by the caller (OD-DH4-PROD-1: the fixed 5 / 5 price). Not decided here. */
  requestPrice: number;
  /** The caller's current paid count (economy: DH4-ECON) and the one the sheet echoed. */
  paidCount: number;
  expectedPaidCount: number;
  pitzBalance: number;
}

export type DeductionRejection = "INVALID_FAMILY" | "NOT_A_TARGET" | "INVALID_PRICE" | "STALE" | "INSUFFICIENT_PITZ";

export type DeductionRequestResult =
  | { outcome: "ANSWERED"; family: DeductionFamily; addFactIds: readonly string[]; charge: number }
  | { outcome: "EXISTENCE_ONLY"; family: "attribute"; addFactIds: readonly []; charge: 0 }
  | { outcome: "GUIDANCE_ONLY"; family: "structure"; addFactIds: readonly []; charge: 0 }
  | { outcome: "ALREADY_OWNED"; family: DeductionFamily; addFactIds: readonly []; charge: 0 }
  | { outcome: "REJECTED"; reason: DeductionRejection };

function isFamily(value: unknown): value is DeductionFamily {
  return typeof value === "string" && (DEDUCTION_FAMILIES as readonly string[]).includes(value);
}

function storedStrings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

const FAMILY_IDS = new Set<string>(ATTRIBUTE_FAMILIES.map((f) => f.id));
const GROUP_IDS = new Set<string>(ATTRIBUTE_GROUPS.map((g) => g.id));
const CATEGORY_IDS = new Set<string>(["sauce", "cheese", "topping"]);

/** A stored, informative attribute answer (never existence), or `null` when the id is not one. */
export function parseAttributeFactId(raw: unknown): ReserveAttributeAnswer | null {
  if (typeof raw !== "string") return null;
  const match = /^attr:(family|group|category):([a-z]+)$/.exec(raw);
  if (!match) return null;
  const [, level, value] = match;
  if (level === "family" && FAMILY_IDS.has(value)) return { level, family: value as never, factId: raw as never };
  if (level === "group" && GROUP_IDS.has(value)) return { level, group: value as never, factId: raw as never };
  if (level === "category" && CATEGORY_IDS.has(value)) return { level, category: value as never, factId: raw as never };
  return null;
}

/** What the player already owns of the two families, from the ledgers only (never from W). */
export interface DeductionOwnership {
  /** A stored `meta:ingredient-total`, or a legacy 「材料は全部で○種類」 line (OD-DH4-8). */
  structureTotalOwned: boolean;
  /** The total came from the legacy line only (display right, archive). */
  structureTotalFromLegacyOnly: boolean;
  toppingClauseOwned: boolean;
  /** An informative attribute answer is stored (`attr:existence` never counts). */
  attributeOwned: boolean;
}

export function deductionOwnership(
  recipeId: unknown,
  storedFactIds: unknown,
  legacyPurchases: unknown,
  recipes: readonly Recipe[] = RECIPES,
): DeductionOwnership {
  const stored = storedStrings(storedFactIds);
  const storedTotal = stored.includes(INGREDIENT_TOTAL_FACT_ID);
  const legacyTotal = legacyOwnsIngredientTotal(recipeId, legacyPurchases, recipes);
  return {
    structureTotalOwned: storedTotal || legacyTotal,
    structureTotalFromLegacyOnly: legacyTotal && !storedTotal,
    toppingClauseOwned: stored.includes(TOPPING_TOTAL_FACT_ID),
    attributeOwned: stored.some((id) => parseAttributeFactId(id) !== null),
  };
}

const REJECT = (reason: DeductionRejection): DeductionRequestResult => ({ outcome: "REJECTED", reason });

/** The single pure authority for one 構成 / 特徴 request. Everything is re-derived from the input. */
export function requestDeductionHint(input: DeductionRequestInput, recipes: readonly Recipe[] = RECIPES): DeductionRequestResult {
  const { family } = input;
  if (!isFamily(family)) return REJECT("INVALID_FAMILY");
  if (!structureTotalFact(input.recipeId, input.context, recipes) || !targetReserveParts(input.recipeId, input.context, recipes)) {
    return REJECT("NOT_A_TARGET");
  }
  const price = input.requestPrice;
  if (typeof price !== "number" || !Number.isSafeInteger(price) || price < 0) return REJECT("INVALID_PRICE");
  if (input.expectedPaidCount !== input.paidCount) return REJECT("STALE");
  if (!Number.isFinite(input.pitzBalance) || input.pitzBalance < price) return REJECT("INSUFFICIENT_PITZ");

  const owned = deductionOwnership(input.recipeId, input.storedFactIds, input.legacyPurchases, recipes);
  if (family === "attribute") {
    if (owned.attributeOwned) return { outcome: "ALREADY_OWNED", family, addFactIds: [], charge: 0 };
    const answer = guardedReserveAttributeAnswer(input.recipeId, input.context, recipes);
    if (!answer) return REJECT("NOT_A_TARGET");
    if (answer.level === "existence") return { outcome: "EXISTENCE_ONLY", family, addFactIds: [], charge: 0 };
    return { outcome: "ANSWERED", family, addFactIds: [answer.factId], charge: price };
  }

  const structure = structureAnswer(input.recipeId, input.context, recipes);
  if (!structure) return REJECT("NOT_A_TARGET");
  if (owned.structureTotalOwned && owned.toppingClauseOwned) return { outcome: "ALREADY_OWNED", family, addFactIds: [], charge: 0 };
  const toAdd = structure.factIds.filter((id) =>
    id === INGREDIENT_TOTAL_FACT_ID ? !owned.structureTotalOwned : !owned.toppingClauseOwned,
  );
  if (toAdd.length === 0) return { outcome: "GUIDANCE_ONLY", family, addFactIds: [], charge: 0 };
  return { outcome: "ANSWERED", family, addFactIds: toAdd, charge: price };
}

/** 「トッピングは○種類使うよ」 (OD-DH4-2-1). Never called with 0. */
export function toppingClauseTextJa(toppingTotal: number): string {
  return `トッピングは${toppingTotal}種類使うよ`;
}

export interface DeductionKnownLines {
  /** 構成: the total line (stored fact) and the topping line (stored clause), in that order. */
  structure: readonly string[];
  /** 特徴: the stored informative attribute line. */
  attribute: readonly string[];
  /** The total is owned only through a legacy line: DH4-2C shows it in the 「以前のヒント」 archive. */
  legacyStructure: boolean;
}

/**
 * The known-fact presentation model: positive lines for what the player already owns, nothing else.
 * No recipe id or name, no level label, no candidate count, no availability, no 「？」, never 0.
 */
export function deductionKnownLines(
  recipeId: unknown,
  context: AttributeContext,
  storedFactIds: unknown,
  legacyPurchases: unknown,
  recipes: readonly Recipe[] = RECIPES,
): DeductionKnownLines {
  const empty: DeductionKnownLines = { structure: [], attribute: [], legacyStructure: false };
  const total = structureTotalFact(recipeId, context, recipes);
  if (!total) return empty;
  const stored = storedStrings(storedFactIds);
  const owned = deductionOwnership(recipeId, stored, legacyPurchases, recipes);
  const structure: string[] = [];
  if (stored.includes(INGREDIENT_TOTAL_FACT_ID)) structure.push(deductionHintTextJa(total));
  if (owned.toppingClauseOwned) {
    const recipe = recipes.find((r) => r.id === recipeId)!;
    const toppings = new Set(recipe.requiredIngredients.map((r) => r.ingredientId).filter((id) => getIngredient(id)?.category === "topping")).size;
    if (toppings >= 1) structure.push(toppingClauseTextJa(toppings));
  }
  const attributeFact = stored.map(parseAttributeFactId).find((a) => a !== null) ?? null;
  return {
    structure,
    attribute: attributeFact ? [deductionHintTextJa(attributeFact)] : [],
    legacyStructure: owned.structureTotalFromLegacyOnly,
  };
}
