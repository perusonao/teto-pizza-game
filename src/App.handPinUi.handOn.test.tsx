import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { pickFirstResearchIfDexOpened } from "./test/discoveryEntry";

/**
 * LC-R6-c (OD-R5e-1), through the real App: the pantry's pin UI (tile toggles, 「選択中」 strip, the capacity-full status
 * region) exists ONLY while the category's hand is ACTIVE. Runs in the `hand-on-9` / `hand-on-12` projects (the real
 * `handPolicy.ts` compiled ON); the production build has the flag off, where the pantry stays the R5-b sheet.
 */
const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const FINITE_TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping" && i.unlockCondition).map((i) => i.id);

function seed(toppings: readonly string[]) {
  const owned = [...STARTER_INGREDIENT_IDS, ...toppings.filter((id) => !STARTER_INGREDIENT_IDS.includes(id))];
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: [],
      pitzBalance: 0,
      ownedIngredientIds: owned,
      missionBest: {},
      inventory: Object.fromEntries(owned.filter((id) => FINITE_TOPPINGS.includes(id)).map((id) => [id, 3])),
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
const trayChip = (name: RegExp) =>
  [...document.querySelectorAll<HTMLButtonElement>(".ingredient-chip")].find((b) => name.test(b.textContent ?? ""))!;

type User = ReturnType<typeof userEvent.setup>;
async function toToppingStep(user: User) {
  await user.click(screen.getByRole("button", { name: /レシピ発見/ }));
  await pickFirstResearchIfDexOpened(user);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    tapPizza(50 + Math.cos(angle) * 46.6, 50 + Math.sin(angle) * 46.6);
  }
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
async function openPantry(user: User) {
  await user.click(screen.getByRole("button", { name: /食材庫/ }));
  return screen.getByRole("dialog", { name: /食材庫/ });
}
const PIN_UI = ".pantry-tile__toggle, .pantry-tile--editable, .pantry-sheet__pins, .pantry-sheet__notice";

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("LC-R6-c (OD-R5e-1): the pantry pin UI exists only for an ACTIVE hand", () => {
  it("INACTIVE hand (8 toppings, within either capacity): the pantry is the read-only sheet -- no toggle, strip, status region", async () => {
    seed(TOPPINGS.slice(0, 8));
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const sheet = await openPantry(user);
    expect(within(sheet).getByRole("region", { name: "所持している材料" }).querySelectorAll("li.pantry-tile").length).toBeGreaterThan(6);
    expect(sheet.querySelector(PIN_UI)).toBeNull();
    expect(within(sheet).queryByRole("status")).toBeNull();
    // (the shelf chips are aria-pressed toggles of their own: only the LIST tiles must be read-only)
    expect(within(sheet).getByRole("region", { name: "所持している材料" }).querySelectorAll("[aria-pressed], button").length).toBe(0);
  });

  it("ACTIVE hand (the full topping catalog, more than either capacity): tile toggles and the empty status region exist", async () => {
    seed(TOPPINGS);
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const sheet = await openPantry(user);
    expect(sheet.querySelectorAll(".pantry-tile__toggle").length).toBe(TOPPINGS.length);
    const status = within(sheet).getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");
    expect(sheet.querySelector(".pantry-sheet__pins")).toBeNull(); // no pin yet: no strip
  });

  it("ACTIVE hand: filling the hand with pins refuses the next NEW pin with the notice, and writes no save", async () => {
    seed(TOPPINGS);
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const sheet = await openPantry(user);
    const saveBefore = window.localStorage.getItem(SAVE_STORAGE_KEY);
    const toggles = [...sheet.querySelectorAll<HTMLButtonElement>(".pantry-tile__toggle")];
    let refused = false;
    for (const toggle of toggles) {
      await user.click(toggle);
      if (within(sheet).getByRole("status").textContent) {
        refused = true;
        break;
      }
    }
    expect(refused).toBe(true);
    expect(within(sheet).getByRole("status")).toHaveTextContent("手元がいっぱいです。使わない食材のピンを外してね");
    expect(within(sheet).getByRole("status").textContent).not.toMatch(/[0-9０-９]/);
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(saveBefore);
    // unpinning one makes room again: the notice goes at once and the next NEW pin is accepted
    const strip = within(sheet).getByRole("group", { name: "選択中の材料" });
    await user.click(within(strip).getAllByRole("button", { name: /を外す$/ })[0]);
    expect(within(sheet).getByRole("status")).toHaveTextContent("");
  });
});
