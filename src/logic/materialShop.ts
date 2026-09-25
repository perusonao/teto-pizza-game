import { DISCOVERY_LADDER, type DiscoveryLadder } from "../data/discoveryLadder";
import type { Ingredient } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import type { InventoryState } from "../state/inventory";
import { nextLadderStep, normalizeDiscoveredCount } from "./discoveryLadder";

/**
 * Progression 2.0 W1 Integration I4b-1: the material Shop's economy as pure functions (REC-04
 * OD-REC04-2/3, Owner Decision commit 6fe02e2d23610e926bab2367405fe9f717d25421; plan in
 * docs/reports/TETO_PROGRESS2_W1_I4B_Fresh-Audit.md).
 *
 * - A material becomes buyable when the Discovery Ladder unlocks it (../data/discoveryLadder.ts,
 *   ./discoveryLadder.ts). Unlocking is free and grants no stock (OD-REC04-2): stock stays 0 until
 *   the first pack is bought.
 * - 1 pack = 10 pizza plays = `10 x k` stock, k = the ingredient's largest `minCount` in the recipe
 *   data (OD-REC04-3). Stock keeps the shipped unit (scatter: pieces, spread: uses), so a spread
 *   sauce (k = 1) pack is 10 uses. The first pack and every refill add the same `10 x k`.
 * - Price comes from the tier of the material's ladder step: T1 steps 1-5, T2 6-14, T3 15-29,
 *   T4 30+ (REC-04 `tierBands`); pack 60/80/100/120 Pitz, refill 30/40/50/60 (OD-REC04-3).
 * - The onboarding starters (no `unlockCondition`) stay unlimited and are never for sale.
 *
 * Every function is deterministic and returns the next state without mutating its input, so the
 * reducer can apply a whole transaction in one step or not at all. Anything invalid fails closed:
 * no Pitz is spent and nothing is granted.
 */

/** Pizza plays one pack (first purchase or refill) covers. */
export const MATERIAL_PACK_PIZZAS = 10;

export type MaterialPriceTierId = "T1" | "T2" | "T3" | "T4";

export interface MaterialPriceTier {
  tier: MaterialPriceTierId;
  /** First ladder step in this band (inclusive). */
  firstStep: number;
  /** Last ladder step in this band (inclusive); `null` = no upper bound. */
  lastStep: number | null;
  packPrice: number;
  refillPrice: number;
}

export const MATERIAL_PRICE_TIERS: readonly MaterialPriceTier[] = [
  { tier: "T1", firstStep: 1, lastStep: 5, packPrice: 60, refillPrice: 30 },
  { tier: "T2", firstStep: 6, lastStep: 14, packPrice: 80, refillPrice: 40 },
  { tier: "T3", firstStep: 15, lastStep: 29, packPrice: 100, refillPrice: 50 },
  { tier: "T4", firstStep: 30, lastStep: null, packPrice: 120, refillPrice: 60 },
];

/** The price tier of a ladder step, or `null` for anything that is not a step number (< 1,
 *  fractional, non-finite). */
export function priceTierForStep(step: number): MaterialPriceTier | null {
  if (!Number.isInteger(step) || step < 1) return null;
  return (
    MATERIAL_PRICE_TIERS.find((t) => step >= t.firstStep && (t.lastStep === null || step <= t.lastStep)) ??
    null
  );
}

/** Minimal recipe shape the pack size reads, so tests can pass other populations. */
export interface MaterialRecipeRequirements {
  requiredIngredients: readonly { ingredientId: string; minCount: number }[];
}

/** k: the largest `minCount` any recipe requires of `ingredientId`; 0 when no recipe uses it. */
export function materialK(
  ingredientId: string,
  recipes: readonly MaterialRecipeRequirements[] = RECIPES,
): number {
  let k = 0;
  for (const recipe of recipes) {
    for (const req of recipe.requiredIngredients) {
      if (req.ingredientId === ingredientId && Number.isInteger(req.minCount) && req.minCount > k) {
        k = req.minCount;
      }
    }
  }
  return k;
}

