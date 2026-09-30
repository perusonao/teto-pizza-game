import type { QualityStars } from "../../logic/scoring";
import type { InventoryState } from "../../state/inventory";
import type { DinnerAttemptView, DinnerBakePlan } from "./dinnerResultDetection";
import type { DinnerClearTier, DinnerRewardTable } from "./dinnerReward";
import type { DinnerRunState } from "./dinnerRun";
import type { DinnerPaySchedule } from "./dinnerSettlement";

/**
 * DM-4-3: what this run's CLEAR settlement did -- written once, by the reducer transition that
 * reached CLEARED (../../state/gameReducer.ts `dinnerResolve`), never by the UI. The UI (DM-4-4) only
 * reads it. `runKey` is the exactly-once backstop (DM-4-1 `settledRunKey`).
 * - SETTLED: the pure settlement ran; `pitz` was added to the balance in the same step and the
 *   record stored in `dinnerMissionRecordsState` (0 Pitz when the reward table is unavailable /
 *   untuned -- the clear is still recorded and the first-clear right is kept).
 * - BLOCKED: the mission's saved record is broken (fail-closed): no Pitz, no record write.
 * - REFUSED: the settlement authority refused the run (malformed / contradictory input).
 */
export type DinnerSettlementView =
  | {
      kind: "SETTLED";
      runKey: string;
      pitz: number;
      schedule: DinnerPaySchedule;
      tier: DinnerClearTier | null;
      clearMs: number;
      newBestTime: boolean;
      newBestTier: boolean;
    }
  | { kind: "BLOCKED"; runKey: string; pitz: 0 }
  | { kind: "REFUSED"; runKey: string; pitz: 0; problems: readonly string[] };

/**
 * Dinner Mission DM-2 (Issue #239) / DM-3R-2 (Issue #250): the Dinner run as the game runtime holds
 * it (`GameState.dinner`, ../../state/gameReducer.ts). Never saved -- a reload starts with no run
 * (OD-DM-7). `null` in GameState whenever no Dinner Mission is on screen.
 */
export interface DinnerSession {
  run: DinnerRunState;
  /** DM-4-3: the reward authority for this run, resolved once at DINNER_START from the mission's
   *  `reward.tableId` (`null` when unknown). Production has only the untuned table until DM-5-2, so a
   *  production clear pays 0 -- wiring is complete, balance activation is not (OD-DM5-5). */
  rewardTable: DinnerRewardTable | null;
  /** DM-4-3: the settlement of this run's CLEAR, or `null` while no CLEAR has happened. */
  settlement: DinnerSettlementView | null;
  /** HOME was requested during a PLAYING run and is waiting for confirm / cancel. */
  abandonRequested: boolean;
  /** The quality gate S for this run, injected at DINNER_START (OD-R2; DM-5 decides the value). */
  minimumStars: QualityStars;
  /** Increases with every fresh recipe-free round of this run, so the UI can reset per pizza
   *  (every Dinner round shares the one recipe-free order id). */
  roundSeq: number;
  /**
   * The pizza in progress between START_BAKE and its result (DM-3R-2). INTERNAL: `plan` carries the
   * composition's identity (Stage A), which the UI must never read directly -- only through
   * `dinnerBakePlanView`. `preConsumptionInventory` is `state.inventory` exactly as it was when
   * CONFIRM_BAKE was dispatched (before its one consumption), the stock Stage B needs; `null` until
   * then.
   */
  pending: { plan: DinnerBakePlan; preConsumptionInventory: InventoryState | null } | null;
  /** The last resolved pizza's presentation-safe result, shown until the next pizza starts. */
  lastResult: DinnerAttemptView | null;
}

export function isDinnerRunPlaying(session: DinnerSession | null): boolean {
  return session !== null && session.run.status === "PLAYING";
}
