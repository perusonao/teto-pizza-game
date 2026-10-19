import { describe, expect, it } from "vitest";
import { createInitialSquareDough, isSquareCellOnPan, squareCellIndex, type SquareDough } from "./squareDough";
import { createLumpySquareDough } from "./squareDoughFixtures";
import { RASTER_SIZE, rasterizeSquareDough, thicknessSurface } from "./squareDoughRaster";
import { thicknessRgb } from "./squareDoughView";

const N = RASTER_SIZE;
const px = (img: Uint8ClampedArray, x: number, y: number) => {
  const o = (y * N + x) * 4;
  return [img[o], img[o + 1], img[o + 2], img[o + 3]] as const;
};
function sheet(fill: (row: number, col: number) => number): SquareDough {
  const thickness = new Array<number>(256).fill(0);
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) if (isSquareCellOnPan(r, c)) thickness[squareCellIndex(r, c)] = fill(r, c);
  return { thickness };
}

describe("rasterizeSquareDough: one smooth sheet, not a grid of squares", () => {
  it("is 128 x 128 RGBA", () => {
    expect(RASTER_SIZE).toBe(128);
    expect(rasterizeSquareDough(createInitialSquareDough()).length).toBe(128 * 128 * 4);
  });

  it("a uniform sheet is one flat colour and opaque to the very rim (the off-pan cells do not fade the edge out)", () => {
    const img = rasterizeSquareDough(sheet(() => 0.16));
    const [r, g, b] = thicknessRgb(0.16, "ball");
    for (const [x, y] of [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1], [N / 2, N / 2], [3, 60], [124, 70]]) {
      const p = px(img, x, y);
      expect(p[3], `alpha at ${x},${y}`).toBe(255);
      expect(Math.abs(p[0] - r) + Math.abs(p[1] - g) + Math.abs(p[2] - b), `colour at ${x},${y}`).toBeLessThanOrEqual(3);
    }
  });

  it("the ball start: the lump is opaque in the middle, the empty corners are transparent, and the picture is left-right symmetric", () => {
    const img = rasterizeSquareDough(createInitialSquareDough());
    expect(px(img, N / 2, N / 2)[3]).toBe(255);
    expect(px(img, 4, 4)[3]).toBe(0);
    expect(px(img, N - 5, N - 5)[3]).toBe(0);
    for (const y of [20, 50, 64, 80]) {
      for (const x of [40, 52, 60]) {
        const a = px(img, x, y);
        const b = px(img, N - 1 - x, y);
        // symmetric up to the lighting (it comes from the left): alpha is exactly mirrored
        expect(Math.abs(a[3] - b[3])).toBeLessThanOrEqual(2);
      }
    }
  });

  it("no cell grid: between neighbouring pixels the colour never jumps the way cell-to-cell steps do", () => {
    const lumpy = createLumpySquareDough();
    const img = rasterizeSquareDough(lumpy, "ball");
    let maxPixelStep = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N - 1; x++) {
        const a = px(img, x, y);
        const b = px(img, x + 1, y);
        maxPixelStep = Math.max(maxPixelStep, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
      }
    }
    // the same sheet drawn as flat cells: the biggest step between two neighbouring cells
    let maxCellStep = 0;
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 15; c++) {
        if (!isSquareCellOnPan(r, c) || !isSquareCellOnPan(r, c + 1)) continue;
        const a = thicknessRgb(lumpy.thickness[squareCellIndex(r, c)], "ball");
        const b = thicknessRgb(lumpy.thickness[squareCellIndex(r, c + 1)], "ball");
        maxCellStep = Math.max(maxCellStep, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
      }
    }
    expect(maxCellStep).toBeGreaterThan(10);
    expect(maxPixelStep).toBeLessThan(maxCellStep / 2);
  });

  it("a covered cell is opaque however thin it is; an uncovered one far from dough is not drawn at all", () => {
    const img = rasterizeSquareDough(sheet(() => 0.05));
    for (const [x, y] of [[0, 0], [64, 64], [127, 127]]) expect(px(img, x, y)[3]).toBe(255);
    const empty = rasterizeSquareDough(sheet(() => 0));
    for (const [x, y] of [[0, 0], [64, 64], [127, 127]]) expect(px(empty, x, y)[3]).toBe(0);
  });

  it("the edge of the sheet rolls off softly: alpha rises over several pixels, never one step", () => {
    const one = sheet((r, c) => (r === 7 && c === 7 ? 0.5 : 0));
    const img = rasterizeSquareDough(one);
    let maxAlphaStep = 0;
    let seen = false;
    for (let x = 0; x < N - 1; x++) {
      const a = px(img, x, N / 2 - 4)[3];
      const b = px(img, x + 1, N / 2 - 4)[3];
      if (a > 0 || b > 0) seen = true;
      maxAlphaStep = Math.max(maxAlphaStep, Math.abs(a - b));
    }
    expect(seen).toBe(true);
    expect(maxAlphaStep).toBeLessThan(128);
  });

  it("relief: the flank of a mound that faces the light (top left) is brighter than the opposite flank at the same thickness", () => {
    const mound = sheet((r, c) => 0.12 + 0.5 * Math.exp(-((r - 7.5) ** 2 + (c - 7.5) ** 2) / 6));
    const img = rasterizeSquareDough(mound);
    const surface = thicknessSurface(mound);
    const a = N / 2 - 14; // a pixel on the top-left flank, and its mirror image through the centre of the pan
    const b = N - 1 - a;
    const tl = px(img, a, a);
    const br = px(img, b, b);
    // the same height on both flanks, so any difference is the lighting
    expect(Math.abs(surface[a * N + a] - surface[b * N + b])).toBeLessThan(0.005);
    const lum = (p: readonly number[]) => p[0] + p[1] + p[2];
    expect(lum(tl)).toBeGreaterThan(lum(br));
  });

  it("thick lumps are visibly darker than the film around them (the ramp, with relief on top)", () => {
    const img = rasterizeSquareDough(sheet((r, c) => (Math.abs(r - 7.5) < 2 && Math.abs(c - 7.5) < 2 ? 0.8 : 0.16)));
    const lum = (p: readonly number[]) => p[0] + p[1] + p[2];
    expect(lum(px(img, N / 2, N / 2)) + 60).toBeLessThan(lum(px(img, 20, 20)));
  });

  it("never throws or produces NaN for hostile data (NaN, negative, above 1, ±Infinity): it is clamped to a valid image", () => {
    const hostile = sheet((r, c) => [Number.NaN, -3, 7, Number.POSITIVE_INFINITY, 0.2][(r + c) % 5]);
    const img = rasterizeSquareDough(hostile);
    expect(img.length).toBe(N * N * 4);
    const surface = thicknessSurface(hostile);
    for (const v of surface) expect(Number.isFinite(v) && v >= 0).toBe(true);
    for (const v of img) expect(v >= 0 && v <= 255).toBe(true);
  });

  it("is deterministic and cheap: the same dough gives the same image, and one image takes a few milliseconds", () => {
    const lumpy = createLumpySquareDough();
    const a = rasterizeSquareDough(lumpy);
    const b = rasterizeSquareDough(lumpy);
    expect(Array.from(a)).toEqual(Array.from(b));
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) rasterizeSquareDough(lumpy);
    expect((performance.now() - t0) / 20).toBeLessThan(60); // generous for a loaded CI box; measured ~2 ms
  });
});
