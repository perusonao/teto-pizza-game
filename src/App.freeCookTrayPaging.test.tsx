import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";

/**
 * PR #197 review (Codex P2): in a free-cook round with more than one tray page, a selection made
 * on page 1 must not stay active once the player pages away and its chip is hidden. Otherwise
 * the next pizza tap would place an ingredient the player can no longer see, consuming finite
 * stock and changing what the pizza matches. Real App, real reducer, real localStorage.
 */

// Tray order follows INGREDIENTS: page 1 = basil, garlic, oregano, cherry-tomato, egg, mushroom;
// page 2 = onion, sausage.
const EXTRA_TOPPINGS = ["garlic", "oregano", "cherry-tomato", "egg", "mushroom", "onion", "sausage"];

function seed() {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: [],
      pitzBalance: 0,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...EXTRA_TOPPINGS],
      missionBest: {},
      inventory: Object.fromEntries(EXTRA_TOPPINGS.map((id) => [id, 3])),
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

function placedPieces(): number {
  return document.querySelectorAll(".pizza-topping").length;
}

const chip = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
  window.localStorage.clear();
  seed();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function toToppingStep(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole("button", { name: /フリークッキング/ }));
  completeDoughStep();
  await user.click(screen.getByRole("button", { name: /次へ/ }));
  await user.click(chip(/トマトソース/));
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    tapPizza(50 + Math.cos(angle) * 25, 50 + Math.sin(angle) * 25);
  }
  await user.click(screen.getByRole("button", { name: /次へ/ }));
  await user.click(chip(/モッツァレラ/));
  tapPizza(40, 50);
  tapPizza(60, 50);
  tapPizza(50, 30);
  await user.click(screen.getByRole("button", { name: /次へ/ }));
}

describe("free-cook tray paging never leaves a hidden selection active (PR #197 P2)", () => {
  it("select a finite page-1 ingredient, page away, tap the pizza: nothing is placed or consumed", async () => {
    const user = userEvent.setup();
    await toToppingStep(user);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await user.click(chip(/にんにく/));
    expect(chip(/にんにく/)).toHaveAttribute("aria-pressed", "true");
    const before = placedPieces();

    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.queryByRole("button", { name: /にんにく/ })).not.toBeInTheDocument();
    expect(document.querySelector(".ingredient-chip--selected")).toBeNull();

    tapPizza(45, 60);
    expect(placedPieces()).toBe(before);

    // A visible page-2 selection still works normally.
    await user.click(chip(/ソーセージ/));
    tapPizza(55, 45);
    expect(placedPieces()).toBe(before + 1);
  });

  it("the hidden ingredient does not change the pizza's discovery or its stock", async () => {
    const user = userEvent.setup();
    await toToppingStep(user);

    await user.click(chip(/バジル/));
    tapPizza(45, 60);
    tapPizza(58, 42);
    await user.click(chip(/にんにく/)); // finite, page 1
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    tapPizza(50, 70); // must not place garlic

    // Bake inside both the generic window and Margherita's own (see App.test.tsx's needle stub).
    let now = 0;
    let raf: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      raf = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.stubGlobal("performance", { now: () => now });
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    now += (70 / 55) * 1000;
    const cb = raf as FrameRequestCallback | null;
    raf = null;
    cb?.(now);
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    vi.unstubAllGlobals();

    // Margherita exactly -- not an ORIGINAL "margherita + garlic".
    expect(await screen.findByText(/NEW PIZZA!.*マルゲリータを発見しました！/)).toBeInTheDocument();
    const save = JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!);
    expect(save.inventory.garlic).toBe(3);
  });

  it("paging while the selection stays visible (or nothing is selected) keeps it", async () => {
    const user = userEvent.setup();
    await toToppingStep(user);
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    await user.click(chip(/ソーセージ/));
    // Clicking the disabled "next" on the last page is a no-op and must not clear anything.
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(chip(/ソーセージ/)).toHaveAttribute("aria-pressed", "true");
  });
});
