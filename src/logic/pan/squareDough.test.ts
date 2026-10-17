import { describe, expect, it } from "vitest";
import { mulberry32 as rng } from "../testSupport/seededRng";
import {
  CORNER_IDS,
  createSquareDough,
  isSquareCornerReached,
  isValidSquareDough,
  pressAt,
  SQUARE_CORNER_REACH_THRESHOLD,
  SQUARE_CORNER_ZONE_CELLS,
  SQUARE_COVERAGE_MIN_SPREAD,
  SQUARE_DOUGH_GRID,
  squareCellAt,
  squareCellCenter,
  squareCornerReach,
  squareCornersReached,
  squareMeanSpread,
  SQUARE_CORNER_ZONE_FRACTION,
  squareCornerZone,
  squareCoverage,
  squareEvenness,
  type SquareDough,
} from "./squareDough";
import { squarePanGeometry } from "./panGeometry";

const N = SQUARE_DOUGH_GRID;
const filled = (v: number): SquareDough => ({ cells: new Array<number>(N * N).fill(v) });

function pressRandomly(steps: number, seed: number): SquareDough {
  const r = rng(seed);
  let d = createSquareDough();
  for (let i = 0; i < steps; i += 1) d = pressAt(d, r() * 120 - 10, r() * 120 - 10, r() * 0.6, 4 + r() * 20);
  return d;
}

describe("square dough model basics", () => {
  it("starts empty and valid", () => {
    const d = createSquareDough();
    expect(isValidSquareDough(d)).toBe(true);
    expect(d.cells).toHaveLength(N * N);
    expect(squareCoverage(d)).toBe(0);
    expect(squareEvenness(d)).toBe(0);
  });

  it("rejects a malformed grid (wrong length, NaN, out of range)", () => {
    expect(isValidSquareDough({ cells: [0, 1] })).toBe(false);
    expect(isValidSquareDough({ cells: new Array<number>(N * N).fill(Number.NaN) })).toBe(false);
    expect(isValidSquareDough(filled(1.01))).toBe(false);
    expect(isValidSquareDough(filled(-0.01))).toBe(false);
    expect(isValidSquareDough(filled(1))).toBe(true);
  });

  it("the validator never throws: null, undefined and non-objects are simply invalid", () => {
    for (const bad of [null, undefined, 5, "x", {}, { cells: null }] as unknown[]) expect(isValidSquareDough(bad as SquareDough), String(bad)).toBe(false);
  });

  it("cell centres and cell lookup agree, and every centre is on the square pan", () => {
    for (let row = 0; row < N; row += 1) {
      for (let col = 0; col < N; col += 1) {
        const c = squareCellCenter(col, row);
        expect(squarePanGeometry.contains(c.x, c.y)).toBe(true);
        expect(squareCellAt(c.x, c.y)).toEqual({ col, row });
      }
    }
    expect(squareCellAt(0, 0)).toBeNull();
    expect(squareCellAt(50, 101)).toBeNull();
    expect(squareCellAt(Number.NaN, 50)).toBeNull();
    const b = squarePanGeometry.bounds();
    expect(squareCellAt(b.maxX, b.maxY)).toEqual({ col: N - 1, row: N - 1 }); // the far edge belongs to the last cell
  });
});

