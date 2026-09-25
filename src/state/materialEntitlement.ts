import { DISCOVERY_LADDER, type DiscoveryLadder } from "../data/discoveryLadder";
import { getIngredient } from "../data/ingredients";
import { discoveredRecipeCount, resolveMaterialUnlocks } from "../logic/discoveryLadder";
import type { DexState } from "./dex";

/**
 * Progression 2.0 W1 Integration I4b-3: the one bridge from runtime state to the Discovery Ladder
 * (REC-04 OD-REC04-1/2; docs/reports/TETO_PROGRESS2_W1_I4B_Fresh-Audit.md §3 A/B/D/K). Replaces
 * EP4's `applyStarterGrants` at the same three call sites (gameReducer's REGISTER_TO_DEX and
 * MISSION_NEXT_ORDER, App.tsx's load path).
 *
 * The Shop entitlement is the union of
 * - the persisted ledger (`unlockedForShopIngredientIds`; never shrinks),
 * - every finite material already OWNED (bought, or granted by the retired EP4 -- an existing save
 *   keeps those as OWNED with its stock), and
 * - the ladder materials reached at the Dex discovered count.
 *
 * Unlocking grants no stock and never touches `ownedIngredientIds`/`inventory` (OD-REC04-2: stock
 * 0 until the first pack is bought). The onboarding starters are never part of it. Pure and
 * deterministic; a no-op call returns the input ledger by reference.
 */

export interface ShopEntitlementResult {
  unlockedForShopIngredientIds: readonly string[];
  /** Ladder materials this call unlocked that were not entitled before, in ladder order. */
  newlyUnlockedMaterialIds: readonly string[];
}

function isFiniteMaterial(id: string): boolean {
  return !!getIngredient(id)?.unlockCondition;
}

export function resolveShopEntitlement(
  dex: DexState,
  ownedIngredientIds: readonly string[],
  unlockedForShopIngredientIds: readonly string[],
  ladder: DiscoveryLadder = DISCOVERY_LADDER,
): ShopEntitlementResult {
  const { unlockedMaterialIds, newlyUnlockedMaterialIds } = resolveMaterialUnlocks({
    ladder,
    discoveredCount: discoveredRecipeCount(dex),
    alreadyUnlockedMaterialIds: [
      ...unlockedForShopIngredientIds,
      ...ownedIngredientIds.filter(isFiniteMaterial),
    ],
  });
  const unchanged =
    unlockedMaterialIds.length === unlockedForShopIngredientIds.length &&
    unlockedMaterialIds.every((id, i) => id === unlockedForShopIngredientIds[i]);
  return {
    unlockedForShopIngredientIds: unchanged ? unlockedForShopIngredientIds : unlockedMaterialIds,
    newlyUnlockedMaterialIds,
  };
}

/** Transient NEW MATERIAL notice for the DISCOVERED screen (never persisted, reset every round,
 *  same lifecycle as `lastPitzCredit`). */
export interface MaterialUnlockNotice {
  /** Newly unlocked material ids, in ladder order -- never empty. */
  ingredientIds: readonly string[];
  /** Ready-to-render copy, e.g. `🆕 新しい材料「たまご」が入荷！ショップで仕入れよう`. */
  messageJa: string;
}

export function buildMaterialUnlockNotice(
  newlyUnlockedMaterialIds: readonly string[],
): MaterialUnlockNotice | null {
  if (newlyUnlockedMaterialIds.length === 0) return null;
  const namesJa = newlyUnlockedMaterialIds.map((id) => getIngredient(id)?.nameJa ?? id).join("・");
  return {
    ingredientIds: newlyUnlockedMaterialIds,
    messageJa: `\u{1F195} 新しい材料「${namesJa}」が入荷！ショップで仕入れよう`,
  };
}
