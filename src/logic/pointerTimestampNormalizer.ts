/**
 * Phase 4A-1A (Post-Codex-Fix, timestamp preservation follow-up): normalizes raw
 * `PointerEvent.timeStamp` values -- including every sample inside one coalesced
 * `pointermove` batch -- into the same clock domain `performance.now()`/
 * `requestAnimationFrame` use, so `SauceDispenseController`'s recorded path preserves the
 * *actual* relative timing between pointer samples instead of collapsing them all to
 * whatever instant the batch happened to be processed at (re-stamping every sample with a
 * freshly-read `performance.now()` destroys that timing entirely -- that was the bug this
 * fixes).
 *
 * `PointerEvent.timeStamp` is a `DOMHighResTimeStamp` sharing `performance.now()`'s origin
 * under the modern UI Events spec, but this does not simply trust that on every engine: it
 * computes and validates one offset per gesture (from the pointerdown event's own
 * timestamp), and falls back to a monotonic nudge -- never a fresh `performance.now()` per
 * sample, which would reintroduce the exact bug being fixed -- whenever a given timestamp
 * can't be trusted (non-finite, negative, or moving backwards).
 */

/** How far forward a distrusted timestamp is nudged past the last known-good one --
 *  small enough to never visibly distort ordering, large enough to stay a distinct,
 *  strictly-greater floating-point value. */
export const TIMESTAMP_FALLBACK_EPSILON_MS = 0.001;

/** A value safe to build a clock offset, or a normalized timestamp, from: finite and
 *  non-negative. (`NaN`, `Infinity`, `-Infinity`, and negative values are all rejected.) */
export function isSafeTimestamp(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * One instance per dispense gesture (constructed at pointerdown, discarded when the session
 * ends -- see PizzaStage's `timestampNormalizerRef`). Every call to `normalize()` is
 * guaranteed to return a value that is finite, non-negative, and strictly greater than every
 * value this same instance has returned before -- i.e. monotonic, ordering-preserving,
 * regardless of what garbage the underlying platform timestamp contains.
 */
export class PointerTimestampNormalizer {
  private readonly offset: number;
  private readonly trustEventTimestamps: boolean;
  private lastNormalized: number;

  /**
   * @param gestureStartEventTimestamp The pointerdown event's own `timeStamp`.
   * @param performanceNowAtStart `performance.now()` sampled at that same instant. Used
   *   both as the offset's other half and as the initial "last known-good" floor every
   *   later `normalize()` call must exceed.
   */
  constructor(gestureStartEventTimestamp: number, performanceNowAtStart: number) {
    const startIsSafe = isSafeTimestamp(performanceNowAtStart);
    if (startIsSafe && isSafeTimestamp(gestureStartEventTimestamp)) {
      this.offset = performanceNowAtStart - gestureStartEventTimestamp;
      this.trustEventTimestamps = true;
    } else {
      this.offset = 0;
      this.trustEventTimestamps = false;
    }
    // If even performanceNowAtStart is unsafe (should never happen in a real browser), 0 is
    // still a finite, non-negative floor -- normalize() will climb forward from there.
    this.lastNormalized = startIsSafe ? performanceNowAtStart : 0;
  }

  /**
   * Normalizes one sample's raw `event.timeStamp`. Call once per coalesced sample, in the
   * order the platform reported them, so `lastNormalized`'s forward-only clamp reflects
   * their real relative order rather than re-deriving it from scratch each time.
   */
  normalize(rawEventTimestamp: number): number {
    let candidate = this.lastNormalized + TIMESTAMP_FALLBACK_EPSILON_MS;
    if (this.trustEventTimestamps && isSafeTimestamp(rawEventTimestamp)) {
      const normalized = rawEventTimestamp + this.offset;
      if (isSafeTimestamp(normalized) && normalized > this.lastNormalized) {
        candidate = normalized;
      }
      // Anomalous (non-finite, negative, or moving backwards relative to the previous
      // sample) -- falls through to the monotonic-nudge candidate computed above instead.
    }
    this.lastNormalized = candidate;
    return candidate;
  }
}