/** Stock one pack adds: `10 x k`; 0 when no recipe uses the ingredient. */
export function packQuantity(
  ingredientId: string,
  recipes: readonly MaterialRecipeRequirements[] = RECIPES,
): number {
  return MATERIAL_PACK_PIZZAS * materialK(ingredientId, recipes);
}

/** The ladder step that unlocks `ingredientId`, or `null` when the ladder does not contain it. */
export function materialLadderStep(
  ingredientId: string,
  ladder: DiscoveryLadder = DISCOVERY_LADDER,
): number | null {
  const step = ladder.steps.find((s) => s.kind === "MATERIAL" && s.ingredientIds.includes(ingredientId));
  return step ? step.step : null;
}

export interface MaterialOffer {
  ingredientId: string;
  step: number;
  tier: MaterialPriceTierId;
  k: number;
  packQuantity: number;
  packPrice: number;
  refillPrice: number;
}

export interface MaterialOfferOptions {
  ladder?: DiscoveryLadder;
  recipes?: readonly MaterialRecipeRequirements[];
}

/**
 * Everything the Shop sells for one material, or `null` when it is not for sale: an unlimited
 * starter, an ingredient the ladder does not contain, or one no recipe uses (k = 0).
 */
export function materialOffer(
  ingredient: Ingredient,
  { ladder = DISCOVERY_LADDER, recipes = RECIPES }: MaterialOfferOptions = {},
): MaterialOffer | null {
  if (!ingredient.unlockCondition) return null;
  const step = materialLadderStep(ingredient.id, ladder);
  if (step === null) return null;
  const tier = priceTierForStep(step);
  const k = materialK(ingredient.id, recipes);
  if (!tier || k <= 0) return null;
  return {
    ingredientId: ingredient.id,
    step,
    tier: tier.tier,
    k,
    packQuantity: MATERIAL_PACK_PIZZAS * k,
    packPrice: tier.packPrice,
    refillPrice: tier.refillPrice,
  };
}

/** Shop row state. LOCKED rows are not listed (I4b implementation default); starters are
 *  `UNLIMITED` and never listed. */
export type MaterialShopState = "UNLIMITED" | "OWNED" | "NEW" | "LOCKED";

/**
 * - `UNLIMITED`: an onboarding starter (no `unlockCondition`).
 * - `OWNED`: the first pack was bought (or granted by the retired EP4) -- refill row.
 * - `NEW`: unlocked for the Shop but not bought yet -- first-pack row.
 * - `LOCKED`: neither.
 */
export function materialShopState(
  ingredient: Ingredient,
  ownedIngredientIds: readonly string[],
  unlockedForShopIngredientIds: readonly string[],
): MaterialShopState {
  if (!ingredient.unlockCondition) return "UNLIMITED";
  if (ownedIngredientIds.includes(ingredient.id)) return "OWNED";
  if (unlockedForShopIngredientIds.includes(ingredient.id)) return "NEW";
  return "LOCKED";
}

export interface NextMaterialHint {
  /** New discoveries still needed before the next step unlocks (always >= 1). */
  discoveriesNeeded: number;
  step: number;
}

/** The Shop progress hint ("あと1つ発見で新しい材料が入荷"), or `null` once the ladder is done. */
export function nextMaterialHint(
  discoveredCount: number,
  ladder: DiscoveryLadder = DISCOVERY_LADDER,
): NextMaterialHint | null {
  const next = nextLadderStep(ladder, discoveredCount);
  if (!next) return null;
  return { discoveriesNeeded: next.step - normalizeDiscoveredCount(discoveredCount), step: next.step };
}

// ---------------------------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------------------------

export type MaterialPurchaseFailureReason =
  | "UNLIMITED"
  | "ALREADY_OWNED"
  | "LOCKED"
  | "NOT_FOR_SALE"
  | "INSUFFICIENT_FUNDS";

export type MaterialRefillFailureReason =
  | "UNLIMITED"
  | "NOT_OWNED"
  | "NOT_FOR_SALE"
  | "INSUFFICIENT_FUNDS";

