import type { Ingredient } from "../data/ingredients";
import { averageQualityScore, type MissionMetrics } from "./missionScoring";
import { ingredientState } from "../state/progression";
import type { InventoryState } from "../state/inventory";

/**
 * Economy rules (Phase 3C-5, see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md sections 3, 8-9
 * and docs/reports/PIZZA_GAME_Phase3C-5_Pitz-Shop_Result.md). Pure functions only -- no React,
 * no reducer wiring, no storage access -- so the reward formula and the purchase transaction
 * can be unit tested independently of when/how often they're called from App.tsx.
 *
 * Deliberately the only place either rule lives: src/state/gameReducer.ts calls into these two
 * functions rather than reimplementing them, and App.tsx never computes a Pitz amount or a
 * purchase outcome directly (SSOT-adjacent instruction: "App.tsxへ経済ルールを直接大量に書かない").
 */

// ---------------------------------------------------------------------------------------------
// Mission reward (Pitz earned from completing a Lunch Rush run)
// ---------------------------------------------------------------------------------------------

/** Flat Pitz every Mission run earns just for serving at least one pizza -- see
 *  `calculateMissionReward`'s zero-serve guard below for why this is never paid out alone. */
export const MISSION_REWARD_BASE_PITZ = 40;

/** Pitz per 10 points of average pizza Quality (0-100 scale, `averageQualityScore`), floored. */
export const MISSION_REWARD_QUALITY_BONUS_PER_10_AVG_QUALITY = 5;

/** Pitz per pizza served, up to `MISSION_REWARD_SERVE_BONUS_CAP` pizzas. */
export const MISSION_REWARD_SERVE_BONUS_PER_PIZZA = 5;

/** Serve bonus stops scaling past this many pizzas in one run -- keeps an unusually long or
 *  fast run from earning unbounded Pitz (SSOT: "通常プレイで極端に稼げない"). */
export const MISSION_REWARD_SERVE_BONUS_CAP = 10;

/**
 * Mission Score (`missionScore`, ../logic/missionScoring.ts) and Pitz reward are deliberately
 * separate formulas over the same underlying `MissionMetrics` -- Mission Score is a
 * leaderboard-style number with no ceiling, while a Pitz reward must stay bounded per run
 * (SSOT: "通常プレイで極端に稼げない"). Never derive one from the other.
 *
 * A run that serves nothing earns nothing: 0 pizzas served always yields exactly 0 Pitz,
 * regardless of the (meaningless, `averageQualityScore`'s own 0-serve guard already returns 0
 * for it) quality term -- "0枚提供で大量Pitzを禁止" is satisfied by construction, not just by
 * the quality/serve terms happening to be small.
 *
 * Bounded: with at least one serve, the result ranges from
 * `MISSION_REWARD_BASE_PITZ` + a small quality/serve bonus (a single low-quality pizza) up to
 * `MISSION_REWARD_BASE_PITZ + 50 + 50 = 140` (average Quality 100, 10+ pizzas served) -- squarely
 * in the "1〜3 Missionで初期Shop商品を買える" ~50-150 Pitz/run target (see the Result report's
 * worked examples for beginner/average/skilled play).
 *
 * Deterministic: same `metrics` in, same reward out, every time -- no randomness, no external
 * state, so a re-render or a duplicate call never risks computing a different amount for the
 * same run (the one-shot *granting* guarantee itself lives in gameReducer's
 * `CLAIM_MISSION_REWARD`, not here -- this function only computes the amount).
 */
export function calculateMissionReward(metrics: MissionMetrics): number {
  if (metrics.servedCount <= 0) return 0;
  const qualityBonus =
    Math.floor(averageQualityScore(metrics) / 10) * MISSION_REWARD_QUALITY_BONUS_PER_10_AVG_QUALITY;
  const serveBonus =
    Math.min(metrics.servedCount, MISSION_REWARD_SERVE_BONUS_CAP) * MISSION_REWARD_SERVE_BONUS_PER_PIZZA;
  return MISSION_REWARD_BASE_PITZ + qualityBonus + serveBonus;
}

