/**
 * B案再構成 Phase 2b (Issue #901): the shop owner's title ladder -- what the shop model shows instead of 「第○章」.
 *
 * Owner decision (2026-11-26): six titles, each with the reputation it is reached at and the shop's stage:
 *   見習い 0（屋台）/ 駆け出し 15（屋台）/ 一人前 40（小さな店）/ 職人 110（人気店）/ 達人 210（有名店）/ 匠 340（伝説の店）
 *
 * The rank is a display only. The shop's stages -- where materials open -- stay the chapter floors of `REPUTATION_TABLE`
 * (0 / 40 / 110 / 210 / 340): every rank but 駆け出し starts exactly on one of them (./shopRank.test.ts pins this), and 駆け出し is a
 * title-only early promotion that opens nothing and changes no pool. Nothing here is saved; the rank is derived from the reputation.
 * Change a value here only on a new Owner decision.
 */

export interface ShopRank {
  /** 1-based position on the ladder. */
  level: number;
  /** The owner's title (見習い ... 匠). */
  title: string;
  /** The shop's stage at this title (屋台 ... 伝説の店). */
  stage: string;
  /** The reputation this title is reached at. */
  floor: number;
}

export const SHOP_RANKS: readonly ShopRank[] = Object.freeze([
  Object.freeze({ level: 1, title: "見習い", stage: "屋台", floor: 0 }),
  Object.freeze({ level: 2, title: "駆け出し", stage: "屋台", floor: 15 }),
  Object.freeze({ level: 3, title: "一人前", stage: "小さな店", floor: 40 }),
  Object.freeze({ level: 4, title: "職人", stage: "人気店", floor: 110 }),
  Object.freeze({ level: 5, title: "達人", stage: "有名店", floor: 210 }),
  Object.freeze({ level: 6, title: "匠", stage: "伝説の店", floor: 340 }),
]);

/** The rank a reputation holds: the highest title whose floor it has reached (at least 見習い). */
export function rankForReputation(reputation: number, ranks: readonly ShopRank[] = SHOP_RANKS): ShopRank {
  let rank = ranks[0];
  for (const r of ranks) {
    if (reputation >= r.floor) rank = r;
  }
  return rank;
}

/** The next title above this reputation's, or `null` at the top of the ladder. */
export function nextRankAbove(reputation: number, ranks: readonly ShopRank[] = SHOP_RANKS): ShopRank | null {
  return ranks.find((r) => r.floor > reputation) ?? null;
}

/** The title reached at a reputation floor (used to name the rank a chapter floor opens with). */
export function rankAtFloor(floor: number, ranks: readonly ShopRank[] = SHOP_RANKS): ShopRank {
  return rankForReputation(floor, ranks);
}

/** 「一人前（小さな店）」 */
export function rankLabel(rank: ShopRank): string {
  return `${rank.title}（${rank.stage}）`;
}
