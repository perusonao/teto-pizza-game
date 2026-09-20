/**
 * Cooking Time CT1/CT2: deterministic FREE-mode "active making" timing foundation (see
 * docs/reports/TETO_COOKING-TIME-EFFICIENCY_Fresh-Audit.md,
 * docs/reports/TETO_COOKING-TIME_CT1_Implementation-Result.md, and
 * docs/reports/TETO_COOKING-TIME_CT2_Efficiency-Result.md).
 *
 * Measures `BEGIN_PREPARE` (or an equivalent fresh-PREPARE entry -- SELECT_RECIPE,
 * RETRY_SAME_RECIPE) -> `START_BAKE` only. BAKE's own needle-tap minigame is deliberately
 * excluded (see the Fresh Audit's boundary recommendation D) -- this module never reads anything
 * from ../logic/bake.ts and is never called from CONFIRM_BAKE onward. CT2: `RESET_PIZZA`
 * (mid-PREPARE discard/redo) is no longer a fresh-timing entry point -- see gameReducer.ts's own
 * `RESET_PIZZA` case comment for why the same run's clock now continues through it uninterrupted.
 *
 * Recipe Cooking Steps 1.0 Phase 1A-T (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §22.2):
 * `activeStep`/`stepStartedAt`/`perStepElapsedMs`/`stepStartAccumulatedPauseMs` below are
 * additive, per-step fields on this *same* state object -- nothing above this comment changed,
 * `completedMs`'s own semantics (FREE-only, BAKE-excluded, pause-aware whole-round total feeding
 * ../logic/efficiency.ts) stay byte-for-byte as CT1/CT2 left them. Per-step finalization
 * (`advanceStepTiming` below) mirrors `finishCookingTiming`'s own "no negative time, pause span
 * never counted" discipline, applied once per step instead of once per round.
 *
 * Pure, absolute-epoch-ms shape mirroring ../mission/lunchRush.ts's `MissionClock`: every
 * function takes `now` as a plain argument, never reads `Date.now()` itself, so this is
 * exactly as deterministically testable as `startMissionClock`/`remainingMs` already are.
 * `src/state/gameReducer.ts` is the only caller of the timing functions; `App.tsx` is the only
 * place that reads real wall-clock time (both for the reducer's `now` payloads and for
 * `isAnyCookingTimingPauseReasonActive`'s own reasons below), exactly like Mission's own
 * boundary.
 */
import type { MakingStep } from "../state/gameReducer";

export interface CookingTimingState {
  startedAt: number;
  /** Epoch ms the current pause began, or `null` while running. */
  pausedAt: number | null;
  /** Total ms already spent paused, excluding any pause still in progress (`pausedAt`). */
  accumulatedPauseMs: number;
  /** Finalized elapsed active ms, set once by `finishCookingTiming` at `START_BAKE`. `null`
   *  while the round is still in PREPARE. */
  completedMs: number | null;

  // --- Phase 1A-T: additive, per-step fields (design doc §22.2). Absent/`null`/empty is the
  // exact "no per-step data yet" state every pre-Phase-1A-T round already had implicitly. ---

  /** Which `MakingStep` is currently accumulating elapsed time, or `null` whenever no step is
   *  open for timing (BAKE itself, or once every step of the round has finalized). */
  activeStep: MakingStep | null;
  /** Epoch ms `activeStep`'s own active window began -- reset at every step transition
   *  (`advanceStepTiming`), `null` exactly when `activeStep` is `null`. A per-step *view* of the
   *  same clock `startedAt` already anchors, never a second independent clock. */
  stepStartedAt: number | null;
  /** `accumulatedPauseMs`'s value at the moment `activeStep` started -- lets `advanceStepTiming`
   *  subtract only the pause time that actually occurred *during* the active step from that
   *  step's own elapsed total, not the whole round's cumulative pause. Meaningless while
   *  `activeStep` is `null`. */
  stepStartAccumulatedPauseMs: number;
  /** Finalized elapsed ms per step already left this round, keyed by `MakingStep`. A step never
   *  reached this round is simply absent from the map (not zero) -- absence, not a sentinel, is
   *  "not measured yet", matching `completedMs`'s own `null`-while-unmeasured convention. */
  perStepElapsedMs: Readonly<Partial<Record<MakingStep, number>>>;
}

export function startCookingTiming(now: number, initialStep: MakingStep): CookingTimingState {
  return {
    startedAt: now,
    pausedAt: null,
    accumulatedPauseMs: 0,
    completedMs: null,
    activeStep: initialStep,
    stepStartedAt: now,
    stepStartAccumulatedPauseMs: 0,
    perStepElapsedMs: {},
  };
}

/** No-op if already paused or already finished -- a duplicate/stray pause signal must never
 *  overwrite `pausedAt` with a later timestamp, which would silently shrink the counted pause. */
export function pauseCookingTiming(timing: CookingTimingState, now: number): CookingTimingState {
  if (timing.pausedAt !== null || timing.completedMs !== null) return timing;
  return { ...timing, pausedAt: now };
}

/** No-op if not currently paused or already finished. */
export function resumeCookingTiming(timing: CookingTimingState, now: number): CookingTimingState {
  if (timing.pausedAt === null || timing.completedMs !== null) return timing;
  return {
    ...timing,
    pausedAt: null,
    accumulatedPauseMs: timing.accumulatedPauseMs + Math.max(0, now - timing.pausedAt),
  };
}

/** No-op if already finished. If still paused at the moment `START_BAKE` fires, the pause's
 *  own start (`pausedAt`) is used as the effective end -- the paused span itself is never
 *  counted as active time, whether or not a matching resume ever arrives. Clamped to >= 0 so a
 *  clock fed an out-of-order/backwards `now` can never report negative active time. */
