import { describe, expect, it } from "vitest";
import {
  isSafeTimestamp,
  PointerTimestampNormalizer,
  TIMESTAMP_FALLBACK_EPSILON_MS,
} from "./pointerTimestampNormalizer";

/**
 * Timestamp preservation follow-up (Codex Post-Fix Independent Re-Review, residual P2):
 * pins that a whole batch of coalesced pointer samples preserves its *real* relative
 * timing end to end -- never re-stamped with a fresh performance.now() per sample, which
 * would collapse a slow-frame batch to nearly one instant and defeat
 * SauceDispenseController's tick-interpolation entirely (see PizzaStage's own comments at
 * the call sites this feeds).
 */

describe("isSafeTimestamp", () => {
  it("accepts finite, non-negative numbers", () => {
    expect(isSafeTimestamp(0)).toBe(true);
    expect(isSafeTimestamp(123.456)).toBe(true);
  });

  it("rejects NaN, Infinity, -Infinity, and negative numbers", () => {
    expect(isSafeTimestamp(NaN)).toBe(false);
    expect(isSafeTimestamp(Infinity)).toBe(false);
    expect(isSafeTimestamp(-Infinity)).toBe(false);
    expect(isSafeTimestamp(-1)).toBe(false);
  });
});

describe("PointerTimestampNormalizer: ordering preservation (the finding itself)", () => {
  it("distinct, increasing raw event timestamps normalize to distinct, increasing values in the same order", () => {
    // Simulates 3 coalesced samples from one slow/coalesced pointermove batch, each with
    // its own real event.timeStamp -- not 3 identical performance.now() re-stamps.
    const normalizer = new PointerTimestampNormalizer(1000, 5000);
    const a = normalizer.normalize(1010);
    const b = normalizer.normalize(1025);
    const c = normalizer.normalize(1040);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    // The real 15ms/15ms spacing between the raw samples should survive normalization
    // (same offset applied to each), not collapse to near-zero gaps.
    expect(b - a).toBeCloseTo(15, 5);
    expect(c - b).toBeCloseTo(15, 5);
  });

  it("normalizes into the performance.now() domain via a single offset computed once at construction", () => {
    // gestureStartEventTimestamp=1000 paired with performanceNowAtStart=5000 implies a
    // +4000 offset; every later sample should carry that same offset, not be replaced by
    // an unrelated fresh performance.now() reading.
    const normalizer = new PointerTimestampNormalizer(1000, 5000);
    expect(normalizer.normalize(1010)).toBeCloseTo(5010, 5);
    expect(normalizer.normalize(1200)).toBeCloseTo(5200, 5);
  });

  it("preserves order across a realistic slow-frame batch: several samples processed in one synchronous loop", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    const rawTimestamps = [5, 12, 19, 26, 33]; // one coalesced batch, ~7ms apart
    const normalized = rawTimestamps.map((t) => normalizer.normalize(t));
    for (let i = 1; i < normalized.length; i += 1) {
      expect(normalized[i]).toBeGreaterThan(normalized[i - 1]);
    }
    // Real spacing preserved, not collapsed to near-identical values.
    expect(normalized[normalized.length - 1] - normalized[0]).toBeCloseTo(28, 5);
  });
});

describe("PointerTimestampNormalizer: coalesced event counts", () => {
  it("handles zero coalesced samples (falls back to the single main event) without special-casing", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    expect(() => normalizer.normalize(10)).not.toThrow();
  });

  it("handles exactly one coalesced sample", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    const value = normalizer.normalize(5);
    expect(value).toBeCloseTo(1005, 5);
  });

  it("handles many coalesced samples, preserving order throughout", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    const raws = Array.from({ length: 50 }, (_, i) => i * 2);
    const normalized = raws.map((t) => normalizer.normalize(t));
    for (let i = 1; i < normalized.length; i += 1) {
      expect(normalized[i]).toBeGreaterThan(normalized[i - 1]);
    }
  });
});

