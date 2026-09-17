import { describe, expect, it } from "vitest";
import { buildHintLine, RECIPE_HINTS } from "./hints";
import { RECIPES, getRecipe } from "./recipes";
import { createEmptyPizza } from "../state/pizzaState";

/**
 * Phase 4A-1B.1 Fix A (First Sauce Touch): the very first hint a player sees (no sauce
 * applied yet, hint button never pressed) must itself convey the touch gesture ("指でなぞる" /
 * "塗る"), not just name the ingredient -- a first-time player was previously told *what* to
 * apply but not *how*. This never introduces a new tutorial state/save flag/modal: it's a
 * copy-only change to the existing `empty` hint line already shown on BEGIN_PREPARE.
 */
describe("First Sauce Touch copy (Phase 4A-1B.1 Fix A)", () => {
  it("every recipe's default (non-explicit) empty-sauce hint mentions both the finger-trace gesture and painting the sauce", () => {
    for (const recipe of RECIPES) {
      const hints = RECIPE_HINTS[recipe.id];
      if (!hints) continue; // fugazza has no RECIPE_HINTS entry -- out of scope, unchanged.
      expect(hints.empty).toContain("指でなぞって");
      expect(hints.empty).toMatch(/塗/);
    }
  });

  it("buildHintLine's initial (non-explicit) call for Margherita returns the gesture-guidance copy, not just the old ingredient-only line", () => {
    const recipe = getRecipe("margherita");
    if (!recipe) throw new Error("margherita recipe fixture is missing");
    const line = buildHintLine(recipe, createEmptyPizza(), "SAUCE");
    expect(line.textJa).toBe("指でなぞってトマトソースを塗ろう！");
  });

  it("the explicit hint (ヒント button) copy is unchanged -- Fix A only touches the default first-shown line", () => {
    const recipe = getRecipe("margherita");
    if (!recipe) throw new Error("margherita recipe fixture is missing");
    const line = buildHintLine(recipe, createEmptyPizza(), "SAUCE", true);
    expect(line.textJa).toBe(
      "ピザを指でなぞると、トマトソースが塗れるよ。ふちの近くまで大胆に広げてみて！",
    );
  });
});

describe("Issue #33 D1: DOUGH hint branch", () => {
  it("never falls through to the recipe's own sauce copy while makingStep is DOUGH", () => {
    const recipe = getRecipe("margherita");
    if (!recipe) throw new Error("margherita recipe fixture is missing");
    const line = buildHintLine(recipe, createEmptyPizza(), "DOUGH");
    expect(line.textJa).not.toMatch(/ソース/);
    expect(line.textJa).toMatch(/生地/);
  });

  it("the explicit DOUGH hint differs from the default one", () => {
    const recipe = getRecipe("margherita");
    if (!recipe) throw new Error("margherita recipe fixture is missing");
    const defaultLine = buildHintLine(recipe, createEmptyPizza(), "DOUGH");
    const explicitLine = buildHintLine(recipe, createEmptyPizza(), "DOUGH", true);
    expect(explicitLine.textJa).not.toBe(defaultLine.textJa);
  });
});