export function finishCookingTiming(timing: CookingTimingState, now: number): CookingTimingState {
  if (timing.completedMs !== null) return timing;
  const effectiveEnd = timing.pausedAt ?? now;
  const elapsed = effectiveEnd - timing.startedAt - timing.accumulatedPauseMs;
  return { ...timing, completedMs: Math.max(0, elapsed) };
}

/** Elapsed ms for the currently active step, using exactly `finishCookingTiming`'s own
 *  "paused-at-the-moment is the effective end, clamp to >= 0" math, scoped to the step's own
 *  window (`stepStartedAt` .. effective end) and the pause that occurred within it
 *  (`accumulatedPauseMs` at the effective end minus its value when the step started). */
function stepElapsedMs(timing: CookingTimingState, now: number): number {
  const effectiveEnd = timing.pausedAt ?? now;
  const pauseDuringStep = timing.accumulatedPauseMs - timing.stepStartAccumulatedPauseMs;
  const elapsed = effectiveEnd - (timing.stepStartedAt as number) - pauseDuringStep;
  return Math.max(0, elapsed);
}

/**
 * Recipe Cooking Steps 1.0 Phase 1A-T (design doc §22.2): the one step-boundary transition,
 * fired at every `CONFIRM_MAKING_STEP` and at the PREPARE->BAKE (`START_BAKE`) and
 * BAKE->POST_BAKE (`CONFIRM_BAKE`, when a profile has post-BAKE steps) phase edges. Finalizes
 * whatever step is currently active (if any) into `perStepElapsedMs`, then starts `nextStep` (if
 * given) as the new active step -- passing `nextStep: null` closes step timing out entirely
 * (BAKE itself has no step of its own, design doc §22.3's "BAKE is excluded" rule).
 *
 * A true no-op (returns `timing` unchanged) only when there is nothing to finalize *and* nothing
 * to start (`activeStep` already `null` and `nextStep` is `null`) -- this is what makes it safe
 * to call unconditionally from `CONFIRM_BAKE` even for every one of the 15 shipped recipes, whose
 * profile has no post-BAKE steps: `activeStep` is already `null` (closed out by `START_BAKE`)
 * and `nextStep` is `null` too, so `cookingTiming` comes back byte-identical.
 *
 * `RESET_PIZZA` deliberately never calls this (see gameReducer.ts's own `RESET_PIZZA` case) --
 * per design doc §22.11, a mid-PREPARE discard/redo leaves per-step timing exactly as untouched
 * as it leaves the whole-round clock. */
export function advanceStepTiming(
  timing: CookingTimingState,
  now: number,
  nextStep: MakingStep | null,
): CookingTimingState {
  if (timing.activeStep === null && nextStep === null) return timing;
  const perStepElapsedMs =
    timing.activeStep !== null && timing.stepStartedAt !== null
      ? {
          ...timing.perStepElapsedMs,
          [timing.activeStep]:
            (timing.perStepElapsedMs[timing.activeStep] ?? 0) + stepElapsedMs(timing, now),
        }
      : timing.perStepElapsedMs;
  return {
    ...timing,
    perStepElapsedMs,
    activeStep: nextStep,
    // Fresh Merge Gate fix (PR #125): if a step boundary fires while still paused
    // (`timing.pausedAt !== null` -- a stray/test dispatch mid-pause; the UI itself gates
    // interaction while paused, but the reducer never assumed that), the incoming step's own
    // window must start at the pause's own beginning, not at `now` -- exactly the same
    // "effective moment" substitution `stepElapsedMs`/`finishCookingTiming` already use for the
    // *outgoing* side of this same transition. Using `now` here was the bug: `resumeCookingTiming`
    // only adds the pause's full duration to `accumulatedPauseMs` once resumed, well after this
    // step's `stepStartAccumulatedPauseMs` snapshot below is taken -- so `stepElapsedMs`'s
    // `accumulatedPauseMs - stepStartAccumulatedPauseMs` delta would later subtract the *entire*
    // pause (including the portion that elapsed before this step even nominally started) from
    // this step's own elapsed time, potentially clamping a genuinely-active next step to zero.
    // Anchoring `stepStartedAt` at `pausedAt` instead makes the pause's whole span fall *within*
    // the new step's own window by construction, so the same delta subtraction removes exactly
    // the paused time and nothing more.
    stepStartedAt: nextStep !== null ? (timing.pausedAt ?? now) : null,
    stepStartAccumulatedPauseMs:
      nextStep !== null ? timing.accumulatedPauseMs : timing.stepStartAccumulatedPauseMs,
  };
}

/**
 * Cooking Time CT2: combines every independent pause reason (Reference popover, Dex/Shop/
 * Inventory overlay, app backgrounded via `visibilitychange`/`blur`) into the one signal
 * `App.tsx` dispatches PAUSE/RESUME_COOKING_TIMING on the transitions of. A plain boolean OR is
 * sufficient and deliberately not a reason-`Set`/counter: as long as every reason feeds into the
 * same OR and the caller only dispatches on *this combined value's* transitions (never per
 * individual reason), an overlapping case -- Reference open -> app backgrounds -> foregrounds ->
 * Reference still open -- can never resume early, since the combined signal only ever flips to
 * `false` once every one of its inputs is `false` at the same time. Exported so this exact logic
 * (not a hand-copied re-implementation of it) is what `App.tsx` calls and what CT2's tests cover.
 */
export function isAnyCookingTimingPauseReasonActive(...reasons: readonly boolean[]): boolean {
  return reasons.some(Boolean);
}
