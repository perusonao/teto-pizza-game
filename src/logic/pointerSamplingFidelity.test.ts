import { describe, expect, it } from "vitest";
import { SauceDispenseController, type SauceDeposit } from "./sauceDispenseController";
import { PointerTimestampNormalizer } from "./pointerTimestampNormalizer";
import { computeSauceMetrics } from "./sauceField";

/**
 * Integration test for the timestamp-preservation fix, end to end: a real pointer path
 * delivered under different sampling/batching patterns must produce approximately the same
 * quantity *and* the same spatial distribution (coverage/evenness), not just the same total.
 *
 * `SauceDispenseController` itself has always correctly interpolated ticks along whatever
 * timestamped path it's given (Post-Codex-Fix MUST FIX 4) -- the bug this file pins was
 * entirely in what PizzaStage handed it: a batch of coalesced samples all re-stamped with a
 * freshly-read `performance.now()` collapses to (near-)identical timestamps, which
 * `SauceDispenseController.interpolate()`'s zero-span branch resolves to the *last* sample
 * in the batch -- silently discarding every other sample's position. This is reproduced
 * directly (not just asserted against) via `collapsedSampleTimestamp` below, modeling
 * exactly what the pre-fix `performance.now()`-per-sample call site produced for one
 * synchronous batch.
 *
 * Note: only *pointermove-sourced* timestamps were ever buggy -- the requestAnimationFrame
 * loop's own `step(now)` timestamp comes from the browser's rAF callback argument, never
 * from the pointermove handler, and was never affected. `drivePath` below therefore always
 * advances `step()` on a real, correctly-elapsing clock; only the *sample* (`move()`)
 * timestamp source varies between the "fixed" and "buggy" scenarios.
 */

function drivePath(
  samples: Array<{ t: number; x: number; y: number }>,
  startPos: { x: number; y: number },
  sampleTimestamp: (rawSampleT: number) => number,
  stepAt: number[],
): SauceDeposit[] {
  const deposits: SauceDeposit[] = [];
  const controller = new SauceDispenseController({
    onDeposit: (d) => deposits.push(d),
    getTotalDispensed: () => deposits.reduce((sum, d) => sum + d.amount, 0),
  });
  // samples[0] is the pointerdown position/instant itself (consumed by start(), exactly
  // like production PizzaStage: controller.start() gets a raw performance.now() sample
  // directly, never routed through the (pointermove-only) timestamp normalizer). Only
  // samples[1..] are pointermove samples.
  controller.start(samples[0]?.t ?? 0, startPos);

  let sampleIndex = 1;
  for (const stepTime of stepAt) {
    while (sampleIndex < samples.length && samples[sampleIndex].t <= stepTime) {
      const sample = samples[sampleIndex];
      controller.move({ x: sample.x, y: sample.y }, sampleTimestamp(sample.t));
      sampleIndex += 1;
    }
    controller.step(stepTime); // real, correctly-elapsing clock -- see file header.
  }
  return deposits;
}

/** A straight drag from (20, 50) to (80, 50) sampled every 10ms across 300ms (31 samples,
 *  matching a real ~100Hz touch scan) -- comfortably spans several dispense ticks (300ms /
 *  SAUCE_TICK_MS 50ms). */
function realDragSamples(): Array<{ t: number; x: number; y: number }> {
  const samples: Array<{ t: number; x: number; y: number }> = [];
  for (let t = 0; t <= 300; t += 10) {
    const ratio = t / 300;
    samples.push({ t, x: 20 + ratio * 60, y: 50 });
  }
  return samples;
}

const identity = (t: number) => t;

describe("Sampling fidelity: high-frequency delivery (ground truth)", () => {
  it("one event per sample, stepped immediately after each -- the reference path reconstruction", () => {
    const samples = realDragSamples();
    const stepAt = samples.map((s) => s.t);
    const deposits = drivePath(samples, { x: 20, y: 50 }, identity, stepAt);
    const xs = deposits.map((d) => d.x);
    expect(new Set(xs).size).toBeGreaterThan(3); // spread across several distinct points
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(30); // spans much of the drag
  });
});

