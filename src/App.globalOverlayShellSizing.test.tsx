import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";

/**
 * HOME Global Overlay size consistency: Dex/Shop/Inventory each open a `.dex-overlay__panel`
 * whose own outer box (`.dex-overlay__panel`'s className/attributes) never varies with how much
 * content it holds -- only a nested `.dex-overlay__body` (the scrollable region) grows/shrinks/
 * scrolls. This file asserts that structural invariant through the real `App` (mirrors this
 * codebase's own App.inventoryOverlay.test.tsx convention) -- jsdom doesn't compute real CSS
 * layout, so actual pixel geometry (top/bottom/height/width at 390x844 and 360px width) is
 * verified separately via a browser screenshot pass (see
 * docs/reports/TETO_GLOBAL-OVERLAY-SIZE-CONSISTENCY_Result.md), not here.
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

/** Every direct child of `.dex-overlay__panel` must be exactly the fixed header + the one
 *  scrollable body wrapper -- never a third element, and never the variable-length list/grid
 *  itself sitting directly in the panel (which would let its intrinsic height drive the panel's
 *  own box, reproducing the original bug). */
function expectPanelShellShape(panel: HTMLElement): void {
  const children = Array.from(panel.children);
  expect(children).toHaveLength(2);
  expect(children[0]).toHaveClass("dex-overlay__header");
  expect(children[1]).toHaveClass("dex-overlay__body");
}

describe("HOME Global Overlay shell sizing (Dex/Shop/Inventory share one rule)", () => {
  it("Dex overlay panel uses the shared shell: fixed header + one scrollable body, nothing else", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    const panel = document.querySelector<HTMLElement>(".dex-overlay__panel")!;
    expect(panel).toBeInTheDocument();
    expectPanelShellShape(panel);
    // The variable-length recipe list lives inside the scrollable body, not directly in the panel.
    expect(panel.querySelector(":scope > .dex-overlay__list")).not.toBeInTheDocument();
    expect(panel.querySelector(".dex-overlay__body > .dex-overlay__list")).toBeInTheDocument();
  });

  it("Shop overlay panel uses the same shared shell as Dex", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const panel = document.querySelector<HTMLElement>(".dex-overlay__panel")!;
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass("shop-overlay__panel");
    expectPanelShellShape(panel);
    expect(panel.querySelector(":scope > .shop-overlay__list")).not.toBeInTheDocument();
  });

  it("Inventory overlay panel uses the same shared shell as Dex/Shop", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /材料/ }));
    const panel = document.querySelector<HTMLElement>(".dex-overlay__panel")!;
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass("inventory-overlay__panel");
    expectPanelShellShape(panel);
    expect(panel.querySelector(":scope > .inventory-grid")).not.toBeInTheDocument();
  });

  it("switching Inventory category tabs (すべて -> ソース, 3 items) never changes the panel's own class list", async () => {
    // すべて (owned Starter set) has more entries than ソース (only tomato-sauce among Starters) --
    // exactly the "内容が3件しかない" case from the bug report.
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /材料/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    const panel = overlay.querySelector<HTMLElement>(".dex-overlay__panel")!;
    const classNameBefore = panel.className;
    const childCountBefore = panel.children.length;

    await user.click(within(overlay).getByRole("tab", { name: "ソース" }));
    expect(panel.className).toBe(classNameBefore);
    expect(panel.children.length).toBe(childCountBefore);
    expectPanelShellShape(panel);

    await user.click(within(overlay).getByRole("tab", { name: "チーズ" }));
    expect(panel.className).toBe(classNameBefore);
    expect(panel.children.length).toBe(childCountBefore);
    expectPanelShellShape(panel);

    await user.click(within(overlay).getByRole("tab", { name: "トッピング" }));
    expect(panel.className).toBe(classNameBefore);
    expect(panel.children.length).toBe(childCountBefore);
    expectPanelShellShape(panel);

    await user.click(within(overlay).getByRole("tab", { name: "すべて" }));
    expect(panel.className).toBe(classNameBefore);
    expect(panel.children.length).toBe(childCountBefore);
    expectPanelShellShape(panel);
  });

  it("Inventory category switching keeps the panel element itself identical (same node), only its body content changes", async () => {
    seedSaveV2({ ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion"], inventory: { onion: 5 } });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /材料/ }));
    const overlay = document.querySelector<HTMLElement>(".dex-overlay")!;
    const panel = overlay.querySelector<HTMLElement>(".dex-overlay__panel")!;

    // 3 items under ソース (small content) vs すべて (larger content, includes onion under topping).
    await user.click(within(overlay).getByRole("tab", { name: "ソース" }));
    const soleCardsUnderSauce = overlay.querySelectorAll(".inventory-card").length;
    expect(soleCardsUnderSauce).toBeGreaterThan(0);
    // Same panel node survives the re-render -- React reconciles in place, it never remounts.
    expect(overlay.querySelector(".dex-overlay__panel")).toBe(panel);

    await user.click(within(overlay).getByRole("tab", { name: "すべて" }));
    expect(overlay.querySelector(".dex-overlay__panel")).toBe(panel);
  });
});
