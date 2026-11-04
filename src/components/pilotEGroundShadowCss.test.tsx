import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { IngredientGlyph } from "./IngredientGlyph";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { getIngredient } from "../data/ingredients";

/**
 * Pilot E ground shadow (#720): the App.css rule that hides the baked ground-shadow ellipse of green-pepper / bell-pepper / pineapple ON THE PIZZA ONLY
 * must (a) exist for exactly those three glyphs, and (b) select exactly that one ellipse in the real markup. jsdom does not apply App.css, so the
 * selector is checked against the rendered glyph with querySelector, and the rule is read from the stylesheet text.
 */
const VISUALS = {
  "green-pepper": "green-pepper-strips",
  "bell-pepper": "bell-pepper-quarter",
  pineapple: "pineapple-wedges",
} as const;
const IDS = Object.keys(VISUALS) as (keyof typeof VISUALS)[];
const SHADOW_SELECTOR = ":scope > g > ellipse:first-child";
const css = () => readFileSync(join(__dirname, "..", "App.css"), "utf8");

describe("Pilot E ground shadow (#720)", () => {
  afterEach(cleanup);

  it.each(IDS)("%s: the selector matches exactly its one baked ground-shadow ellipse", (id) => {
    const { container } = render(<IngredientGlyph ingredient={getIngredient(id)!} />);
    const svg = container.querySelector("svg")!;
    const hit = svg.querySelectorAll(SHADOW_SELECTOR);
    expect(hit).toHaveLength(1);
    expect(hit[0].getAttribute("cy")).toBe("57");
    expect(hit[0].getAttribute("opacity")).toBe(".15");
  });

  it("the CSS rule names exactly the three glyphs, scoped to the on-pizza wrapper, and only hides", () => {
    const m = css().match(/((?:\.ingredient-piece-visual__emoji [^{}]*ellipse:first-child,?\s*)+)\{\s*display:\s*none;\s*\}/);
    expect(m).not.toBeNull();
    const selectors = m![1].split(",").map((s) => s.trim()).filter(Boolean);
    expect(selectors).toEqual(
      IDS.map((id) => `.ingredient-piece-visual__emoji .ingredient-glyph--${VISUALS[id]} > g > ellipse:first-child`),
    );
  });

  it("a placed piece draws the glyph inside the scoped wrapper; the bare glyph (tray / Dex / Shop) is not inside it", () => {
    const placed = render(<IngredientPieceVisual ingredient={getIngredient("bell-pepper")!} />);
    expect(placed.container.querySelector(".ingredient-piece-visual__emoji .ingredient-glyph--bell-pepper-quarter")).not.toBeNull();
    cleanup();
    const bare = render(<IngredientGlyph ingredient={getIngredient("bell-pepper")!} />);
    expect(bare.container.querySelector(".ingredient-piece-visual__emoji")).toBeNull();
  });

  it("no other glyph is named by a rule of this kind", () => {
    const all = css().match(/\.ingredient-piece-visual__emoji \.ingredient-glyph--[a-z-]+ > g > ellipse:first-child/g) ?? [];
    expect(all).toHaveLength(3);
  });
});