describe("pressAt (the pure primitive step B drives)", () => {
  it("spreads strongest at the centre, fading to nothing at the brush edge", () => {
    const d = pressAt(createSquareDough(), 50, 50, 0.5, 12);
    const centre = squareCellAt(50, 50)!;
    const near = d.cells[centre.row * N + centre.col];
    expect(near).toBeGreaterThan(0);
    expect(d.cells[0]).toBe(0); // far corner untouched
    expect(isValidSquareDough(d)).toBe(true);
  });

  it("returns the same object for anything that cannot change the grid (bad input never reaches the model)", () => {
    const d = createSquareDough();
    const cases: [number, number, number, number][] = [[Number.NaN, 50, 0.5, 10], [50, Number.POSITIVE_INFINITY, 0.5, 10], [50, 50, 0, 10], [50, 50, -1, 10], [50, 50, 0.5, 0], [50, 50, Number.NaN, 10], [-500, -500, 0.5, 5]];
    for (const [x, y, amount, radius] of cases) {
      expect(pressAt(d, x, y, amount, radius)).toBe(d);
    }
  });

  it("a malformed grid is returned as it is (never NaN / undefined cells): short, NaN-filled, out of range", () => {
    for (const bad of [{ cells: [] }, { cells: [0, 0.5] }, { cells: new Array<number>(N * N).fill(Number.NaN) }, filled(2)] as SquareDough[]) {
      expect(pressAt(bad, 50, 50, 0.5, 10)).toBe(bad);
    }
  });

  it("property: any sequence of presses keeps the grid valid (finite, within 0..1) and never lowers a cell", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const r = rng(seed);
      let d = createSquareDough();
      for (let i = 0; i < 60; i += 1) {
        const next = pressAt(d, r() * 130 - 15, r() * 130 - 15, r() * 1.5, 1 + r() * 30);
        expect(isValidSquareDough(next), `seed ${seed} step ${i}`).toBe(true);
        next.cells.forEach((v, k) => expect(v).toBeGreaterThanOrEqual(d.cells[k]));
        d = next;
      }
    }
  });

  it("property: hammering one point saturates (spread stops at 1, never past it, never NaN)", () => {
    let d = createSquareDough();
    for (let i = 0; i < 200; i += 1) d = pressAt(d, 50, 50, 0.3, 10);
    expect(isValidSquareDough(d)).toBe(true);
    expect(Math.max(...d.cells)).toBe(1);
    const again = pressAt(d, 50, 50, 0.3, 10);
    expect(again).toBe(d); // nothing left to change: same object
  });
});

describe("coverage", () => {
  it("is the fraction of cells at or above the minimum spread", () => {
    const d = createSquareDough();
    const cells = d.cells.slice();
    for (let i = 0; i < 36; i += 1) cells[i] = SQUARE_COVERAGE_MIN_SPREAD;
    cells[40] = SQUARE_COVERAGE_MIN_SPREAD - 0.001;
    expect(squareCoverage({ cells })).toBeCloseTo(36 / (N * N), 12);
    expect(squareCoverage(filled(1))).toBe(1);
  });

  it("property: always within 0..1 and never decreases as dough is pressed out", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const r = rng(seed * 7);
      let d = createSquareDough();
      let last = 0;
      for (let i = 0; i < 40; i += 1) {
        d = pressAt(d, r() * 100, r() * 100, r() * 0.8, 3 + r() * 25);
        const c = squareCoverage(d);
        expect(c).toBeGreaterThanOrEqual(last);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
        last = c;
      }
    }
  });
});

describe("evenness (a shape measure: the level is read separately)", () => {
  it("a barely pressed but uniform pan is perfectly even; only the mean level tells it apart (so completion must not use evenness alone)", () => {
    const thin = filled(SQUARE_COVERAGE_MIN_SPREAD + 0.01);
    expect(squareEvenness(thin)).toBeCloseTo(1, 12);
    expect(squareMeanSpread(thin)).toBeLessThan(0.1);
    expect(squareMeanSpread(filled(1))).toBe(1);
    expect(squareMeanSpread(createSquareDough())).toBe(0);
    expect(Object.values(squareCornersReached(thin)).some(Boolean)).toBe(false); // the level shows up in corner reach
  });

  it("is 1 for any uniform non-empty grid and 0 for an empty one", () => {
    for (const v of [0.1, 0.5, 0.85, 1]) expect(squareEvenness(filled(v)), String(v)).toBeCloseTo(1, 12);
    expect(squareEvenness(filled(0))).toBe(0);
  });

  it("is lower for a lopsided pan than for a flat one, and always within 0..1", () => {
    const half = { cells: Array.from({ length: N * N }, (_, i) => (i % N < N / 2 ? 1 : 0.1)) };
    expect(squareEvenness(half)).toBeLessThan(squareEvenness(filled(0.7)));
    for (let seed = 1; seed <= 60; seed += 1) {
      const e = squareEvenness(pressRandomly(25, seed));
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
    }
  });

  it("a pan pressed out in one blob is less even than one pressed out everywhere", () => {
    const blob = pressAt(createSquareDough(), 50, 50, 1, 20);
    let everywhere = createSquareDough();
    for (const x of [20, 40, 60, 80]) for (const y of [20, 40, 60, 80]) everywhere = pressAt(everywhere, x, y, 1, 30);
    expect(squareEvenness(everywhere)).toBeGreaterThan(squareEvenness(blob));
  });
});

