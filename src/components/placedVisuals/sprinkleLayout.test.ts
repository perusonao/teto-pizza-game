import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../../logic/pizzaCoordinates";
import {
  SPRINKLE_BOX_PCT,
  SPRINKLE_COUNT_MAX,
  SPRINKLE_COUNT_MIN,
  SPRINKLE_CRUMBS_MAX,
  SPRINKLE_CRUMBS_MIN,
  SPRINKLE_DOUGH_CENTER,
  SPRINKLE_DOUGH_RADIUS,
  SPRINKLE_FIELD_RADIUS,
  SPRINKLE_MAX_SHIFT,
  SPRINKLE_SHAVING_REACH,
  SPRINKLE_STRAY_FACTOR,
  SPRINKLE_WRAPPER_ROTATION_DEG,
  hashSeed,
  sprinkleLayout,
  sprinkleShift,
} from "./sprinkleLayout";

/**
 * Issue #825 (Owner: parmigiano SPRINKLE Pilot). The sprinkle is the drawing of ONE placed piece; these tests pin that it is a scatter (not a ring, not a repeated stamp),
 * deterministic per piece, made of broad shaved flakes (not rice grains), and kept on the dough near the rim. Whether it LOOKS like cheese sprinkled over a pizza is the Owner's iPhone judgement.
 */
