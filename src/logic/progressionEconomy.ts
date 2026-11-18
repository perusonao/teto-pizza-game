import type { ProgressionIngredientUnlock } from "../data/progressionUnlocks";
import type { IngredientState } from "../state/progression";

/**
 * Progression 2.0 Phase 3-4A: the Phase 3-4 authority's ingredient lifecycle and `S10_R10` stock
 * policy as pure functions (see
 * docs/reports/PROGRESSION-2.0_PHASE-3-4_PreImplementation-Audit.md §2.3 and §7 slice 3-4A).
 *
 * - Lifecycle: LOCKED → AVAILABLE_TO_BUY (progression ⭐ reach the gate) → OWNED (purchased).
 *   The starter trio is OWNED from the start with UNLIMITED stock and is never for sale.
 * - First purchase: Pitz −price, OWNED, **+10 uses** of stock.
 * - Refill: Pitz −ceil(price × 0.5), **+10 uses** of stock. Only for an OWNED, finite ingredient.
 *
 * **Stock unit: 1 use = 1 pizza.** A pizza that uses an ingredient consumes exactly one use of
 * it, however many pieces are placed (`consumePizzaUse`). This is a different unit from the
 * shipped inventory (../state/inventory.ts), which counts scatter pieces; how the runtime
 * inventory moves to pizza uses is Phase 3-4C's decision, not this module's.
 *
 * **Not wired yet.** The runtime still uses `purchaseIngredient`/`restockIngredient`
 * (./economy.ts) and `ingredientState` (../state/progression.ts). Nothing here reads or writes
 * `GameState`, persistence or the UI. Every function returns the next state and never mutates its
 * input, so a caller can apply a whole transaction in one step or not at all. Anything invalid
 * (negative or fractional balance, bad price or gate, corrupt stock) fails closed: no Pitz is spent
 * and nothing is granted.
 */

/** Uses of stock the first purchase grants (`purchaseGrantPortions`). */
export const PROGRESSION_PURCHASE_GRANT_USES = 10;

/** Uses of stock one refill grants (`refillPortions`). */
export const PROGRESSION_REFILL_USES = 10;

/** Refill price as a fraction of the first-purchase price (`refillPriceFactor`). */
export const PROGRESSION_REFILL_PRICE_FACTOR = 0.5;

/** Stock uses consumed by one pizza that uses an ingredient, regardless of piece count. */
export const PROGRESSION_USES_PER_PIZZA = 1;

