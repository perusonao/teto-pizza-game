import { describe, expect, it } from "vitest";
import { newOilSession, oilCoverage, reduceOilSession, validPanCells } from "./prototype";

const down = { type: "down" as const, pointerId: 1, point: { x: 0.3, y: 0.5 } };
const move = { type: "move" as const, pointerId: 1, point: { x: 0.7, y: 0.5 } };
const up = { type: "up" as const, pointerId: 1 };
const finishOil = { type: "finish-oil" as const, requiredFraction: 0.01 };

describe("Greek pan oil research prototype (Production OFF)", () => {
  it("rejects invalid research grids", () => {
    expect(() => newOilSession(1)).toThrow(RangeError);
    expect(() => newOilSession(129)).toThrow(RangeError);
    expect(() => newOilSession(3.5)).toThrow(RangeError);
  });
  it("paints only valid circular cells, including a segment", () => {
    const a = reduceOilSession(newOilSession(16), down);
    const b = reduceOilSession(a, move);
    expect(b.covered.size).toBeGreaterThan(a.covered.size);
    expect(b.covered.size).toBeLessThanOrEqual(validPanCells(16));
    for (const index of b.covered) {
      const x = ((index % b.size) + 0.5) / b.size;
      const y = (Math.floor(index / b.size) + 0.5) / b.size;
      expect((x - 0.5) ** 2 + (y - 0.5) ** 2).toBeLessThanOrEqual(0.25);
    }
  });
  it("ignores off-grid and non-finite pointers", () => {
    const s = newOilSession(16);
    expect(reduceOilSession(s, { ...down, point: { x: NaN, y: 0.5 } })).toBe(s);
    expect(reduceOilSession(s, { ...down, point: { x: -1, y: 0.5 } })).toBe(s);
  });
  it("ignores secondary pointer and cancels without continuing a stroke", () => {
    const a = reduceOilSession(newOilSession(16), down);
    const b = reduceOilSession(a, { ...move, pointerId: 2 });
    expect(b).toBe(a);
    const c = reduceOilSession(b, { type: "cancel", pointerId: 1 });
    expect(c.activePointer).toBeNull();
    expect(reduceOilSession(c, move)).toBe(c);
    expect(c.covered.size).toBe(a.covered.size);
  });
  it("replays identically and never advances during an active gesture", () => {
    const run = () => [down, move, up].reduce(reduceOilSession, newOilSession(16));
    const a = reduceOilSession(reduceOilSession(newOilSession(16), down), move);
    expect(reduceOilSession(a, finishOil)).toBe(a);
    expect([...run().covered].sort((x, y) => x - y)).toEqual([...run().covered].sort((x, y) => x - y));
    expect(oilCoverage(run())).toBeGreaterThan(0);
  });
  it("gates dough behind oil and READY behind dough completion", () => {
    const s = newOilSession(16);
    expect(reduceOilSession(s, finishOil)).toBe(s);
    expect(reduceOilSession(s, { type: "finish-dough", doughComplete: true })).toBe(s);
    const coated = [down, move, up].reduce(reduceOilSession, s);
    const dough = reduceOilSession(coated, finishOil);
    expect(dough.phase).toBe("DOUGH_PRESS");
    expect(reduceOilSession(dough, { type: "finish-dough", doughComplete: false })).toBe(dough);
    const ready = reduceOilSession(dough, { type: "finish-dough", doughComplete: true });
    expect(ready.phase).toBe("READY");
    expect(reduceOilSession(ready, finishOil)).toBe(ready);
    expect(reduceOilSession(ready, { type: "reset" }).phase).toBe("PAN_OIL");
  });
  it("rejects invalid and unmet oil thresholds", () => {
    const s = [down, move, up].reduce(reduceOilSession, newOilSession(16));
    for (const requiredFraction of [NaN, 0, -1, 1.1, 1]) {
      expect(reduceOilSession(s, { type: "finish-oil", requiredFraction })).toBe(s);
    }
  });
});
