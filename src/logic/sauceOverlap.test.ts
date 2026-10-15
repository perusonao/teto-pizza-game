import { describe, expect, it } from "vitest";
import { createIdealDoughShape } from "./doughShape";
import {
  alphaPlaneOf,
  buildSauceDisplayPixels,
  dimWhereOverlapping,
  SAUCE_DISPLAY_GRID,
  SAUCE_OVERLAP_ALPHA_FACTOR,
} from "./sauceDisplay";
import { SAUCE_ALPHA_CAP, type SauceDepositLike } from "./sauceField";

/** Owner Decision on PR #494: where a later sauce run overlaps an earlier one, its opacity is dimmed (about x0.7); elsewhere nothing changes. */
const shape = createIdealDoughShape();
const GRID = SAUCE_DISPLAY_GRID;
const TOMATO = "#c73b2e";
const PESTO = "#6b8e3d";
const OIL = "#e9d9a0";
const DOUGH: [number, number, number] = [232, 190, 128];

/** A held stroke along a horizontal band: `perPoint` deposits at each of 30 points (a full 1.0 bottle spread over the band). */
const band = (x0: number, x1: number, y = 50): SauceDepositLike[] =>
  Array.from({ length: 50 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / 49, y, amount: 0.02 }));

const px = (x: number, y: number) => (Math.round((y / 100) * (GRID - 1)) * GRID + Math.round((x / 100) * (GRID - 1))) * 4;

/** What PizzaStage's canvas does for one layer: rasterize it, then dim it where everything under it already is. */
function layer(deposits: SauceDepositLike[], color: string, under: SauceDepositLike[]): Uint8ClampedArray {
  const pixels = buildSauceDisplayPixels(deposits, shape, color);
  if (under.length > 0) dimWhereOverlapping(pixels, alphaPlaneOf(buildSauceDisplayPixels(under, shape, "#000000")));
  return pixels;
}

/** Plain alpha stacking of the layers (bottom first) over bare dough, at one pixel: the same "over" the browser applies to the canvases. */
function composite(layers: Uint8ClampedArray[], at: number): [number, number, number] {
  let rgb = [...DOUGH];
  for (const l of layers) {
    const a = l[at + 3] / 255;
    rgb = [0, 1, 2].map((c) => l[at + c] * a + rgb[c] * (1 - a));
  }
  return rgb.map(Math.round) as [number, number, number];
}

