/**
 * Dinner Mission DM-1 (Issue #236): the reward *shape* only -- OD-DM-9 fixes the model (CLEAR plus a
 * completion-time tier) but leaves every number to DM-5, which measures real play time first. So
 * the one Phase 1 table below has no thresholds and no Pitz amounts, a quote made from it names the
 * outcome but pays nothing, and nothing here is wired to Pitz, the save or the UI.
 *
 * The tier is its own concept (OD-DM-10): GOLD / SILVER / BRONZE, never a `QualityStars` value, and
 * nothing here reads or writes the Dex, so a Dinner result can never add to progression stars
 * (`totalStars`, ../../logic/mastery.ts).
 */

export type DinnerClearTier = "GOLD" | "SILVER" | "BRONZE";

export const DINNER_CLEAR_TIERS: readonly DinnerClearTier[] = ["GOLD", "SILVER", "BRONZE"];

/**
 * Inclusive clear-time upper bounds (ms from START). A clear at or under `goldMaxClearMs` is GOLD,
 * else at or under `silverMaxClearMs` SILVER, else at or under `bronzeMaxClearMs` BRONZE; slower
 * than that it is a plain CLEAR with no tier. DM-5 decides the values (BRONZE may simply equal the
 * time limit so that every clear earns at least BRONZE).
 */
export interface DinnerTierThresholds {
  goldMaxClearMs: number;
  silverMaxClearMs: number;
  bronzeMaxClearMs: number;
}

/** Pitz for one clear: a base for clearing plus a bonus by tier. */
export interface DinnerPayout {
  clear: number;
  tierBonus: Readonly<Record<DinnerClearTier, number>>;
}

export interface DinnerRewardTable {
  tableId: string;
  /** `null` until DM-5 measures play time: every clear then has no tier. */
  thresholds: DinnerTierThresholds | null;
  /** `null` until DM-5 decides the amounts: a quote then pays nothing. The first clear of a mission
   *  and every later clear have separate schedules (first-clear bonus / repeat reward, OD-DM-9). */
  pitz: { firstClear: DinnerPayout; repeatClear: DinnerPayout } | null;
}

export const DINNER_PHASE1_REWARD_TABLE_ID = "dinner-phase1-untuned";

export const DINNER_REWARD_TABLES: readonly DinnerRewardTable[] = [
  { tableId: DINNER_PHASE1_REWARD_TABLE_ID, thresholds: null, pitz: null },
];

export function getDinnerRewardTable(tableId: string): DinnerRewardTable | undefined {
  return DINNER_REWARD_TABLES.find((t) => t.tableId === tableId);
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Problems with a table's own numbers (empty when valid). An untuned table is valid. */
export function validateDinnerRewardTable(table: DinnerRewardTable): string[] {
  const problems: string[] = [];
  if (table.tableId === "") problems.push("tableId is empty");
  const t = table.thresholds;
  if (t) {
    const bounds = [t.goldMaxClearMs, t.silverMaxClearMs, t.bronzeMaxClearMs];
    if (!bounds.every((b) => Number.isFinite(b) && b > 0)) problems.push(`${table.tableId}: thresholds must be positive`);
    if (!(t.goldMaxClearMs <= t.silverMaxClearMs && t.silverMaxClearMs <= t.bronzeMaxClearMs)) {
      problems.push(`${table.tableId}: thresholds must satisfy gold <= silver <= bronze`);
    }
  }
  if (table.pitz) {
    for (const payout of [table.pitz.firstClear, table.pitz.repeatClear]) {
      const amounts = [payout.clear, ...DINNER_CLEAR_TIERS.map((tier) => payout.tierBonus[tier])];
      if (!amounts.every((a) => Number.isInteger(a) && a >= 0)) {
        problems.push(`${table.tableId}: Pitz amounts must be non-negative integers`);
      }
    }
  }
  return problems;
}

/** The tier a clear time earns, or `null` (untuned table, invalid time, or slower than BRONZE). */
export function dinnerClearTier(clearMs: number, thresholds: DinnerTierThresholds | null): DinnerClearTier | null {
  if (!thresholds || !isNonNegativeFinite(clearMs)) return null;
  if (clearMs <= thresholds.goldMaxClearMs) return "GOLD";
  if (clearMs <= thresholds.silverMaxClearMs) return "SILVER";
  if (clearMs <= thresholds.bronzeMaxClearMs) return "BRONZE";
  return null;
}

/** What a finished run is worth. A FAILED run is always worth nothing. */
export type DinnerRewardQuote =
  | { kind: "FAILED"; pitz: 0 }
  | {
      kind: "CLEAR";
      clearMs: number;
      tier: DinnerClearTier | null;
      /** `null` while the table's amounts are untuned (nothing to pay yet). */
      pitz: { clear: number; tierBonus: number; total: number } | null;
    };

export type DinnerRewardOutcome = { kind: "CLEAR"; clearMs: number } | { kind: "FAILED" };

/**
 * Pure quote for a finished run. `isFirstClear` picks the first-clear schedule; deciding it (from
 * DM-4's records) and paying the quote exactly once belong to later phases.
 */
export function quoteDinnerReward(
  outcome: DinnerRewardOutcome,
  table: DinnerRewardTable,
  { isFirstClear }: { isFirstClear: boolean },
): DinnerRewardQuote {
  if (outcome.kind !== "CLEAR") return { kind: "FAILED", pitz: 0 };
  const tier = dinnerClearTier(outcome.clearMs, table.thresholds);
  if (!table.pitz) return { kind: "CLEAR", clearMs: outcome.clearMs, tier, pitz: null };
  const payout = isFirstClear ? table.pitz.firstClear : table.pitz.repeatClear;
  const tierBonus = tier ? payout.tierBonus[tier] : 0;
  return {
    kind: "CLEAR",
    clearMs: outcome.clearMs,
    tier,
    pitz: { clear: payout.clear, tierBonus, total: payout.clear + tierBonus },
  };
}
