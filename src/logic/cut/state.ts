/**
 * Pizza Cutting 1.0 Phase 1 (docs/design/TETO_PIZZA-CUTTING_1.0.md §11/§18): a pure, standalone
 * transient CUT state shape and its helper functions -- `config`/`lines`/`evaluation`, matching
 * the design doc's own `PizzaState`/`GameState` data-boundary table (§11: "`cutLines: readonly
 * CutLine[]` -- committed lines only" / "`cutResult: CutEvaluation | null` -- computed once at
 * CUT's own confirm action, mirrors `scoringV2Result`/`completion`'s existing 'compute once,
 * store, never live-recompute' contract").
 *
 * **Deliberately not wired into `../../state/gameReducer.ts`'s `GameState` in this phase** --
 * CUT Phase 1's own scope is "geometry + transient state foundation" only (design doc §18); the
 * reducer/UI wiring that lets Phase 2 dispatch real pointer-driven actions against this shape is
 * explicitly out of scope here. This module is what that future wiring will call.
 *
 * Never persisted: no `PersistentSaveV2` field, no `CURRENT_SCHEMA_VERSION` involvement, exactly
 * as transient as `sauceDeposits`/`toppings` already are (design doc §10).
 */
import { DEFAULT_CUT_CONFIG, type CutConfig, type CutEvaluation, type CutLine } from "./types";
import { evaluateCut } from "./evaluation";

export interface CutState {
  readonly config: CutConfig;
  readonly lines: readonly CutLine[];
  /** `null` until an explicit `evaluateCutState` call -- mirrors the design doc's own
   *  "`cutResult` computed once at CUT's own confirm action" contract (§11): adding a line
   *  invalidates any prior evaluation (set back to `null`, ./state.ts's own `addCutLine`) rather
   *  than silently going stale. */
  readonly evaluation: CutEvaluation | null;
}

/** A fresh CUT state for a round -- `lines: []`, `evaluation: null`, matching the design doc
 *  §15.3's own "CUT step entered" reducer-level acceptance criterion. */
export function createCutState(config: CutConfig = DEFAULT_CUT_CONFIG): CutState {
  return { config, lines: [], evaluation: null };
}

/** Appends one committed line. Invalidates any previous `evaluation` (set to `null`) rather than
 *  leaving a now-stale value in place -- the caller must call `evaluateCutState` again to get a
 *  result that reflects the new `lines`. */
export function addCutLine(state: CutState, line: CutLine): CutState {
  return { ...state, lines: [...state.lines, line], evaluation: null };
}

/** Discards all committed lines and any evaluation, keeping the same `config` -- the "fresh
 *  round" reset every other per-round field already gets on retry/recipe-change (design doc
 *  §15.3's own "cutLines/cutResult reset to empty/null" acceptance criterion). */
export function resetCutState(state: CutState): CutState {
  return { config: state.config, lines: [], evaluation: null };
}

/** Pizza Cutting 1.0 Phase 2 (design doc §8.4): removes exactly the most recently committed
 *  line, no others -- the one CUT-step undo affordance ("1本戻す"). A no-op (same reference
 *  back) when there is nothing to undo. Invalidates any prior evaluation, same as `addCutLine`,
 *  since a confirm after an undo must recompute against the now-shorter `lines`. */
export function undoLastCutLine(state: CutState): CutState {
  if (state.lines.length === 0) return state;
  return { ...state, lines: state.lines.slice(0, -1), evaluation: null };
}

/** Computes `evaluateCut(state.lines, state.config)` and stores it as `evaluation` -- the CUT
 *  step's own confirm action calls this exactly once per attempt (design doc §11). Safe to call
 *  with zero lines (returns the same defined, non-`NaN` worst-case result `evaluateCut` always
 *  produces for an empty `lines` array). */
export function evaluateCutState(state: CutState): CutState {
  return { ...state, evaluation: evaluateCut(state.lines, state.config) };
}
