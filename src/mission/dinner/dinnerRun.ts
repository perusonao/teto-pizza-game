import { getRecipe, type Recipe, type RecipeId } from "../../data/recipes";
import type { DexState } from "../../state/dex";
import {
  recipeSetStockShortage,
  type RecipeSetInputs,
  type SetIngredientShortage,
} from "../../state/recipeSetFeasibility";
import {
  dinnerMissionUnlock,
  resolveDinnerTargets,
  validateDinnerMissions,
  type DinnerMissionDefinition,
} from "./dinnerMission";

/**
 * Dinner Mission DM-1 (Issue #236): the run state machine, pure. Separate from Lunch Rush's
 * `MissionState` / `missionRunReducer` (../lunchRush.ts) -- the two modes share only the pure stock
 * primitives. Not wired into App, the timer, the cooking round or the save yet (DM-2 onward).
 *
 * Rules (docs/reports/TETO_DINNER-MISSION_Phase0_Fresh-Design.md §17):
 * - START only when the mission is unlocked and the whole target set is cookable with the minimum
 *   amounts (OD-DM-2).
 * - The player picks any remaining target, cooks it, and the result is resolved as PASS or FAILED
 *   (Completion Gate). PASS completes the target; FAILED does not (OD-DM-4).
 * - After every resolved pizza the remaining targets are checked against the stock *after* that
 *   pizza's consumption. Not completable any more -> FAILED at once, reason INFEASIBLE (OD-DM-3).
 *   Nothing prevents over-placement; using too much is the player's mistake to make.
 * - Every target completed -> CLEARED. The clock reaching 0 -> FAILED (TIME_UP). Reload or HOME ->
 *   FAILED (ABANDONED). A run is never saved (OD-DM-7).
 *
 * The run never reads or writes the Dex beyond the unlock check at START (OD-DM-11): no transition
 * takes a Dex, so no Dinner path -- the FAILED ones above all -- can mutate it.
 */

export interface DinnerClock {
  startedAt: number;
  endsAt: number;
}

export function dinnerRemainingMs(now: number, clock: DinnerClock): number {
  return Math.max(0, clock.endsAt - now);
}

/** Same deadline rule as Lunch Rush: the instant `now` reaches `endsAt` the time is up. */
export function isDinnerClockExpired(now: number, clock: DinnerClock): boolean {
  return now >= clock.endsAt;
}

export type DinnerRunStatus = "PLAYING" | "CLEARED" | "FAILED";

export type DinnerFailureReason = "TIME_UP" | "INFEASIBLE" | "ABANDONED";

export type DinnerRunOutcome =
  | { kind: "CLEAR"; endedAt: number; clearMs: number }
  | { kind: "FAILED"; reason: "TIME_UP" | "ABANDONED"; endedAt: number }
  | { kind: "FAILED"; reason: "INFEASIBLE"; endedAt: number; shortages: SetIngredientShortage[] };

/** One resolved pizza: the Completion Gate result for a target the player chose. */
export interface DinnerAttempt {
  recipeId: string;
  completion: "PASS" | "FAILED";
  at: number;
}

export interface DinnerRunState {
  missionId: string;
  revision: number;
  status: DinnerRunStatus;
  targetRecipeIds: readonly string[];
  /** Completed targets, in completion order. */
  completedRecipeIds: readonly string[];
  /** The target being cooked, or `null` on the target-selection screen. */
  activeRecipeId: string | null;
  clock: DinnerClock;
  attempts: readonly DinnerAttempt[];
  /** Set exactly when `status` leaves PLAYING. */
  outcome: DinnerRunOutcome | null;
}

export type DinnerStartBlock =
  | { reason: "INVALID_MISSION"; problems: string[] }
  | { reason: "LOCKED"; undiscoveredCount: number }
  | { reason: "INSUFFICIENT_STOCK"; shortages: SetIngredientShortage[] }
  | { reason: "NO_TIME_LIMIT" };

export interface DinnerStartInputs extends RecipeSetInputs {
  dex: DexState;
}

/**
 * The START gate, without starting anything: why this mission cannot start now, or `null` when it
 * can. The time limit is not checked here (it is an input to `startDinnerRun`).
 */
export function dinnerStartBlock(
  mission: DinnerMissionDefinition,
  inputs: DinnerStartInputs,
): Exclude<DinnerStartBlock, { reason: "NO_TIME_LIMIT" }> | null {
  const problems = validateDinnerMissions([mission]);
  const targets = resolveDinnerTargets(mission);
  if (problems.length > 0 || !targets) return { reason: "INVALID_MISSION", problems };
  const unlock = dinnerMissionUnlock(mission, inputs.dex);
  if (!unlock.unlocked) return { reason: "LOCKED", undiscoveredCount: unlock.undiscoveredCount };
  const shortages = recipeSetStockShortage(targets, inputs);
  if (shortages.length > 0) return { reason: "INSUFFICIENT_STOCK", shortages };
  return null;
}

export type DinnerStartResult = { ok: true; state: DinnerRunState } | { ok: false; block: DinnerStartBlock };

/**
 * Starts a run at `now`. `durationMs` overrides the mission's own time limit; one of the two must
 * be a positive number (Phase 1 limits are untuned until DM-5, so callers pass it explicitly).
 */
