import { describe, expect, it } from "vitest";
import { createInitialSquareDough, isSquareCellOnPan, squareCellIndex, type SquareDough } from "./squareDough";
import { createLumpySquareDough } from "./squareDoughFixtures";
import { RASTER_SIZE, rasterizeSquareDough } from "./squareDoughRaster";
import { CLOSE_BLUR, EDGE_DARK, PAN_FLOOR_LIGHT, panFloorRgb, rasterizeSquareDoughSheet } from "./squareDoughSheet";

const N = RASTER_SIZE;
const px = (img: Uint8ClampedArray, x: number, y: number) => {
  const o = (y * N + x) * 4;
  return [img[o], img[o + 1], img[o + 2], img[o + 3]] as const;
};
const lum = (p: readonly number[]) => p[0] + p[1] + p[2];
function sheet(fill: (row: number, col: number) => number): SquareDough {
  const thickness = new Array<number>(256).fill(0);
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) if (isSquareCellOnPan(r, c)) thickness[squareCellIndex(r, c)] = fill(r, c);
  return { thickness };
}
/** dough only in the block of cells rows 5..10, cols 5..10 */
const block = sheet((r, c) => (r >= 5 && r <= 10 && c >= 5 && c <= 10 ? 0.3 : 0));

describe("rasterizeSquareDoughSheet: the pan's floor, the dough's shadow and its side (D2-b2, render only)", () => {
  it("is one opaque 128 x 128 picture: the floor shows where there is no dough, so nothing is left transparent", () => {
    for (const dough of [createInitialSquareDough(), createLumpySquareDough(), block]) {
      const img = rasterizeSquareDoughSheet(dough);
      expect(img.length).toBe(N * N * 4);
      for (let i = 3; i < img.length; i += 4) expect(img[i]).toBe(255);
    }
  });

  it("an empty pan is the floor: light at the top left, darker toward the bottom right and at the wall, with no shadow", () => {
    const img = rasterizeSquareDoughSheet(sheet(() => 0));
    for (const [x, y] of [[40, 40], [64, 64], [90, 90], [20, 100]]) {
      const floor = panFloorRgb(x, y);
      const p = px(img, x, y);
      for (let k = 0; k < 3; k++) expect(Math.abs(p[k] - floor[k]), `floor ${x},${y}`).toBeLessThanOrEqual(1);
    }
    expect(lum(px(img, 40, 40))).toBeGreaterThan(lum(px(img, 90, 90)));
    expect(lum(px(img, 64, 64))).toBeGreaterThan(lum(px(img, 64, 1))); // the wall darkens the rim
    expect(PAN_FLOOR_LIGHT[0]).toBeGreaterThan(panFloorRgb(N - 1, N - 1)[0]);
  });

  it("the dough keeps its own colour away from its edge (a uniform sheet is the same pixels as the plain raster)", () => {
    const flat = sheet(() => 0.16);
    const plain = rasterizeSquareDough(flat);
    const img = rasterizeSquareDoughSheet(flat);
    for (const [x, y] of [[64, 64], [30, 90], [100, 40], [5, 5], [N - 6, N - 6]]) {
      const a = px(plain, x, y);
      const b = px(img, x, y);
      for (let k = 0; k < 3; k++) expect(Math.abs(a[k] - b[k]), `${x},${y} channel ${k}`).toBeLessThanOrEqual(2);
    }
  });

  it("never takes dough away: every pixel the plain raster draws as dough is still dough here, at most EDGE_DARK darker", () => {
    for (const dough of [createInitialSquareDough(), createLumpySquareDough(), block]) {
      const plain = rasterizeSquareDough(dough);
      const img = rasterizeSquareDoughSheet(dough);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const a = px(plain, x, y);
          if (a[3] < 255) continue;
          const b = px(img, x, y);
          for (let k = 0; k < 3; k++) {
            expect(b[k], `${x},${y} channel ${k}`).toBeGreaterThanOrEqual(Math.floor(a[k] * (1 - EDGE_DARK)) - 1);
            expect(b[k], `${x},${y} channel ${k}`).toBeLessThanOrEqual(Math.min(255, Math.ceil(a[k] * 1.1)) + 1);
          }
        }
      }
    }
  });

  it("closing the notches of the outline only ever adds a few pixels: it never reaches farther than CLOSE_BLUR pixels from the plain dough", () => {
    const dough = createInitialSquareDough();
    const plain = rasterizeSquareDough(dough);
    const img = rasterizeSquareDoughSheet(dough);
    const isDough = (y: number, x: number) => px(plain, Math.min(N - 1, Math.max(0, x)), Math.min(N - 1, Math.max(0, y)))[3] > 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (isDough(y, x)) continue;
        const floor = panFloorRgb(x, y);
        const p = px(img, x, y);
        const differs = Math.abs(p[0] - floor[0]) + Math.abs(p[1] - floor[1]) + Math.abs(p[2] - floor[2]) > 0;
        if (!differs) continue;
        // a pixel that is not floor-coloured is shadow (darker) or a closed notch (lighter, dough-coloured): the latter must touch the dough
        if (lum(p) > lum(floor) + 4) {
          let near = false;
          for (let dy = -CLOSE_BLUR - 1; dy <= CLOSE_BLUR + 1 && !near; dy++) for (let dx = -CLOSE_BLUR - 1; dx <= CLOSE_BLUR + 1; dx++) if (isDough(y + dy, x + dx)) near = true;
          expect(near, `a closed pixel at ${x},${y} is next to the dough`).toBe(true);
        }
      }
    }
  });

  it("the dough casts a shadow onto the floor, down and to the right (away from the light): darker below-right of a block than above-left of it", () => {
    const img = rasterizeSquareDoughSheet(block);
    // the block spans cells 5..10 -> pixels ~ [40..88]; 3 pixels outside each side
    const noShadow = (x: number, y: number) => lum(panFloorRgb(x, y));
    const right = noShadow(92, 64) - lum(px(img, 92, 64));
    const left = noShadow(36, 64) - lum(px(img, 36, 64));
    const below = noShadow(64, 92) - lum(px(img, 64, 92));
    const above = noShadow(64, 36) - lum(px(img, 64, 36));
    expect(right).toBeGreaterThan(20);
    expect(below).toBeGreaterThan(20);
    expect(right).toBeGreaterThan(left);
    expect(below).toBeGreaterThan(above);
    // and it fades: far from the dough the floor is the floor again
    expect(Math.abs(noShadow(120, 64) - lum(px(img, 120, 64)))).toBeLessThanOrEqual(3);
  });

  it("the dough's side: the edge facing the light (top left) is brighter than the edge turned away from it (bottom right)", () => {
    const img = rasterizeSquareDoughSheet(block);
    const plain = rasterizeSquareDough(block);
    // the outermost opaque column / row of the block on each side, relative to the plain dough there
    const row = 64;
    let leftEdge = -1;
    let rightEdge = -1;
    for (let x = 0; x < N; x++) if (px(plain, x, row)[3] === 255) { if (leftEdge < 0) leftEdge = x; rightEdge = x; }
    expect(leftEdge).toBeGreaterThan(0);
    const gainLeft = lum(px(img, leftEdge, row)) - lum(px(plain, leftEdge, row));
    const gainRight = lum(px(img, rightEdge, row)) - lum(px(plain, rightEdge, row));
    expect(gainLeft).toBeGreaterThan(gainRight);
    expect(gainRight).toBeLessThan(0); // the far edge is darker than the plain dough
  });

  it("never throws or produces NaN for hostile data, and is deterministic and cheap", () => {
    const hostile = sheet((r, c) => [Number.NaN, -3, 7, Number.POSITIVE_INFINITY, 0.2][(r + c) % 5]);
    const img = rasterizeSquareDoughSheet(hostile);
    expect(img.length).toBe(N * N * 4);
    for (const v of img) expect(v >= 0 && v <= 255).toBe(true);
    const lumpy = createLumpySquareDough();
    expect(Array.from(rasterizeSquareDoughSheet(lumpy))).toEqual(Array.from(rasterizeSquareDoughSheet(lumpy)));
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) rasterizeSquareDoughSheet(lumpy);
    expect((performance.now() - t0) / 20).toBeLessThan(80); // generous for a loaded CI box
  });
});
