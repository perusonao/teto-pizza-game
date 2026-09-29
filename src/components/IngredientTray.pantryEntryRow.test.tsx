import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { getRecipe } from "../data/recipes";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { EMPTY_INVENTORY } from "../state/inventory";
import { createEmptyPizza } from "../state/pizzaState";

/**
 * LC-R5-a (OD-R5-10): the pantry entry lives in the reserved utility row, and the row -- not the pager -- is what
 * keeps it. With a one-page tray (`pager` false, the future "hand fits one page" case) and `reservePagerRow`
 * (= `dockReserve.utilityRow`) true, the entry stays, inside the invisible-pager placeholder row.
 */
afterEach(() => cleanup());
const recipe = getRecipe("margherita")!;

function tray(props: { reservePagerRow: boolean; withEntry: boolean }) {
  return render(
    <IngredientTray
      activeCategory="topping"
      selectedIngredientId={null}
      onSelectIngredient={() => {}}
      onClearSelection={() => {}}
      ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
      recipe={recipe}
      freeCook
      inventory={EMPTY_INVENTORY}
      pizza={createEmptyPizza()}
      reservePagerRow={props.reservePagerRow}
      pantryEntry={props.withEntry ? { onOpen: () => {} } : undefined}
    />,
  );
}

describe("IngredientTray utility row (pager=false)", () => {
  it("pager=false, row reserved, entry given: the entry stays; the pager is only the invisible placeholder", () => {
    tray({ reservePagerRow: true, withEntry: true });
    expect(screen.getByRole("button", { name: /食材庫/ })).toBeInTheDocument();
    const row = document.querySelector(".ingredient-page-nav");
    expect(row).toHaveClass("ingredient-page-nav--with-entry", "ingredient-page-nav--placeholder");
    expect(screen.queryByRole("button", { name: "次のページ" })).not.toBeInTheDocument();
  });

  it("pager=false, row not reserved: no row and no entry (no new row is ever created)", () => {
    tray({ reservePagerRow: false, withEntry: true });
    expect(document.querySelector(".ingredient-page-nav")).toBeNull();
    expect(screen.queryByRole("button", { name: /食材庫/ })).not.toBeInTheDocument();
  });

  it("no entry given: the reserved row is the plain placeholder (non-eligible rounds are unchanged)", () => {
    tray({ reservePagerRow: true, withEntry: false });
    expect(document.querySelector(".pantry-entry")).toBeNull();
    expect(document.querySelector(".ingredient-page-nav")).toHaveClass("ingredient-page-nav--placeholder");
    expect(document.querySelector(".ingredient-page-nav")).not.toHaveClass("ingredient-page-nav--with-entry");
  });
});