describe("overlap dimming of a later sauce layer (Owner Decision, PR #494)", () => {
  const tomatoBand = band(25, 70);
  const pestoSame = band(25, 70);

  it("nothing under a layer: the raster is byte-identical (one-sauce pizzas and the bottom layer never change)", () => {
    const plain = buildSauceDisplayPixels(tomatoBand, shape, TOMATO);
    expect([...layer(tomatoBand, TOMATO, [])]).toEqual([...plain]);
    const noOverlap = layer(band(25, 70, 20), PESTO, band(25, 70, 80)); // far apart: nothing shared
    expect([...noOverlap]).toEqual([...buildSauceDisplayPixels(band(25, 70, 20), shape, PESTO)]);
  });

  it("full overlap: the top layer's opacity is about 0.7 of what it was, its colour untouched", () => {
    const plain = buildSauceDisplayPixels(pestoSame, shape, PESTO);
    const dimmed = layer(pestoSame, PESTO, tomatoBand);
    const at = px(48, 50);
    expect(plain[at + 3]).toBe(Math.round(255 * SAUCE_ALPHA_CAP));
    expect(dimmed[at + 3] / plain[at + 3]).toBeCloseTo(SAUCE_OVERLAP_ALPHA_FACTOR, 2);
    expect([dimmed[at], dimmed[at + 1], dimmed[at + 2]]).toEqual([plain[at], plain[at + 1], plain[at + 2]]);
    expect(SAUCE_OVERLAP_ALPHA_FACTOR).toBeCloseTo(0.7, 5);
  });

  it("partial overlap: only the shared part is dimmed; the rest of the top layer is exactly as before; never more opaque", () => {
    const lower = band(20, 40); // a sauce edge is soft (reaches ~20% of the dough past its last deposit), so test far from it
    const upper = band(35, 90);
    const plain = buildSauceDisplayPixels(upper, shape, PESTO);
    const dimmed = layer(upper, PESTO, lower);
    const clear = px(88, 50); // well past the soft edge of the lower band
    expect(dimmed[clear + 3]).toBe(plain[clear + 3]);
    const shared = px(37, 50);
    expect(dimmed[shared + 3]).toBeLessThan(plain[shared + 3]);
    expect(dimmed[shared + 3] / plain[shared + 3]).toBeLessThan(0.8);
    for (let i = 3; i < dimmed.length; i += 4) expect(dimmed[i]).toBeLessThanOrEqual(plain[i]);
    // smooth, not a hard seam: the dimming eases off along the soft edge of the lower sauce
    const ratios = [45, 52, 58, 64, 72].map((x) => dimmed[px(x, 50) + 3] / Math.max(1, plain[px(x, 50) + 3]));
    for (let i = 1; i < ratios.length; i += 1) expect(ratios[i]).toBeGreaterThanOrEqual(ratios[i - 1] - 1e-9);
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(SAUCE_OVERLAP_ALPHA_FACTOR - 0.02);
    expect(ratios[ratios.length - 1]).toBeGreaterThan(0.97);
  });

  it("two layers over the same band: the sauce underneath shows through (about 3x what a plain stack left, was ~7%)", () => {
    const bottom = layer(tomatoBand, TOMATO, []);
    const plainTop = buildSauceDisplayPixels(pestoSame, shape, PESTO);
    const dimmedTop = layer(pestoSame, PESTO, tomatoBand);
    const at = px(48, 50);
    const before = composite([bottom, plainTop], at);
    const after = composite([bottom, dimmedTop], at);
    // the old composite is almost pure pesto; the new one carries clearly more of the tomato red and less green
    expect(before[0]).toBeLessThan(125);
    expect(after[0] - before[0]).toBeGreaterThanOrEqual(15);
    expect(before[1] - after[1]).toBeGreaterThanOrEqual(10);
    // it is still a stack, not a flat blend: the top sauce keeps the larger share
    expect(after[1]).toBeGreaterThan(after[0] - 40);
  });

  it("three layers: every layer stays readable, and each lies under only the layers below it", () => {
    const oilSame = band(25, 70);
    const l1 = layer(tomatoBand, TOMATO, []);
    const l2 = layer(pestoSame, PESTO, tomatoBand);
    const l3 = layer(oilSame, OIL, [...tomatoBand, ...pestoSame]);
    const at = px(48, 50);
    const stack3 = composite([l1, l2, l3], at);
    const stack2 = composite([l1, l2], at);
    const oldStack3 = composite([l1, buildSauceDisplayPixels(pestoSame, shape, PESTO), buildSauceDisplayPixels(oilSame, shape, OIL)], at);
    // the top layer is dimmed too (it overlaps two layers): its alpha is ~0.7 of the cap
    expect(l3[at + 3] / (255 * SAUCE_ALPHA_CAP)).toBeCloseTo(SAUCE_OVERLAP_ALPHA_FACTOR, 1);
    // the stack is not just the top colour any more: it keeps part of the pesto green and the tomato red underneath
    expect(Math.abs(stack3[0] - oldStack3[0]) + Math.abs(stack3[1] - oldStack3[1]) + Math.abs(stack3[2] - oldStack3[2])).toBeGreaterThan(20);
    expect(stack3).not.toEqual(stack2);
    // ordering is preserved: the oil on top is the main contributor, and the result is between the layers' own colours
    expect(stack3[2]).toBeGreaterThan(stack2[2]); // more of the pale oil's blue channel than without it
  });

  it("works on whatever the alpha plane says: an empty under raster changes nothing, a full one gives exactly the factor", () => {
    const pixels = buildSauceDisplayPixels(pestoSame, shape, PESTO);
    const copy = new Uint8ClampedArray(pixels);
    dimWhereOverlapping(copy, new Uint8ClampedArray(GRID * GRID));
    expect([...copy]).toEqual([...pixels]);
    const full = new Uint8ClampedArray(GRID * GRID).fill(255);
    dimWhereOverlapping(copy, full);
    const at = px(48, 50);
    expect(copy[at + 3]).toBe(Math.round(pixels[at + 3] * SAUCE_OVERLAP_ALPHA_FACTOR));
  });
});
