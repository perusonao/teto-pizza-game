/**
 * B案 Phase 3d (Issue #901, shop model only): the research point hints wired to the game state -- the reducer's purchase and the
 * views the hint sheet, the Dex and the cooking screen render. The pure rules are ../logic/progression/shopHints.ts.
 *
 * Under the legacy model every function here answers "nothing" (`null` / `false`), so a legacy session never reads or writes
 * the shop hint ledger.
 */
import { activeProgressionModel, completeReputationTable } from "../logic/progression/progressionModel";
import {
  isShopHintTargetAt,
  purchaseShopHint,
  shopHintAnswer,
  shopHintBoardView,
  type ShopHintBoardView,
  type ShopHintInputs,
  type ShopHintResult,
} from "../logic/progression/shopHints";
import { activeShopCatalog } from "../logic/progression/shopProgression";
import type { ShopProgressState } from "../logic/progression/shopProgress";
import { discoveredRecipeIds, type DexState } from "./dex";
import { hintKeyToppingIdOf } from "./discoveryHint";

export interface ShopHintStateInputs {
  dex: DexState;
  shop: ShopProgressState;
  discoveryHintFacts: Readonly<Record<string, readonly string[]>>;
  discoveryHintPurchases: unknown;
}

/** True while the shop model runs (with a complete reputation table): Pitz never buys a hint then. */
export function shopHintsActive(): boolean {
  return activeProgressionModel().id === "shop" && completeReputationTable() !== null;
}

function inputsOf(state: ShopHintStateInputs): ShopHintInputs {
  return {
    shop: state.shop,
    discoveredCount: discoveredRecipeIds(state.dex).length,
    discoveryHintFacts: state.discoveryHintFacts,
    discoveryHintPurchases: state.discoveryHintPurchases,
  };
}

/** Whether `recipeId` is a hint target now (shop model only). */
export function isShopHintTarget(state: Pick<ShopHintStateInputs, "shop">, recipeId: string): boolean {
  const table = completeReputationTable();
  if (!shopHintsActive() || table === null) return false;
  return isShopHintTargetAt(recipeId, state.shop.reputation, table.chapterFloors, activeShopCatalog());
}

/** One purchase (the reducer's PURCHASE_SHOP_HINT). Legacy: always refused as not a target. */
export function purchaseShopHintFor(
  state: ShopHintStateInputs,
  request: { recipeId: unknown; kind: unknown; expectedPrice: unknown },
): ShopHintResult {
  if (!shopHintsActive()) return { ok: false, reason: "NOT_A_TARGET" };
  return purchaseShopHint(request, inputsOf(state), (id) => isShopHintTarget(state, id), activeShopCatalog(), hintKeyToppingIdOf);
}

/** The board of one target, or `null` (legacy, not a target, or data that does not resolve). */
export function shopHintBoardFor(state: ShopHintStateInputs, recipeId: string | null | undefined): ShopHintBoardView | null {
  if (!recipeId || !isShopHintTarget(state, recipeId)) return null;
  const answer = shopHintAnswer(recipeId, activeShopCatalog(), hintKeyToppingIdOf);
  return answer ? shopHintBoardView(answer, inputsOf(state)) : null;
}