/** Stock in pizza uses, keyed by ingredient id. An absent key means 0. */
export type ProgressionStock = Readonly<Record<string, number>>;

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/** A stored stock count made safe: absent, non-finite or negative reads as 0, fractions floor. */
function sanitizeUses(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/** Progression ⭐ made safe for a gate comparison: non-finite or negative reads as 0. */
function sanitizeStars(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function withUses(stock: ProgressionStock, ingredientId: string, uses: number): ProgressionStock {
  return { ...stock, [ingredientId]: uses };
}

/**
 * LOCKED / AVAILABLE_TO_BUY / OWNED for one ingredient. `progressionStars` is the Σ max(2, BEST)
 * total from ../logic/progressionStars.ts. The gate is inclusive (⭐ == gate is AVAILABLE_TO_BUY).
 * A row with an invalid gate (negative, fractional, NaN) stays LOCKED.
 */
export function progressionIngredientState(
  unlock: ProgressionIngredientUnlock,
  ownedIngredientIds: readonly string[],
  progressionStars: number,
): IngredientState {
  if (unlock.initialOwned || ownedIngredientIds.includes(unlock.ingredientId)) return "OWNED";
  if (!isNonNegativeInteger(unlock.minProgressionStars)) return "LOCKED";
  return sanitizeStars(progressionStars) >= unlock.minProgressionStars ? "AVAILABLE_TO_BUY" : "LOCKED";
}

/**
 * Refill price: `ceil(purchasePrice × 0.5)`, so a refill is never free and never undercharged.
 * Every authority price is even, so the ceiling never applies to shipped data. Returns `null`
 * when the purchase price is not a positive integer (not for sale).
 */
export function progressionRefillPricePitz(purchasePricePitz: number): number | null {
  if (!isPositiveInteger(purchasePricePitz)) return null;
  return Math.ceil(purchasePricePitz * PROGRESSION_REFILL_PRICE_FACTOR);
}

/** Remaining pizza uses, or `"UNLIMITED"` for an initial-owned (starter) ingredient. */
export function remainingPizzaUses(
  unlock: ProgressionIngredientUnlock,
  stock: ProgressionStock,
): number | "UNLIMITED" {
  if (unlock.initialOwned) return "UNLIMITED";
  return sanitizeUses(stock[unlock.ingredientId]);
}

// ---------------------------------------------------------------------------------------------
// First purchase
// ---------------------------------------------------------------------------------------------

export type ProgressionPurchaseFailureReason =
  | "INVALID_BALANCE"
  | "ALREADY_OWNED"
  | "LOCKED"
  | "NOT_FOR_SALE"
  | "INSUFFICIENT_FUNDS";

export interface ProgressionPurchaseInput {
  unlock: ProgressionIngredientUnlock;
  ownedIngredientIds: readonly string[];
  progressionStars: number;
  pitzBalance: number;
  stock: ProgressionStock;
}

export type ProgressionPurchaseResult =
  | {
      success: true;
      nextOwnedIngredientIds: string[];
      nextPitzBalance: number;
      nextStock: ProgressionStock;
    }
  | { success: false; reason: ProgressionPurchaseFailureReason };

/**
 * Pitz → permanent OWNED + `PROGRESSION_PURCHASE_GRANT_USES` uses. A second purchase of the same
 * ingredient is `ALREADY_OWNED` (never a second charge or a second grant; refilling is
 * `refillProgressionIngredient`). Leftover stock (e.g. from an earlier rule set) is kept and the
 * grant is added on top; a corrupt leftover reads as 0.
 */
export function purchaseProgressionIngredient(input: ProgressionPurchaseInput): ProgressionPurchaseResult {
  const { unlock, ownedIngredientIds, progressionStars, pitzBalance, stock } = input;
  if (!isNonNegativeInteger(pitzBalance)) return { success: false, reason: "INVALID_BALANCE" };

  const state = progressionIngredientState(unlock, ownedIngredientIds, progressionStars);
  if (state === "OWNED") return { success: false, reason: "ALREADY_OWNED" };
  if (state === "LOCKED") return { success: false, reason: "LOCKED" };

  const price = unlock.purchasePricePitz;
  if (!isPositiveInteger(price)) return { success: false, reason: "NOT_FOR_SALE" };
  if (pitzBalance < price) return { success: false, reason: "INSUFFICIENT_FUNDS" };

  const uses = sanitizeUses(stock[unlock.ingredientId]) + PROGRESSION_PURCHASE_GRANT_USES;
  return {
    success: true,
    nextOwnedIngredientIds: [...ownedIngredientIds, unlock.ingredientId],
    nextPitzBalance: pitzBalance - price,
    nextStock: withUses(stock, unlock.ingredientId, uses),
  };
}

// ---------------------------------------------------------------------------------------------
// Refill
// ---------------------------------------------------------------------------------------------

export type ProgressionRefillFailureReason =
  | "INVALID_BALANCE"
  | "UNLIMITED"
  | "NOT_OWNED"
  | "NOT_FOR_SALE"
  | "INSUFFICIENT_FUNDS";

export interface ProgressionRefillInput {
  unlock: ProgressionIngredientUnlock;
  ownedIngredientIds: readonly string[];
  pitzBalance: number;
  stock: ProgressionStock;
}

export type ProgressionRefillResult =
  | { success: true; nextPitzBalance: number; nextStock: ProgressionStock }
  | { success: false; reason: ProgressionRefillFailureReason };

/**
 * Pitz −`progressionRefillPricePitz` → +`PROGRESSION_REFILL_USES` uses. Repeatable, and allowed
 * whether or not stock is already 0. Never for a starter (UNLIMITED) or not-yet-owned ingredient.
 */
export function refillProgressionIngredient(input: ProgressionRefillInput): ProgressionRefillResult {
  const { unlock, ownedIngredientIds, pitzBalance, stock } = input;
  if (!isNonNegativeInteger(pitzBalance)) return { success: false, reason: "INVALID_BALANCE" };
  if (unlock.initialOwned) return { success: false, reason: "UNLIMITED" };
  if (!ownedIngredientIds.includes(unlock.ingredientId)) return { success: false, reason: "NOT_OWNED" };

  const price = progressionRefillPricePitz(unlock.purchasePricePitz);
  if (price === null) return { success: false, reason: "NOT_FOR_SALE" };
  if (pitzBalance < price) return { success: false, reason: "INSUFFICIENT_FUNDS" };

  const uses = sanitizeUses(stock[unlock.ingredientId]) + PROGRESSION_REFILL_USES;
  return {
    success: true,
    nextPitzBalance: pitzBalance - price,
    nextStock: withUses(stock, unlock.ingredientId, uses),
  };
}

// ---------------------------------------------------------------------------------------------
// Use (1 pizza = 1 use)
// ---------------------------------------------------------------------------------------------

export type ProgressionUseResult =
  | { success: true; nextStock: ProgressionStock }
  | { success: false; reason: "OUT_OF_STOCK" };

/**
 * One pizza that uses `unlock`'s ingredient: −`PROGRESSION_USES_PER_PIZZA` use, however many
 * pieces were placed. A starter (UNLIMITED) ingredient never consumes. Stock never goes negative:
 * 0 (or corrupt) stock is `OUT_OF_STOCK` and nothing changes.
 */
export function consumePizzaUse(
  unlock: ProgressionIngredientUnlock,
  stock: ProgressionStock,
): ProgressionUseResult {
  if (unlock.initialOwned) return { success: true, nextStock: stock };
  const uses = sanitizeUses(stock[unlock.ingredientId]);
  if (uses < PROGRESSION_USES_PER_PIZZA) return { success: false, reason: "OUT_OF_STOCK" };
  return { success: true, nextStock: withUses(stock, unlock.ingredientId, uses - PROGRESSION_USES_PER_PIZZA) };
}
