/**
 * Discovery Hint Economy 1.0 (Issue #232): the paid, persistent hint levels.
 *
 * Authority: docs/reports/TETO_DISCOVERY-HINT-ECONOMY-1_FRESH-AUDIT.md §4 / §10 and the Owner
 * decisions OD-HE-1..10 recorded on Issue #232.
 *
 * HE-1: the ledger shape. `recipeId -> highest purchased hint level` (1..4 today). It stores a
 * *level*, never a step index into `buildHintSteps`, so the lines are always derived at read time.
 * HE-2: the price table and the pure purchase rule the reducer applies.
 *
 * Unit = recipe x level (OD-HE-3): a level is paid once, the first time it is unlocked
 * (OD-HE-2), and re-reading it is free forever. H4 is one level, so one purchase shows every H4
 * line (still n-1 capped by `buildHintSteps`).
 */
export type DiscoveryHintPurchases = Readonly<Record<string, number>>;

/** The highest level bought for `recipeId` (0 = none). A stored value is never trusted past the
 *  recipe's own `maxLevel` (a later build may store a higher level than this build knows). */
export function purchasedHintLevel(purchases: DiscoveryHintPurchases, recipeId: string, maxLevel: number): number {
  const stored = purchases[recipeId];
  if (typeof stored !== "number" || !Number.isInteger(stored) || stored < 1) return 0;
  return Math.min(stored, maxLevel);
}

/** HE-2 (OD-HE-1, Candidate B): the one-time price of unlocking each hint level for one recipe.
 *  H0 (the "a new pizza is possible" line) is always free. A full set costs 75 Pitz. No H5
 *  (OD-HE-7): nothing beyond H4 is ever for sale. */
export const DISCOVERY_HINT_PRICES = { 1: 5, 2: 10, 3: 20, 4: 40 } as const;

export type PurchasableHintLevel = keyof typeof DISCOVERY_HINT_PRICES;

export const MAX_PURCHASABLE_HINT_LEVEL: PurchasableHintLevel = 4;

function isPurchasableHintLevel(level: number): level is PurchasableHintLevel {
  return Number.isInteger(level) && level >= 1 && level <= MAX_PURCHASABLE_HINT_LEVEL;
}

/** The price of `level`: 0 for H0, `DISCOVERY_HINT_PRICES` for H1..H4. */
export function discoveryHintPrice(level: number): number {
  if (level === 0) return 0;
  if (!isPurchasableHintLevel(level)) throw new RangeError(`no hint level ${level} for sale`);
  return DISCOVERY_HINT_PRICES[level];
}

const ONBOARDING_RECIPE_ID = "margherita";

/** OD-HE-5: the first Margherita onboarding (Dex 0, target Margherita) is free and nothing is
 *  written to the ledger -- the player has no Pitz yet. Only that pair: any other recipe that is
 *  DISCOVERABLE at Dex 0 (e.g. on a migrated save) is priced like every other hint. */
export function isHintOnboardingFree(discoveredCount: number, recipeId: string): boolean {
  return discoveredCount === 0 && recipeId === ONBOARDING_RECIPE_ID;
}

export type DiscoveryHintPurchaseFailure =
  /** The level is not H1..H4, is not exactly the next one after the purchased level (a skip, a
   *  stale or a repeated tap), or is past the recipe's own last level. */
  | "NOT_NEXT_LEVEL"
  /** The recipe is not the session's DISCOVERABLE hint target (any more). */
  | "NOT_A_TARGET"
  /** Dex-0 Margherita: the onboarding reveal is free and session-only, never a purchase. */
  | "ONBOARDING_FREE"
  | "INSUFFICIENT_PITZ";

export interface DiscoveryHintPurchaseInput {
  recipeId: string;
  requestedLevel: number;
  /** The recipe's last hint level (`buildHintSteps(...).at(-1).level`, 3 or 4). */
  maxLevel: number;
  /** True only while `recipeId` is the session's hint target and DISCOVERABLE. */
  isTarget: boolean;
  discoveredCount: number;
  purchases: DiscoveryHintPurchases;
  pitzBalance: number;
}

export type DiscoveryHintPurchaseResult =
  | {
      success: true;
      level: PurchasableHintLevel;
      price: number;
      nextPurchases: DiscoveryHintPurchases;
      nextPitzBalance: number;
    }
  | { success: false; reason: DiscoveryHintPurchaseFailure };

/**
 * HE-2: the single authority for buying one hint level (same "pure rule, reducer only applies it"
 * pattern as `purchaseFirstPack`). Everything is re-checked from the input, never from the UI:
 * the target, the purchased level, that the requested level is exactly the next one, the price
 * and the balance. A success debits Pitz and raises the ledger together; any failure changes
 * nothing. Because the requested level must equal `purchased + 1`, a double tap or a stale event
 * for a level already bought is rejected -- the same level can never be charged twice, and
 * levels can never be skipped. The balance never goes negative.
 */
export function purchaseDiscoveryHint(input: DiscoveryHintPurchaseInput): DiscoveryHintPurchaseResult {
  if (!input.isTarget) return { success: false, reason: "NOT_A_TARGET" };
  if (isHintOnboardingFree(input.discoveredCount, input.recipeId)) return { success: false, reason: "ONBOARDING_FREE" };
  const maxLevel = Math.min(input.maxLevel, MAX_PURCHASABLE_HINT_LEVEL);
  const purchased = purchasedHintLevel(input.purchases, input.recipeId, maxLevel);
  const level = input.requestedLevel;
  if (!isPurchasableHintLevel(level) || level !== purchased + 1 || level > maxLevel) {
    return { success: false, reason: "NOT_NEXT_LEVEL" };
  }
  const price = DISCOVERY_HINT_PRICES[level];
  if (!Number.isFinite(input.pitzBalance) || input.pitzBalance < price) {
    return { success: false, reason: "INSUFFICIENT_PITZ" };
  }
  return {
    success: true,
    level,
    price,
    nextPurchases: { ...input.purchases, [input.recipeId]: Math.max(input.purchases[input.recipeId] ?? 0, level) },
    nextPitzBalance: input.pitzBalance - price,
  };
}