describe("corner reach", () => {
  it("the threshold is one named constant, 85% (Owner D5 initial value)", () => {
    expect(SQUARE_CORNER_REACH_THRESHOLD).toBe(0.85);
    expect(isSquareCornerReached(0.85)).toBe(true);
    expect(isSquareCornerReached(0.8499)).toBe(false);
  });

  it("the zone size is derived from the fraction of the grid and can never make zones overlap", () => {
    expect(SQUARE_CORNER_ZONE_CELLS).toBe(Math.round(N * SQUARE_CORNER_ZONE_FRACTION));
    expect(SQUARE_CORNER_ZONE_CELLS * 2).toBeLessThanOrEqual(N);
  });

  it("each corner zone is a 3x3 block in its own corner and the four zones do not overlap", () => {
    const seen = new Set<string>();
    for (const corner of CORNER_IDS) {
      const zone = squareCornerZone(corner);
      expect(zone).toHaveLength(SQUARE_CORNER_ZONE_CELLS ** 2);
      for (const { col, row } of zone) {
        expect(seen.has(`${col},${row}`)).toBe(false);
        seen.add(`${col},${row}`);
      }
    }
    expect(squareCornerZone("topLeft")).toContainEqual({ col: 0, row: 0 });
    expect(squareCornerZone("bottomRight")).toContainEqual({ col: N - 1, row: N - 1 });
    expect(squareCornerZone("topRight")).toContainEqual({ col: N - 1, row: 0 });
    expect(squareCornerZone("bottomLeft")).toContainEqual({ col: 0, row: N - 1 });
  });

  it("a fully pressed pan reaches all four corners; an empty one none; dough only in the middle reaches none", () => {
    expect(Object.values(squareCornersReached(filled(1))).every(Boolean)).toBe(true);
    expect(Object.values(squareCornersReached(createSquareDough())).some(Boolean)).toBe(false);
    const middle = pressAt(createSquareDough(), 50, 50, 1, 30);
    expect(Object.values(squareCornersReached(middle)).some(Boolean)).toBe(false);
  });

  it("pressing a corner reaches that corner and no other", () => {
    const b = squarePanGeometry.bounds();
    const i = 3.5; // a little inside the pan's corner
    const spots = { topLeft: [b.minX + i, b.minY + i], topRight: [b.maxX - i, b.minY + i], bottomLeft: [b.minX + i, b.maxY - i], bottomRight: [b.maxX - i, b.maxY - i] } as const;
    for (const corner of CORNER_IDS) {
      let d = createSquareDough();
      for (let n = 0; n < 6; n += 1) d = pressAt(d, spots[corner][0], spots[corner][1], 1, 36);
      const reached = squareCornersReached(d);
      expect(reached[corner], corner).toBe(true);
      for (const other of CORNER_IDS.filter((c) => c !== corner)) expect(reached[other], `${corner} presses ${other}`).toBe(false);
    }
  });

  it("property: reach values are within 0..1 and never decrease as dough is pressed out", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const r = rng(seed * 13);
      let d = createSquareDough();
      let last = squareCornerReach(d);
      for (let i = 0; i < 30; i += 1) {
        d = pressAt(d, r() * 100, r() * 100, r() * 0.7, 3 + r() * 25);
        const now = squareCornerReach(d);
        for (const c of CORNER_IDS) {
          expect(now[c]).toBeGreaterThanOrEqual(last[c]);
          expect(now[c]).toBeGreaterThanOrEqual(0);
          expect(now[c]).toBeLessThanOrEqual(1);
        }
        last = now;
      }
    }
  });
});
