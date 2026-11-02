import { describe, expect, it } from "vitest";
import { SAUSAGE_CHARRED_COLORS, SAUSAGE_GOLDEN_COLORS, SAUSAGE_RAW_COLORS, lerpHex, sausageSearColors, sausageSearGloss, sausageSearStyle, searedPieceVisual } from "./sausageSear";

/** Relative luminance (WCAG) of a #rrggbb colour. */
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

describe("sausage sear colours", () => {
  it("amount 0 is exactly the shipped SausageSlices colours (an unseared sausage is unchanged)", () => {
    expect(sausageSearColors(0)).toEqual(SAUSAGE_RAW_COLORS);
  });
  it("0.5 and 1 hit the stops", () => {
    expect(sausageSearColors(0.5)).toEqual(SAUSAGE_GOLDEN_COLORS);
    expect(sausageSearColors(1)).toEqual(SAUSAGE_CHARRED_COLORS);
  });
  it("out-of-range / non-finite amounts clamp", () => {
    expect(sausageSearColors(-3)).toEqual(SAUSAGE_RAW_COLORS);
    expect(sausageSearColors(9)).toEqual(SAUSAGE_CHARRED_COLORS);
    expect(sausageSearColors(NaN)).toEqual(SAUSAGE_RAW_COLORS);
  });
  it("the face and the outer ring get monotonically darker as it sears (the colour is a true progression, no dip on the way)", () => {
    for (const part of ["inner", "outer"] as const) {
      let prev = Infinity;
      for (let a = 0; a <= 1.0001; a += 0.01) {
        const l = lum(sausageSearColors(a)[part]);
        expect(l, `${part} @${a.toFixed(2)}`).toBeLessThanOrEqual(prev + 1e-9);
        prev = l;
      }
    }
  });
  it("#724 visibility: each look's face is clearly darker than the unseared face (WCAG-style luminance ratio floors)", () => {
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const raw = sausageSearColors(0).inner;
    expect(ratio(raw, sausageSearColors(0.3).inner)).toBeGreaterThanOrEqual(1.25); // ほんのり
    expect(ratio(raw, sausageSearColors(0.5).inner)).toBeGreaterThanOrEqual(1.55); // こんがり
    expect(ratio(raw, sausageSearColors(0.75).inner)).toBeGreaterThanOrEqual(2.0); // しっかり
    expect(ratio(raw, sausageSearColors(1).inner)).toBeGreaterThanOrEqual(2.4); // まっくろ
  });
  it("#724 shape: at EVERY amount the outer ring stays darker than the face, the fat flecks stay light, and the outline is the darkest part", () => {
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    for (let a = 0; a <= 1.0001; a += 0.05) {
      const c = sausageSearColors(a);
      expect(ratio(c.inner, c.outer), `face/ring @${a.toFixed(2)}`).toBeGreaterThanOrEqual(1.3);
      expect(ratio(c.fat, c.inner), `flecks/face @${a.toFixed(2)}`).toBeGreaterThanOrEqual(2.2);
      expect(lum(c.edge), `outline @${a.toFixed(2)}`).toBeLessThan(lum(c.outer));
    }
  });
  it("#724 the charred face is not black (a charred slice must not become one dark blob)", () => {
    expect(lum(sausageSearColors(1).inner)).toBeGreaterThan(0.03);
  });
  it("lerpHex is exact at the ends", () => {
    expect(lerpHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(lerpHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(lerpHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
  it("the sheen peaks around golden and dries out toward charred", () => {
    expect(sausageSearGloss(0)).toBe(0);
    expect(sausageSearGloss(0.5)).toBe(1);
    expect(sausageSearGloss(1)).toBe(0);
  });
  it("the style carries only custom properties (no filter / colour that could clash with the bake curve)", () => {
    const keys = Object.keys(sausageSearStyle(0.4));
    expect(keys.every((k) => k.startsWith("--sear-"))).toBe(true);
  });
  it("searedPieceVisual: only sausage, only when seared", () => {
    expect(searedPieceVisual("sausage", undefined)).toBeNull();
    expect(searedPieceVisual("beef", 0.5)).toBeNull();
    expect(searedPieceVisual("sausage", 0.5)?.className).toBe("ingredient-piece--seared");
  });
});