export interface MaterialTransactionSuccess {
  success: true;
  nextOwnedIngredientIds: string[];
  nextInventory: InventoryState;
  nextPitzBalance: number;
  /** Stock added by this transaction (`10 x k`). */
  quantity: number;
  /** Pitz spent by this transaction. */
  price: number;
}

export type MaterialPurchaseResult =
  | MaterialTransactionSuccess
  | { success: false; reason: MaterialPurchaseFailureReason };

export type MaterialRefillResult =
  | MaterialTransactionSuccess
  | { success: false; reason: MaterialRefillFailureReason };

export interface MaterialPurchaseInput extends MaterialOfferOptions {
  ingredient: Ingredient;
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
  inventory: InventoryState;
  pitzBalance: number;
}

export interface MaterialRefillInput extends MaterialOfferOptions {
  ingredient: Ingredient;
  ownedIngredientIds: readonly string[];
  inventory: InventoryState;
  pitzBalance: number;
}

/** A balance that can pay: finite and non-negative. Anything else can pay nothing. */
function canPay(pitzBalance: number, price: number): boolean {
  return Number.isFinite(pitzBalance) && pitzBalance >= 0 && pitzBalance >= price;
}

/** Current stock made safe for arithmetic: absent, non-finite or negative reads as 0. */
function currentStock(inventory: InventoryState, ingredientId: string): number {
  const value = inventory[ingredientId];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * First pack: a NEW material becomes OWNED, `-packPrice` Pitz, `+10 x k` stock (added to any stock
 * already there, never replacing it). Rejected when the material is a starter, already owned, not
 * unlocked for the Shop, not for sale, or unaffordable.
 */
export function purchaseFirstPack(input: MaterialPurchaseInput): MaterialPurchaseResult {
  const { ingredient, ownedIngredientIds, unlockedForShopIngredientIds, inventory, pitzBalance } = input;
  const state = materialShopState(ingredient, ownedIngredientIds, unlockedForShopIngredientIds);
  if (state === "UNLIMITED") return { success: false, reason: "UNLIMITED" };
  if (state === "OWNED") return { success: false, reason: "ALREADY_OWNED" };
  if (state === "LOCKED") return { success: false, reason: "LOCKED" };
  const offer = materialOffer(ingredient, input);
  if (!offer) return { success: false, reason: "NOT_FOR_SALE" };
  if (!canPay(pitzBalance, offer.packPrice)) return { success: false, reason: "INSUFFICIENT_FUNDS" };
  return {
    success: true,
    nextOwnedIngredientIds: [...ownedIngredientIds, ingredient.id],
    nextInventory: {
      ...inventory,
      [ingredient.id]: currentStock(inventory, ingredient.id) + offer.packQuantity,
    },
    nextPitzBalance: pitzBalance - offer.packPrice,
    quantity: offer.packQuantity,
    price: offer.packPrice,
  };
}

/**
 * Refill: an OWNED finite material, `-refillPrice` Pitz, `+10 x k` stock. Repeatable. Rejected when
 * the material is a starter, not owned, not for sale, or unaffordable.
 */
export function refillPack(input: MaterialRefillInput): MaterialRefillResult {
  const { ingredient, ownedIngredientIds, inventory, pitzBalance } = input;
  if (!ingredient.unlockCondition) return { success: false, reason: "UNLIMITED" };
  if (!ownedIngredientIds.includes(ingredient.id)) return { success: false, reason: "NOT_OWNED" };
  const offer = materialOffer(ingredient, input);
  if (!offer) return { success: false, reason: "NOT_FOR_SALE" };
  if (!canPay(pitzBalance, offer.refillPrice)) return { success: false, reason: "INSUFFICIENT_FUNDS" };
  return {
    success: true,
    nextOwnedIngredientIds: [...ownedIngredientIds],
    nextInventory: {
      ...inventory,
      [ingredient.id]: currentStock(inventory, ingredient.id) + offer.packQuantity,
    },
    nextPitzBalance: pitzBalance - offer.refillPrice,
    quantity: offer.packQuantity,
    price: offer.refillPrice,
  };
}
