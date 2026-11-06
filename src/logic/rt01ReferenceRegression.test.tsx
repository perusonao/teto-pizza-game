import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RECIPES } from "../data/recipes";
import { getPlayerReferencePizza } from "../data/playerReference";
import { getReferencePizza } from "../data/referencePizza";
import { PizzaThumbnail } from "../components/PizzaThumbnail";
import {
  PIZZA_THUMBNAIL_HTML_BASELINE,
  PLAYER_REFERENCE_BASELINE,
  SCORING_FIXTURES_FNV1A,
  fnv1a32,
} from "./testSupport/rt01ReferenceBaseline";

/**
 * RT-01 regression guard (Owner Decision RT-01-OD-1: "1-8 pieces keep the current layout
 * exactly", "scoring unchanged"): every shipped recipe's player reference, Pizza Select
 * thumbnail markup and Scoring 2.0 fixture must stay byte-identical to the frozen BEFORE
 * baseline in ./testSupport/rt01ReferenceBaseline.ts.
 */
afterEach(() => {
  cleanup();
});

/** The 15 recipes the BEFORE baseline was frozen for. The 10 W1 recipes (I5b-3) are new content,
 *  pinned by referencePizza.w1.test.ts (RT-01c) instead. */
const BASELINE_RECIPES = RECIPES.filter((r) => r.id in PLAYER_REFERENCE_BASELINE);

describe("RT-01 shipped-recipe regression", () => {
  it("covers exactly the 15 pre-W1 recipes, which are still the first 15 of RECIPES", () => {
    expect(BASELINE_RECIPES).toHaveLength(15);
    expect(BASELINE_RECIPES.map((r) => r.id)).toEqual(RECIPES.slice(0, 15).map((r) => r.id));
  });

  it.each(BASELINE_RECIPES.map((r) => [r.id, r] as const))("%s: player reference layout is unchanged", (id, recipe) => {
    expect(getPlayerReferencePizza(recipe).pieceGroups).toEqual(PLAYER_REFERENCE_BASELINE[id]);
  });

  it.each(BASELINE_RECIPES.map((r) => [r.id, r] as const))("%s: Pizza Select thumbnail markup is unchanged", (id, recipe) => {
    const { container } = render(<PizzaThumbnail recipe={recipe} />);
    // Ingredient Icons 2.0 Pilot A (#438) deliberately draws sausage as an SVG instead of 🌭. The frozen baseline guards the
    // layout, so map that one glyph back to its emoji before comparing: any other markup change still fails.
    // Ingredient Icons 2.0 herbs (#417, Owner R2 2026-11-06) likewise draw rosemary / oregano / spinach / artichoke as SVGs instead of 🌱 / 🍃 / 🍃 / 🌱: the same one-glyph-at-a-time mapping back to the emoji.
    const HERB_EMOJI: Record<string, string> = { "rosemary-sprigs": "\u{1F331}", "oregano-pile": "\u{1F343}", "spinach-leaves": "\u{1F343}", "artichoke-quarter": "\u{1F331}" };
    const markup = container.innerHTML
      .replace(/<svg [^>]*data-ingredient-visual="sausage-slices".*?<\/svg>/g, "\u{1F32D}")
      .replace(/<svg [^>]*data-ingredient-visual="(rosemary-sprigs|oregano-pile|spinach-leaves|artichoke-quarter)".*?<\/svg>/g, (_m, v: string) => HERB_EMOJI[v]);
    expect(markup).toBe(PIZZA_THUMBNAIL_HTML_BASELINE[id]);
  });

  it("Scoring 2.0 Reference fixtures for the 15 pre-W1 recipes are byte-identical", () => {
    const fixtures = JSON.stringify(BASELINE_RECIPES.map((r) => getReferencePizza(r.id)));
    expect({ length: fixtures.length, fnv1a: fnv1a32(fixtures) }).toEqual(SCORING_FIXTURES_FNV1A);
  });
});
