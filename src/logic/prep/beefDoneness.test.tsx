import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IngredientGlyph } from "../../components/IngredientGlyph";
import { getIngredient } from "../../data/ingredients";
import { BEEF_COOKED_COLORS, BEEF_RAW_COLORS, PREPARED_PIECE_CLASS, PREP_HEAT_OFFSET, beefDonenessColors, beefDonenessStyle, lerpHex, preparedPieceVisual } from "./beefDoneness";

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
