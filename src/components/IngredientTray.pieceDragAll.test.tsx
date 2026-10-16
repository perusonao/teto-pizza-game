import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { FREE_COOK_RECIPE } from "../data/freeCook";
import { INGREDIENTS, type Ingredient, type IngredientCategory } from "../data/ingredients";
import { createEmptyPizza } from "../state/pizzaState";
import { resolvePieceDrop } from "../logic/pieceDrag";
import type { InventoryState } from "../state/inventory";

/**
 * Issue #476 (S1): every `scatter` cheese / topping is draggable, a sauce never is -- decided from the ingredient
 * itself, with no per-id list. Each ingredient is rendered alone in a Free Cooking tray (every owned ingredient of the
 * step is listed) so the whole catalog is exercised without paging.
 */

const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300 } as DOMRect;
const INSIDE = { x: 150, y: 150 };

const GENEROUS_INVENTORY: InventoryState = Object.fromEntries(INGREDIENTS.map((i) => [i.id, 99]));

afterEach(() => cleanup());

function renderTray(ingredient: Ingredient, onPhysicalDrop: (ingredient: Ingredient) => void) {
  return render(
    <IngredientTray
      activeCategory={ingredient.category as IngredientCategory}
      selectedIngredientId={null}
      onSelectIngredient={() => {}}
      ownedIngredientIds={[ingredient.id]}
      recipe={FREE_COOK_RECIPE}
      freeCook
      inventory={GENEROUS_INVENTORY}
      pizza={createEmptyPizza()}
      physicalDragEnabled
      resolvePhysicalDrop={(x, y) => resolvePieceDrop(x, y, DOUGH_RECT)}
      onPhysicalDrop={(dropped) => onPhysicalDrop(dropped)}
    />,
  );
}

function chipOf(ingredient: Ingredient): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(ingredient.nameJa) });
}

function drag(chip: HTMLElement) {
  fireEvent.pointerDown(chip, { pointerId: 1, isPrimary: true, pointerType: "mouse", clientX: 20, clientY: 20 });
  fireEvent.pointerMove(chip, { pointerId: 1, clientX: 40, clientY: 20 });
  fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE.x, clientY: INSIDE.y });
}

const SCATTER_PIECES = INGREDIENTS.filter(
  (i) => i.placement === "scatter" && (i.category === "cheese" || i.category === "topping"),
);

describe("tray drag covers every scatter cheese / topping (#476 S1)", () => {
  it("the catalog has scatter cheeses and toppings (the loop below is not vacuous)", () => {
    expect(SCATTER_PIECES.some((i) => i.category === "cheese")).toBe(true);
    expect(SCATTER_PIECES.some((i) => i.category === "topping")).toBe(true);
    expect(SCATTER_PIECES.length).toBeGreaterThan(40);
  });

  it.each(SCATTER_PIECES.map((i) => [i.id, i] as const))("%s is draggable and drops onto the pizza", (_id, ingredient) => {
    const onDrop = vi.fn();
    renderTray(ingredient, onDrop);
    const chip = chipOf(ingredient);
    expect(chip.className).toContain("ingredient-chip--physical");
    drag(chip);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0][0].id).toBe(ingredient.id);
  });

  it.each(INGREDIENTS.filter((i) => i.category === "sauce").map((i) => [i.id, i] as const))(
    "sauce %s is never draggable",
    (_id, ingredient) => {
      const onDrop = vi.fn();
      renderTray(ingredient, onDrop);
      const chip = chipOf(ingredient);
      expect(chip.className).not.toContain("ingredient-chip--physical");
      drag(chip);
      expect(onDrop).not.toHaveBeenCalled();
    },
  );

  it("a tap on a draggable chip still just selects it", () => {
    const onSelect = vi.fn();
    const sausage = INGREDIENTS.find((i) => i.id === "sausage")!;
    render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={onSelect}
        ownedIngredientIds={["sausage"]}
        recipe={FREE_COOK_RECIPE}
        freeCook
        inventory={GENEROUS_INVENTORY}
        pizza={createEmptyPizza()}
        physicalDragEnabled
        resolvePhysicalDrop={() => null}
        onPhysicalDrop={() => {}}
      />,
    );
    fireEvent.click(chipOf(sausage));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "sausage" }));
  });

  it("with physicalDragEnabled off no chip is draggable (Lunch Rush / paused)", () => {
    const sausage = INGREDIENTS.find((i) => i.id === "sausage")!;
    const onDrop = vi.fn();
    render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={["sausage"]}
        recipe={FREE_COOK_RECIPE}
        freeCook
        inventory={GENEROUS_INVENTORY}
        pizza={createEmptyPizza()}
        resolvePhysicalDrop={() => ({ x: 50, y: 50 })}
        onPhysicalDrop={onDrop}
      />,
    );
    const chip = chipOf(sausage);
    expect(chip.className).not.toContain("ingredient-chip--physical");
    drag(chip);
    expect(onDrop).not.toHaveBeenCalled();
  });
});