// ---------------------------------------------------------------------------------------------
// Ingredient purchase (Pitz -> permanent OWNED, SSOT section 9)
// ---------------------------------------------------------------------------------------------

export type PurchaseFailureReason =
  | "LOCKED"
  | "ALREADY_OWNED"
  | "INSUFFICIENT_FUNDS"
  | "NOT_FOR_SALE";

export interface PurchaseIngredientInput {
  ingredient: Ingredient;
  ownedIngredientIds: readonly string[];
  /** Mastery, i.e. `totalStars(dex)` (../logic/mastery.ts) -- callers compute this once from
   *  Dex and pass it in, rather than this module reaching into Dex itself. */
  totalStars: number;
  pitzBalance: number;
}

export type PurchaseIngredientResult =
  | { success: true; nextOwnedIngredientIds: string[]; nextPitzBalance: number }
  | { success: false; reason: PurchaseFailureReason };

/** A valid shop price: a positive integer. Rejects missing, zero, negative, fractional, NaN,
 *  and non-finite prices -- an ingredient with anything else set as `pricePitz` is simply not
 *  for sale, never "free" or "infinitely expensive". */
function isValidPrice(price: number | undefined): price is number {
  return typeof price === "number" && Number.isInteger(price) && price > 0;
}

/**
 * The one purchase transaction: Pitz -> permanent OWNED (SSOT section 9). Pure and atomic by
 * construction -- it never mutates its input, only returns what the *next* state should be, so
 * the caller (gameReducer's PURCHASE_INGREDIENT) applies the whole transaction in one reducer
 * step or not at all. There is no partial-success case: either `pitzBalance` decreases by
 * exactly `pricePitz` and the ingredient id is added exactly once, or nothing about the caller's
 * state should change.
 *
 * Calling this twice with the *same* pre-purchase input (e.g. a double-tap before a re-render)
 * always returns the same successful result both times -- that's expected and harmless as long
 * as the caller only ever *applies* one of those results before the next one is computed, which
 * is exactly what a `useReducer` dispatch queue guarantees (gameReducer processes actions
 * sequentially against the already-updated state, so a second PURCHASE_INGREDIENT for the same
 * ingredient sees it as already OWNED and gets ALREADY_OWNED instead of double-charging).
 */
export function purchaseIngredient(input: PurchaseIngredientInput): PurchaseIngredientResult {
  const { ingredient, ownedIngredientIds, totalStars, pitzBalance } = input;
  const state = ingredientState(ingredient, ownedIngredientIds, totalStars);

  if (state === "OWNED") return { success: false, reason: "ALREADY_OWNED" };
  if (state === "LOCKED") return { success: false, reason: "LOCKED" };

  // state === "AVAILABLE_TO_BUY"
  if (!isValidPrice(ingredient.pricePitz)) return { success: false, reason: "NOT_FOR_SALE" };
  if (pitzBalance < ingredient.pricePitz) return { success: false, reason: "INSUFFICIENT_FUNDS" };

  return {
    success: true,
    nextOwnedIngredientIds: [...ownedIngredientIds, ingredient.id],
    nextPitzBalance: pitzBalance - ingredient.pricePitz,
  };
}

// ---------------------------------------------------------------------------------------------
// Ingredient restock (Pitz -> +inventory batch, Economy & Progression 1.0 EP3)
// ---------------------------------------------------------------------------------------------

