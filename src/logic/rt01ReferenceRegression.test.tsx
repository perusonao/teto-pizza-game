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
    expect(container.innerHTML).toBe(PIZZA_THUMBNAIL_HTML_BASELINE[id]);
  });

  it("Scoring 2.0 Reference fixtures for the 15 pre-W1 recipes are byte-identical", () => {
    const fixtures = JSON.stringify(BASELINE_RECIPES.map((r) => getReferencePizza(r.id)));
    expect({ length: fixtures.length, fnv1a: fnv1a32(fixtures) }).toEqual(SCORING_FIXTURES_FNV1A);
  });
});
