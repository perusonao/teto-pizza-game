import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INITIAL_DOUGH_RADIUS } from "../doughShape";
import { SQUARE_PAN_GEOMETRY } from "./panGeometry";
import {
  CORNER_REACH_THRESHOLD,
  SQUARE_COVER_MIN_THICKNESS,
  SQUARE_DOUGH_GRID,
  SQUARE_DOUGH_MAX_THICKNESS,
  areAllCornersReached,
  createInitialSquareDough,
  isSquareCellOnPan,
  isValidSquareDough,
  squareCellCenter,
  squareCellIndex,
  squareCornerReach,
  squareDoughCoverage,
  squareDoughEvenness,
  type SquareDough,
} from "./squareDough";

const N = SQUARE_DOUGH_GRID;
const MAX = SQUARE_DOUGH_MAX_THICKNESS;

function blank(): number[] {
  return new Array<number>(N * N).fill(0);
}

/** Every on-pan cell at `value`. */
function sheet(value: number): SquareDough {
  const thickness = blank();
  for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) if (isSquareCellOnPan(row, col)) thickness[squareCellIndex(row, col)] = value;
  return { thickness };
}

/** The initial ball plus the given cells at full thickness. */
function withCells(cells: readonly (readonly [number, number])[]): SquareDough {
  const thickness = [...createInitialSquareDough().thickness];
  for (const [row, col] of cells) thickness[squareCellIndex(row, col)] = MAX;
  return { thickness };
}

