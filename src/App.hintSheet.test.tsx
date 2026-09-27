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
 * Discovery Hint 3.0 (Issue #238, H3-3): from Dex 1 the sheet sells Selectable Hint facts; the save
 * changes by the debit and the fact ledger only, and the legacy ledger never moves.
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
  async function openSheet(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /フリークッキング/ }));
    const bar = document.querySelector(".prepare-bake-bar") as HTMLElement;
    await user.click(within(bar).getByRole("button", { name: "ヒント" }));
    return screen.getByRole("dialog", { name: /ヒント/ });
  }

  const cta = (dialog: HTMLElement) => dialog.querySelector<HTMLButtonElement>(".hint-sheet__next")!;

  it("opens from 「ヒント」, buys facts by preference, and the save changes only by the Pitz debit and the fact ledger", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(DEX2_SAVE));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);
    expect(before).toBeTruthy();

    // H0 + the free key only; the three preferences and the first price.
    expect(dialog).toHaveTextContent("今の材料で、まだ見つけていないピザが作れそう！");
    expect(dialog).toHaveTextContent("ベーコン");
    expect(dialog).not.toHaveTextContent("トマトソース");
    expect(within(dialog).getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["sauce", "cheese", "topping"]);
    expect(cta(dialog)).toHaveTextContent("5 Pitz");
    expect(dialog).toHaveTextContent("所持 300 Pitz");

    await user.click(within(dialog).getByRole("radio", { name: "チーズ" }));
    await user.click(cta(dialog));
    expect(dialog).toHaveTextContent("モッツァレラ");
    expect(dialog).not.toHaveTextContent("トマトソース");
    expect(cta(dialog)).toHaveTextContent("10 Pitz");
    // Still "cheese": nothing is left there, so the fallback (sauce) is sold -- not an error, no hint of absence.
    await user.click(cta(dialog));
    expect(dialog).toHaveTextContent("トマトソース");
    expect(dialog).toHaveTextContent("所持 285 Pitz");
    // Nothing left to sell: the generic guidance only, nothing charged.
    await user.click(cta(dialog));
    expect(dialog).toHaveTextContent("このピザは、今わかっているヒントを手がかりに考えてみよう！");
    expect(dialog).toHaveTextContent("所持 285 Pitz");
    expect(dialog).not.toHaveTextContent("ブレックファストピザ");
    expect(dialog).not.toHaveTextContent("たまご");
    await user.click(within(dialog).getByRole("button", { name: "閉じる" }));

    const after = JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!);
    const { pitzBalance, discoveryHintPurchases, discoveryHintFacts, ...rest } = after;
    expect(pitzBalance).toBe(300 - 15);
    expect(discoveryHintPurchases).toEqual({});
    expect(discoveryHintFacts).toEqual({ "breakfast-pizza": ["ing:mozzarella", "ing:tomato-sauce"] });
    expect(after.schemaVersion).toBe(2);
    const { pitzBalance: _p, discoveryHintFacts: _f, ...restBefore } = JSON.parse(before!);
    void _p;
    void _f;
    expect(rest).toEqual(restBefore);
  });

  it("a reload shows the bought fact again, never resells it, and keeps the next price", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(DEX2_SAVE));
    const user = userEvent.setup();
    const first = render(<App />);
    let dialog = await openSheet(user);
    await user.click(cta(dialog));
    expect(dialog).toHaveTextContent("トマトソース");
    first.unmount();

    render(<App />);
    dialog = await openSheet(user);
    expect(dialog).toHaveTextContent("トマトソース");
    expect(cta(dialog)).toHaveTextContent("10 Pitz");
    expect(dialog).toHaveTextContent("所持 295 Pitz");
    await user.click(cta(dialog));
    expect(dialog).toHaveTextContent("モッツァレラ");
    expect(JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!)).toMatchObject({
      pitzBalance: 285,
      discoveryHintFacts: { "breakfast-pizza": ["ing:tomato-sauce", "ing:mozzarella"] },
      discoveryHintPurchases: {},
    });
  });

  it("insufficient Pitz: the CTA is disabled and nothing is saved", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ ...DEX2_SAVE, pitzBalance: 4 }));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);
    expect(cta(dialog)).toBeDisabled();
    expect(dialog).toHaveTextContent("たまったら解除できるよ。このまま作ってもOK！");
    await user.click(cta(dialog));
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(before);
    expect(screen.getByRole("dialog", { name: /ヒント/ })).toBeInTheDocument();
  });

  it("a legacy Economy 1.0 save shows its bought lines (「以前のヒント」) and continues the price ladder", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ ...DEX2_SAVE, discoveryHintPurchases: { "breakfast-pizza": 3 } }));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    expect(dialog).toHaveTextContent("トマトソース");
    expect(dialog).toHaveTextContent("以前のヒント");
    expect(dialog).toHaveTextContent("材料は全部で4種類。チーズを使うみたい");
    expect(cta(dialog)).toHaveTextContent("40 Pitz");
    await user.click(cta(dialog));
    expect(JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!)).toMatchObject({
      pitzBalance: 260,
      discoveryHintPurchases: { "breakfast-pizza": 3 },
      discoveryHintFacts: { "breakfast-pizza": ["ing:mozzarella"] },
    });
  });
});
