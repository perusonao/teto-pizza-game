import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { getRecipe } from "../data/recipes";
import { STARTER_INGREDIENT_IDS, type IngredientCategory } from "../data/ingredients";
import { EMPTY_INVENTORY, type InventoryState } from "../state/inventory";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import type { Recipe } from "../data/recipes";

/**
 * Issue #86 (Ingredient Tray Scalability): coverage for the "Recommended"/"Other" grouping, the
 * Inventory stock display, and the Stock Gate's own read-only display (`canPlaceIngredient`,
 * `remainingStock` -- both unchanged, reducer-shared functions, src/state/inventory.ts). See
 * IngredientTray.tsx's own doc comments for the SSOT contract this file pins.
 */

const margheritaFixture = getRecipe("margherita");
if (!margheritaFixture) throw new Error("margherita fixture missing");
const MARGHERITA: Recipe = margheritaFixture;
const marinaraFixture = getRecipe("marinara");
if (!marinaraFixture) throw new Error("marinara fixture missing");
const MARINARA: Recipe = marinaraFixture;

function Harness({
  category,
  ownedIngredientIds,
  recipe = MARGHERITA,
  inventory = EMPTY_INVENTORY,
  pizza = createEmptyPizza(),
}: {
  category: IngredientCategory;
  ownedIngredientIds: readonly string[];
  recipe?: Recipe;
  inventory?: InventoryState;
  pizza?: PizzaState;
}) {
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  return (
    <div>
      <span data-testid="selected-id">{selectedIngredientId ?? ""}</span>
      <IngredientTray
        activeCategory={category}
        selectedIngredientId={selectedIngredientId}
        onSelectIngredient={(ingredient) => setSelectedIngredientId(ingredient.id)}
        ownedIngredientIds={ownedIngredientIds}
        recipe={recipe}
        inventory={inventory}
        pizza={pizza}
      />
    </div>
  );
}

function recommendedSection(): HTMLElement | null {
  return document.querySelector(".ingredient-section--recommended");
}

function otherSection(): HTMLElement {
  const section = document.querySelector(".ingredient-section--other");
  if (!section) throw new Error("Other section not found");
  return section as HTMLElement;
}

afterEach(() => {
  cleanup();
});

describe("Recommended / Other grouping (Issue #86)", () => {
  it("test 9: recipe.requiredIngredients owned in this category render under Recommended", () => {
    render(<Harness category="cheese" ownedIngredientIds={STARTER_INGREDIENT_IDS} />);
    const recommended = recommendedSection();
    expect(recommended).not.toBeNull();
    expect(within(recommended!).getByRole("button", { name: /モッツァレラ/ })).toBeInTheDocument();
  });

  it("test 10: an owned ingredient not required by the recipe renders under Other", () => {
    render(
      <Harness
        category="cheese"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "gorgonzola"]}
      />,
    );
    const other = otherSection();
    expect(within(other).getByRole("button", { name: /ゴルゴンゾーラ/ })).toBeInTheDocument();
    // gorgonzola isn't required by margherita, so it must not also appear in Recommended.
    expect(within(recommendedSection()!).queryByRole("button", { name: /ゴルゴンゾーラ/ })).not.toBeInTheDocument();
  });

  it("test 11: an unowned ingredient (even one the recipe requires) never renders anywhere", () => {
    // marinara requires garlic/oregano, neither owned here.
    render(<Harness category="topping" ownedIngredientIds={["tomato-sauce", "mozzarella", "basil"]} recipe={MARINARA} />);
    expect(screen.queryByRole("button", { name: /にんにく/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /オレガノ/ })).not.toBeInTheDocument();
  });

  it("Recommended is omitted entirely when the recipe has no requirement in this category (e.g. marinara has no CHEESE requirement)", () => {
    render(<Harness category="cheese" ownedIngredientIds={STARTER_INGREDIENT_IDS} recipe={MARINARA} />);
    expect(recommendedSection()).toBeNull();
  });
});

describe("Inventory display (Issue #86)", () => {
  it("test 12/26: a finite ingredient shows its remaining stock count", () => {
    render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 27 }}
      />,
    );
    const chip = screen.getByRole("button", { name: /マッシュルーム/ });
    expect(within(chip).getByText("×27")).toBeInTheDocument();
  });

  it("test 13: an unlimited (Starter) ingredient shows the infinity marker", () => {
    render(<Harness category="cheese" ownedIngredientIds={STARTER_INGREDIENT_IDS} />);
    const chip = screen.getByRole("button", { name: /モッツァレラ/ });
    expect(within(chip).getByText("∞")).toBeInTheDocument();
  });

  it("test 14: a finite ingredient at 0 stock renders visually disabled", () => {
    render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 0 }}
      />,
    );
    const chip = screen.getByRole("button", { name: /マッシュルーム/ });
    expect(chip).toBeDisabled();
    expect(chip.className).toContain("ingredient-chip--disabled");
  });

  it("test 15: a stock-0 ingredient cannot be selected/placed via the UI", () => {
    render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 0 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /マッシュルーム/ }));
    expect(screen.getByTestId("selected-id").textContent).toBe("");
  });

  it("a finite ingredient already exhausted by pieces placed this round (not just persisted 0) is also disabled", () => {
    const pizza = {
      ...createEmptyPizza(),
      toppings: [
        { id: "t1", ingredientId: "mushroom", x: 40, y: 40 },
        { id: "t2", ingredientId: "mushroom", x: 50, y: 50 },
      ],
    };
    render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 2 }}
        pizza={pizza}
      />,
    );
    expect(screen.getByRole("button", { name: /マッシュルーム/ })).toBeDisabled();
  });
});

