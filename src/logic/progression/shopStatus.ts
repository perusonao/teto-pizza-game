/**
 * B案再構成 Phase 2a (Issue #901): what the UI reads about the shop model. Everything here is `false` / `null` under the
 * legacy model (Production), so a screen that branches on it renders exactly as before there.
 */
import { activeProgressionModel, completeReputationTable } from "./progressionModel";
import type { ShopProgressState } from "./shopProgress";
import { chapterForReputation, nextChapterFloor } from "./shopProgression";

/** True only while the shop model runs with its rules (the flag says shop -- Preview / DEV only -- and the table is complete). */
export const SHOP_MODEL_ACTIVE: boolean = activeProgressionModel().id === "shop" && completeReputationTable() !== null;

export interface ShopReputationStatus {
  reputation: number;
  /** The open chapter (1..5). */
  chapter: number;
  /** The next chapter's floor, or `null` once the last chapter is open. */
  nextFloor: number | null;
}

/** The HOME line's numbers, or `null` when the shop rules are not running. */
export function shopReputationStatus(shop: ShopProgressState): ShopReputationStatus | null {
  const table = completeReputationTable();
  if (!SHOP_MODEL_ACTIVE || table === null) return null;
  return {
    reputation: shop.reputation,
    chapter: chapterForReputation(shop.reputation, table.chapterFloors),
    nextFloor: nextChapterFloor(shop.reputation, table.chapterFloors),
  };
}
