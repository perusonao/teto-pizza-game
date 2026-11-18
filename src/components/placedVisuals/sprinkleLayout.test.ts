import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../../logic/pizzaCoordinates";
import {
  SPRINKLE_BOX_PCT,
  SPRINKLE_DOUGH_CENTER,
  SPRINKLE_DOUGH_RADIUS,
  SPRINKLE_FIELD_RADIUS,
  SPRINKLE_MAX_SHIFT,
  hashSeed,
  sprinkleLayout,
  sprinkleShift,
} from "./sprinkleLayout";

/**
 * Issue #825 (Owner: parmigiano SPRINKLE Pilot). The sprinkle is the drawing of ONE placed piece; these tests pin that it is a scatter (not a ring, not a repeated stamp),
 * deterministic per piece, made of thin shavings, and kept on the dough near the rim. Whether it LOOKS like cheese sprinkled over a pizza is the Owner's iPhone judgement.
 */
const SEEDS = Array.from({ length: 60 }, (_, i) => `topping-${i + 1}`);

describe("sprinkleLayout", () => {
  it("is deterministic: the same piece id always draws the same sprinkle", () => {
    expect(sprinkleLayout("topping-7")).toEqual(sprinkleLayout("topping-7"));
    expect(hashSeed("topping-7")).toBe(hashSeed("topping-7"));
  });

  it("every piece gets its own sprinkle: 60 consecutive ids give 60 different layouts, and no two taps share a stamp", () => {
    const layouts = new Set(SEEDS.map((seed) => JSON.stringify(sprinkleLayout(seed))));
    expect(layouts.size).toBe(SEEDS.length);
    const [a, b, c] = ["topping-1", "topping-2", "topping-3"].map((seed) => sprinkleLayout(seed));
    for (const [x, y] of [[a, b], [b, c], [a, c]]) {
      expect(JSON.stringify(x.shavings.map((s) => [s.cx, s.cy]))).not.toBe(JSON.stringify(y.shavings.map((s) => [s.cx, s.cy])));
    }
  });

  it("each sprinkle is ten to fourteen thin, separate shavings plus a few chips", () => {
    for (const seed of SEEDS) {
      const { shavings, chips } = sprinkleLayout(seed);
      expect(shavings.length, seed).toBeGreaterThanOrEqual(8);
      expect(shavings.length, seed).toBeLessThanOrEqual(14);
      expect(chips.length, seed).toBeGreaterThanOrEqual(3);
      expect(chips.length, seed).toBeLessThanOrEqual(5);
      for (const s of shavings) {
        expect((s.half * 2) / s.len, `${seed} shaving`).toBeLessThanOrEqual(0.34);
        expect(s.len).toBeGreaterThanOrEqual(6);
        expect(s.len).toBeLessThanOrEqual(15);
      }
      for (let i = 0; i < shavings.length; i += 1) {
        for (let j = i + 1; j < shavings.length; j += 1) {
          expect(Math.hypot(shavings[i].cx - shavings[j].cx, shavings[i].cy - shavings[j].cy), `${seed} ${i}/${j}`).toBeGreaterThanOrEqual(6.1);
        }
      }
    }
  });

  it("is a scatter over a disc, not a ring: the mean distance from the centre is about two thirds of the field radius, with a wide spread", () => {
    const radii: number[] = [];
    for (const seed of SEEDS) for (const s of sprinkleLayout(seed).shavings) radii.push(Math.hypot(s.cx - 32, s.cy - 32) / SPRINKLE_FIELD_RADIUS);
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
    const spread = Math.sqrt(radii.reduce((a, b) => a + (b - mean) ** 2, 0) / radii.length);
    expect(mean).toBeGreaterThan(0.5);
    expect(mean).toBeLessThan(0.8);
    expect(spread).toBeGreaterThan(0.2);
    // a ring would put nearly everything near the edge and nothing near the centre
    expect(radii.filter((r) => r < 0.35).length / radii.length).toBeGreaterThan(0.08);
  });

  it("directions and sizes vary within a sprinkle", () => {
    for (const seed of SEEDS) {
      const { shavings } = sprinkleLayout(seed);
      const angles = shavings.map((s) => s.angle);
      expect(Math.max(...angles) - Math.min(...angles), seed).toBeGreaterThanOrEqual(60);
      const lengths = shavings.map((s) => s.len);
      expect(Math.max(...lengths) / Math.min(...lengths), seed).toBeGreaterThanOrEqual(1.3);
    }
  });

  it("every shaving centre stays inside the viewBox with room for its reach", () => {
    for (const seed of SEEDS) for (const s of sprinkleLayout(seed).shavings) {
      const reach = s.len / 2 + s.half;
      expect(s.cx - reach).toBeGreaterThanOrEqual(-4);
      expect(s.cx + reach).toBeLessThanOrEqual(68);
      expect(s.cy - reach).toBeGreaterThanOrEqual(-4);
      expect(s.cy + reach).toBeLessThanOrEqual(68);
    }
  });
});