describe("Sampling fidelity: the fix -- coalesced/slow-frame delivery with real timestamps preserved", () => {
  it("all 31 samples delivered in ONE batch (a frame-stall), stepped once at the end -- ticks still interpolate along the real path", () => {
    const samples = realDragSamples();
    const normalizer = new PointerTimestampNormalizer(0, 0); // offset 0 -- same domain as `identity`
    const deposits = drivePath(samples, { x: 20, y: 50 }, (t) => normalizer.normalize(t), [300]);

    const regularTicks = deposits.slice(1); // drop the start() starter dab
    expect(regularTicks.length).toBeGreaterThanOrEqual(4); // ~300ms / 50ms tick period
    const xs = regularTicks.map((d) => d.x);
    // Distinct, increasing positions spread across the drag -- not collapsed to one spot.
    expect(new Set(xs).size).toBe(xs.length);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(xs[xs.length - 1] - xs[0]).toBeGreaterThan(30);
  });

  it("quantity, coverage, and evenness closely match the high-frequency ground truth despite the different batching", () => {
    const samples = realDragSamples();

    const groundTruthDeposits = drivePath(
      samples,
      { x: 20, y: 50 },
      identity,
      samples.map((s) => s.t),
    );
    const normalizer = new PointerTimestampNormalizer(0, 0);
    const coalescedDeposits = drivePath(
      samples,
      { x: 20, y: 50 },
      (t) => normalizer.normalize(t),
      [300],
    );

    const groundTruthMetrics = computeSauceMetrics(groundTruthDeposits);
    const coalescedMetrics = computeSauceMetrics(coalescedDeposits);

    expect(coalescedMetrics.quantity).toBeCloseTo(groundTruthMetrics.quantity, 2);
    expect(coalescedMetrics.coverage).toBeCloseTo(groundTruthMetrics.coverage, 1);
    expect(coalescedMetrics.evenness).toBeCloseTo(groundTruthMetrics.evenness, 1);
  });
});

describe("Regression demonstration: the pre-fix collapsed-timestamp pattern degrades coverage", () => {
  /** Reproduces the pre-fix call site's behavior for one synchronous batch: every sample
   *  in the batch is re-stamped with the *same* instant, exactly like calling
   *  `performance.now()` once per sample within a tight, sub-millisecond JS loop (or on an
   *  engine that coarsens timer resolution) would produce. This is the bug -- not a
   *  hypothetical -- reproduced here because the buggy call site itself no longer exists in
   *  PizzaStage.tsx (this fix replaced it outright). Only the *sample* timestamp collapses;
   *  `step()` still advances on the real clock (see file header), exactly matching what the
   *  actual bug did (and didn't) touch. */
  const collapsedSampleTimestamp = () => 150; // frozen -- ignores its input entirely

  it("collapses most ticks in a frame-stalled batch onto the same (last-recorded) position, unlike the fix", () => {
    const samples = realDragSamples();
    const deposits = drivePath(samples, { x: 20, y: 50 }, collapsedSampleTimestamp, [300]);
    const regularTicks = deposits.slice(1);
    const xs = regularTicks.map((d) => d.x);
    // The bug: every pointermove-sourced path sample shares the same timestamp, so
    // interpolate()'s "past every recorded sample" branch resolves any due tick later than
    // that shared instant to the same last-recorded sample -- collapsing the *majority* of
    // this batch's ticks onto one point, unlike the fix (5 genuinely distinct positions).
    const mostCommonCount = Math.max(
      ...Array.from(new Set(xs), (x) => xs.filter((other) => other === x).length),
    );
    expect(mostCommonCount).toBeGreaterThanOrEqual(3); // at least 3 of 5 ticks collapsed together
    expect(new Set(xs).size).toBeLessThan(regularTicks.length); // strictly fewer distinct points than ticks
  });

  it("that collapse measurably narrows coverage compared to the fixed (real-timestamp) reconstruction of the same physical path, at the same quantity", () => {
    const samples = realDragSamples();

    const buggyDeposits = drivePath(samples, { x: 20, y: 50 }, collapsedSampleTimestamp, [300]);
    const normalizer = new PointerTimestampNormalizer(0, 0);
    const fixedDeposits = drivePath(
      samples,
      { x: 20, y: 50 },
      (t) => normalizer.normalize(t),
      [300],
    );

    const buggyMetrics = computeSauceMetrics(buggyDeposits);
    const fixedMetrics = computeSauceMetrics(fixedDeposits);

    // Same total quantity either way (the timestamp bug never affected *how much*, only
    // *where* -- consistent with the Codex finding's own "quantityは正しいが" framing).
    expect(buggyMetrics.quantity).toBeCloseTo(fixedMetrics.quantity, 6);
    // But coverage is measurably worse when the path collapses to one point.
    expect(buggyMetrics.coverage).toBeLessThan(fixedMetrics.coverage);
  });
});
