import { describe, expect, it } from "vitest";
import {
  SAUCE_MAX_QUANTITY,
  SAUCE_RATE_PER_TICK,
  SAUCE_TICK_MS,
  clampQuantity,
  createDispenseAccumulator,
  nextDepositAmount,
  stepDispenseTicks,
} from "./sauceQuantity";

describe("stepDispenseTicks", () => {
  it("produces more ticks the longer the elapsed hold, independent of how it's chunked", () => {
    const short = stepDispenseTicks(SAUCE_TICK_MS * 2, createDispenseAccumulator());
    const long = stepDispenseTicks(SAUCE_TICK_MS * 10, createDispenseAccumulator());
    expect(long.ticks).toBeGreaterThan(short.ticks);
    expect(short.ticks).toBe(2);
    expect(long.ticks).toBe(10);
  });

  it("carries a sub-tick remainder forward instead of dropping or double-counting it", () => {
    // Two 30ms steps (60ms total, < 2 * SAUCE_TICK_MS of 50ms) should yield exactly the
    // same tick count as one 60ms step -- the accumulator must not lose time by chunking.
    let acc = createDispenseAccumulator();
    let ticks = 0;
    for (let i = 0; i < 2; i += 1) {
      const step = stepDispenseTicks(30, acc);
      ticks += step.ticks;
      acc = step.next;
    }
    const oneShot = stepDispenseTicks(60, createDispenseAccumulator());
    expect(ticks).toBe(oneShot.ticks);
    expect(ticks).toBe(1);
  });

  it("is blind to pointer-event count: the same wall-clock hold yields the same ticks whether split into many small steps or one big one (no 120Hz-device advantage)", () => {
    // Simulate a "120Hz device": 12 steps of 5ms each (60ms of real time).
    let acc = createDispenseAccumulator();
    let manyStepsTicks = 0;
    for (let i = 0; i < 12; i += 1) {
      const step = stepDispenseTicks(5, acc);
      manyStepsTicks += step.ticks;
      acc = step.next;
    }
    // Simulate a "30Hz device": 2 steps of 30ms each (also 60ms of real time).
    let acc2 = createDispenseAccumulator();
    let fewStepsTicks = 0;
    for (let i = 0; i < 2; i += 1) {
      const step = stepDispenseTicks(30, acc2);
      fewStepsTicks += step.ticks;
      acc2 = step.next;
    }
    expect(manyStepsTicks).toBe(fewStepsTicks);
  });

  it("never produces a negative tick count for zero or negative elapsed time", () => {
    expect(stepDispenseTicks(0, createDispenseAccumulator()).ticks).toBe(0);
    expect(stepDispenseTicks(-10, createDispenseAccumulator()).ticks).toBe(0);
  });
});

describe("clampQuantity", () => {
  it("clamps to [0, SAUCE_MAX_QUANTITY]", () => {
    expect(clampQuantity(-1)).toBe(0);
    expect(clampQuantity(0.5)).toBe(0.5);
    expect(clampQuantity(SAUCE_MAX_QUANTITY + 5)).toBe(SAUCE_MAX_QUANTITY);
  });
});

describe("nextDepositAmount (cap/clamp)", () => {
  it("scales linearly with ticks when there is headroom", () => {
    expect(nextDepositAmount(1, 0)).toBeCloseTo(SAUCE_RATE_PER_TICK);
    expect(nextDepositAmount(3, 0)).toBeCloseTo(SAUCE_RATE_PER_TICK * 3);
  });

  it("clamps to the remaining headroom under SAUCE_MAX_QUANTITY", () => {
    const almostFull = SAUCE_MAX_QUANTITY - SAUCE_RATE_PER_TICK / 2;
    const amount = nextDepositAmount(5, almostFull);
    expect(amount).toBeCloseTo(SAUCE_RATE_PER_TICK / 2);
    expect(almostFull + amount).toBeCloseTo(SAUCE_MAX_QUANTITY);
  });

  it("returns 0 once already at or past the cap -- holding longer does nothing further", () => {
    expect(nextDepositAmount(10, SAUCE_MAX_QUANTITY)).toBe(0);
    expect(nextDepositAmount(10, SAUCE_MAX_QUANTITY + 1)).toBe(0);
  });

  it("returns 0 for zero ticks", () => {
    expect(nextDepositAmount(0, 0)).toBe(0);
  });
});
