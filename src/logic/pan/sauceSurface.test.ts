import { describe, expect, it } from "vitest";
import { createIdealDoughShape } from "../doughShape";
import { buildSauceDisplayPixels } from "../sauceDisplay";
import { insideDoughShapeFraction, type SauceDepositLike } from "../sauceField";
import { buildPanSauceDisplayPixels, insidePanSauceFraction } from "./sauceSurface";
import { buildSquareSauceDisplayPixels } from "./squareSauceDisplay";
import { insidePanFraction } from "./squareSauce";

/** Square-Pan Dough D2-a2 (#537): the surface switch the shared sauce canvases read. Round must be the existing functions, byte for byte. */
const SHAPE = createIdealDoughShape();
const DEPOSITS: SauceDepositLike[] = [
  { x: 50, y: 50, amount: 0.3 },
  { x: 12, y: 12, amount: 0.2 }, // a pan corner: outside the round dough
  { x: 88, y: 90, amount: 0.2 },
  { x: 97, y: 50, amount: 0.1 }, // past the pan's edge
];

describe("buildPanSauceDisplayPixels", () => {
  it("round is exactly buildSauceDisplayPixels", () => {
    expect(buildPanSauceDisplayPixels("round", DEPOSITS, SHAPE, "#c73b2e")).toEqual(buildSauceDisplayPixels(DEPOSITS, SHAPE, "#c73b2e"));
  });

  it("square is the square rasterizer (the dough shape plays no part)", () => {
    const expected = buildSquareSauceDisplayPixels(DEPOSITS, "#c73b2e");
    expect(buildPanSauceDisplayPixels("square", DEPOSITS, SHAPE, "#c73b2e")).toEqual(expected);
    const shrunk = { ...SHAPE, radii: SHAPE.radii.map(() => 20) } as typeof SHAPE;
    expect(buildPanSauceDisplayPixels("square", DEPOSITS, shrunk, "#c73b2e")).toEqual(expected);
  });

  it("the corner of the pan is painted on the square pan and not on the round one", () => {
    const alphaAt = (pixels: Uint8ClampedArray, px: number, py: number) => pixels[(py * 64 + px) * 4 + 3];
    const corner = [{ x: 12, y: 12, amount: 0.5 }];
    // display pixel of dough-percent 12 on the 64 grid
    const cell = Math.round((12 / 100) * 64);
    expect(alphaAt(buildPanSauceDisplayPixels("square", corner, SHAPE, "#c73b2e"), cell, cell)).toBeGreaterThan(40);
    expect(alphaAt(buildPanSauceDisplayPixels("round", corner, SHAPE, "#c73b2e"), cell, cell)).toBe(0);
  });
});

describe("insidePanSauceFraction", () => {
  it("round is exactly insideDoughShapeFraction; square is exactly insidePanFraction", () => {
    for (const d of DEPOSITS) {
      expect(insidePanSauceFraction("round", SHAPE, d.x, d.y)).toBe(insideDoughShapeFraction(SHAPE, d.x, d.y));
      expect(insidePanSauceFraction("square", SHAPE, d.x, d.y)).toBe(insidePanFraction(d.x, d.y));
    }
  });

  it("the pan's corner is on the pan (1) and its far side off it (0); the round dough says the opposite", () => {
    expect(insidePanSauceFraction("square", SHAPE, 12, 12)).toBe(1);
    expect(insidePanSauceFraction("square", SHAPE, 97, 50)).toBe(0);
    expect(insidePanSauceFraction("round", SHAPE, 12, 12)).toBeLessThan(1);
  });
});
