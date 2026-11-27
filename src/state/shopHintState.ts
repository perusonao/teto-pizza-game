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
import { deriveResearchEntries } from "../logic/discovery/researchEntry";

export interface ShopHintStateInputs {
  dex: DexState;
  /** For the Research Entries' unlock facts (carried over as known). Optional: absent = none owned. */
  ownedIngredientIds?: readonly string[];
  shop: ShopProgressState;
  discoveryHintFacts: Readonly<Record<string, readonly string[]>>;
  discoveryHintPurchases: unknown;
}

/** True while the shop model runs (with a complete reputation table): Pitz never buys a hint then. */
export function shopHintsActive(): boolean {
  return activeProgressionModel().id === "shop" && completeReputationTable() !== null;
}

/** One-entry memo: the Dex renders a board per slot from the same state, so the projection is derived once. */
let researchMemo: { dex: DexState; owned: readonly string[]; facts: unknown; unlock: ReadonlyMap<string, string> } | null = null;

function researchUnlockOf(state: ShopHintStateInputs): ReadonlyMap<string, string> {
  const owned = state.ownedIngredientIds ?? NO_IDS;
  if (researchMemo && researchMemo.dex === state.dex && researchMemo.owned === owned && researchMemo.facts === state.discoveryHintFacts) {
    return researchMemo.unlock;
  }
  const { entries } = deriveResearchEntries(
    { dex: state.dex, ownedIngredientIds: owned, discoveryHintFacts: state.discoveryHintFacts },
    undefined,
    activeProgressionModel().catalogRecipes(),
  );
  const unlock = new Map(entries.map((e) => [e.recipeId as string, e.unlockIngredientId]));
  researchMemo = { dex: state.dex, owned, facts: state.discoveryHintFacts, unlock };
  return unlock;
}

const NO_IDS: readonly string[] = Object.freeze([]);

function inputsOf(state: ShopHintStateInputs): ShopHintInputs {
  const unlock = researchUnlockOf(state);
  return {
    researchKnownIngredientIdOf: (recipeId) => unlock.get(recipeId) ?? null,
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
