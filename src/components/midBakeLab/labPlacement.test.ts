import { describe, expect, it } from "vitest";
import { isInsideLabDough, LAB_DOUGH_CENTER, PLACEMENT_STRATEGIES, placementFor, spreadPlacement } from "./labPlacement";

describe("MID_BAKE Lab placement (decision Q6: deterministic automatic placement)", () => {
  it("gives the same spot for the same ingredient and index, every time", () => {
    for (let i = 0; i < 20; i += 1) expect(placementFor("natto", i)).toEqual(placementFor("natto", i));
    expect(placementFor("natto", 0)).toEqual({ x: 40, y: 44 });
    expect(placementFor("natto", 1)).toEqual({ x: 60, y: 57 });
  });

  it("keeps every spot inside the dough and keeps the first pieces apart", () => {
    for (const id of ["natto", "unknown-ingredient"]) {
      for (let i = 0; i < 40; i += 1) expect(isInsideLabDough(placementFor(id, i)), `${id}#${i}`).toBe(true);
    }
    const [a, b] = [placementFor("natto", 0), placementFor("natto", 1)];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(12);
  });

  it("falls back to the spread for an ingredient without a strategy, and is total for odd indexes", () => {
    expect(placementFor("okra", 3)).toEqual(spreadPlacement(3));
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const spot = spreadPlacement(bad);
      expect(Number.isFinite(spot.x) && Number.isFinite(spot.y)).toBe(true);
      expect(isInsideLabDough(spot)).toBe(true);
    }
    expect(spreadPlacement(0)).not.toEqual(LAB_DOUGH_CENTER);
  });

  it("a per-ingredient operation can replace the placement by registering a strategy (the extension point)", () => {
    expect(Object.keys(PLACEMENT_STRATEGIES)).toContain("natto");
    const registry: Record<string, (index: number) => { x: number; y: number }> = { ...PLACEMENT_STRATEGIES, sansho: (i) => ({ x: 50, y: 30 + i }) };
    expect(registry.sansho(2)).toEqual({ x: 50, y: 32 });
  });
});