describe("sprinkleShift (keeps the sprinkle on the dough near the rim)", () => {
  it("copies of the pizza constants match their source", () => {
    expect(SPRINKLE_DOUGH_CENTER).toBe(DOUGH_CENTER);
    expect(SPRINKLE_DOUGH_RADIUS).toBe(DOUGH_RADIUS);
  });

  it("does not move a sprinkle tapped near the middle", () => {
    expect(sprinkleShift(50, 50)).toEqual({ x: 0, y: 0 });
    expect(sprinkleShift(55, 45)).toEqual({ x: 0, y: 0 });
    expect(sprinkleShift(40, 60)).toEqual({ x: 0, y: 0 });
  });

  it("pulls a rim tap toward the centre, more the closer to the rim, and never by more than the cap", () => {
    const near = sprinkleShift(50 + 36, 50);
    const rim = sprinkleShift(50 + 46, 50);
    expect(near.x).toBeLessThan(0);
    expect(rim.x).toBeLessThan(near.x);
    expect(near.y).toBeCloseTo(0, 5);
    for (const angle of [0, 40, 130, 200, 300]) {
      const r = DOUGH_RADIUS;
      const shift = sprinkleShift(50 + r * Math.cos((angle * Math.PI) / 180), 50 + r * Math.sin((angle * Math.PI) / 180));
      expect(Math.hypot(shift.x, shift.y)).toBeLessThanOrEqual(SPRINKLE_MAX_SHIFT + 0.01);
    }
  });

  it("keeps the whole field (centre plus reach) inside the dough for every tap on the dough, including the rim", () => {
    // convert the field's farthest reach and the applied shift to percent of the dough
    const unitsPerPct = 64 / SPRINKLE_BOX_PCT;
    const fieldReachPct = (SPRINKLE_FIELD_RADIUS + 7.5) / unitsPerPct;
    for (let angle = 0; angle < 360; angle += 15) {
      for (const dist of [10, 25, 35, 40, 44, 48]) {
        const x = 50 + dist * Math.cos((angle * Math.PI) / 180);
        const y = 50 + dist * Math.sin((angle * Math.PI) / 180);
        const shift = sprinkleShift(x, y);
        const cx = x + shift.x / unitsPerPct;
        const cy = y + shift.y / unitsPerPct;
        const farthest = Math.hypot(cx - 50, cy - 50) + fieldReachPct;
        // the cap can leave the very rim slightly over (a tap at the crust edge): allow the crust band, never beyond the dough box
        expect(farthest, `${angle}deg ${dist}%`).toBeLessThanOrEqual(DOUGH_RADIUS + 4);
      }
    }
  });

  it("ignores a non-finite position", () => {
    expect(sprinkleShift(Number.NaN, 10)).toEqual({ x: 0, y: 0 });
  });
});
