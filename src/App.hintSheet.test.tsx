import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

  /** DH4-2C U3-C: the 材料 request lives on the transient 「ヒントをもらう」 panel. */
  const cta = (dialog: HTMLElement) => dialog.querySelector<HTMLButtonElement>('.hint-sheet__card[data-hint-family="material"] .hint-sheet__next')!;

  /** Opens the 「ヒントをもらう」 panel (if the board is showing) and waits out the request latch. */
  async function openPanel(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    if (!dialog.querySelector(".hint-sheet__panel")) {
      const entry = within(dialog).getByRole("button", { name: "ヒントをもらう" });
      // Right after an answer the request latch also covers 「ヒントをもらう」 (a double tap never reopens).
      await waitFor(() => expect(entry).not.toHaveAttribute("aria-disabled"), { timeout: 2000 });
      await user.click(entry);
    }
    await waitFor(() => expect(cta(dialog)).not.toHaveAttribute("aria-disabled"), { timeout: 2000 });
  }

  /** One 材料 request like a player: open the panel, tap 「たずねる」. An answer returns to the board;
   *  a no-charge outcome stays on the panel. */
  async function buy(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    await openPanel(user, dialog);
    await user.click(cta(dialog));
  }

  const backToBoard = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) =>
    user.click(within(dialog).getByRole("button", { name: /もどる/ }));

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
    // DH4-2C U3-C: the board's footer is 「ヒントをもらう」 only; the panel has the family cards (Vitest
    // is a DEV build, so the E3 flag shows 構成 / 特徴 too) and the 材料 preferences with 「おまかせ」.
    expect(within(dialog).queryAllByRole("radio")).toHaveLength(0);
    expect(dialog).toHaveTextContent("所持 300 Pitz");
    await openPanel(user, dialog);
    expect([...dialog.querySelectorAll(".hint-sheet__card")].map((c) => c.getAttribute("data-hint-family"))).toEqual(["material", "structure", "attribute"]);
    expect(within(dialog).getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["any", "sauce", "cheese", "topping"]);
    expect(cta(dialog)).toHaveTextContent("5 Pitz");

    await user.click(within(dialog).getByRole("radio", { name: "チーズ" }));
    await buy(user, dialog);
    // An answer returns to the board, with the new fact.
    await waitFor(() => expect(dialog.querySelector(".hint-sheet__panel")).toBeNull());
    expect(dialog).toHaveTextContent("モッツァレラ");
    expect(dialog).not.toHaveTextContent("トマトソース");
    await openPanel(user, dialog);
    expect(cta(dialog)).toHaveTextContent("10 Pitz");
    // Still "cheese" (the preference is kept for this sheet): nothing is left there, so the fallback (sauce) is sold -- not an error, no hint of absence.
    await buy(user, dialog);
    expect(dialog).toHaveTextContent("トマトソース");
    expect(dialog).toHaveTextContent("所持 285 Pitz");
    // Nothing left to sell: nothing charged; the panel stays, and (H3-4, OD-H3-4-3) only now, after
    // the reducer answered GUIDANCE_ONLY, the 材料 card stops.
    await buy(user, dialog);
    await waitFor(() => expect(dialog).toHaveTextContent("材料ヒントはここまで（Pitzは使っていないよ）"));
    expect(cta(dialog)).toBeNull();
    expect(dialog).toHaveTextContent("所持 285 Pitz");
    await backToBoard(user, dialog);
    expect(dialog).toHaveTextContent("このピザは、今わかっているヒントを手がかりに考えてみよう！");
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
    await buy(user, dialog);
    await waitFor(() => expect(dialog).toHaveTextContent("トマトソース"));
    first.unmount();

    render(<App />);
    dialog = await openSheet(user);
    expect(dialog).toHaveTextContent("トマトソース");
    expect(dialog).toHaveTextContent("所持 295 Pitz");
    await openPanel(user, dialog);
    expect(cta(dialog)).toHaveTextContent("10 Pitz");
    await buy(user, dialog);
    await waitFor(() => expect(dialog).toHaveTextContent("モッツァレラ"));
    expect(JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!)).toMatchObject({
      pitzBalance: 285,
      discoveryHintFacts: { "breakfast-pizza": ["ing:tomato-sauce", "ing:mozzarella"] },
      discoveryHintPurchases: {},
    });
  });

  it("H3-3: a double-click or a burst of taps on the CTA buys exactly one fact", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(DEX2_SAVE));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    await openPanel(user, dialog);
    const first = cta(dialog);
    await user.dblClick(first);
    // The answer returned to the board with focus on 「ヒントをもらう」; the stray second tap and more
    // taps / Enter within the latch neither buy nor reopen the panel.
    const entry = within(dialog).getByRole("button", { name: "ヒントをもらう" });
    expect(dialog.querySelector(".hint-sheet__panel")).toBeNull();
    expect(entry).toHaveFocus();
    await user.click(entry);
    await user.keyboard("{Enter}{Enter}");
    expect(dialog.querySelector(".hint-sheet__panel")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!)).toMatchObject({
      pitzBalance: 295,
      discoveryHintFacts: { "breakfast-pizza": ["ing:tomato-sauce"] },
    });
    expect(dialog).toHaveTextContent("所持 295 Pitz");
    // Once the latch releases, the next deliberate tap buys the next fact at the next price.
    await buy(user, dialog);
    await waitFor(() => expect(dialog.querySelector(".hint-sheet__panel")).toBeNull());
    expect(JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!).pitzBalance).toBe(285);
  });

  it("insufficient Pitz: the CTA is disabled and nothing is saved", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ ...DEX2_SAVE, pitzBalance: 4 }));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);
    await user.click(within(dialog).getByRole("button", { name: "ヒントをもらう" }));
    expect(cta(dialog)).toBeDisabled();
    expect(dialog).toHaveTextContent("Pitzがたまったら、またためしてね。このまま作ってもOK！");
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
    await openPanel(user, dialog);
    expect(cta(dialog)).toHaveTextContent("40 Pitz");
    await buy(user, dialog);
    await waitFor(() => expect(dialog.querySelector(".hint-sheet__panel")).toBeNull());
    expect(JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!)).toMatchObject({
      pitzBalance: 260,
      discoveryHintPurchases: { "breakfast-pizza": 3 },
      discoveryHintFacts: { "breakfast-pizza": ["ing:mozzarella"] },
    });
  });

  // H3-4 (Issue #238, OD-H3-4-1/3): capricciosa, a legacy Economy 1.0 H1 buyer. Cap parity (75):
  // 10 + 20 + 40 are paid, then the cap is reached while one real fact is still for sale. That fact
  // must still be obtainable at 「支払いずみ」 (never pre-disabled), and only the following request
  // answers GUIDANCE_ONLY, charges nothing and stops the CTA.
  const LADDER11 = [
    ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
    ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
    ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ] as const;
  const DEX11_MATERIALS = [...LADDER11.flatMap(([, m]) => m), "black-olive", "oregano"];
  const DEX11_SAVE = {
    schemaVersion: 2,
    dex: LADDER11.map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 200,
    discoveryHintPurchases: { capricciosa: 1 },
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...DEX11_MATERIALS],
    missionBest: {},
    inventory: Object.fromEntries(DEX11_MATERIALS.map((m) => [m, 10])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: DEX11_MATERIALS,
  };
  const chips = (dialog: HTMLElement) => dialog.querySelectorAll(".hint-sheet__chip:not(.hint-sheet__chip--unknown)").length;
  const saved = () => JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!);

  it("H3-4: a legacy buyer at the cap gets the remaining real fact at 「支払いずみ」 (0 Pitz); only then GUIDANCE_ONLY stops the CTA", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(DEX11_SAVE));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    await openPanel(user, dialog);
    expect(cta(dialog).textContent).toBe("たずねる 10 Pitz");
    for (const price of [10, 20, 40]) {
      await buy(user, dialog);
      await waitFor(() => expect(saved().pitzBalance).toBeLessThanOrEqual(200 - price));
      await waitFor(() => expect(dialog.querySelector(".hint-sheet__panel")).toBeNull());
    }
    expect(saved().pitzBalance).toBe(200 - 10 - 20 - 40);
    const before = chips(dialog);

    // Cap reached, one real fact left: the CTA is a request, enabled, and never says 0 Pitz / free.
    await openPanel(user, dialog);
    expect(cta(dialog).textContent).toBe("たずねる 支払いずみ");
    expect(cta(dialog)).toBeEnabled();
    expect(dialog).toHaveTextContent("このピザのヒント代は上限まで支払いずみ");
    await buy(user, dialog);
    await waitFor(() => expect(chips(dialog)).toBe(before + 1));
    expect(dialog.querySelectorAll(".hint-sheet__chip--new")).toHaveLength(1);
    expect(saved().pitzBalance).toBe(130);
    expect(saved().discoveryHintFacts.capricciosa).toHaveLength(4);
    expect(saved().discoveryHintPurchases).toEqual({ capricciosa: 1 });
    expect(dialog.querySelector(".hint-sheet__guidance")).toBeNull();

    // Same wording again (the view cannot tell that nothing is left) -> this time GUIDANCE_ONLY.
    await openPanel(user, dialog);
    expect(cta(dialog).textContent).toBe("たずねる 支払いずみ");
    expect(cta(dialog)).toBeEnabled();
    const snapshot = window.localStorage.getItem(SAVE_STORAGE_KEY);
    await user.click(cta(dialog));
    await waitFor(() => expect(dialog).toHaveTextContent("材料ヒントはここまで（Pitzは使っていないよ）"));
    expect(cta(dialog)).toBeNull();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(snapshot);

    // Re-operating after the guidance changes nothing: focus is on もどる (the card's request is gone),
    // so Enter returns to the board, and a second Enter on 「ヒントをもらう」 within the latch is ignored.
    expect(within(dialog).getByRole("button", { name: /もどる/ })).toHaveFocus();
    await user.keyboard("{Enter}{Enter}");
    expect(dialog.querySelector(".hint-sheet__panel")).toBeNull();
    expect(dialog.querySelector(".hint-sheet__guidance")).not.toBeNull();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(snapshot);
    expect(chips(dialog)).toBe(before + 1);
    expect(screen.getByRole("dialog", { name: /ヒント/ })).toBeInTheDocument();

    // Close and reopen: the outcome is transient; the request is offered again, still without Pitz.
    await user.click(within(dialog).getByRole("button", { name: "閉じる" }));
    const bar = document.querySelector(".prepare-bake-bar") as HTMLElement;
    await user.click(within(bar).getByRole("button", { name: "ヒント" }));
    const reopened = screen.getByRole("dialog", { name: /ヒント/ });
    expect(reopened.querySelector(".hint-sheet__guidance")).toBeNull();
    await openPanel(user, reopened);
    expect(cta(reopened).textContent).toBe("たずねる 支払いずみ");
    expect(cta(reopened)).toBeEnabled();
    expect(reopened.querySelector(".hint-sheet__guidance")).toBeNull();
    expect(reopened.querySelectorAll(".hint-sheet__chip--new")).toHaveLength(0);
  });
});
