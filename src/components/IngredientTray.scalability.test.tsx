import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { createEmptyPizza } from "../state/pizzaState";
import { EMPTY_INVENTORY } from "../state/inventory";
import type { IngredientCategory } from "../data/ingredients";
import type { Recipe } from "../data/recipes";

/**
 * Issue #86 / Issue #159 P0: the Recipe Master foundation targets 62 unique ingredients, well
 * past the current ~14-ingredient catalog -- this file pins that the tray never renders more
 * than a bounded number of chips at once regardless of catalog size, via a synthetic (mocked,
 * per the task brief) 30/62-ingredient catalog standing in for that future scale. Real
 * production data is untouched -- this only replaces `ingredientsByCategory`/`getIngredient`'s
 * data source for this one test file (`vi.mock` below is hoisted above every import in this
 * file, including `./IngredientTray`'s own transitive import of `../data/ingredients`).
 *
 * Issue #159 P0 update: the tray no longer shows an unbounded "Other" (owned-but-not-required)
 * grid at all -- only this recipe's own `requiredIngredients` (still owned-gated) render (see
 * IngredientTray.tsx / IngredientTray.recommendedOther.test.tsx). A future wide recipe (e.g. a
 * catalog-scale Content Editor product) could still in principle require more ingredients in
 * one category than MAX_INGREDIENT_PALETTE_SLOTS -- these tests now pin that even *that* case
 * stays paged/bounded rather than dumping an unbounded grid on screen, using a synthetic recipe
 * that requires many mocked ingredients at once (a shape no recipe in `recipes.ts` produces
 * today, deliberately stress-testing past it).
 */

const { MOCK_CATALOG } = vi.hoisted(() => {
  const categories = ["sauce", "cheese", "topping"] as const;
  const catalog = Array.from({ length: 62 }, (_, i) => ({
    id: `mock-${i}`,
    category: categories[i % 3],
    nameJa: `素材${i}`,
    color: "#cccccc",
    emoji: "\u{1F355}",
    placement: categories[i % 3] === "sauce" ? "spread" : ("scatter" as const),
  }));
  return { MOCK_CATALOG: catalog };
});

vi.mock("../data/ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/ingredients")>();
  return {
    ...actual,
    ingredientsByCategory: (category: IngredientCategory) =>
      MOCK_CATALOG.filter((i) => i.category === category),
    getIngredient: (id: string) => MOCK_CATALOG.find((i) => i.id === id),
  };
});

function idsForCategory(category: IngredientCategory, count: number): string[] {
  return MOCK_CATALOG.filter((i) => i.category === category)
    .slice(0, count)
    .map((i) => i.id);
}

function buildRecipe(requiredIds: readonly string[]): Recipe {
  return {
    id: "margherita",
    nameJa: "テスト用レシピ",
    description: "",
    requiredIngredients: requiredIds.map((ingredientId) => ({ ingredientId, minCount: 1 })),
    bakeTarget: { start: 60, end: 80 },
    baseRewardPitz: 100,
  };
}

afterEach(() => {
  cleanup();
});

describe("Ingredient Tray scalability (Issue #86 / #159)", () => {
  it("does not crash and stays bounded even when a recipe requires ~20 owned (mocked) ingredients in one category", () => {
    const owned20Toppings = idsForCategory("topping", 20); // well past MAX_INGREDIENT_PALETTE_SLOTS
    render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={owned20Toppings}
        recipe={buildRecipe(owned20Toppings)}
        inventory={EMPTY_INVENTORY}
        pizza={createEmptyPizza()}
      />,
    );
    // Capped at exactly 6 chips on any one page, never all 20 at once.
    const grid = document.querySelector(".ingredient-section .ingredient-tray")!;
    expect(within(grid as HTMLElement).getAllByRole("button")).toHaveLength(6);
    expect(screen.getByRole("group", { name: "素材ページ切り替え" })).toBeInTheDocument();
  });

  it("does not crash and stays bounded with the full mocked 62-ingredient catalog required+owned across every category", () => {
    const allOwned = MOCK_CATALOG.map((i) => i.id);
    for (const category of ["sauce", "cheese", "topping"] as const) {
      cleanup();
      const requiredIds = idsForCategory(category, MOCK_CATALOG.filter((i) => i.category === category).length);
      render(
        <IngredientTray
          activeCategory={category}
          selectedIngredientId={null}
          onSelectIngredient={() => {}}
          ownedIngredientIds={allOwned}
          recipe={buildRecipe(requiredIds)}
          inventory={EMPTY_INVENTORY}
          pizza={createEmptyPizza()}
        />,
      );
      const grid = document.querySelector(".ingredient-section .ingredient-tray")!;
      expect(within(grid as HTMLElement).getAllByRole("button")).toHaveLength(6);
      // ~20 ingredients per category -- a multi-page nav must exist rather than ever dumping
      // the whole category on screen at once.
      expect(screen.getByRole("group", { name: "素材ページ切り替え" })).toBeInTheDocument();
      const pageLabel = screen.getByText(/^1 \/ \d+$/).textContent!;
      const totalPages = Number(pageLabel.split("/")[1].trim());
      expect(totalPages).toBeGreaterThan(1);
    }
  });

  it("paging through a wide required list eventually reaches the last required+owned ingredient in a category", () => {
    const toppingIds = idsForCategory("topping", MOCK_CATALOG.filter((i) => i.category === "topping").length);
    const lastId = toppingIds[toppingIds.length - 1];
    render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={toppingIds}
        recipe={buildRecipe(toppingIds)}
        inventory={EMPTY_INVENTORY}
        pizza={createEmptyPizza()}
      />,
    );
    const mockIngredient = MOCK_CATALOG.find((i) => i.id === lastId)!;
    const nameMatcher = new RegExp(mockIngredient.nameJa);
    let guard = 0;
    while (screen.queryByRole("button", { name: nameMatcher }) === null && guard < 30) {
      const nextButton = screen.getByRole("button", { name: "次のページ" });
      if ((nextButton as HTMLButtonElement).disabled) break;
      fireEvent.click(nextButton);
      guard += 1;
    }
    expect(screen.getByRole("button", { name: nameMatcher })).toBeInTheDocument();
  });

  it("an owned-but-not-required (mocked) ingredient is never offered, even at catalog scale", () => {
    const owned = idsForCategory("topping", 10);
    const required = owned.slice(0, 3);
    const notRequired = owned.slice(3);
    render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={owned}
        recipe={buildRecipe(required)}
        inventory={EMPTY_INVENTORY}
        pizza={createEmptyPizza()}
      />,
    );
    expect(screen.getAllByRole("button").filter((b) => b.className.includes("ingredient-chip"))).toHaveLength(3);
    for (const id of notRequired) {
      const ingredient = MOCK_CATALOG.find((i) => i.id === id)!;
      expect(screen.queryByRole("button", { name: new RegExp(ingredient.nameJa) })).not.toBeInTheDocument();
    }
  });
});
