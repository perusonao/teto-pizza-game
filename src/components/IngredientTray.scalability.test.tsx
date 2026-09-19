import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { createEmptyPizza } from "../state/pizzaState";
import { EMPTY_INVENTORY } from "../state/inventory";
import type { IngredientCategory } from "../data/ingredients";
import type { Recipe } from "../data/recipes";

/**
 * Issue #86 (Ingredient Tray Scalability): the Recipe Master foundation targets 62 unique
 * ingredients, well past the current ~14-ingredient catalog -- this file pins that the tray
 * never renders more than a bounded number of chips at once regardless of catalog size, via a
 * synthetic (mocked, per the task brief) 30/62-ingredient catalog standing in for that future
 * scale. Real production data is untouched -- this only replaces `ingredientsByCategory`/
 * `getIngredient`'s data source for this one test file (`vi.mock` below is hoisted above every
 * import in this file, including `./IngredientTray`'s own transitive import of
 * `../data/ingredients`). The current real ~14-ingredient catalog's own regression coverage
 * lives in the sibling IngredientTray.palette.test.tsx / IngredientTray.recommendedOther.test.tsx
 * / IngredientTray.physicalDragReset.test.tsx files, which import the real, unmocked module.
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

describe("Ingredient Tray scalability (Issue #86)", () => {
  it("test 27: does not crash and stays bounded with ~30 owned (mocked) ingredients in one category", () => {
    const owned30Toppings = idsForCategory("topping", 20); // ~20 toppings, well past MAX_INGREDIENT_PALETTE_SLOTS
    const recommendedIds = owned30Toppings.slice(0, 2);
    render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={owned30Toppings}
        recipe={buildRecipe(recommendedIds)}
        inventory={EMPTY_INVENTORY}
        pizza={createEmptyPizza()}
      />,
    );
    // "Other" grid (everything but the 2 Recommended) is still capped at exactly 6 on any one
    // page -- Recommended's own 2 chips bring the total on screen to 8, never anywhere near 30.
    const otherGrid = document.querySelector(".ingredient-section--other .ingredient-tray")!;
    expect(within(otherGrid as HTMLElement).getAllByRole("button")).toHaveLength(6);
    expect(screen.getAllByRole("button").filter((b) => b.className.includes("ingredient-chip")).length).toBe(8);
    expect(screen.getByRole("group", { name: "素材ページ切り替え" })).toBeInTheDocument();
  });

  it("test 28: does not crash and stays bounded with the full mocked 62-ingredient catalog owned across every category", () => {
    const allOwned = MOCK_CATALOG.map((i) => i.id);
    for (const category of ["sauce", "cheese", "topping"] as const) {
      cleanup();
      const recommendedIds = idsForCategory(category, 1);
      render(
        <IngredientTray
          activeCategory={category}
          selectedIngredientId={null}
          onSelectIngredient={() => {}}
          ownedIngredientIds={allOwned}
          recipe={buildRecipe(recommendedIds)}
          inventory={EMPTY_INVENTORY}
          pizza={createEmptyPizza()}
        />,
      );
      const otherGrid = document.querySelector(".ingredient-section--other .ingredient-tray")!;
      expect(within(otherGrid as HTMLElement).getAllByRole("button")).toHaveLength(6);
      // ~20 ingredients per category, 1 Recommended + 6-per-page Other -- a multi-page nav must
      // exist rather than ever dumping the whole category on screen at once.
      expect(screen.getByRole("group", { name: "素材ページ切り替え" })).toBeInTheDocument();
      const pageLabel = screen.getByText(/^1 \/ \d+$/).textContent!;
      const totalPages = Number(pageLabel.split("/")[1].trim());
      expect(totalPages).toBeGreaterThan(1);
    }
  });

  it("paging through the full mocked catalog eventually reaches the last owned ingredient in a category", () => {
    const toppingIds = idsForCategory("topping", MOCK_CATALOG.filter((i) => i.category === "topping").length);
    const lastId = toppingIds[toppingIds.length - 1];
    render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={toppingIds}
        recipe={buildRecipe([])}
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
});