/** A small deterministic generator, so the property tests are reproducible. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("grid and pan cells", () => {
  it("only cells whose centre is on the pan can hold dough (14 x 14 of the 16 x 16)", () => {
    let onPan = 0;
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const c = squareCellCenter(row, col);
        expect(isSquareCellOnPan(row, col)).toBe(SQUARE_PAN_GEOMETRY.contains(c.x, c.y));
        if (isSquareCellOnPan(row, col)) onPan++;
      }
    }
    expect(onPan).toBe(196);
  });
});

describe("createInitialSquareDough", () => {
  it("is valid, a thick ball inside the initial radius, and symmetric in all four directions", () => {
    const dough = createInitialSquareDough();
    expect(isValidSquareDough(dough)).toBe(true);
    expect(dough.thickness).toHaveLength(N * N);
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const t = dough.thickness[squareCellIndex(row, col)];
        const c = squareCellCenter(row, col);
        const inside = Math.hypot(c.x - 50, c.y - 50) <= INITIAL_DOUGH_RADIUS;
        expect(t, `${row},${col}`).toBe(inside ? MAX : 0);
        expect(dough.thickness[squareCellIndex(N - 1 - row, col)]).toBe(t);
        expect(dough.thickness[squareCellIndex(row, N - 1 - col)]).toBe(t);
        expect(dough.thickness[squareCellIndex(col, row)]).toBe(t);
      }
    }
  });

  it("starts small, nowhere near even (most of the pan is empty), and nowhere near a corner", () => {
    const dough = createInitialSquareDough();
    const coverage = squareDoughCoverage(dough);
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThan(0.25);
    expect(squareDoughEvenness(dough)).toBe(0);
    expect(squareCornerReach(dough).every((r) => r < 0.6)).toBe(true);
    expect(areAllCornersReached(dough)).toBe(false);
  });
});

describe("isValidSquareDough", () => {
  it("accepts the initial dough and a full sheet", () => {
    expect(isValidSquareDough(createInitialSquareDough())).toBe(true);
    expect(isValidSquareDough(sheet(MAX))).toBe(true);
    expect(isValidSquareDough(sheet(0))).toBe(true);
  });

  it("rejects a wrong length, non-finite, negative and over-thick values", () => {
    expect(isValidSquareDough({ thickness: [] })).toBe(false);
    expect(isValidSquareDough({ thickness: blank().slice(1) })).toBe(false);
    expect(isValidSquareDough({ thickness: [...blank(), 0] })).toBe(false);
    const at = squareCellIndex(7, 7);
    for (const bad of [NaN, Infinity, -Infinity, -0.0001, MAX + 0.0001, "1" as unknown as number, null as unknown as number]) {
      const t = blank();
      t[at] = bad;
      expect(isValidSquareDough({ thickness: t }), String(bad)).toBe(false);
    }
  });

  it("rejects dough on a cell that is off the pan", () => {
    const t = blank();
    t[squareCellIndex(0, 0)] = MAX;
    expect(isSquareCellOnPan(0, 0)).toBe(false);
    expect(isValidSquareDough({ thickness: t })).toBe(false);
  });
});

describe("coverage and evenness", () => {
  it("coverage: 0 for empty, 1 for a full sheet, and a cell counts from SQUARE_COVER_MIN_THICKNESS up (inclusive)", () => {
    expect(squareDoughCoverage(sheet(0))).toBe(0);
    expect(squareDoughCoverage(sheet(MAX))).toBe(1);
    const below = sheet(SQUARE_COVER_MIN_THICKNESS - 1e-9);
    const at = sheet(SQUARE_COVER_MIN_THICKNESS);
    expect(squareDoughCoverage(below)).toBe(0);
    expect(squareDoughCoverage(at)).toBe(1);
  });

  it("coverage grows by one on-pan cell at a time", () => {
    const base = createInitialSquareDough();
    const before = squareDoughCoverage(base);
    const t = [...base.thickness];
    t[squareCellIndex(1, 1)] = MAX;
    expect(squareDoughCoverage({ thickness: t })).toBeCloseTo(before + 1 / 196, 12);
  });

  it("evenness counts uncovered cells: half a pan of uniform dough is far from even", () => {
    const t = blank();
    for (let row = 0; row < N; row++) for (let col = 0; col < N / 2; col++) if (isSquareCellOnPan(row, col)) t[squareCellIndex(row, col)] = MAX;
    const half = squareDoughEvenness({ thickness: t });
    expect(squareDoughCoverage({ thickness: t })).toBeCloseTo(0.5, 12);
    expect(half).toBe(0); // mean 0.5, sd 0.5 -> 1 - 1 = 0
    expect(squareDoughEvenness(sheet(MAX))).toBe(1);
  });

  it("evenness: a full sheet with one hole is below 1 and above a half-empty pan", () => {
    const t = [...sheet(MAX).thickness];
    t[squareCellIndex(7, 7)] = 0;
    const value = squareDoughEvenness({ thickness: t });
    expect(value).toBeLessThan(1);
    expect(value).toBeGreaterThan(0.9);
  });

  it("evenness: a uniform sheet of any thickness is 1, an empty dough is 0", () => {
    expect(squareDoughEvenness(sheet(0.3))).toBe(1);
    expect(squareDoughEvenness(sheet(MAX))).toBe(1);
    expect(squareDoughEvenness(sheet(0))).toBe(0);
  });

  it("evenness: a known two-level sheet (half 1.0, half 0.5) gives 1 - sd/mean = 1 - 0.25/0.75", () => {
    const t = blank();
    let i = 0;
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        if (!isSquareCellOnPan(row, col)) continue;
        t[squareCellIndex(row, col)] = i++ % 2 === 0 ? 1 : 0.5;
      }
    }
    expect(squareDoughEvenness({ thickness: t })).toBeCloseTo(1 - 0.25 / 0.75, 12);
  });

  it("evenness: uneven is strictly lower than even, and always within [0, 1]", () => {
    const next = lcg(42);
    for (let run = 0; run < 50; run++) {
      const t = blank();
      for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) if (isSquareCellOnPan(row, col)) t[squareCellIndex(row, col)] = next() * MAX;
      const value = squareDoughEvenness({ thickness: t });
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("corner reach (D5: 85% of the way, both axes, generous)", () => {
  it("the threshold is 0.85 and the comparison is inclusive", () => {
    expect(CORNER_REACH_THRESHOLD).toBe(0.85);
  });

  it("a full sheet reaches every corner at exactly 1; an empty dough reaches none", () => {
    expect(squareCornerReach(sheet(MAX))).toEqual([1, 1, 1, 1]);
    expect(areAllCornersReached(sheet(MAX))).toBe(true);
    expect(squareCornerReach(sheet(0))).toEqual([0, 0, 0, 0]);
    expect(areAllCornersReached(sheet(0))).toBe(false);
  });

  it("corner order is NW, NE, SE, SW", () => {
    const only = (row: number, col: number) => squareCornerReach({ thickness: (() => { const t = blank(); t[squareCellIndex(row, col)] = MAX; return t; })() });
    const nw = only(1, 1);
    const ne = only(1, N - 2);
    const se = only(N - 2, N - 2);
    const sw = only(N - 2, 1);
    expect(nw.map((r) => (r > 0 ? 1 : 0))).toEqual([1, 0, 0, 0]);
    expect(ne.map((r) => (r > 0 ? 1 : 0))).toEqual([0, 1, 0, 0]);
    expect(se.map((r) => (r > 0 ? 1 : 0))).toEqual([0, 0, 1, 0]);
    expect(sw.map((r) => (r > 0 ? 1 : 0))).toEqual([0, 0, 0, 1]);
    for (const reach of [nw, ne, se, sw]) expect(Math.max(...reach)).toBe(1);
  });

  it("boundary: covering the corner's outermost cell is 1; the second ring is just over the threshold; the third is under", () => {
    // outer edges (from the centre): ring 1 = 43.75, ring 2 = 37.5, ring 3 = 31.25 -> / 43.75
    const ring = (k: number) => squareCornerReach(withCells([[k, k]]))[0]; // NW quadrant: ring 1 = cell (1,1)
    expect(ring(1)).toBe(1);
    expect(ring(2)).toBeCloseTo(37.5 / 43.75, 12);
    expect(ring(2)).toBeGreaterThanOrEqual(CORNER_REACH_THRESHOLD);
    expect(ring(3)).toBeCloseTo(31.25 / 43.75, 12);
    expect(ring(3)).toBeLessThan(CORNER_REACH_THRESHOLD);
  });

  it("boundary: the inclusive comparison, via an explicit threshold equal to a cell's own reach", () => {
    const dough = sheet(MAX);
    expect(areAllCornersReached(dough, 1)).toBe(true);
    expect(areAllCornersReached(dough, 1 + 1e-12)).toBe(false);
  });

  it("pulling far along one side only does not reach the corner (the smaller axis counts)", () => {
    const edgeRun: [number, number][] = [];
    for (let col = 1; col <= 6; col++) edgeRun.push([6, col]); // along the left side at mid height, far in x, shallow in y
    const reach = squareCornerReach(withCells(edgeRun));
    expect(reach[0]).toBeLessThan(CORNER_REACH_THRESHOLD);
    expect(reach[3]).toBeLessThan(CORNER_REACH_THRESHOLD);
  });

  it("each corner is independent: all four reached only when all four corner blocks are covered", () => {
    const corner = (r: number, c: number): [number, number][] => [
      [r, c],
      [r, c + (c < 8 ? 1 : -1)],
      [r + (r < 8 ? 1 : -1), c],
      [r + (r < 8 ? 1 : -1), c + (c < 8 ? 1 : -1)],
    ];
    const blocks = [corner(1, 1), corner(1, N - 2), corner(N - 2, N - 2), corner(N - 2, 1)];
    for (let skip = 0; skip < 4; skip++) {
      const cells = blocks.filter((_, i) => i !== skip).flat();
      expect(areAllCornersReached(withCells(cells)), `without corner ${skip}`).toBe(false);
    }
    expect(areAllCornersReached(withCells(blocks.flat()))).toBe(true);
  });

  it("tendrils to the corners do not read as a finished sheet (Codex P2, #541): corners reached, but coverage low and evenness 0", () => {
    // the initial ball plus one full-thickness cell at each second-ring corner
    const tendrils = withCells([
      [2, 2],
      [2, N - 3],
      [N - 3, N - 3],
      [N - 3, 2],
    ]);
    expect(squareCornerReach(tendrils).every((r) => r >= CORNER_REACH_THRESHOLD)).toBe(true);
    expect(areAllCornersReached(tendrils)).toBe(true);
    expect(squareDoughCoverage(tendrils)).toBeCloseTo(36 / 196, 12);
    expect(squareDoughEvenness(tendrils)).toBe(0);
  });

  it("a film just under the cover threshold does not count as dough in evenness (Codex P2, #541)", () => {
    // every on-pan cell at a sliver below the threshold, four second-ring corner cells at the threshold itself
    const film = SQUARE_COVER_MIN_THICKNESS - 1e-6;
    const t = sheet(film).thickness.slice();
    for (const [row, col] of [
      [2, 2],
      [2, N - 3],
      [N - 3, N - 3],
      [N - 3, 2],
    ]) t[squareCellIndex(row, col)] = SQUARE_COVER_MIN_THICKNESS;
    const dough = { thickness: t };
    expect(isValidSquareDough(dough)).toBe(true);
    expect(squareDoughCoverage(dough)).toBeCloseTo(4 / 196, 12);
    expect(areAllCornersReached(dough)).toBe(true);
    expect(squareDoughEvenness(dough)).toBe(0);
  });

  it("evenness ignores sub-threshold slivers: it equals the evenness of the same dough with them zeroed", () => {
    const next = lcg(2024);
    for (let run = 0; run < 40; run++) {
      const t = blank();
      const zeroed = blank();
      for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
          if (!isSquareCellOnPan(row, col)) continue;
          const v = next() < 0.4 ? next() * SQUARE_COVER_MIN_THICKNESS * 0.99 : 0.5 + next() * 0.5;
          t[squareCellIndex(row, col)] = v;
          zeroed[squareCellIndex(row, col)] = v >= SQUARE_COVER_MIN_THICKNESS ? v : 0;
        }
      }
      expect(squareDoughEvenness({ thickness: t })).toBe(squareDoughEvenness({ thickness: zeroed }));
    }
  });

  it("a thin frame around the rim reaches every corner but is nowhere near even", () => {
    const t = blank();
    for (let i = 1; i <= N - 2; i++) {
      for (const [row, col] of [
        [1, i],
        [N - 2, i],
        [i, 1],
        [i, N - 2],
      ]) t[squareCellIndex(row, col)] = MAX;
    }
    const frame = { thickness: t };
    expect(isValidSquareDough(frame)).toBe(true);
    expect(areAllCornersReached(frame)).toBe(true);
    expect(squareDoughEvenness(frame)).toBe(0);
  });

  it("monotone: adding dough never lowers coverage or any corner's reach", () => {
    const next = lcg(7);
    let dough = createInitialSquareDough();
    for (let step = 0; step < 120; step++) {
      const row = Math.floor(next() * N);
      const col = Math.floor(next() * N);
      if (!isSquareCellOnPan(row, col)) continue;
      const t = [...dough.thickness];
      t[squareCellIndex(row, col)] = Math.max(t[squareCellIndex(row, col)], next() * MAX);
      const grown = { thickness: t };
      expect(squareDoughCoverage(grown)).toBeGreaterThanOrEqual(squareDoughCoverage(dough));
      const before = squareCornerReach(dough);
      const after = squareCornerReach(grown);
      for (let k = 0; k < 4; k++) expect(after[k]).toBeGreaterThanOrEqual(before[k]);
      expect(isValidSquareDough(grown)).toBe(true);
      dough = grown;
    }
  });

  it("reach is always within [0, 1]", () => {
    const next = lcg(99);
    for (let run = 0; run < 40; run++) {
      const t = blank();
      for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) if (isSquareCellOnPan(row, col) && next() < 0.5) t[squareCellIndex(row, col)] = next() * MAX;
      for (const r of squareCornerReach({ thickness: t })) {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("module guards", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), "utf8") }));

  it("the corner-reach threshold literal lives in exactly one place", () => {
    const hits = sources.filter((s) => /\b0\.85\b/.test(s.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
    expect(hits.map((h) => h.file)).toEqual(["squareDough.ts"]);
  });

  it("the pan module imports no UI, state or technique code (pure logic only)", () => {
    expect(sources.length).toBeGreaterThanOrEqual(3);
    for (const { file, text } of sources) {
      const imports = [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/components|screens|state\/|techniques|discovery|react|\.css/);
      }
    }
  });
});
