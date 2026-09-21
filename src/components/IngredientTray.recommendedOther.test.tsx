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
 * Issue #159 P0 (Cooking UI 1-Screen Polish): the tray used to split owned ingredients into
 * "Recommended" (this round's own recipe requirements) and "Other" (every remaining owned
 * ingredient), so FREE play could browse and place ingredients the current recipe never asked
 * for -- see the old file header this replaces (Issue #86). A real-device Fresh Audit
 * (2026-09-21) found that split was both a real contributor to PREPARE overflow and the
 * mechanism that let a player pick a wrong-for-the-recipe SAUCE mid-step, so #159 P0
 * deliberately supersedes it (its own kickoff comment explicitly permits changing
 * ingredient-selection behavior where #159 says so): the tray now shows only this recipe's own
 * `requiredIngredients`, still gated on ownership. This file pins that new, single-list
 * contract; the "FREE creativity"/Other-section assertions from the old #86 file are gone (the
 * behavior they pinned no longer exists), replaced by explicit "an owned-but-not-required
 * ingredient is never offered" coverage below.
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

afterEach(() => {
  cleanup();
});

describe("Recipe-required ingredients only (Issue #159 P0)", () => {
  it("recipe.requiredIngredients owned in this category are offered", () => {
    render(<Harness category="cheese" ownedIngredientIds={STARTER_INGREDIENT_IDS} />);
    expect(screen.getByRole("button", { name: /モッツァレラ/ })).toBeInTheDocument();
  });

  it("an owned ingredient NOT required by the recipe is never offered", () => {
    render(
      <Harness
        category="cheese"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "gorgonzola"]}
      />,
    );
    // gorgonzola isn't required by margherita -- it must not render anywhere, even though owned.
    expect(screen.queryByRole("button", { name: /ゴルゴンゾーラ/ })).not.toBeInTheDocument();
  });

  it("an unowned ingredient (even one the recipe requires) never renders", () => {
    // marinara requires garlic/oregano, neither owned here.
    render(<Harness category="topping" ownedIngredientIds={["tomato-sauce", "mozzarella", "basil"]} recipe={MARINARA} />);
    expect(screen.queryByRole("button", { name: /にんにく/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /オレガノ/ })).not.toBeInTheDocument();
  });

  it("no heading/section label renders -- there is only one list, never labeled おすすめ/その他", () => {
    render(<Harness category="cheese" ownedIngredientIds={STARTER_INGREDIENT_IDS} />);
    expect(screen.queryByText("このピザにおすすめ")).not.toBeInTheDocument();
    expect(screen.queryByText("その他")).not.toBeInTheDocument();
  });

  it("renders nothing (no chips) when the recipe has no requirement in this category (e.g. marinara has no CHEESE requirement)", () => {
    render(<Harness category="cheese" ownedIngredientIds={STARTER_INGREDIENT_IDS} recipe={MARINARA} />);
    expect(document.querySelectorAll(".ingredient-chip")).toHaveLength(0);
  });

  it("SAUCE step never offers an owned-but-off-recipe sauce -- the recipe-lock's own structural mechanism", () => {
    // The player owns three sauces, but margherita only requires tomato-sauce -- olive-oil/pesto
    // (owned, but not this recipe's sauce) must never appear as selectable alternatives, which is
    // exactly what makes switching to a different sauce mid-step impossible (see #159 P0's own
    // sauce-lock acceptance criterion; gameReducer.ts's APPLY_SAUCE/COMMIT_SAUCE_DISPENSE already
    // independently gate on `makingStep === "SAUCE"`, unchanged by this file).
    render(
      <Harness
        category="sauce"
        ownedIngredientIds={["tomato-sauce", "olive-oil", "pesto"]}
        recipe={MARGHERITA}
      />,
    );
    expect(screen.getByRole("button", { name: /トマトソース/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /オリーブオイル/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ジェノベーゼソース|バジルソース|ペスト/ })).not.toBeInTheDocument();
  });
});

