import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IngredientGlyph } from "../../components/IngredientGlyph";
import { getIngredient } from "../../data/ingredients";
import {
  BEEF_BURNT_COLORS,
  BEEF_COOKED_COLORS,
  BEEF_RAW_COLORS,
  PREPARED_PIECE_CLASS,
  PREP_HEAT_OFFSET,
  beefDonenessColors,
  beefDonenessStyle,
  beefLookColors,
  beefLookGloss,
  beefLookStyle,
  lerpHex,
  preparedPieceVisual,
} from "./beefDoneness";
import { BEST_END_MS, BEST_START_MS, PAN_TOTAL_MS } from "./panDoneness";

afterEach(cleanup);

describe("beef doneness colours (S3)", () => {
  it("doneness 0 is exactly the BeefSlices art as shipped (#691): the raw colours are read from the real SVG", () => {
    const { container } = render(<IngredientGlyph ingredient={getIngredient("beef")!} />);
    const paths = [...container.querySelectorAll("svg g > path")];
    expect(paths).toHaveLength(4);
    const attr = (i: number, name: string) => paths[i].getAttribute(name);
    expect({ lean: attr(0, "fill"), edge: attr(0, "stroke"), fat: attr(1, "stroke"), lean2: attr(2, "fill"), fat2: attr(3, "stroke") }).toEqual({
      lean: BEEF_RAW_COLORS.lean,
      edge: BEEF_RAW_COLORS.edge,
      fat: BEEF_RAW_COLORS.fat,
      lean2: BEEF_RAW_COLORS.lean2,
      fat2: BEEF_RAW_COLORS.fat2,
    });
    expect(beefDonenessColors(0)).toEqual(BEEF_RAW_COLORS);
  });

  it("doneness 1 is the prepped target and the colours move monotonically between the two", () => {
    expect(beefDonenessColors(1)).toEqual(BEEF_COOKED_COLORS);
    const dark = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    for (const key of ["lean", "lean2", "fat", "fat2", "edge"] as const) {
      const steps = [0, 1 / 3, 2 / 3, 1].map((d) => dark(beefDonenessColors(d)[key]));
      for (let i = 1; i < steps.length; i++) expect(steps[i], key).toBeLessThanOrEqual(steps[i - 1]);
    }
  });

  it("clamps and survives junk input", () => {
    expect(beefDonenessColors(-5)).toEqual(BEEF_RAW_COLORS);
    expect(beefDonenessColors(9)).toEqual(BEEF_COOKED_COLORS);
    expect(beefDonenessColors(Number.NaN)).toEqual(BEEF_RAW_COLORS);
    expect(lerpHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("the style is custom properties only (no colour-mix, no filter), with the gloss following the doneness", () => {
    const s = beefDonenessStyle(1) as Record<string, string>;
    expect(Object.keys(s).sort()).toEqual(["--beef-edge", "--beef-fat", "--beef-fat-2", "--beef-gloss", "--beef-lean", "--beef-lean-2"]);
    expect(s["--beef-gloss"]).toBe("1");
    expect((beefDonenessStyle(0) as Record<string, string>)["--beef-gloss"]).toBe("0");
    expect(JSON.stringify(s)).not.toMatch(/color-mix/);
  });

  it("a placed piece of a prepped ingredient: beef only, always the full prepped look", () => {
    expect(preparedPieceVisual("beef")?.className).toBe(PREPARED_PIECE_CLASS);
    expect((preparedPieceVisual("beef")!.style as Record<string, string>)["--beef-lean"]).toBe(BEEF_COOKED_COLORS.lean);
    expect(preparedPieceVisual("mozzarella")).toBeNull();
  });

  it("the bake curve gets no extra heat from the prep (Owner decision P-7: offset 0)", () => {
    expect(PREP_HEAT_OFFSET).toBe(0);
  });
});

describe("Phase 1B: the colour over the pan time (raw -> cooked -> burnt)", () => {
  const at = (ms: number) => beefLookColors(ms / PAN_TOTAL_MS);
  const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11;

  it("starts as the BeefSlices art as shipped, stays so until the first sizzle, ends burnt", () => {
    expect(beefLookColors(0)).toEqual(BEEF_RAW_COLORS);
    expect(at(1700)).toEqual(BEEF_RAW_COLORS);
    expect(beefLookColors(1)).toEqual(BEEF_BURNT_COLORS);
  });

  it("is cooked in the middle of best", () => {
    const mid = at((BEST_START_MS + BEST_END_MS) / 2);
    expect(mid).toEqual(BEEF_COOKED_COLORS);
  });

  it("the lean ribbon only ever gets darker, step by step, and the three grades look different", () => {
    let last = Infinity;
    for (let ms = 0; ms <= PAN_TOTAL_MS; ms += 50) {
      const l = lum(at(ms).lean);
      expect(l, `+${ms}ms`).toBeLessThanOrEqual(last + 1e-9);
      last = l;
    }
    const early = at(1000).lean;
    const best = at(3000).lean;
    const burnt = at(5500).lean;
    expect(new Set([early, best, burnt]).size).toBe(3);
    expect(lum(early) - lum(best)).toBeGreaterThan(10);
    expect(lum(best) - lum(burnt)).toBeGreaterThan(10);
  });

  it("the sheen is a shape: none while raw, its peak in the middle of best, drying out after", () => {
    const g = (ms: number) => beefLookGloss(ms / PAN_TOTAL_MS);
    expect(g(0)).toBe(0);
    expect(g(1700)).toBe(0);
    const peak = g((BEST_START_MS + BEST_END_MS) / 2);
    expect(peak).toBe(1);
    expect(g(BEST_START_MS)).toBeGreaterThan(0.15);
    expect(g(BEST_START_MS)).toBeLessThan(peak);
    expect(g(BEST_END_MS)).toBeLessThan(peak);
    expect(g(PAN_TOTAL_MS)).toBe(0);
    for (const ms of [0, 1000, 2100, 3150, 4200, 5000, 6000]) {
      expect(g(ms)).toBeGreaterThanOrEqual(0);
      expect(g(ms)).toBeLessThanOrEqual(1);
    }
  });

  it("clamps and survives junk (NaN, negatives, > 1)", () => {
    expect(beefLookColors(Number.NaN)).toEqual(BEEF_RAW_COLORS);
    expect(beefLookColors(-4)).toEqual(BEEF_RAW_COLORS);
    expect(beefLookColors(9)).toEqual(BEEF_BURNT_COLORS);
    expect(beefLookGloss(Number.NaN)).toBe(0);
  });

  it("the style is the same six custom properties (no colour-mix, no filter)", () => {
    const s = beefLookStyle(0.5) as Record<string, string>;
    expect(Object.keys(s).sort()).toEqual(["--beef-edge", "--beef-fat", "--beef-fat-2", "--beef-gloss", "--beef-lean", "--beef-lean-2"]);
    expect(JSON.stringify(s)).not.toMatch(/color-mix|filter/);
  });

  it("a placed piece uses its look when it has one, the cooked look when it has none, and only beef", () => {
    const withLook = preparedPieceVisual("beef", 1)!.style as Record<string, string>;
    expect(withLook["--beef-lean"]).toBe(BEEF_BURNT_COLORS.lean);
    const noLook = preparedPieceVisual("beef")!.style as Record<string, string>;
    expect(noLook["--beef-lean"]).toBe(BEEF_COOKED_COLORS.lean);
    expect(preparedPieceVisual("mozzarella", 0.5)).toBeNull();
  });
});
