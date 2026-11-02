import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getIngredient } from "../data/ingredients";
import { IngredientGlyph } from "./IngredientGlyph";
import { sausageSearStyle } from "../logic/sear/sausageSear";
import { IngredientPieceVisual } from "./IngredientPieceVisual";

afterEach(cleanup);

/**
 * Cooking Sear Phase 1 (#724): ./Sear.css recolours `SausageSlices` by selector (the glyph itself is untouched, because IngredientGlyph.tsx is a catalog hot file).
 * That works only while the glyph keeps the structure the selectors assume, so this test pins it: when the drawing changes, this fails and Sear.css is revisited.
 */
describe("SausageSlices still has the structure Sear.css recolours", () => {
  it("six paths in drawing order, and the two seed / fleck groups", () => {
    const sausage = getIngredient("sausage")!;
    const { container } = render(<IngredientGlyph ingredient={sausage} />);
    const svg = container.querySelector("svg.ingredient-glyph--sausage-slices")!;
    expect(svg).not.toBeNull();
    const paths = Array.from(svg.querySelectorAll(":scope > g > path"));
    expect(paths.map((p) => p.getAttribute("fill"))).toEqual(["#8f3f2e", "#b95e47", "#f5dcc6", "#8f3f2e", "#b95e47", "#f5dcc6"]);
    expect(svg.querySelectorAll('g[fill="#6e2a1e"]').length).toBeGreaterThan(0);
    expect(svg.querySelectorAll('g[fill="#f5dcc6"]').length).toBeGreaterThan(0);
  });
});

describe("a placed piece takes the look through className + custom properties only", () => {
  it("the wrapper gets the class and the variables; an unseared piece has neither", () => {
    const sausage = getIngredient("sausage")!;
    const { container: seared } = render(<IngredientPieceVisual ingredient={sausage} className="ingredient-piece--seared" style={sausageSearStyle(0.6)} />);
    const el = seared.firstElementChild as HTMLElement;
    expect(el.className).toContain("ingredient-piece--seared");
    expect(el.style.getPropertyValue("--sear-inner")).toMatch(/^#[0-9a-f]{6}$/);
    cleanup();
    const { container: plain } = render(<IngredientPieceVisual ingredient={sausage} />);
    expect((plain.firstElementChild as HTMLElement).className).not.toContain("seared");
    expect((plain.firstElementChild as HTMLElement).getAttribute("style") ?? "").not.toContain("--sear");
  });
});