describe("Inventory display (Issue #86, unaffected by #159's recipe-only filter)", () => {
  it("a finite ingredient shows its remaining stock count", () => {
    render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 27 }}
        recipe={getRecipe("funghi")!}
      />,
    );
    const chip = screen.getByRole("button", { name: /マッシュルーム/ });
    expect(within(chip).getByText("×27")).toBeInTheDocument();
  });

  it("an unlimited (Starter) ingredient shows the infinity marker", () => {
    render(<Harness category="cheese" ownedIngredientIds={STARTER_INGREDIENT_IDS} />);
    const chip = screen.getByRole("button", { name: /モッツァレラ/ });
    expect(within(chip).getByText("∞")).toBeInTheDocument();
  });

  it("a finite ingredient at 0 stock renders visually disabled", () => {
    render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 0 }}
        recipe={getRecipe("funghi")!}
      />,
    );
    const chip = screen.getByRole("button", { name: /マッシュルーム/ });
    expect(chip).toBeDisabled();
    expect(chip.className).toContain("ingredient-chip--disabled");
  });

  it("a stock-0 ingredient cannot be selected/placed via the UI", () => {
    render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 0 }}
        recipe={getRecipe("funghi")!}
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
        recipe={getRecipe("funghi")!}
      />,
    );
    expect(screen.getByRole("button", { name: /マッシュルーム/ })).toBeDisabled();
  });
});

describe("Category filters -- IngredientCategory already matches the making-step 1:1", () => {
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

describe("Whichever recipe is current drives what's offered -- no FREE/Mission branch needed", () => {
  it("the tray's contents follow state.recipe (FREE's chosen recipe or Lunch Rush's current order) with no separate Mission code path", () => {
    const owned = [...STARTER_INGREDIENT_IDS, "garlic", "oregano"];
    const { rerender } = render(<Harness category="topping" ownedIngredientIds={owned} recipe={MARGHERITA} />);
    // margherita requires basil, not garlic/oregano (marinara's own requirements).
    expect(screen.getByRole("button", { name: /バジル/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /にんにく/ })).not.toBeInTheDocument();

    // The current order recipe changes (mirrors Lunch Rush's MISSION_NEXT_ORDER swapping
    // state.recipe) -- garlic/oregano now surface, basil no longer does, with no separate
    // Mission-only code path.
    rerender(<Harness category="topping" ownedIngredientIds={owned} recipe={MARINARA} />);
    expect(screen.getByRole("button", { name: /にんにく/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /オレガノ/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /バジル/ })).not.toBeInTheDocument();
  });
});

describe("EP4 grant / Shop restock reflected in the tray", () => {
  it("an ingredient granted by EP4 Starter Stock (added to ownedIngredientIds+inventory) appears in the tray once the recipe also requires it", () => {
    const fugazza = getRecipe("fugazza")!; // requires onion
    const { rerender } = render(
      <Harness category="topping" ownedIngredientIds={STARTER_INGREDIENT_IDS} inventory={EMPTY_INVENTORY} recipe={fugazza} />,
    );
    expect(screen.queryByRole("button", { name: /オニオン|たまねぎ/ })).not.toBeInTheDocument();

    // Mirrors applyStarterGrants: onion joins ownedIngredientIds with a fresh inventory count.
    rerender(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "onion"]}
        inventory={{ onion: 40 }}
        recipe={fugazza}
      />,
    );
    const onionChip = screen.getByRole("button", { name: /たまねぎ/ });
    expect(onionChip).toBeInTheDocument();
    expect(within(onionChip).getByText("×40")).toBeInTheDocument();
  });

  it("a Shop restock (inventory count increasing) is reflected in the stock badge and re-enables a depleted chip", () => {
    const funghi = getRecipe("funghi")!; // requires mushroom
    const { rerender } = render(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 0 }}
        recipe={funghi}
      />,
    );
    expect(screen.getByRole("button", { name: /マッシュルーム/ })).toBeDisabled();

    // Mirrors RESTOCK_INGREDIENT crediting a fresh batch.
    rerender(
      <Harness
        category="topping"
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "mushroom"]}
        inventory={{ mushroom: 9 }}
        recipe={funghi}
      />,
    );
    const chip = screen.getByRole("button", { name: /マッシュルーム/ });
    expect(chip).not.toBeDisabled();
    expect(within(chip).getByText("×9")).toBeInTheDocument();
  });
});
