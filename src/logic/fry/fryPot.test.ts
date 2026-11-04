import { describe, expect, it } from "vitest";
import {
  clamp01,
  FRY_AMOUNT_CRISP_MAX,
  FRY_AMOUNT_OVER,
  FRY_BUBBLES,
  FRY_BUBBLE_STAGES,
  FRY_CRISP_FROM_MS,
  FRY_LOOK_COPY,
  FRY_OVER_FROM_MS,
  FRY_STAGE_END_MS,
  FRY_STAGE_LIVE,
  FRY_TIME_SCALES,
  fryBubbleStageAt,
  fryLookAt,
  fryLookOfAmount,
  fryResultOf,
  validTimeScale,
} from "./fryPot";

describe("bubble stages", () => {
  it("are fixed boundaries, ascending, one more stage than boundaries", () => {
    expect([...FRY_STAGE_END_MS]).toEqual([2000, 3500, 6500, 8500]);
    expect(FRY_BUBBLE_STAGES).toHaveLength(FRY_STAGE_END_MS.length + 1);
    expect([...FRY_STAGE_END_MS].sort((a, b) => a - b)).toEqual([...FRY_STAGE_END_MS]);
  });
  it("step at the boundary (the boundary itself belongs to the later stage)", () => {
    expect(fryBubbleStageAt(0)).toBe("big");
    expect(fryBubbleStageAt(1999)).toBe("big");
    expect(fryBubbleStageAt(2000)).toBe("medium");
    expect(fryBubbleStageAt(3499)).toBe("medium");
    expect(fryBubbleStageAt(3500)).toBe("fine");
    expect(fryBubbleStageAt(6499)).toBe("fine");
    expect(fryBubbleStageAt(6500)).toBe("calm");
    expect(fryBubbleStageAt(8499)).toBe("calm");
    expect(fryBubbleStageAt(8500)).toBe("still");
    expect(fryBubbleStageAt(10 ** 9)).toBe("still");
  });
  it("bubbles get smaller and rarer with each stage", () => {
    for (let i = 1; i < FRY_BUBBLE_STAGES.length; i++) {
      const a = FRY_BUBBLES[FRY_BUBBLE_STAGES[i - 1]];
      const b = FRY_BUBBLES[FRY_BUBBLE_STAGES[i]];
      expect(b.size).toBeLessThan(a.size);
      expect(b.rate).toBeLessThan(a.rate);
    }
  });
  it("every stage and look has words, and none is a grade or a number", () => {
    for (const s of FRY_BUBBLE_STAGES) expect(FRY_STAGE_LIVE[s]).toBeTruthy();
    for (const l of ["raw", "crisp", "over"] as const) expect(FRY_LOOK_COPY[l]).not.toMatch(/\d|成功|失敗|点|良|悪|ミス/);
  });
});

describe("look", () => {
  it("raw -> crisp -> over at the boundaries; over needs the later boundary", () => {
    expect(FRY_CRISP_FROM_MS).toBe(3500);
    expect(FRY_OVER_FROM_MS).toBe(8500);
    expect(fryLookAt(0)).toBe("raw");
    expect(fryLookAt(3499)).toBe("raw");
    expect(fryLookAt(3500)).toBe("crisp");
    expect(fryLookAt(8499)).toBe("crisp");
    expect(fryLookAt(8500)).toBe("over");
  });
  it("non-finite and negative times are raw / the first stage", () => {
    for (const bad of [NaN, -1, -Infinity, undefined as never]) {
      expect(fryLookAt(bad)).toBe("raw");
      expect(fryBubbleStageAt(bad)).toBe("big");
    }
    expect(fryLookAt(Infinity)).toBe("raw"); // non-finite is read as 0, like the steam
  });
});

describe("amount", () => {
  it("is monotonic in time, below 1 until over, and exactly 1 only for over", () => {
    let prev = -1;
    for (let ms = 0; ms < 8500; ms += 50) {
      const r = fryResultOf(ms);
      expect(r.amount).toBeGreaterThanOrEqual(prev);
      expect(r.amount).toBeLessThanOrEqual(FRY_AMOUNT_CRISP_MAX);
      prev = r.amount;
    }
    expect(fryResultOf(8500).amount).toBe(FRY_AMOUNT_OVER);
    expect(fryResultOf(60000).amount).toBe(FRY_AMOUNT_OVER);
  });
  it("round-trips to the look through fryLookOfAmount", () => {
    for (let ms = 0; ms <= 12000; ms += 25) expect(fryLookOfAmount(fryResultOf(ms).amount), `${ms}`).toBe(fryResultOf(ms).look);
  });
  it("fryLookOfAmount reads junk as raw and clamps", () => {
    for (const bad of [NaN, -3, undefined as never]) expect(fryLookOfAmount(bad)).toBe("raw");
    expect(fryLookOfAmount(7)).toBe("over");
  });
  it("is deterministic: the same input is the same result", () => {
    expect(fryResultOf(4321, 1.35)).toEqual(fryResultOf(4321, 1.35));
  });
  it("clamp01", () => {
    expect([clamp01(-1), clamp01(0.4), clamp01(5), clamp01(NaN)]).toEqual([0, 0.4, 1, 0]);
  });
});

describe("the comparison time scale", () => {
  it("the three choices", () => {
    expect(FRY_TIME_SCALES).toEqual({ short: 0.75, standard: 1, long: 1.35 });
  });
  it("short is done sooner, long later; the boundaries scale linearly", () => {
    expect(fryLookAt(3500 * 0.75, FRY_TIME_SCALES.short)).toBe("crisp");
    expect(fryLookAt(3500 * 0.75 - 1, FRY_TIME_SCALES.short)).toBe("raw");
    expect(fryLookAt(3500, FRY_TIME_SCALES.long)).toBe("raw");
    expect(fryLookAt(3500 * 1.35, FRY_TIME_SCALES.long)).toBe("crisp");
    expect(fryLookAt(8500 * 1.35, FRY_TIME_SCALES.long)).toBe("over");
  });
  it("an invalid scale is 1", () => {
    for (const bad of [0, -2, NaN, Infinity, undefined]) {
      expect(validTimeScale(bad as never)).toBe(1);
    }
    expect(fryLookAt(3500, 0)).toBe("crisp");
    expect(fryLookAt(3500, NaN)).toBe("crisp");
  });
});
