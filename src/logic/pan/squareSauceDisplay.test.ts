import { describe, expect, it } from "vitest";
import { buildSauceDisplayPixels, SAUCE_DISPLAY_GRID } from "../sauceDisplay";
import { createInitialDoughShape } from "../doughShape";
import { SQUARE_PAN_HALF_SIDE } from "./panGeometry";
import { buildSquareSauceDisplayPixels, squarePanMask } from "./squareSauceDisplay";

const G = SAUCE_DISPLAY_GRID;
const alphaAt = (pixels: Uint8ClampedArray, x: number, y: number) => pixels[(y * G + x) * 4 + 3];
const HEX = "#c73b2e";

describe("squarePanMask", () => {
  it("is opaque on the pan, transparent outside, and keeps the corners (no rounding)", () => {
    const mask = squarePanMask(G);
    expect(mask[(G / 2) * G + G / 2]).toBe(255);
    // pixel centres 6.25% in from each side are on the pan (44 half side => 6 .. 94)
    for (const [x, y] of [[6, 6], [G - 7, 6], [6, G - 7], [G - 7, G - 7]]) expect(mask[y * G + x]).toBe(255);
    expect(mask[0]).toBe(0);
    expect(mask[G * G - 1]).toBe(0);
    expect(SQUARE_PAN_HALF_SIDE).toBe(44);
  });

  it("is symmetric under the 8 square symmetries", () => {
    const mask = squarePanMask(G);
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        expect(mask[y * G + x]).toBe(mask[x * G + y]);
        expect(mask[y * G + x]).toBe(mask[y * G + (G - 1 - x)]);
      }
    }
  });
});

describe("buildSquareSauceDisplayPixels", () => {
  it("is fully transparent with no deposits, and for deposits entirely off the pan", () => {
    expect(buildSquareSauceDisplayPixels([], HEX).every((v) => v === 0)).toBe(true);
    expect(buildSquareSauceDisplayPixels([{ x: 99, y: 99, amount: 0.05 }], HEX).every((v) => v === 0)).toBe(true);
  });

  it("reaches the four corners: a dab in each corner paints that corner's pixel", () => {
    for (const [x, y, px, py] of [
      [8, 8, 5, 5],
      [92, 8, G - 6, 5],
      [8, 92, 5, G - 6],
      [92, 92, G - 6, G - 6],
    ]) {
      const pixels = buildSquareSauceDisplayPixels([{ x, y, amount: 0.05 }], HEX);
      expect(alphaAt(pixels, px, py)).toBeGreaterThan(100);
    }
  });

  it("never paints outside the pan, however much is dispensed along the edge", () => {
    const deposits = [];
    for (let t = 0; t <= 100; t += 2) {
      deposits.push({ x: t, y: 4, amount: 0.05 }, { x: t, y: 96, amount: 0.05 }, { x: 4, y: t, amount: 0.05 }, { x: 96, y: t, amount: 0.05 });
    }
    const pixels = buildSquareSauceDisplayPixels(deposits, HEX);
    const mask = squarePanMask(G);
    for (let p = 0; p < G * G; p++) {
      if (mask[p] === 0) expect(pixels[p * 4 + 3]).toBe(0);
      expect(pixels[p * 4 + 3]).toBeLessThanOrEqual(mask[p]);
    }
  });

  it("is symmetric: mirrored deposits give mirrored pixels", () => {
    const a = buildSquareSauceDisplayPixels([{ x: 30, y: 40, amount: 0.05 }], HEX);
    const b = buildSquareSauceDisplayPixels([{ x: 70, y: 40, amount: 0.05 }], HEX);
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) expect(Math.abs(alphaAt(a, x, y) - alphaAt(b, G - 1 - x, y))).toBeLessThanOrEqual(1);
  });

  it("uses the colour it is given and is deterministic", () => {
    const d = [{ x: 50, y: 50, amount: 0.05 }];
    const a = buildSquareSauceDisplayPixels(d, HEX);
    expect(a).toEqual(buildSquareSauceDisplayPixels(d, HEX));
    const i = (G / 2 * G + G / 2) * 4;
    expect([a[i], a[i + 1], a[i + 2]]).toEqual([0xc7, 0x3b, 0x2e]);
  });

  it("matches the round rasterizer's pixels for a dab well inside both (same constants, same curve)", () => {
    const d = [{ x: 50, y: 50, amount: 0.05 }];
    const square = buildSquareSauceDisplayPixels(d, HEX);
    const round = buildSauceDisplayPixels(d, createInitialDoughShape(), HEX);
    let maxDiff = 0;
    for (let i = 3; i < square.length; i += 4) maxDiff = Math.max(maxDiff, Math.abs(square[i] - round[i]));
    expect(maxDiff).toBeLessThanOrEqual(2);
  });
});
