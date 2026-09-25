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

describe("RT-01 shipped-recipe regression", () => {
  it("covers exactly the 15 shipped recipes", () => {
    expect(Object.keys(PLAYER_REFERENCE_BASELINE).sort()).toEqual(RECIPES.map((r) => r.id).sort());
    expect(RECIPES).toHaveLength(15);
  });

  it.each(RECIPES.map((r) => [r.id, r] as const))("%s: player reference layout is unchanged", (id, recipe) => {
    expect(getPlayerReferencePizza(recipe).pieceGroups).toEqual(PLAYER_REFERENCE_BASELINE[id]);
  });

  it.each(RECIPES.map((r) => [r.id, r] as const))("%s: Pizza Select thumbnail markup is unchanged", (id, recipe) => {
    const { container } = render(<PizzaThumbnail recipe={recipe} />);
    expect(container.innerHTML).toBe(PIZZA_THUMBNAIL_HTML_BASELINE[id]);
  });

  it("Scoring 2.0 Reference fixtures for all 15 recipes are byte-identical", () => {
    const fixtures = JSON.stringify(RECIPES.map((r) => getReferencePizza(r.id)));
    expect({ length: fixtures.length, fnv1a: fnv1a32(fixtures) }).toEqual(SCORING_FIXTURES_FNV1A);
  });
});
