import { getNextOrder, type Order } from "../data/orders";
import type { RecipeId } from "../data/recipes";
import { EMPTY_MISSION_METRICS, recordServe, type MissionMetrics } from "../logic/missionScoring";
import type { LunchRushServeRecord } from "../shared/lunchRushScoring";

/**
 * Lunch Rush mission (Phase 3C-4, see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 11
 * and docs/reports/PIZZA_GAME_Phase3C-4_Lunch-Rush_Result.md).
 *
 * Deliberately does not replace the existing 5-phase state machine (ORDER/PREPARE/BAKE/
 * RESULT/DISCOVERED, src/state/gameReducer.ts) -- Mission is a thin *outer* wrapper around
 * ordinary rounds, not a second state machine duplicating round state. `GameState` (order,
 * recipe, pizza, dex, ownedIngredientIds) stays the single source of truth for "what pizza is
 * being made right now" in both Free play and Mission play; this module only owns two small,
 * Mission-only concerns: the mission clock/run lifecycle (below) and order rotation
 * (`pickMissionOrder`). Per-pizza quality scoring stays in ../logic/scoring.ts unchanged
 * (Mission never re-implements or branches scoring); per-run metrics/formula live in
 * ../logic/missionScoring.ts.
 */

export const LUNCH_RUSH_MISSION_ID = "lunch-rush";

export interface MissionConfig {
  /** How long one Mission run lasts, in seconds. Production always uses
   *  `DEFAULT_MISSION_CONFIG` (180s); tests inject a much shorter value so no test ever needs
   *  to wait out a real 3-minute timer, and (dev-only) the app can inject a shorter value from
   *  a URL param for manual browser verification -- see App.tsx's `resolveMissionConfig`. */
  durationSeconds: number;
}

export const DEFAULT_MISSION_DURATION_SECONDS = 180;

export const DEFAULT_MISSION_CONFIG: MissionConfig = {
  durationSeconds: DEFAULT_MISSION_DURATION_SECONDS,
};

/**
 * Absolute start/end timestamps (epoch ms), not a countdown counter. Deriving remaining time
 * as `endsAt - now` on every read (rather than a canonical `remaining -= 1` value ticked down
 * over time) is what makes the timer resistant to background-tab throttling and clock drift:
 * even if ticks are delayed, skipped, or batched by the browser, the next tick's `Date.now()`
 * still yields the exact correct remaining time, with no accumulated error to correct for.
 */
export interface MissionClock {
  startedAt: number;
  endsAt: number;
}

export function startMissionClock(
  now: number,
  config: MissionConfig = DEFAULT_MISSION_CONFIG,
): MissionClock {
  return { startedAt: now, endsAt: now + config.durationSeconds * 1000 };
}

/** Milliseconds left, clamped to 0 -- never negative regardless of how late `now` is relative
 *  to `endsAt` (a throttled background tab, a delayed tick, a stale `now` value, ...). */
export function remainingMs(now: number, clock: MissionClock): number {
  return Math.max(0, clock.endsAt - now);
}

/** Whole seconds left, for display. Rounds up so the displayed timer never reads "0" while
 *  time (per remainingMs) technically remains, and lands on exactly 0 once expired. */
export function remainingSeconds(now: number, clock: MissionClock): number {
  return Math.ceil(remainingMs(now, clock) / 1000);
}

export function isMissionExpired(now: number, clock: MissionClock): boolean {
  return now >= clock.endsAt;
}

/**
 * Picks the next Mission order. Mission reuses the exact same order-selection pipeline as
 * free play (`getNextOrder`, ../data/orders.ts) -- no separate Mission-only recipe pool or
 * weighting -- so the same availability filtering (only currently-ownable recipes, see
 * ../state/progression.ts) and repeat-avoidance guarantees (never the same recipe twice in a
 * row, unless the available pool has only one recipe) apply automatically and can never drift
 * out of sync with free play's own rules.
 *
 * Deliberately omits `dex`/`preferFirst`: Mission does not need to force undiscovered-first
 * ordering (SSOT section 11 / Phase 3C-4 scope explicitly does not require it). Omitting
 * `dex` makes `getNextOrder`'s "undiscovered" filter a no-op (every order counts as
 * "undiscovered" against an empty list), which yields exactly a natural, uniformly random
 * rotation within the available pool that still avoids an immediate repeat -- a better fit for
 * a timed, fast-paced mode than steering the player toward specific recipes.
 */
