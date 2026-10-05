import { describe, expect, it } from "vitest";
import { ingredientsByCategory, MAX_INGREDIENT_PALETTE_SLOTS } from "../data/ingredients";
import { getRecipe, type Recipe } from "../data/recipes";
import { getCookingProfile, preBakeSteps } from "../data/cookingProfiles";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FAMILY_ROW_PX, familyRowFits, prepareDockReserve, trayIngredientsFor } from "./prepareDock";

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
    ).toEqual({ sauceRows: 1, otherRows: 1, pager: false, pantryWorthwhile: true, utilityRow: false, readout: true, familyRow: false });
  });

  it("the readout is reserved only when the SAUCE step shows it (Lunch Rush has none)", () => {
    const r = recipe("pizza-portuguesa");
    expect(
      prepareDockReserve({ steps: steps(r), ownedIngredientIds: ALL_OWNED, freeCook: false, recipe: r, sauceReadout: false }),
    ).toEqual({ sauceRows: 1, otherRows: 2, pager: false, pantryWorthwhile: true, utilityRow: false, readout: false, familyRow: false });
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
    ).toEqual({ sauceRows: 0, otherRows: 0, pager: false, pantryWorthwhile: false, utilityRow: false, readout: false, familyRow: false });
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

describe("prepareDockReserve utilityRow / pantryWorthwhile (LC-R5-a, OD-R5-10)", () => {
  const counts = Array.from({ length: 23 }, (_, n) => n);
  const ownedOf = (n: number) => [
    ...ingredientsByCategory("sauce").slice(0, 3).map((i) => i.id),
    ...ingredientsByCategory("cheese").slice(0, 3).map((i) => i.id),
    ...ingredientsByCategory("topping").slice(0, n).map((i) => i.id),
  ];
  const r = recipe("margherita");

  it("eligible FREE round: pantryWorthwhile === pager and utilityRow === pager for 0..22 owned toppings (layout Δ0)", () => {
    for (const n of counts) {
      const reserve = prepareDockReserve({
        steps: steps(r),
        ownedIngredientIds: ownedOf(n),
        freeCook: true,
        recipe: r,
        sauceReadout: false,
        largeCatalogEligible: true,
      });
      expect(reserve.pantryWorthwhile, `n=${n}`).toBe(reserve.pager);
      expect(reserve.utilityRow, `n=${n}`).toBe(reserve.pager);
    }
  });

  it("not eligible (guided / Lunch Rush / Dinner tray): utilityRow === pager even with > 6 owned toppings", () => {
    for (const freeCook of [false, true]) {
      for (const n of counts) {
        for (const largeCatalogEligible of [false, undefined]) {
          const reserve = prepareDockReserve({
            steps: steps(r),
            ownedIngredientIds: ownedOf(n),
            freeCook,
            recipe: r,
            sauceReadout: false,
            ...(largeCatalogEligible === undefined ? {} : { largeCatalogEligible }),
          });
          expect(reserve.utilityRow, `freeCook=${freeCook} n=${n}`).toBe(reserve.pager);
        }
      }
    }
    // The isolation case: guided, 12 owned, recipe-limited tray => no pager, no utility row, but ownership is worthwhile.
    const guided = prepareDockReserve({ steps: steps(r), ownedIngredientIds: ownedOf(12), freeCook: false, recipe: r, sauceReadout: false });
    expect(guided.pager).toBe(false);
    expect(guided.pantryWorthwhile).toBe(true);
    expect(guided.utilityRow).toBe(false);
  });

  it("pantryWorthwhile ignores the recipe-limited tray (ownership, not what the tray offers)", () => {
    const guided = prepareDockReserve({ steps: steps(r), ownedIngredientIds: ownedOf(12), freeCook: false, recipe: r, sauceReadout: false });
    const free = prepareDockReserve({ steps: steps(r), ownedIngredientIds: ownedOf(12), freeCook: true, recipe: r, sauceReadout: false });
    expect(guided.pantryWorthwhile).toBe(free.pantryWorthwhile);
  });

  it("the existing reservation fields are unchanged by the split", () => {
    const eligible = prepareDockReserve({ steps: steps(r), ownedIngredientIds: ownedOf(12), freeCook: true, recipe: r, sauceReadout: true, largeCatalogEligible: true });
    const plain = prepareDockReserve({ steps: steps(r), ownedIngredientIds: ownedOf(12), freeCook: true, recipe: r, sauceReadout: true });
    const { pantryWorthwhile: _a, utilityRow: _b, ...e } = eligible;
    const { pantryWorthwhile: _c, utilityRow: _d, ...p } = plain;
    expect(e).toEqual(p);
  });
});

describe("prepareDockReserve familyRow (Issue #399)", () => {
  const freeSteps = (ids: string[]) =>
    prepareDockReserve({ steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"], ownedIngredientIds: ids, freeCook: true, recipe: recipe("margherita"), sauceReadout: false });
  const toppings = ingredientsByCategory("topping").map((i) => i.id);

  it("is reserved exactly when the 具材 tray lists more than one page and spans two families (the tray's own rule)", () => {
    expect(freeSteps(["tomato-sauce", "mozzarella", ...toppings]).familyRow).toBe(true);
    // seven vegetables only: pages, but one family -> no chips, no row
    expect(freeSteps(["tomato-sauce", "mozzarella", "mushroom", "cherry-tomato", "onion", "black-olive", "corn", "eggplant", "fresh-tomato"]).familyRow).toBe(false);
    // six toppings: one page -> no chips
    expect(freeSteps(["tomato-sauce", "mozzarella", ...toppings.slice(0, MAX_INGREDIENT_PALETTE_SLOTS)]).familyRow).toBe(false);
  });

  it("is never reserved for a round without a 具材 tray (guided small list, no TOPPING step)", () => {
    const r = recipe("margherita");
    const guided = prepareDockReserve({ steps: steps(r), ownedIngredientIds: ALL_OWNED, freeCook: false, recipe: r, sauceReadout: true });
    expect(guided.familyRow).toBe(false);
    expect(prepareDockReserve({ steps: ["DOUGH"], ownedIngredientIds: ALL_OWNED, freeCook: true, recipe: r, sauceReadout: false }).familyRow).toBe(false);
  });
});

describe("familyRowFits: may the family filter take its own row without shrinking the pizza (Issue #399)", () => {
  const CAP = 290;
  const fits = (contentHeight: number, placedAbove = false, pizzaCap = CAP) => familyRowFits({ contentHeight, pizzaCap, placedAbove });

  it("inline -> above needs the row's height PLUS a 2px margin over the pizza's cap (boundary)", () => {
    expect(fits(CAP + FAMILY_ROW_PX + 1)).toBe(false);
    expect(fits(CAP + FAMILY_ROW_PX + 2)).toBe(true);
    expect(fits(CAP + FAMILY_ROW_PX + 60)).toBe(true);
    expect(fits(CAP)).toBe(false); // a stage with no spare at all keeps the one-row layout
    expect(fits(CAP - 40)).toBe(false); // a stage already smaller than the pizza's cap
  });

  it("above -> stays above while the stage still holds the pizza at its cap (the row's own height is already out of the stage)", () => {
    expect(fits(CAP, true)).toBe(true);
    expect(fits(CAP + 1, true)).toBe(true);
    expect(fits(CAP - 0.5, true)).toBe(false); // the pizza would be squeezed: back to inline
    expect(fits(CAP - 30, true)).toBe(false);
  });

  it("the two readings are the same rule (hysteresis is 2px, nothing else): switching the layout does not flip the answer back", () => {
    // `stage` = the content height the one-row layout would have. After switching above the measured height is stage - FAMILY_ROW_PX.
    for (const cap of [273.6, 290, 380]) {
      for (let stage = cap - 80; stage <= cap + 120; stage += 0.5) {
        const first = fits(stage, false, cap);
        const measuredNext = first ? stage - FAMILY_ROW_PX : stage;
        expect(fits(measuredNext, first, cap), `cap ${cap} stage ${stage}`).toBe(first); // a fixed point: no oscillation
        // and the pizza is never smaller above than inline: above only when stage - FAMILY_ROW_PX >= cap
        if (first) expect(stage - FAMILY_ROW_PX).toBeGreaterThanOrEqual(cap);
      }
    }
  });

  it("a 1px resize sweep switches once and never back (monotone in height), for the compact and the roomy cap", () => {
    for (const cap of [273.6, 290, 380]) {
      let above = false;
      let switches = 0;
      let measured = cap - 100;
      for (let stage = cap - 100; stage <= cap + 200; stage += 1) {
        measured = above ? stage - FAMILY_ROW_PX : stage;
        const next = fits(measured, above, cap);
        if (next !== above) switches += 1;
        above = next;
      }
      expect(switches, `cap ${cap}`).toBe(1);
      expect(above).toBe(true);
      expect(measured).toBeGreaterThanOrEqual(cap);
      // and back down: switches once to inline
      for (let stage = cap + 200; stage >= cap - 100; stage -= 1) {
        measured = above ? stage - FAMILY_ROW_PX : stage;
        const next = fits(measured, above, cap);
        if (next !== above) switches += 1;
        above = next;
      }
      expect(switches, `cap ${cap} down`).toBe(2);
      expect(above).toBe(false);
    }
  });

  it("no layout (jsdom: NaN) or no probe: the one-row layout", () => {
    expect(fits(Number.NaN)).toBe(false);
    expect(familyRowFits({ contentHeight: 400, pizzaCap: Number.NaN, placedAbove: false })).toBe(false);
    expect(familyRowFits({ contentHeight: 400, pizzaCap: Number.NaN, placedAbove: true })).toBe(false);
  });
});

describe("App.css: the family row height and the pizza cap have one authority each (Issue #399)", () => {
  it("--family-h equals FAMILY_ROW_PX, the row is 28px + a 10px gap, and the pager row's 10px gap (+4) is what makes up the rest", () => {
    expect(cssSource().match(/--family-h:\s*(\d+)px/)?.[1]).toBe(String(FAMILY_ROW_PX));
    const row = /\.tray-family-row\s*\{[^}]*height:\s*28px;[^}]*margin-bottom:\s*10px;/s.test(cssSource());
    const pager = /\.prepare-dock--family-above \.ingredient-page-nav\s*\{[^}]*margin-top:\s*10px;/s.test(cssSource());
    expect(row && pager).toBe(true);
    expect(28 + 10 + (10 - 6)).toBe(FAMILY_ROW_PX);
  });

  it("the pizza's size caps are written once, as --pizza-cap-compact / --pizza-cap-roomy: the dough and the probe both read them", () => {
    const css = cssSource();
    expect(css).toMatch(/--pizza-cap-compact:\s*min\(76vw, 290px\);/);
    expect(css).toMatch(/--pizza-cap-roomy:\s*min\(92vw, 380px\);/);
    expect(css).toMatch(/\.pizza-stage--compact \.pizza-dough \{\s*width: min\(var\(--pizza-cap-compact\), 100cqh\);/);
    expect(css).toMatch(/\.pizza-stage--roomy \.pizza-dough \{\s*width: min\(var\(--pizza-cap-roomy\), 100cqh\);/);
    expect(css).toMatch(/\.pizza-stage--compact::before \{\s*width: var\(--pizza-cap-compact\);/);
    expect(css).toMatch(/\.pizza-stage--roomy::before \{\s*width: var\(--pizza-cap-roomy\);/);
    // the numbers 76vw / 290px / 92vw / 380px appear in no `.game-screen--cooking` dough rule any more
    expect(css).not.toMatch(/min\(76vw, 290px, 100cqh\)|min\(92vw, 380px, 100cqh\)/);
  });
});

function cssSource(): string {
  return readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");
}
