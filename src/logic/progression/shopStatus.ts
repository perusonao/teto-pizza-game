/**
 * B案再構成 Phase 2a (Issue #901): what the UI reads about the shop model. Everything here is `false` / `null` under the
 * legacy model.
 */
import { completeReputationTable } from "./progressionModel";
import { PROGRESSION_MODEL_ID } from "./progressionModelFlag";
import type { CompleteReputationTable } from "./reputationTable";
import type { ShopProgressState } from "./shopProgress";
import { chapterForReputation, nextChapterFloor } from "./shopProgression";
import { nextRankAbove, rankAtFloor, rankForReputation, type ShopRank } from "./shopRank";

/** True for a page load that selected the shop model. */
export const SHOP_MODEL_ACTIVE: boolean = PROGRESSION_MODEL_ID === "shop";

export interface ShopReputationStatus {
  reputation: number;
  /** The open chapter (1..5). */
  chapter: number;
  /** The next chapter's floor, or `null` once the last chapter is open. */
  nextFloor: number | null;
  /** B案 Phase 2b: the owner's title (./shopRank.ts) -- what the screens show instead of the chapter. */
  rank: ShopRank;
  /** The next title, or `null` at the top of the ladder. */
  nextRank: ShopRank | null;
  /** The title the next chapter (new materials) opens with, or `null` once the last chapter is open. */
  nextMaterialRank: ShopRank | null;
}

/** The HOME line's numbers, or `null` when the shop rules are not running. */
export function shopReputationStatus(shop: ShopProgressState): ShopReputationStatus | null {
  const table = completeReputationTable();
  if (!SHOP_MODEL_ACTIVE || table === null) return null;
  return buildShopReputationStatus(shop.reputation, table);
}

/** The status of a reputation under a complete table (pure; the screens' tests build it directly). */
export function buildShopReputationStatus(reputation: number, table: CompleteReputationTable): ShopReputationStatus {
  const nextFloor = nextChapterFloor(reputation, table.chapterFloors);
  return {
    reputation,
    chapter: chapterForReputation(reputation, table.chapterFloors),
    nextFloor,
    rank: rankForReputation(reputation),
    nextRank: nextRankAbove(reputation),
    nextMaterialRank: nextFloor === null ? null : rankAtFloor(nextFloor),
  };
}