export function pickMissionOrder(
  availableRecipeIds: readonly RecipeId[],
  discoveredRecipeIds: readonly RecipeId[],
  excludeRecipeId?: string,
): Order | null {
  // Progression 2.0 follow-up (Issue #200): Lunch Rush is a mastery/speed mode for pizzas
  // the player has already discovered. Availability still remains the canonical makeability
  // gate; Mission narrows it further to the intersection with the Dex. Deliberately return
  // null for an empty intersection instead of calling getNextOrder([]), whose free-play-safe
  // fallback is the full order catalog and would bypass discovery progression.
  const discovered = new Set<RecipeId>(discoveredRecipeIds);
  const missionRecipeIds = availableRecipeIds.filter((id) => discovered.has(id));
  if (missionRecipeIds.length === 0) return null;
  return getNextOrder({ availableRecipeIds: [...missionRecipeIds], excludeRecipeId });
}

/** Which screen the Mission wrapper is showing. "FREE" means Mission is not engaged at all --
 *  the app is plain free play, unaffected by anything in this module. */
export type MissionMode = "FREE" | "INTRO" | "PLAYING" | "RESULT";

export interface MissionState {
  mode: MissionMode;
  /** Set only while PLAYING (and retained, inert, in RESULT for display); null otherwise. */
  clock: MissionClock | null;
  metrics: MissionMetrics;
  /** Increments by one on every START (Phase 3C-5, SSOT section 8-9) -- a fresh, unique id
   *  for each run, a fresh start *and* every retry alike. This is the identity a Pitz reward
   *  grant is keyed against (see src/state/gameReducer.ts's `lastClaimedMissionRunId` /
   *  `CLAIM_MISSION_REWARD`): it's what lets "grant this run's reward exactly once" and
   *  "retrying never re-grants the previous run's reward" both hold without depending on any
   *  effect only firing once. Preserved (not reset) across EXIT_TO_FREE so it keeps
   *  increasing for the lifetime of the session -- resetting it to 0 on exit would risk a
   *  later run reusing an id an earlier run in the same session already claimed. */
  runId: number;
  /** Firebase Ranking 1.0 Phase 1B (Issue #87): the serve-by-serve log this run's Mission
   *  Score submission is built from (../shared/lunchRushScoring.ts's
   *  `calculateLunchRushMissionScore`) -- appended in the exact same SERVE branch that decides
   *  `metrics`, so the two can never drift apart (a submission is provably the same score the
   *  player already saw). Every SERVE this reducer actually accepts (PASS *or* FAILED alike,
   *  deadline-rejected excluded) appends one entry here; `metrics` alone (PASS-only) stays the
   *  realtime accumulator every other part of the app already reads. Reset to `[]` on START and
   *  EXIT_TO_FREE, the same points `metrics` itself resets at. */
  serves: readonly LunchRushServeRecord[];
}

export const INITIAL_MISSION_STATE: MissionState = {
  mode: "FREE",
  clock: null,
  metrics: EMPTY_MISSION_METRICS,
  runId: 0,
  serves: [],
};

export type MissionRunAction =
  | { type: "SHOW_INTRO" }
  | { type: "START"; now: number; config?: MissionConfig }
  /** Lunch Rush Completion Gate 1A: `completionFailed` is App.tsx's read of the same
   *  `state.completion` (../logic/completionGate.ts's `evaluatePizzaCompletion`, already
   *  computed unconditionally at CONFIRM_BAKE for FREE and Mission alike) for the pizza this
   *  SERVE is for. `true` means this order never becomes a counted serve -- see the SERVE
   *  case below. Order rotation itself is unaffected here (App.tsx still dispatches
   *  MISSION_NEXT_ORDER/BEGIN_PREPARE against `gameReducer` right after this, PASS or FAILED
   *  alike) -- this reducer only owns the run's own metrics/clock, never order advancement. */
  /** Firebase Ranking 1.0 Phase 1B: `recipeId` (App.tsx's `state.recipe.id`) is what lets this
   *  SERVE's `LunchRushServeRecord` (../shared/lunchRushScoring.ts) identify which recipe it
   *  was, alongside the same `qualityTotal`/`completionFailed` the run's own metrics already
   *  read -- not a new fact this reducer computes, just carried through to the log. */
  | { type: "SERVE"; qualityTotal: number; now: number; recipeId: string; completionFailed?: boolean }
  | { type: "TICK"; now: number }
  | { type: "EXIT_TO_FREE" };