describe("Regression demonstration: the finding's own pre-fix pattern vs. the fix", () => {
  // The pre-fix PizzaStage.tsx (PR #21 HEAD 2b7b09c) called `performance.now()` fresh for
  // every sample inside the coalesced-events loop, discarding each sample's own
  // event.timeStamp entirely. That code no longer exists in the tree (this fix replaced it
  // outright), so this reproduces the exact pattern locally -- a function that, like the old
  // code, ignores its input and returns whatever "now" is at call time -- to document
  // concretely what was broken and prove the fix's behavior actually differs from it, rather
  // than asserting the new code's properties in isolation.
  function preFixReStampEverySample(rawTimestamps: number[], now: () => number): number[] {
    return rawTimestamps.map(() => now()); // <-- the bug: ignores each sample's own timestamp
  }

  it("the pre-fix pattern collapses a slow/coalesced batch to (near-)identical timestamps", () => {
    // A synchronous loop processing several samples "in one frame" -- performance.now()
    // barely advances (or, as modeled here for a deterministic test, does not advance at
    // all) between calls, exactly the failure mode the finding describes.
    const frozenNow = 12345;
    const raws = [10, 25, 40, 55]; // the finger's real, well-separated sample timestamps
    const preFixResult = preFixReStampEverySample(raws, () => frozenNow);
    expect(new Set(preFixResult).size).toBe(1); // all 4 samples collapsed to one instant
  });

  it("the fix preserves the same 4 samples' real relative ordering and spacing instead", () => {
    const raws = [10, 25, 40, 55];
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    const fixedResult = raws.map((t) => normalizer.normalize(t));
    expect(new Set(fixedResult).size).toBe(raws.length); // 4 distinct instants, not 1
    for (let i = 1; i < fixedResult.length; i += 1) {
      expect(fixedResult[i]).toBeGreaterThan(fixedResult[i - 1]);
    }
    // Real ~15ms spacing between samples survives, matching the raw input's own spacing.
    expect(fixedResult[3] - fixedResult[0]).toBeCloseTo(raws[3] - raws[0], 5);
  });
});

describe("PointerTimestampNormalizer: clock-domain safety / anomaly fallback", () => {
  it("never throws and stays monotonic when the gesture-start event timestamp itself is anomalous (NaN)", () => {
    const normalizer = new PointerTimestampNormalizer(NaN, 1000);
    const a = normalizer.normalize(10);
    const b = normalizer.normalize(20);
    expect(Number.isNaN(a)).toBe(false);
    expect(Number.isFinite(a)).toBe(true);
    expect(b).toBeGreaterThan(a);
  });

  it("falls back safely when a sample's own raw timestamp is NaN", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    const good = normalizer.normalize(10);
    const bad = normalizer.normalize(NaN);
    expect(Number.isFinite(bad)).toBe(true);
    expect(bad).toBeGreaterThan(good);
  });

  it("falls back safely when a sample's own raw timestamp is Infinity", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    const good = normalizer.normalize(10);
    const bad = normalizer.normalize(Infinity);
    expect(Number.isFinite(bad)).toBe(true);
    expect(bad).toBeGreaterThan(good);
  });

  it("falls back safely when a sample's timestamp moves backwards relative to the previous sample", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    const first = normalizer.normalize(100);
    const backwards = normalizer.normalize(50); // earlier than the previous raw sample
    expect(backwards).toBeGreaterThan(first); // never goes backwards in the normalized output
    expect(backwards - first).toBeCloseTo(TIMESTAMP_FALLBACK_EPSILON_MS, 6);
  });

  it("falls back safely when a sample's raw timestamp is negative", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    const good = normalizer.normalize(10);
    const bad = normalizer.normalize(-5);
    expect(bad).toBeGreaterThan(good);
  });

  it("recovers to trusting good timestamps again after one anomalous sample", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    normalizer.normalize(10); // good
    const afterAnomaly = normalizer.normalize(NaN); // fallback nudge
    const nextGood = normalizer.normalize(afterAnomaly - 1000 + 50); // a plausible raw value again
    expect(nextGood).toBeGreaterThan(afterAnomaly);
  });

  it("every output is monotonic across a long mixed sequence of good and anomalous samples", () => {
    const normalizer = new PointerTimestampNormalizer(0, 1000);
    const raws = [10, 20, NaN, 40, Infinity, -1, 90, 30 /* backwards */, 200];
    let previous = -Infinity;
    for (const raw of raws) {
      const value = normalizer.normalize(raw);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });
});
