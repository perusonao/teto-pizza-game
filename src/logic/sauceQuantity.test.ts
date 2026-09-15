import { describe, expect, it } from "vitest";
import {
  MAX_TICKS_PER_STEP,
  SAUCE_MAX_QUANTITY,
  SAUCE_RATE_PER_TICK,
  SAUCE_TICK_MS,
  clampQuantity,
  computeDueTicks,
  tickDepositAmount,
} from "./sauceQuantity";

describe("computeDueTicks", () => {
  it("produces more ticks the longer the elapsed hold, independent of how it's chunked", () => {
    const short = computeDueTicks(0, SAUCE_TICK_MS * 2);
    const long = computeDueTicks(0, SAUCE_TICK_MS * 10);
    expect(short.dueAts.length).toBe(2);
    expect(long.dueAts.length).toBe(10);
  });

  it("each due timestamp is exactly prevDueAt + k * SAUCE_TICK_MS", () => {
    const result = computeDueTicks(1000, 1000 + SAUCE_TICK_MS * 3);
    expect(result.dueAts).toEqual([1000 + SAUCE_TICK_MS, 1000 + SAUCE_TICK_MS * 2, 1000 + SAUCE_TICK_MS * 3]);
    expect(result.nextDueAt).toBe(1000 + SAUCE_TICK_MS * 3);
  });

  it("carries no remainder across calls -- chaining two short calls yields the same total ticks as one long call", () => {
    let prevDueAt = 0;
    let ticks = 0;
    let now = 0;
    for (let i = 0; i < 2; i += 1) {
      now += 30;
      const step = computeDueTicks(prevDueAt, now);
      ticks += step.dueAts.length;
      prevDueAt = step.nextDueAt;
    }
    const oneShot = computeDueTicks(0, 60);
    expect(ticks).toBe(oneShot.dueAts.length);
    expect(ticks).toBe(1); // 60ms / 50ms = 1 full tick, 10ms carried (implicitly, via prevDueAt)
  });

  it("is blind to pointer-event count: the same wall-clock span yields the same tick count whether polled often (many small steps) or rarely (few large steps)", () => {
    // "120Hz": 12 steps of 5ms each (60ms of real time).
    let prevDueAt = 0;
    let manyStepsTicks = 0;
    for (let now = 5; now <= 60; now += 5) {
      const step = computeDueTicks(prevDueAt, now);
      manyStepsTicks += step.dueAts.length;
      prevDueAt = step.nextDueAt;
    }
    // "30Hz": 2 steps of 30ms each (also 60ms of real time).
    let prevDueAt2 = 0;
    let fewStepsTicks = 0;
    for (let now = 30; now <= 60; now += 30) {
      const step = computeDueTicks(prevDueAt2, now);
      fewStepsTicks += step.dueAts.length;
      prevDueAt2 = step.nextDueAt;
    }
    expect(manyStepsTicks).toBe(fewStepsTicks);
  });

  it("never produces ticks for zero or negative elapsed time", () => {
    expect(computeDueTicks(1000, 1000).dueAts).toEqual([]);
    expect(computeDueTicks(1000, 900).dueAts).toEqual([]);
  });

  describe("MAX_TICKS_PER_STEP cap (background/stall safety, Codex MUST FIX 3)", () => {
    it("never returns more than MAX_TICKS_PER_STEP ticks, however large the elapsed gap", () => {
      const result = computeDueTicks(0, SAUCE_TICK_MS * 10_000); // a huge, e.g. backgrounded-tab, gap
      expect(result.dueAts.length).toBe(MAX_TICKS_PER_STEP);
      expect(result.droppedTicks).toBeGreaterThan(0);
    });

    it("does not queue up dropped ticks for the next call -- resuming after a stall doesn't 'catch up' later", () => {
      const first = computeDueTicks(0, SAUCE_TICK_MS * 10_000);
      expect(first.droppedTicks).toBeGreaterThan(0);
      // The very next call, shortly after, should behave like a fresh short hold -- not
      // immediately produce another full batch of capped ticks from leftover backlog.
      const second = computeDueTicks(first.nextDueAt, first.nextDueAt + SAUCE_TICK_MS);
      expect(second.dueAts.length).toBe(1);
      expect(second.droppedTicks).toBe(0);
    });

    it("reports droppedTicks as 0 for a normal, uncapped call", () => {
      const result = computeDueTicks(0, SAUCE_TICK_MS * 3);
      expect(result.droppedTicks).toBe(0);
    });
  });
});

describe("clampQuantity", () => {
  it("clamps to [0, SAUCE_MAX_QUANTITY]", () => {
    expect(clampQuantity(-1)).toBe(0);
    expect(clampQuantity(0.5)).toBe(0.5);
    expect(clampQuantity(SAUCE_MAX_QUANTITY + 5)).toBe(SAUCE_MAX_QUANTITY);
  });
});

describe("tickDepositAmount (cap/clamp)", () => {
  it("returns a full tick's worth when there is headroom", () => {
    expect(tickDepositAmount(0)).toBeCloseTo(SAUCE_RATE_PER_TICK);
    expect(tickDepositAmount(0.5)).toBeCloseTo(SAUCE_RATE_PER_TICK);
  });

  it("clamps to the remaining headroom under SAUCE_MAX_QUANTITY", () => {
    const almostFull = SAUCE_MAX_QUANTITY - SAUCE_RATE_PER_TICK / 2;
    const amount = tickDepositAmount(almostFull);
    expect(amount).toBeCloseTo(SAUCE_RATE_PER_TICK / 2);
    expect(almostFull + amount).toBeCloseTo(SAUCE_MAX_QUANTITY);
  });

  it("returns 0 once already at or past the cap -- holding longer does nothing further", () => {
    expect(tickDepositAmount(SAUCE_MAX_QUANTITY)).toBe(0);
    expect(tickDepositAmount(SAUCE_MAX_QUANTITY + 1)).toBe(0);
  });
});