/**
 * Pure Mission run-state reducer. Kept entirely separate from `gameReducer` (src/state/
 * gameReducer.ts) -- it knows nothing about pizza/order/recipe, only about the Mission
 * timer/metrics/screen -- so the two reducers never fight over the same field (see this
 * file's top comment on the canonical/derived boundary).
 */
export function missionRunReducer(state: MissionState, action: MissionRunAction): MissionState {
  switch (action.type) {
    case "SHOW_INTRO":
      return state.mode === "FREE" ? { ...state, mode: "INTRO" } : state;

    // Used for both a fresh Mission start and "もう一度" (retry) -- either way the result is
    // the same: a brand new run with a fresh clock and metrics reset to empty. Deliberately
    // unconditional (no mode guard): retrying from RESULT is exactly as valid as starting
    // from INTRO.
    case "START":
      return {
        mode: "PLAYING",
        clock: startMissionClock(action.now, action.config),
        metrics: EMPTY_MISSION_METRICS,
        runId: state.runId + 1,
        serves: [],
      };

    // Codex review (PR #18, P2-1): TICK alone is not the source of truth for "is this run
    // still open" -- it only fires on its own ~250ms interval (App.tsx) and can be delayed
    // or throttled, leaving a window where `mode` is still "PLAYING" even though
    // `clock.endsAt` has already passed in wall-clock time. A SERVE landing in that window
    // must not silently count. So every SERVE re-checks the deadline itself against
    // `action.now` (the timestamp the serve actually happened at, passed in rather than read
    // from `Date.now()` here so this stays a pure, directly-testable reducer): a serve at or
    // after `endsAt` is rejected outright (metrics untouched -- servedCount/
    // totalQualityScore/bestQualityScore, and therefore missionScore and any persisted
    // Mission BEST derived from them, can never include it) and immediately ends the run
    // (PLAYING -> RESULT), exactly like a TICK-detected expiry would. Ending it here as well
    // is what closes the race: whichever of TICK or SERVE observes the expired deadline
    // first flips `mode` away from "PLAYING", and the one-shot guard below (and on TICK)
    // makes sure nothing after that can flip it again.
    case "SERVE": {
      if (state.mode !== "PLAYING" || !state.clock) return state;
      if (isMissionExpired(action.now, state.clock)) {
        return { ...state, mode: "RESULT" };
      }
      // Lunch Rush Completion Gate 1A: a FAILED pizza (../logic/completionGate.ts) never
      // becomes a counted serve -- servedCount/totalQualityScore/bestQualityScore (and
      // therefore missionScore and any persisted Mission BEST derived from them) stay exactly
      // as they were. The order itself is still consumed and the run still advances to its
      // next order -- that happens unconditionally in App.tsx's handleMissionServeNext, PASS
      // or FAILED alike -- so this is not a retry: the player never gets this same order back.
      //
      // Firebase Ranking 1.0 Phase 1B: `serves` still appends a FAILED entry (qualityTotal
      // forced 0, same as `metrics` never counting it) -- deliberately *not* silently dropped
      // from the log, so the eventual score submission's serves[] lets the server independently
      // re-derive that this pizza never counted, rather than trusting a client-side count that
      // simply omitted it.
      if (action.completionFailed) {
        return {
          ...state,
          serves: [...state.serves, { recipeId: action.recipeId, qualityTotal: 0, completionStatus: "FAILED" }],
        };
      }
      return {
        ...state,
        metrics: recordServe(state.metrics, action.qualityTotal),
        serves: [
          ...state.serves,
          { recipeId: action.recipeId, qualityTotal: action.qualityTotal, completionStatus: "PASS" },
        ],
      };
    }

    // Advances the clock check. A no-op unless we are actually PLAYING *and* time has
    // actually run out -- this is what makes mission expiration a one-shot transition
    // (PLAYING -> RESULT exactly once) no matter how many TICKs fire after expiry: the
    // interval driving TICK (App.tsx) keeps running independently of this reducer's state,
    // but once `mode` is no longer "PLAYING" every subsequent TICK returns the same state
    // reference unchanged.
    case "TICK": {
      if (state.mode !== "PLAYING" || !state.clock) return state;
      if (!isMissionExpired(action.now, state.clock)) return state;
      return { ...state, mode: "RESULT" };
    }

    case "EXIT_TO_FREE":
      // runId is deliberately preserved, not reset -- see the field's own doc comment above.
      return {
        mode: "FREE",
        clock: null,
        metrics: EMPTY_MISSION_METRICS,
        runId: state.runId,
        serves: [],
      };

    default:
      return state;
  }
}
