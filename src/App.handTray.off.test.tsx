import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./data/ingredients";

/**
 * LC-R5-d OFF equivalence through the real App: the SHIPPED flag (`HAND_ENFORCEMENT_ENABLED = false`, no mock).
 * With 22 toppings owned the FREE Cooking tray is exactly today's paged tray (catalog order, 4 pages, everything
 * reachable by paging), the selection rules of PR #197 are untouched, and the pantry shows no pin UI.
 */
const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping");

function seedFree(stock = 3) {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: [],
      pitzBalance: 0,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...TOPPINGS.map((t) => t.id)],
      missionBest: {},
      inventory: Object.fromEntries(TOPPINGS.filter((t) => t.unlockCondition).map((t) => [t.id, stock])),
      starterGrantClaimedRecipeIds: [],
    }),
  );
}
function dough(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!el) throw new Error("Pizza dough missing");
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  return el;
}
function tapPizza(xPercent: number, yPercent: number) {
  const el = dough();
  const clientX = (xPercent / 100) * 300;
  const clientY = (yPercent / 100) * 300;
  const pointerId = Math.floor(Math.random() * 1_000_000);
  fireEvent.pointerDown(el, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
  fireEvent.pointerUp(el, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
}
function completeDoughStep() {
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    tapPizza(50 + Math.cos(angle) * 46.6, 50 + Math.sin(angle) * 46.6);
  }
}
type User = ReturnType<typeof userEvent.setup>;
const trayChip = (name: RegExp) =>
  [...document.querySelectorAll<HTMLButtonElement>(".ingredient-chip")].find((b) => name.test(b.textContent ?? ""))!;
async function toToppingStep(user: User) {
  await user.click(screen.getByRole("button", { name: /フリークッキング/ }));
  completeDoughStep();
  await user.click(screen.getByRole("button", { name: /次へ/ }));
  await user.click(trayChip(/トマトソース/));
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    tapPizza(50 + Math.cos(angle) * 25, 50 + Math.sin(angle) * 25);
  }
  await user.click(screen.getByRole("button", { name: /次へ/ }));
  await user.click(trayChip(/モッツァレラ/));
  tapPizza(40, 50);
  tapPizza(60, 50);
  tapPizza(50, 30);
  await user.click(screen.getByRole("button", { name: /次へ/ }));
}

const trayNames = () => [...document.querySelectorAll(".ingredient-chip__name")].map((n) => n.textContent ?? "");
const pageLabel = () => document.querySelector(".ingredient-page-nav__label")?.textContent ?? "";
const chipByName = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".ingredient-chip")].find((b) => b.querySelector(".ingredient-chip__name")?.textContent === name)!;

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("LC-R5-d OFF equivalence (shipped flag = false)", () => {
  it("FREE Cooking with 22 toppings keeps today's tray: 4 pages in catalog order; #197 clears on a page switch; the pantry has no pin UI and never touches the tray", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    expect(pageLabel()).toBe("1 / 4");
    const all: string[] = [];
    for (let page = 0; page < 4; page += 1) {
      all.push(...trayNames());
      if (page < 3) await user.click(screen.getByRole("button", { name: "次のページ" }));
    }
    expect(all).toEqual(TOPPINGS.map((t) => t.nameJa));
    // On page 4: select, open / search / close the pantry: nothing moves or clears.
    await user.click(chipByName(all[all.length - 1]));
    const before = JSON.stringify({ names: trayNames(), page: pageLabel(), selected: document.querySelector(".ingredient-chip--selected")?.textContent });
    await user.click(screen.getByRole("button", { name: /食材庫/ }));
    expect(document.querySelector(".pantry-tile__toggle, .pantry-sheet__pins, .pantry-tile__pin-badge")).toBeNull();
    for (const tile of document.querySelectorAll(".pantry-tile")) await user.click(tile);
    await user.type(screen.getByRole("searchbox", { name: "材料を検索" }), "に");
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(JSON.stringify({ names: trayNames(), page: pageLabel(), selected: document.querySelector(".ingredient-chip--selected")?.textContent })).toBe(before);
    // Leaving the page still clears the selection (the existing PR #197 rule).
    await user.click(screen.getByRole("button", { name: "前のページ" }));
    expect(document.querySelector(".ingredient-chip--selected")).toBeNull();
    expect(within(document.body).queryByRole("group", { name: "選択中の材料" })).toBeNull();
  });
});
