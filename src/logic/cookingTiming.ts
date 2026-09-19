/**
 * Cooking Time CT1: deterministic FREE-mode "active making" timing foundation (see
 * docs/reports/TETO_COOKING-TIME-EFFICIENCY_Fresh-Audit.md and
 * docs/reports/TETO_COOKING-TIME_CT1_Implementation-Result.md).
 *
 * Measures `BEGIN_PREPARE` (or an equivalent fresh-PREPARE entry -- RESET_PIZZA,
 * SELECT_RECIPE, RETRY_SAME_RECIPE) -> `START_BAKE` only. BAKE's own needle-tap minigame is
 * deliberately excluded (see the Fresh Audit's boundary recommendation D) -- this module never
 * reads anything from ../logic/bake.ts and is never called from CONFIRM_BAKE onward.
 *
 * Pure, absolute-epoch-ms shape mirroring ../mission/lunchRush.ts's `MissionClock`: every
 * function takes `now` as a plain argument, never reads `Date.now()` itself, so this is
 * exactly as deterministically testable as `startMissionClock`/`remainingMs` already are.
 * `src/state/gameReducer.ts` is the only caller; `App.tsx` is the only place that reads real
 * wall-clock time, exactly like Mission's own boundary.
 */
export interface CookingTimingState {
  startedAt: number;
  /** Epoch ms the current pause began, or `null` while running. */
  pausedAt: number | null;
  /** Total ms already spent paused, excluding any pause still in progress (`pausedAt`). */
  accumulatedPauseMs: number;
  /** Finalized elapsed active ms, set once by `finishCookingTiming` at `START_BAKE`. `null`
   *  while the round is still in PREPARE. */
  completedMs: number | null;
}

export function startCookingTiming(now: number): CookingTimingState {
  return { startedAt: now, pausedAt: null, accumulatedPauseMs: 0, completedMs: null };
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