const SEEDS = Array.from({ length: 60 }, (_, i) => `topping-${i + 1}`);
// NOTE: the shape / spread / variety assertions below are a PIN over these 60 ids (the layout is deterministic, so they cannot flake), not a guarantee for every id: over
// 20000 ids a few tails fall outside (a lattice with fewer occupied quarters, a narrow flake rounding just under the aspect bound, ...). The hard guarantees -- counts 11..12,
// the kind mix, no NaN, the stray radius, the extents -- do hold for all 20000 ids (checked by the independent review).

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

  it("each sprinkle is eleven or twelve shavings: at least five broad soft flakes, one or two thin strips, four or five crumbs (rev. 6)", () => {
    for (const seed of SEEDS) {
      const { shavings } = sprinkleLayout(seed);
      expect(shavings.length, seed).toBeGreaterThanOrEqual(SPRINKLE_COUNT_MIN);
      expect(shavings.length, seed).toBeLessThanOrEqual(SPRINKLE_COUNT_MAX);
      const of = (kind: string) => shavings.filter((s) => s.kind === kind).length;
      expect(of("ribbon"), seed).toBeGreaterThanOrEqual(1);
      expect(of("ribbon"), seed).toBeLessThanOrEqual(2);
      expect(of("fragment"), seed).toBeGreaterThanOrEqual(SPRINKLE_CRUMBS_MIN);
      expect(of("fragment"), seed).toBeLessThanOrEqual(SPRINKLE_CRUMBS_MAX);
      expect(of("flake"), seed).toBeGreaterThanOrEqual(5);
    }
  });

  it("no rice grains and no crescents: flakes are broad, strips are wide enough to read as shavings and only slightly bent, crumbs are small", () => {
    for (const seed of SEEDS) for (const s of sprinkleLayout(seed).shavings) {
      if (s.kind === "flake") {
        expect(s.len, seed).toBeGreaterThanOrEqual(10.5);
        // F3 (V9, Owner-approved single trial): flake width / length is 0.28..0.55 (V8-1: 0.38..0.80), so the lower bounds are F3's, not V8-1's.
        expect(s.wid / s.len, seed).toBeGreaterThanOrEqual(0.27);
        expect(s.wid / s.len, seed).toBeLessThanOrEqual(0.56);
        expect(s.wid, seed).toBeGreaterThanOrEqual(2.9);
        expect(s.verts.length).toBe(9);
      } else if (s.kind === "ribbon") {
        expect(s.len, seed).toBeGreaterThanOrEqual(12);
        expect(s.wid, seed).toBeGreaterThanOrEqual(3.4);
        expect(s.len / s.wid, seed).toBeGreaterThanOrEqual(2);
        // a crescent needs a strong bend: here the bend is slight and the width wanders instead
        expect(Math.abs(s.bend), seed).toBeLessThanOrEqual(0.12);
        expect(Math.abs(s.wobble), seed).toBeLessThanOrEqual(0.06);
        expect(s.profile.length, seed).toBe(10);
        expect(Math.max(...s.profile) - Math.min(...s.profile), seed).toBeGreaterThanOrEqual(0.05);
      } else {
        expect(s.len, seed).toBeLessThanOrEqual(6.5);
        expect(s.verts.length).toBe(5);
      }
      if (s.kind !== "ribbon") {
        expect(s.profile.length).toBe(0);
      }
      expect(s.len, seed).toBeLessThanOrEqual(22);
    }
  });

  it("is evenly spread, not clumped: neighbours are well apart on average, and at least three of the four quarters of the field hold a shaving", () => {
    for (const seed of SEEDS) {
      const { shavings } = sprinkleLayout(seed);
      const nearest = shavings.map((a, i) => Math.min(...shavings.filter((_, j) => j !== i).map((b) => Math.hypot(a.cx - b.cx, a.cy - b.cy))));
      // statistical: over 20000 ids the smallest nearest-neighbour distance is about 1.4 (strayed crumbs), so a floor of 1 holds without relying on these 60 ids
      expect(Math.min(...nearest), seed).toBeGreaterThanOrEqual(1);
      expect(nearest.reduce((a, b) => a + b, 0) / nearest.length, seed).toBeGreaterThanOrEqual(8);
      const quarters = [0, 0, 0, 0];
      for (const s of shavings) quarters[(s.cx >= 32 ? 1 : 0) + (s.cy >= 32 ? 2 : 0)] += 1;
      expect(quarters.filter((n) => n > 0).length, seed).toBeGreaterThanOrEqual(3);
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

  it("directions, shapes and sizes vary within a sprinkle", () => {
    for (const seed of SEEDS) {
      const { shavings } = sprinkleLayout(seed);
      const angles = shavings.map((s) => s.angle);
      expect(Math.max(...angles) - Math.min(...angles), seed).toBeGreaterThanOrEqual(45);
      const lengths = shavings.map((s) => s.len);
      expect(Math.max(...lengths) / Math.min(...lengths), seed).toBeGreaterThanOrEqual(2);
      expect(new Set(shavings.map((s) => s.kind)).size, seed).toBe(3);
      // outline strength and core size are not uniform (thin sheets have fainter edges)
      const edges = shavings.map((s) => s.edge);
      expect(Math.max(...edges) - Math.min(...edges), seed).toBeGreaterThanOrEqual(0.4);
      const cores = shavings.filter((s) => s.kind === "flake").map((s) => s.core);
      expect(Math.max(...cores) - Math.min(...cores), seed).toBeGreaterThanOrEqual(0.02);
      // the outlines of the flakes differ from one another
      const outlines = shavings.filter((s) => s.kind === "flake").map((s) => s.verts.join(","));
      expect(new Set(outlines).size, seed).toBe(outlines.length);
    }
  });

  it("rev. 6 trial values: field radius 34, 11..12 pieces, 4..5 crumbs", () => {
    expect(SPRINKLE_FIELD_RADIUS).toBe(34);
    expect([SPRINKLE_COUNT_MIN, SPRINKLE_COUNT_MAX]).toEqual([11, 12]);
    expect([SPRINKLE_CRUMBS_MIN, SPRINKLE_CRUMBS_MAX]).toEqual([4, 5]);
  });

  it("the density still fades toward the edge, more gently since V8-1 (crumbs now spread inward too): broad flakes and strips are denser in the inner third than in the outer third, and the whole sprinkle is neither a ring nor a hole", () => {
    const radii: number[] = [];
    for (const seed of SEEDS) for (const s of sprinkleLayout(seed).shavings) if (s.kind !== "fragment") radii.push(Math.hypot(s.cx - 32, s.cy - 32) / SPRINKLE_FIELD_RADIUS);
    // annulus areas (in units of the disc area): inner disc r<0.577 has 1/3 of the area, the outer annulus r>0.816 has 1/3 as well
    const inner = radii.filter((r) => r < Math.sqrt(1 / 3)).length;
    const outer = radii.filter((r) => r >= Math.sqrt(2 / 3)).length;
    // V8-1 position follow-up: with the crumbs no longer confined to the outer part, flakes and strips reach further out; the measured inner/outer ratio over these 60 ids is 1.48 (rev. 6: 3.34 by the same count; so this threshold no longer separates V8-1 from rev. 6 -- the V8-1 tests below and the hash pin do)
    expect(inner / outer).toBeGreaterThan(1.2);
    // ...but it is a fade, not a hole: the outer third still holds pieces
    expect(outer / radii.length).toBeGreaterThan(0.08);
    // all pieces together (crumbs included): not a ring (the inner third holds a fair share) and not a hole (the outer third does not dominate)
    const every: number[] = [];
    for (const seed of SEEDS) for (const s of sprinkleLayout(seed).shavings) every.push(Math.hypot(s.cx - 32, s.cy - 32) / SPRINKLE_FIELD_RADIUS);
    const innerAll = every.filter((r) => r < Math.sqrt(1 / 3)).length / every.length;
    const outerAll = every.filter((r) => r >= Math.sqrt(2 / 3)).length / every.length;
    expect(innerAll).toBeGreaterThan(0.25);
    expect(outerAll).toBeLessThan(0.45);
  });

  it("V8-1: the crumbs come from ALL centres, not only the outer part: about a fifth of them sit in the inner 40% of the field, they still spread over all four quarters, and the outer part holds broad flakes too", () => {
    const crumbs = SEEDS.flatMap((seed) => sprinkleLayout(seed).shavings.filter((s) => s.kind === "fragment"));
    const inner = crumbs.filter((s) => Math.hypot(s.cx - 32, s.cy - 32) / SPRINKLE_STRAY_FACTOR < 0.4 * SPRINKLE_FIELD_RADIUS).length / crumbs.length;
    expect(inner).toBeGreaterThan(0.1);
    expect(inner).toBeLessThan(0.35);
    const quarters = new Set<number>();
    for (const s of crumbs) quarters.add((s.cx >= 32 ? 1 : 0) + (s.cy >= 32 ? 2 : 0));
    expect(quarters.size).toBe(4);
    const outerFlakes = SEEDS.flatMap((seed) => sprinkleLayout(seed).shavings.filter((s) => s.kind !== "fragment" && Math.hypot(s.cx - 32, s.cy - 32) >= 0.7 * SPRINKLE_FIELD_RADIUS)).length;
    // over these 60 ids rev. 6 put 2.00 flakes/strips per sprinkle there and V8-1 puts 3.07 (about 1.5x); the floor is 1.2x of rev. 6's 2.23 measured over 4000 ids (2.676), a margin of 0.4 below V8-1's 3.07
    expect(outerFlakes / SEEDS.length).toBeGreaterThan(2.23 * 1.2);
  });

  it("V8-1: EVERY centre can be a crumb, innermost and outermost alike: by radius rank and by position in the list each turns into a crumb in roughly 4.5/11.5 = 39% of the sprinkles", () => {
    const preStray = (s: { kind: string; cx: number; cy: number }): [number, number] =>
      s.kind === "fragment" ? [32 + (s.cx - 32) / SPRINKLE_STRAY_FACTOR, 32 + (s.cy - 32) / SPRINKLE_STRAY_FACTOR] : [s.cx, s.cy];
    const byRank = new Array(11).fill(0) as number[];
    const byIndex = new Array(11).fill(0) as number[];
    for (const seed of SEEDS) {
      const list = sprinkleLayout(seed).shavings;
      list.slice(0, 11).forEach((piece, index) => { if (piece.kind === "fragment") byIndex[index] += 1; });
      list
        .map((s) => ({ r: Math.hypot(...(preStray(s).map((v) => v - 32) as [number, number])), crumb: s.kind === "fragment" }))
        .sort((a, b) => a.r - b.r)
        .slice(0, 11)
        .forEach((piece, rank) => { if (piece.crumb) byRank[rank] += 1; });
    }
    for (const [rank, count] of byRank.entries()) {
      expect(count / SEEDS.length, `radius rank ${rank}`).toBeGreaterThan(0.15);
      expect(count / SEEDS.length, `radius rank ${rank}`).toBeLessThan(0.7);
    }
    for (const [index, count] of byIndex.entries()) expect(count / SEEDS.length, `index ${index}`).toBeGreaterThan(0.15);
  });

  it("F3 is pinned: the output over 60 ids is exactly what the trial-branch preset f3 produced (hash; V8-1 was 1975367952), so the drawing is the reviewed one", () => {
    // hash of JSON of 60 layouts; equal to the trial branch's `f3` preset (checked over 20000 ids with 0 differences). A change to the drawing must change this on purpose.
    expect(hashSeed(JSON.stringify(SEEDS.map((seed) => sprinkleLayout(seed))))).toBe(2035136589);
  });

  it("every shaving stays within the field plus its reach (centre radius and tip extent)", () => {
    for (const seed of SEEDS) for (const s of sprinkleLayout(seed).shavings) {
      const limit = s.kind === "fragment" ? SPRINKLE_FIELD_RADIUS * SPRINKLE_STRAY_FACTOR : SPRINKLE_FIELD_RADIUS;
      expect(Math.hypot(s.cx - 32, s.cy - 32), seed).toBeLessThanOrEqual(limit + 0.05);
      expect(Math.hypot(s.cx - 32, s.cy - 32) + s.len / 2, seed).toBeLessThanOrEqual(SPRINKLE_FIELD_RADIUS * SPRINKLE_STRAY_FACTOR + SPRINKLE_SHAVING_REACH + 0.5);
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
    // the pull is expressed in the (rotated) drawing frame, so compare its length
    expect(Math.hypot(near.x, near.y)).toBeGreaterThan(0);
    expect(Math.hypot(rim.x, rim.y)).toBeGreaterThan(Math.hypot(near.x, near.y));
    for (const angle of [0, 40, 130, 200, 300]) {
      const r = DOUGH_RADIUS;
      const shift = sprinkleShift(50 + r * Math.cos((angle * Math.PI) / 180), 50 + r * Math.sin((angle * Math.PI) / 180));
      expect(Math.hypot(shift.x, shift.y)).toBeLessThanOrEqual(SPRINKLE_MAX_SHIFT + 0.01);
    }
  });

  it("keeps the whole field (centre plus reach) inside the dough for every tap on the dough, including the rim", () => {
    // convert the field's farthest reach and the applied shift to percent of the dough
    const unitsPerPct = 64 / SPRINKLE_BOX_PCT;
    const fieldReachPct = (SPRINKLE_FIELD_RADIUS + SPRINKLE_SHAVING_REACH) / unitsPerPct;
    for (let angle = 0; angle < 360; angle += 15) {
      for (const dist of [10, 25, 35, 40, 44, 48]) {
        const x = 50 + dist * Math.cos((angle * Math.PI) / 180);
        const y = 50 + dist * Math.sin((angle * Math.PI) / 180);
        const shift = sprinkleShift(x, y);
        // the shift is in the drawing's own frame; the wrapper turns it by SPRINKLE_WRAPPER_ROTATION_DEG on screen
        const turn = (SPRINKLE_WRAPPER_ROTATION_DEG * Math.PI) / 180;
        const screenX = shift.x * Math.cos(turn) - shift.y * Math.sin(turn);
        const screenY = shift.x * Math.sin(turn) + shift.y * Math.cos(turn);
        const cx = x + screenX / unitsPerPct;
        const cy = y + screenY / unitsPerPct;
        const farthest = Math.hypot(cx - 50, cy - 50) + fieldReachPct;
        // the cap can leave the very rim slightly over (a tap at the crust edge): allow a 1.5% crust band at most (the farthest tip of the farthest shaving)
        expect(farthest, `${angle}deg ${dist}%`).toBeLessThanOrEqual(DOUGH_RADIUS + 1.5);
      }
    }
  });

  it("counter-rotates the pull so that, on screen, it points at the pizza centre", () => {
    const shift = sprinkleShift(50 + 46, 50);
    const turn = (SPRINKLE_WRAPPER_ROTATION_DEG * Math.PI) / 180;
    const screenX = shift.x * Math.cos(turn) - shift.y * Math.sin(turn);
    const screenY = shift.x * Math.sin(turn) + shift.y * Math.cos(turn);
    expect(screenX).toBeLessThan(0);
    expect(screenY).toBeCloseTo(0, 1);
    // with no wrapper rotation the pull is the plain vector toward the centre
    const plain = sprinkleShift(50 + 46, 50, 0);
    expect(plain.y).toBeCloseTo(0, 5);
    expect(plain.x).toBeLessThan(0);
  });

  it("the rim cap is a parameter: the default stays 44 units (about 66px); a larger cap (52, compared in rev. 6, NOT adopted) pulls a rim tap further in, never past the cap", () => {
    expect(SPRINKLE_MAX_SHIFT).toBe(44);
    const rim = (maxShift?: number) => {
      const s = sprinkleShift(50 + 47, 50, SPRINKLE_WRAPPER_ROTATION_DEG, maxShift);
      return Math.hypot(s.x, s.y);
    };
    expect(rim()).toBeLessThanOrEqual(44.01);
    expect(rim(52)).toBeGreaterThan(rim(44));
    expect(rim(52)).toBeLessThanOrEqual(52.01);
    // a tap that needs less than the cap is not moved further by a larger cap
    expect(Math.hypot(...Object.values(sprinkleShift(50 + 30, 50, SPRINKLE_WRAPPER_ROTATION_DEG, 52)) as [number, number])).toBeCloseTo(Math.hypot(...Object.values(sprinkleShift(50 + 30, 50)) as [number, number]), 5);
  });

  it("ignores a non-finite position", () => {
    expect(sprinkleShift(Number.NaN, 10)).toEqual({ x: 0, y: 0 });
  });
});
