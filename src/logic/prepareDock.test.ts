import { describe, expect, it } from "vitest";
import { ingredientsByCategory, MAX_INGREDIENT_PALETTE_SLOTS } from "../data/ingredients";
import { getRecipe, type Recipe } from "../data/recipes";
import { getCookingProfile, preBakeSteps } from "../data/cookingProfiles";
import { prepareDockReserve, trayIngredientsFor } from "./prepareDock";

/**
 * DM-3R-0 Cooking Stage Size Stability (Issue #245): the PREPARE dock's per-round reservation.
 * The dock must be at least as tall as every PREPARE step of the round, or the stage (and the
 * dough) would still change size between steps.
 */
const recipe = (id: string): Recipe => getRecipe(id as Parameters<typeof getRecipe>[0])!;
const steps = (r: Recipe) => preBakeSteps(getCookingProfile(r.id));
const ALL_OWNED = ["sauce", "cheese", "topping"].flatMap((c) =>
  ingredientsByCategory(c as "sauce" | "cheese" | "topping").map((i) => i.id),
);

describe("trayIngredientsFor", () => {
  it("guided: only the owned ingredients the recipe requires", () => {
    const portuguesa = recipe("pizza-portuguesa");
    const ids = trayIngredientsFor("topping", { ownedIngredientIds: ALL_OWNED, freeCook: false, recipe: portuguesa }).map((i) => i.id);
    expect(ids.sort()).toEqual(["black-olive", "egg", "ham", "onion"]);
    const withoutEgg = trayIngredientsFor("topping", {
      ownedIngredientIds: ALL_OWNED.filter((id) => id !== "egg"),
      freeCook: false,
      recipe: portuguesa,
    });
    expect(withoutEgg.map((i) => i.id)).not.toContain("egg");
  });

  it("free cook: every owned ingredient of the category", () => {
    const ids = trayIngredientsFor("topping", { ownedIngredientIds: ALL_OWNED, freeCook: true, recipe: recipe("margherita") });
    expect(ids).toEqual(ingredientsByCategory("topping"));
  });
});

describe("prepareDockReserve", () => {
  it("guided margherita: one row everywhere, the readout in SAUCE, no pager", () => {
    const r = recipe("margherita");
    expect(
      prepareDockReserve({ steps: steps(r), ownedIngredientIds: ALL_OWNED, freeCook: false, recipe: r, sauceReadout: true }),
    ).toEqual({ sauceRows: 1, otherRows: 1, pager: false, readout: true });
  });

  it("the readout is reserved only when the SAUCE step shows it (Lunch Rush has none)", () => {
    const r = recipe("pizza-portuguesa");
    expect(
      prepareDockReserve({ steps: steps(r), ownedIngredientIds: ALL_OWNED, freeCook: false, recipe: r, sauceReadout: false }),
    ).toEqual({ sauceRows: 1, otherRows: 2, pager: false, readout: false });
  });

  it("free cook with more than one page of toppings: two rows and the pager row in every step", () => {
    expect(ingredientsByCategory("topping").length).toBeGreaterThan(MAX_INGREDIENT_PALETTE_SLOTS);
    const r = recipe("margherita");
    const reserve = prepareDockReserve({ steps: steps(r), ownedIngredientIds: ALL_OWNED, freeCook: true, recipe: r, sauceReadout: false });
    expect(reserve.otherRows).toBe(2);
    expect(reserve.pager).toBe(true);
  });

  it("a step the round does not have reserves nothing (quattro-formaggi has no TOPPING step)", () => {
    const r = recipe("quattro-formaggi");
    expect(steps(r)).not.toContain("TOPPING");
    const reserve = prepareDockReserve({ steps: steps(r), ownedIngredientIds: ALL_OWNED, freeCook: false, recipe: r, sauceReadout: false });
    // mozzarella / gorgonzola / parmigiano / fontina: 4 cheeses, two rows.
    expect(reserve.otherRows).toBe(2);
  });

  it("DOUGH alone reserves nothing", () => {
    const r = recipe("margherita");
    expect(
      prepareDockReserve({ steps: ["DOUGH"], ownedIngredientIds: ALL_OWNED, freeCook: false, recipe: r, sauceReadout: true }),
    ).toEqual({ sauceRows: 0, otherRows: 0, pager: false, readout: false });
  });

  it("covers every step of every shipped guided recipe with owned materials (never fewer rows than the tray shows)", () => {
    for (const id of ["margherita", "marinara", "quattro-formaggi", "capricciosa", "meat-lovers", "pizza-portuguesa", "new-haven-apizza"]) {
      const r = recipe(id);
      const reserve = prepareDockReserve({ steps: steps(r), ownedIngredientIds: ALL_OWNED, freeCook: false, recipe: r, sauceReadout: true });
      for (const step of steps(r)) {
        const category = step === "SAUCE" ? "sauce" : step === "CHEESE" ? "cheese" : step === "TOPPING" ? "topping" : null;
        if (!category) continue;
        const shown = Math.ceil(Math.min(trayIngredientsFor(category, { ownedIngredientIds: ALL_OWNED, freeCook: false, recipe: r }).length, 6) / 3);
        expect(step === "SAUCE" ? reserve.sauceRows : reserve.otherRows, `${id} ${step}`).toBeGreaterThanOrEqual(shown);
      }
    }
  });
});