describe("Category filters (test 16/17/18) -- IngredientCategory already matches the making-step 1:1", () => {
  it("SAUCE step (activeCategory=sauce) only ever shows sauce-category ingredients", () => {
    render(<Harness category="sauce" ownedIngredientIds={["tomato-sauce", "olive-oil", "mozzarella", "basil"]} />);
    expect(screen.getByRole("button", { name: /トマトソース/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /モッツァレラ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /バジル/ })).not.toBeInTheDocument();
  });

  it("CHEESE step only ever shows cheese-category ingredients", () => {
    render(<Harness category="cheese" ownedIngredientIds={["tomato-sauce", "mozzarella", "basil"]} />);
    expect(screen.getByRole("button", { name: /モッツァレラ/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /トマトソース/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /バジル/ })).not.toBeInTheDocument();
  });

  it("TOPPING step only ever shows topping-category ingredients", () => {
    render(<Harness category="topping" ownedIngredientIds={["tomato-sauce", "mozzarella", "basil"]} />);
    expect(screen.getByRole("button", { name: /バジル/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /トマトソース/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /モッツァレラ/ })).not.toBeInTheDocument();
  });
});

describe("FREE creativity vs Lunch Rush priority (test 19/20)", () => {
  it("test 19: FREE play can still select an Other (non-recommended) ingredient", () => {
    render(
      <Harness
        category="cheese"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "gorgonzola"]}
        inventory={{ gorgonzola: 6 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /ゴルゴンゾーラ/ }));
    expect(screen.getByTestId("selected-id").textContent).toBe("gorgonzola");
  });

  it("test 20: whichever recipe is current (FREE's chosen recipe or Lunch Rush's current order) drives Recommended -- no FREE/Mission branch needed", () => {
    const owned = [...STARTER_INGREDIENT_IDS, "garlic", "oregano"];
    const { rerender } = render(<Harness category="topping" ownedIngredientIds={owned} recipe={MARGHERITA} />);
    // margherita requires basil -- garlic/oregano (marinara's own requirements) are Other here.
    expect(within(otherSection()).getByRole("button", { name: /にんにく/ })).toBeInTheDocument();

    // The current order recipe changes (mirrors Lunch Rush's MISSION_NEXT_ORDER swapping
    // state.recipe) -- garlic/oregano now surface first under Recommended, with no separate
    // Mission-only code path.
    rerender(<Harness category="topping" ownedIngredientIds={owned} recipe={MARINARA} />);
    expect(within(recommendedSection()!).getByRole("button", { name: /にんにく/ })).toBeInTheDocument();
    expect(within(recommendedSection()!).getByRole("button", { name: /オレガノ/ })).toBeInTheDocument();
  });
});

describe("EP4 grant / Shop restock reflected in the tray (test 21/22)", () => {
  it("test 21: an ingredient granted by EP4 Starter Stock (added to ownedIngredientIds+inventory) appears in the tray", () => {
    const { rerender } = render(
      <Harness category="topping" ownedIngredientIds={STARTER_INGREDIENT_IDS} inventory={EMPTY_INVENTORY} />,
    );
    expect(screen.queryByRole("button", { name: /オニオン|たまねぎ/ })).not.toBeInTheDocument();

    // Mirrors applyStarterGrants: onion joins ownedIngredientIds with a fresh inventory count.
    rerender(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "onion"]}
        inventory={{ onion: 40 }}
      />,
    );
    const onionChip = screen.getByRole("button", { name: /たまねぎ/ });
    expect(onionChip).toBeInTheDocument();
    expect(within(onionChip).getByText("×40")).toBeInTheDocument();
  });

  it("test 22: a Shop restock (inventory count increasing) is reflected in the stock badge and re-enables a depleted chip", () => {
    const { rerender } = render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 0 }}
      />,
    );
    expect(screen.getByRole("button", { name: /マッシュルーム/ })).toBeDisabled();

    // Mirrors RESTOCK_INGREDIENT crediting a fresh batch.
    rerender(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 9 }}
      />,
    );
    const chip = screen.getByRole("button", { name: /マッシュルーム/ });
    expect(chip).not.toBeDisabled();
    expect(within(chip).getByText("×9")).toBeInTheDocument();
  });
});
