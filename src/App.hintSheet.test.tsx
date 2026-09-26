import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";

/**
 * Discovery Hint 2.0 (Issue #229, 229-B) through the real App: the Free Cooking 「ヒント」 button
 * opens the hint sheet. Discovery Hint Economy 1.0 (Issue #232, HE-2): unlocking levels is a Pitz
 * purchase, so the save changes by exactly the debit and the purchase ledger -- nothing else.
 */

const DEX2_SAVE = {
  schemaVersion: 2,
  dex: ["margherita", "bismarck"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 300,
  ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg", "bacon"],
  missionBest: {},
  inventory: { egg: 10, bacon: 10 },
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: ["egg", "bacon"],
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Free Cooking hint sheet in the App (229-B)", () => {
  it("opens from 「ヒント」, buys every level, and the save changes only by the Pitz debit and the ledger", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(DEX2_SAVE));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /フリークッキング/ }));
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);
    expect(before).toBeTruthy();

    const bar = document.querySelector(".prepare-bake-bar") as HTMLElement;
    await user.click(within(bar).getByRole("button", { name: "ヒント" }));
    const dialog = screen.getByRole("dialog", { name: /ヒント/ });
    for (let i = 0; i < 6; i += 1) {
      const next = dialog.querySelector<HTMLButtonElement>(".hint-sheet__next");
      if (next) await user.click(next);
    }
    expect(dialog).toHaveTextContent("ベーコン を使うピザが作れそう！");
    expect(dialog).not.toHaveTextContent("ブレックファストピザ");
    await user.click(within(dialog).getByRole("button", { name: "閉じる" }));

    const after = JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!);
    const { pitzBalance, discoveryHintPurchases, ...rest } = after;
    expect(pitzBalance).toBe(300 - 75);
    expect(discoveryHintPurchases).toEqual({ "breakfast-pizza": 4 });
    const { pitzBalance: _p, discoveryHintPurchases: _d, ...restBefore } = JSON.parse(before!);
    void _p;
    void _d;
    expect(rest).toEqual(restBefore);
  });
});
