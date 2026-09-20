import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { InventoryOverlay } from "./InventoryOverlay";
import { EMPTY_INVENTORY, consumePizzaInventory } from "../state/inventory";
import { createEmptyPizza } from "../state/pizzaState";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";

/**
 * Inventory Screen: component-level coverage for `InventoryOverlay`, the new READ-ONLY
 * "what do I own / how much is left" view (see this file's own doc comment for why it's kept
 * separate from ShopOverlay's purchase/restock responsibility). Reuses the same
 * `remainingStock`/`consumePizzaInventory` SSOT (../state/inventory.ts) every other stock
 * display (IngredientTray, ShopOverlay) already reuses -- no second stock calculation is
 * introduced or tested here.
 */

afterEach(() => {
  cleanup();
});

describe("InventoryOverlay (read-only stock view)", () => {
  it("test 1: renders only owned ingredients, hiding an unowned one", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
        inventory={EMPTY_INVENTORY}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("トマトソース")).toBeInTheDocument();
    expect(screen.getByText("モッツァレラ")).toBeInTheDocument();
    expect(screen.getByText("バジル")).toBeInTheDocument();
    // olive-oil ("オリーブオイル") is not in STARTER_INGREDIENT_IDS -- must not render at all.
    expect(screen.queryByText("オリーブオイル")).not.toBeInTheDocument();
  });

  it("test 2: shows unlimited (Starter) ingredients as ∞", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
        inventory={EMPTY_INVENTORY}
        onClose={() => {}}
      />,
    );
    const card = screen.getByText("トマトソース").closest(".inventory-card") as HTMLElement;
    expect(within(card).getByText("∞")).toBeInTheDocument();
  });

  it("test 3: shows a finite ingredient's remaining stock as ×N", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "onion"]}
        inventory={{ onion: 27 }}
        onClose={() => {}}
      />,
    );
    const card = screen.getByText("たまねぎ").closest(".inventory-card") as HTMLElement;
    expect(within(card).getByText("×27")).toBeInTheDocument();
  });

  it("test 4: shows an owned-but-depleted finite ingredient as ×0, not hidden", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "onion"]}
        inventory={{ onion: 0 }}
        onClose={() => {}}
      />,
    );
    const card = screen.getByText("たまねぎ").closest(".inventory-card") as HTMLElement;
    expect(within(card).getByText("×0")).toBeInTheDocument();
  });

  it("test 5: absent inventory key for an owned finite ingredient reads as ×0 (same convention as remainingStock)", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "onion"]}
        inventory={EMPTY_INVENTORY}
        onClose={() => {}}
      />,
    );
    const card = screen.getByText("たまねぎ").closest(".inventory-card") as HTMLElement;
    expect(within(card).getByText("×0")).toBeInTheDocument();
  });

  it("test 6: shows category tabs (すべて/ソース/チーズ/トッピング) and filters by the active one", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
        inventory={EMPTY_INVENTORY}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("tab", { name: "すべて" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ソース" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "チーズ" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "トッピング" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "ソース" }));
    expect(screen.getByText("トマトソース")).toBeInTheDocument();
    expect(screen.queryByText("モッツァレラ")).not.toBeInTheDocument();
    expect(screen.queryByText("バジル")).not.toBeInTheDocument();
  });

  it("test 7: switching category tabs changes the visible set back and forth", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
        inventory={EMPTY_INVENTORY}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "チーズ" }));
    expect(screen.getByText("モッツァレラ")).toBeInTheDocument();
    expect(screen.queryByText("トマトソース")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "すべて" }));
    expect(screen.getByText("トマトソース")).toBeInTheDocument();
    expect(screen.getByText("モッツァレラ")).toBeInTheDocument();
    expect(screen.getByText("バジル")).toBeInTheDocument();
  });

  it("test 8: shows an empty-state message when a category has no owned ingredients", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={["tomato-sauce"]}
        inventory={EMPTY_INVENTORY}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "チーズ" }));
    expect(screen.getByText(/まだこのカテゴリの材料を持っていません/)).toBeInTheDocument();
  });

  it("test 9: calls onClose when 閉じる is clicked, and dispatches nothing else", () => {
    const onClose = vi.fn();
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
        inventory={EMPTY_INVENTORY}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("test 10: read-only guarantee -- renders no purchase/restock/consume control of any kind", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "onion"]}
        inventory={{ onion: 5 }}
        onClose={() => {}}
      />,
    );
    // Every button on screen is either the close button or a category tab -- no Shop-style
    // purchase/restock affordance exists anywhere in this component's own markup.
    for (const button of screen.getAllByRole("button")) {
      expect(button.textContent).not.toMatch(/購入|補充/);
    }
    expect(screen.queryByRole("button", { name: "購入" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "補充する" })).not.toBeInTheDocument();
  });

  it("test 11: renders the shared cheese physical visual (not a plain emoji) for a cheese ingredient", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={["mozzarella"]}
        inventory={EMPTY_INVENTORY}
        onClose={() => {}}
      />,
    );
    const card = screen.getByText("モッツァレラ").closest(".inventory-card") as HTMLElement;
    expect(within(card).getByText("チーズ")).toBeInTheDocument();
    expect(card.querySelector(".pizza-cheese")).toBeInTheDocument();
  });

  it("test 12: displays each card's category label", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
        inventory={EMPTY_INVENTORY}
        onClose={() => {}}
      />,
    );
    const sauceCard = screen.getByText("トマトソース").closest(".inventory-card") as HTMLElement;
    expect(within(sauceCard).getByText("ソース")).toBeInTheDocument();
    const toppingCard = screen.getByText("バジル").closest(".inventory-card") as HTMLElement;
    expect(within(toppingCard).getByText("トッピング")).toBeInTheDocument();
  });

  it("test 13: shows a live owned/total summary count", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
        inventory={EMPTY_INVENTORY}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/所持 3\/22種/)).toBeInTheDocument();
  });

  it("test 14: reflects a Starter Grant landing (e.g. onion +40) exactly like remainingStock would", () => {
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "onion"]}
        inventory={{ onion: 40 }}
        onClose={() => {}}
      />,
    );
    const card = screen.getByText("たまねぎ").closest(".inventory-card") as HTMLElement;
    expect(within(card).getByText("×40")).toBeInTheDocument();
  });

  it("test 15: reflects post-CONFIRM_BAKE consumption via the same consumePizzaInventory SSOT", () => {
    const pizza = createEmptyPizza();
    pizza.toppings = [
      { id: "t1", ingredientId: "onion", x: 0.1, y: 0.1 },
      { id: "t2", ingredientId: "onion", x: 0.2, y: 0.2 },
    ];
    const inventoryAfterBake = consumePizzaInventory(pizza, { onion: 10 });
    render(
      <InventoryOverlay
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "onion"]}
        inventory={inventoryAfterBake}
        onClose={() => {}}
      />,
    );
    const card = screen.getByText("たまねぎ").closest(".inventory-card") as HTMLElement;
    expect(within(card).getByText("×8")).toBeInTheDocument();
  });

  it("test 16 (current ~22 ingredients): renders every real, owned ingredient across every category without crashing", () => {
    const allOwned = INGREDIENTS.map((i) => i.id);
    render(
      <InventoryOverlay ownedIngredientIds={allOwned} inventory={EMPTY_INVENTORY} onClose={() => {}} />,
    );
    expect(INGREDIENTS.length).toBe(22);
    expect(screen.getByText(/所持 22\/22種/)).toBeInTheDocument();
    for (const ingredient of INGREDIENTS) {
      expect(screen.getByText(ingredient.nameJa)).toBeInTheDocument();
    }
  });
});