/**
 * Economy & Progression 1.0 EP3: restock is a *separate* transaction from `purchaseIngredient`
 * above, deliberately never folded into it. `purchaseIngredient`'s own contract is "grant
 * ownership exactly once" -- calling it again for an already-OWNED ingredient always rejects
 * with `ALREADY_OWNED`, by design (SSOT section 9: "purchases are permanent," never repeatable).
 * Restocking an already-owned finite ingredient's stock is a genuinely different rule (repeatable,
 * credits `inventory[id]` instead of `ownedIngredientIds`), so it needs its own failure-reason
 * vocabulary and its own pure function -- reusing `purchaseIngredient` here would either have to
 * special-case OWNED into a different code path internally (muddying its own single-purpose
 * contract) or silently change what "purchase" has always meant. This keeps the two Shop
 * concepts -- "unlock a new ingredient" vs. "restock a finite ingredient you already own" --
 * exactly as structurally separate in code as the EP3 task requires them to be in product terms.
 */
export type RestockFailureReason = "NOT_OWNED" | "UNLIMITED" | "NOT_FOR_SALE" | "INSUFFICIENT_FUNDS";

export interface RestockIngredientInput {
  ingredient: Ingredient;
  ownedIngredientIds: readonly string[];
  inventory: InventoryState;
  pitzBalance: number;
}

export type RestockIngredientResult =
  | { success: true; nextInventory: InventoryState; nextPitzBalance: number }
  | { success: false; reason: RestockFailureReason };

/** A valid restock batch size: a positive integer, mirroring `isValidPrice`'s own rules for
 *  the same reasons (an ingredient with anything else set as `restockQuantity` is simply not
 *  restockable, never "free" or "an infinite/zero-sized batch"). */
function isValidQuantity(quantity: number | undefined): quantity is number {
  return typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0;
}

/**
 * The one restock transaction: Pitz -> `+restockQuantity` on `inventory[ingredient.id]` (SSOT
 * `TETO_ECONOMY-PROGRESSION-1_MATRIX.md` section 2). Pure and atomic by construction, exactly
 * like `purchaseIngredient` above: it never mutates its input, only returns what the *next*
 * state should be, so the caller (gameReducer's `RESTOCK_INGREDIENT`) applies the whole
 * transaction in one reducer step or not at all -- there is no partial-success case where Pitz
 * is spent without inventory being credited, or vice versa.
 *
 * Restock only ever applies to an ingredient that is (a) already OWNED and (b) genuinely finite
 * (`unlockCondition` present, i.e. not a permanently-unlimited Starter ingredient) -- an
 * ingredient the player has never unlocked, or one that's structurally unlimited, is never a
 * valid restock target regardless of Pitz balance. This is the EP3 task's own "既にunlock/owned
 * 済みの有限ingredientについて" scope boundary, enforced here rather than left to callers.
 *
 * Calling this twice with the *same* pre-restock input (e.g. a double-tap before a re-render)
 * always returns the same successful result both times -- harmless for the identical reason
 * `purchaseIngredient`'s own doc comment gives: a `useReducer` dispatch queue applies actions
 * sequentially against the already-updated state, so a genuine double-dispatch is charged and
 * credited exactly once per actual successful application, never twice from one tap.
 */
export function restockIngredient(input: RestockIngredientInput): RestockIngredientResult {
  const { ingredient, ownedIngredientIds, inventory, pitzBalance } = input;

  if (!ingredient.unlockCondition) return { success: false, reason: "UNLIMITED" };
  if (!ownedIngredientIds.includes(ingredient.id)) return { success: false, reason: "NOT_OWNED" };
  if (!isValidPrice(ingredient.pricePitz) || !isValidQuantity(ingredient.restockQuantity)) {
    return { success: false, reason: "NOT_FOR_SALE" };
  }
  if (pitzBalance < ingredient.pricePitz) return { success: false, reason: "INSUFFICIENT_FUNDS" };

  return {
    success: true,
    nextInventory: {
      ...inventory,
      [ingredient.id]: (inventory[ingredient.id] ?? 0) + ingredient.restockQuantity,
    },
    nextPitzBalance: pitzBalance - ingredient.pricePitz,
  };
}
