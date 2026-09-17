import { describe, expect, it } from "vitest";
import { recipeCardState } from "./pizzaSelect";
import { getRecipe } from "../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { QualityStars } from "../logic/scoring";

const bismarck = getRecipe("bismarck")!;
const fugazza = getRecipe("fugazza")!;

describe("recipeCardState (Issue #39 Pizza Select)", () => {
  it("is LOCKED when the recipe's required ingredients aren't all owned (fugazza needs onion)", () => {
    const card = recipeCardState(fugazza, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    expect(card.kind).toBe("LOCKED");
  });

  it("is NEW when available but not yet discovered (bismarck, starter-only ownership)", () => {
    const card = recipeCardState(bismarck, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    expect(card).toEqual({ kind: "NEW", recipe: bismarck });
  });

  it("is COMPLETED with bestStars/bestScore once discovered", () => {
    const dex: DexState = registerScoreToDex(EMPTY_DEX, "bismarck", {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: 91.5,
      stars: 5 as QualityStars,
    }).dex;
    const card = recipeCardState(bismarck, dex, STARTER_INGREDIENT_IDS);
    expect(card).toEqual({ kind: "COMPLETED", recipe: bismarck, bestStars: 5, bestScore: 91.5 });
  });

  it("becomes NEW instead of LOCKED once onion is owned (fugazza)", () => {
    const card = recipeCardState(fugazza, EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "onion"]);
    expect(card).toEqual({ kind: "NEW", recipe: fugazza });
  });

  it("LOCKED takes precedence over any stale Dex entry for an unavailable recipe", () => {
    // Defensive: a recipe should never render COMPLETED/NEW once its ingredients are no
    // longer all owned, even if a Dex entry exists from before (not a real save-shape today,
    // but the selector must not assume Dex and ownership can never disagree).
    const dex: DexState = registerScoreToDex(EMPTY_DEX, "fugazza", {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: 80,
      stars: 4 as QualityStars,
    }).dex;
    const card = recipeCardState(fugazza, dex, STARTER_INGREDIENT_IDS);
    expect(card.kind).toBe("LOCKED");
  });
});
