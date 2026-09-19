import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";

/**
 * Inventory Screen (next phase after Issue #86 UX-2): end-to-end HOME -> InventoryOverlay
 * coverage through the real `App` (real reducer, real localStorage), following this codebase's
 * own established convention for a feature-scoped App-level test file (see
 * App.playerReference.test.tsx / App.humanFeelFix3.test.tsx). Exists specifically to catch a
 * broken HOME wire or a stock number that silently stops tracking `GameState.inventory` --
 * `remainingStock`/`consumePizzaInventory` themselves are already unit-tested in
 * state/inventory.test.ts, and the component's own rendering rules (category filter, ∞/×N/×0,
 * scalability) are covered directly in components/InventoryOverlay(.scalability).test.tsx. This
 * file's job is purely "is Inventory correctly wired into HOME/App, and does it stay a read-only
 * mirror of the same state Shop/GAME already mutate."
 */

function seedSaveV2(overrides: {
  pitzBalance?: number;
  ownedIngredientIds?: string[];
  inventory?: Record<string, number>;
}): void {
  const save = {
    schemaVersion: 2,
    dex: [],
    pitzBalance: overrides.pitzBalance ?? 0,
    ownedIngredientIds: overrides.ownedIngredientIds ?? [...STARTER_INGREDIENT_IDS],
    missionBest: {},
    inventory: overrides.inventory ?? {},
  };
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Inventory Screen (read-only stock view)", () => {
  it("shows a 材料 entry point on HOME", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /材料/ })).toBeInTheDocument();
  });

  it("opens the Inventory overlay from HOME without leaving HOME underneath", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /材料/ }));
    const overlay = document.querySelector(".dex-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay?.querySelector(".inventory-overlay__panel")).toBeInTheDocument();
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("closes the Inventory overlay via 閉じる, returning to a plain HOME", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /材料/ }));
    await user.click(within(document.querySelector(".dex-overlay")!).getByRole("button", { name: "閉じる" }));
    expect(document.querySelector(".dex-overlay")).not.toBeInTheDocument();
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("shows only the default Starter-owned ingredients on a fresh save, hiding an unowned one", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /材料/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(within(overlay).getByText("トマトソース")).toBeInTheDocument();
    expect(within(overlay).getByText("モッツァレラ")).toBeInTheDocument();
    expect(within(overlay).getByText("バジル")).toBeInTheDocument();
    // A never-purchased, non-Starter ingredient must not appear at all by default.
    expect(within(overlay).queryByText("オリーブオイル")).not.toBeInTheDocument();
  });

  it("filters the visible list by category tab", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /材料/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    await user.click(within(overlay).getByRole("tab", { name: "ソース" }));
    expect(within(overlay).getByText("トマトソース")).toBeInTheDocument();
    expect(within(overlay).queryByText("バジル")).not.toBeInTheDocument();
  });

  it("never renders a purchase or restock control -- responsibility stays separate from Shop", async () => {
    seedSaveV2({ pitzBalance: 200, ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion"], inventory: { onion: 2 } });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /材料/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(within(overlay).queryByRole("button", { name: "購入" })).not.toBeInTheDocument();
    expect(within(overlay).queryByRole("button", { name: "補充する" })).not.toBeInTheDocument();
  });

  it("reflects a Shop restock once it lands, when Inventory is reopened", async () => {
    seedSaveV2({ pitzBalance: 200, ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion"], inventory: { onion: 2 } });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;
    await user.click(within(shop).getByRole("button", { name: "補充する" }));
    await user.click(within(shop).getByRole("button", { name: "閉じる" }));
    expect(document.querySelector(".dex-overlay")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /材料/ }));
    const inventory = document.querySelector<HTMLElement>(".dex-overlay")!;
    const card = within(inventory).getByText("たまねぎ").closest(".inventory-card") as HTMLElement;
    // onion's restockQuantity is 12 (see data/ingredients.ts) -- 2 + 12 = 14.
    expect(within(card).getByText("×14")).toBeInTheDocument();
  });

  it("reflects an already-landed Starter Grant (e.g. onion +40) exactly as persisted", async () => {
    seedSaveV2({ ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion"], inventory: { onion: 40 } });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /材料/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    const card = within(overlay).getByText("たまねぎ").closest(".inventory-card") as HTMLElement;
    expect(within(card).getByText("×40")).toBeInTheDocument();
  });

  it("regression: Dex overlay still opens correctly from HOME after the Inventory wiring change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(overlay).toBeInTheDocument();
    expect(overlay.querySelector(".inventory-overlay__panel")).not.toBeInTheDocument();
  });

  it("regression: Shop overlay still opens correctly from HOME after the Inventory wiring change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(overlay).toBeInTheDocument();
    expect(overlay.querySelector(".shop-overlay__panel")).toBeInTheDocument();
  });
});
