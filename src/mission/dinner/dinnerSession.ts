import type { QualityStars } from "../../logic/scoring";
import type { InventoryState } from "../../state/inventory";
import type { DinnerAttemptView, DinnerBakePlan } from "./dinnerResultDetection";
import type { DinnerRunState } from "./dinnerRun";

/**
 * Dinner Mission DM-2 (Issue #239) / DM-3R-2 (Issue #250): the Dinner run as the game runtime holds
 * it (`GameState.dinner`, ../../state/gameReducer.ts). Never saved -- a reload starts with no run
 * (OD-DM-7). `null` in GameState whenever no Dinner Mission is on screen.
 */
export interface DinnerSession {
  run: DinnerRunState;
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
