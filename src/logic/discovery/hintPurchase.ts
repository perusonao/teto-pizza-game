/**
 * Discovery Hint Economy 1.0 (Issue #232): the paid, persistent hint levels.
 *
 * Authority: docs/reports/TETO_DISCOVERY-HINT-ECONOMY-1_FRESH-AUDIT.md §4 / §10 and the Owner
 * decisions OD-HE-1..10 recorded on Issue #232.
 *
 * HE-1: the ledger shape. `recipeId -> highest purchased hint level` (1..4 today). It stores a
 * *level*, never a step index into `buildHintSteps`, so the lines are always derived at read time.
 */
export type DiscoveryHintPurchases = Readonly<Record<string, number>>;

/** The highest level bought for `recipeId` (0 = none). A stored value is never trusted past the
 *  recipe's own `maxLevel` (a later build may store a higher level than this build knows). */
export function purchasedHintLevel(purchases: DiscoveryHintPurchases, recipeId: string, maxLevel: number): number {
  const stored = purchases[recipeId];
  if (typeof stored !== "number" || !Number.isInteger(stored) || stored < 1) return 0;
  return Math.min(stored, maxLevel);
}