export function startDinnerRun(
  mission: DinnerMissionDefinition,
  inputs: DinnerStartInputs,
  now: number,
  durationMs?: number,
): DinnerStartResult {
  const block = dinnerStartBlock(mission, inputs);
  if (block) return { ok: false, block };
  const duration = durationMs ?? (mission.timeLimit.seconds === null ? null : mission.timeLimit.seconds * 1000);
  if (duration === null || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(now)) {
    return { ok: false, block: { reason: "NO_TIME_LIMIT" } };
  }
  return {
    ok: true,
    state: {
      missionId: mission.missionId,
      revision: mission.revision,
      status: "PLAYING",
      targetRecipeIds: [...mission.targetRecipeIds],
      completedRecipeIds: [],
      activeRecipeId: null,
      clock: { startedAt: now, endsAt: now + duration },
      attempts: [],
      outcome: null,
    },
  };
}

/** Targets not completed yet, in definition order. */
export function remainingTargetIds(state: DinnerRunState): string[] {
  const done = new Set(state.completedRecipeIds);
  return state.targetRecipeIds.filter((id) => !done.has(id));
}

/** For the HUD: `completed / total` (e.g. 1/4). */
export function dinnerProgress(state: DinnerRunState): { completed: number; total: number } {
  return { completed: state.completedRecipeIds.length, total: state.targetRecipeIds.length };
}

function resolveIds(ids: readonly string[]): Recipe[] | null {
  const recipes: Recipe[] = [];
  for (const id of ids) {
    const recipe = getRecipe(id as RecipeId);
    if (!recipe) return null;
    recipes.push(recipe);
  }
  return recipes;
}

/**
 * Shortages of the remaining targets against `stock` (empty = still completable). An unknown
 * target id fails closed with a synthetic shortage so it can never read as completable.
 */
export function remainingTargetShortages(state: DinnerRunState, stock: RecipeSetInputs): SetIngredientShortage[] {
  const remaining = remainingTargetIds(state);
  const recipes = resolveIds(remaining);
  if (!recipes) return [{ ingredientId: "", need: 1, have: 0, recipeIds: remaining }];
  return recipeSetStockShortage(recipes, stock);
}

export function isRemainingTargetSetFeasible(state: DinnerRunState, stock: RecipeSetInputs): boolean {
  return remainingTargetShortages(state, stock).length === 0;
}

export type DinnerRunAction =
  /** The player picks a remaining target on the selection screen. */
  | { type: "SELECT_TARGET"; recipeId: string; now: number }
  /** Back to the selection screen before baking. Stock is only consumed at bake, so nothing else
   *  changes; whether the UI offers this is a DM-2/DM-3 decision. */
  | { type: "CANCEL_TARGET"; now: number }
  /** The active target's pizza was baked and judged. `stock` is the inventory *after* that pizza's
   *  consumption (CONFIRM_BAKE's `consumePizzaInventory`), over-placement and FAILED pizzas included. */
  | { type: "RESOLVE_ATTEMPT"; recipeId: string; completion: "PASS" | "FAILED"; stock: RecipeSetInputs; now: number }
  | { type: "TICK"; now: number }
  /** Reload / HOME / navigation away: the run is lost and pays nothing. */
  | { type: "ABANDON"; now: number };

function fail(state: DinnerRunState, outcome: Extract<DinnerRunOutcome, { kind: "FAILED" }>): DinnerRunState {
  return { ...state, status: "FAILED", activeRecipeId: null, outcome };
}

export function dinnerRunReducer(state: DinnerRunState, action: DinnerRunAction): DinnerRunState {
  if (state.status !== "PLAYING") return state;
  // The deadline wins over everything that happens at or after it (a pizza resolved late does not
  // count, exactly like a Lunch Rush serve after the deadline).
  if (isDinnerClockExpired(action.now, state.clock)) {
    return fail(state, { kind: "FAILED", reason: "TIME_UP", endedAt: state.clock.endsAt });
  }

  switch (action.type) {
    case "SELECT_TARGET": {
      if (state.activeRecipeId !== null) return state;
      if (!remainingTargetIds(state).includes(action.recipeId)) return state;
      return { ...state, activeRecipeId: action.recipeId };
    }

    case "CANCEL_TARGET":
      return state.activeRecipeId === null ? state : { ...state, activeRecipeId: null };

    case "RESOLVE_ATTEMPT": {
      // Only the target the player chose can be resolved: a different or off-target pizza never
      // counts (it cannot be cooked in a Dinner round at all; this is the backstop).
      if (state.activeRecipeId === null || action.recipeId !== state.activeRecipeId) return state;
      const attempt: DinnerAttempt = { recipeId: action.recipeId, completion: action.completion, at: action.now };
      const completedRecipeIds =
        action.completion === "PASS" ? [...state.completedRecipeIds, action.recipeId] : state.completedRecipeIds;
      const next: DinnerRunState = {
        ...state,
        completedRecipeIds,
        activeRecipeId: null,
        attempts: [...state.attempts, attempt],
      };
      if (remainingTargetIds(next).length === 0) {
        return {
          ...next,
          status: "CLEARED",
          outcome: { kind: "CLEAR", endedAt: action.now, clearMs: action.now - state.clock.startedAt },
        };
      }
      const shortages = remainingTargetShortages(next, action.stock);
      if (shortages.length > 0) {
        return fail(next, { kind: "FAILED", reason: "INFEASIBLE", endedAt: action.now, shortages });
      }
      return next;
    }

    case "TICK":
      return state;

    case "ABANDON":
      return fail(state, { kind: "FAILED", reason: "ABANDONED", endedAt: action.now });

    default:
      return state;
  }
}
