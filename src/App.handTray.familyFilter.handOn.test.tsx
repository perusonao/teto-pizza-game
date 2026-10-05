import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { pickFirstResearchIfDexOpened } from "./test/discoveryEntry";
import { ingredientShelf, ingredientShelfLabel } from "./data/ingredientShelf";

/**
 * Issue #396 (Codex P2 on PR #397): a HAND change made through the Pantry judges the selection against the page the
 * player actually sees. With a tray family filter active, page 1 is the FILTERED first page, so a selected ingredient
 * that is on it survives a pin; one that truly leaves the hand (or the filtered page) is still cleared.
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
const trayNames = () => [...document.querySelectorAll(".ingredient-chip__name")].map((n) => n.textContent ?? "");
const pageLabel = () => document.querySelector(".ingredient-page-nav__label")?.textContent ?? "";
const selectedName = () => document.querySelector(".ingredient-chip--selected .ingredient-chip__name")?.textContent ?? null;
async function bothPages(user: User): Promise<string[][]> {
  const first = trayNames();
  await user.click(screen.getByRole("button", { name: "次のページ" }));
  const second = trayNames();
  await user.click(screen.getByRole("button", { name: "前のページ" }));
  return [first, second];
}
const exactTile = (name: string) => {
  const li = [...document.querySelectorAll<HTMLElement>(".pantry-tile")].find((el) => el.querySelector(".pantry-tile__name")?.textContent === name);
  if (!li) throw new Error(`pantry tile ${name} missing`);
  return within(li).getByRole("button");
};
const chipByName = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".ingredient-chip")].find((b) => b.querySelector(".ingredient-chip__name")?.textContent === name)!;
const stripPins = () =>
  screen.queryByRole("group", { name: "選択中の材料" })
    ? within(screen.getByRole("group", { name: "選択中の材料" })).getAllByRole("button", { name: /を外す$/ }).length
    : 0;
async function openPantry(user: User) {
  await user.click(screen.getByRole("button", { name: /食材庫/ }));
}
const closePantry = (user: User) => user.click(screen.getByRole("button", { name: "閉じる" }));

async function toToppingStep(user: User) {
  await user.click(screen.getByRole("button", { name: /レシピ発見/ }));
  await pickFirstResearchIfDexOpened(user);
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


const idOf = (name: string) => INGREDIENTS.find((i) => i.nameJa === name)!.id;
const familyOfName = (name: string) => ingredientShelf(idOf(name));
const familyChip = (family: string) =>
  screen.getByRole("button", { name: `${ingredientShelfLabel(family as never)}の具材だけ表示` });
const familyPressed = () =>
  document.querySelector(".tray-family-chip[aria-pressed='true']")?.getAttribute("data-tray-family") ?? null;

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
});

async function setup() {
  seedFree();
  const user = userEvent.setup();
  render(<App />);
  await toToppingStep(user);
  const [p1, p2] = await bothPages(user);
  const outside = TOPPINGS.map((t) => t.nameJa).find((n) => ![...p1, ...p2].includes(n))!;
  return { user, p1, p2, outside };
}

describe("tray family filter x HAND change through the Pantry (Issue #396 / PR #397 Codex P2)", () => {
  it("keeps a selection that is on the filtered first page although it is not on the unfiltered first page", async () => {
    const { user, p1, p2, outside } = await setup();
    const hand = [...p1, ...p2];
    // An item on the unfiltered SECOND page whose family has it within the filtered first page.
    const target = p2.find((n) => {
      const f = familyOfName(n);
      return f && hand.filter((h) => familyOfName(h) === f).indexOf(n) < 6;
    })!;
    const family = familyOfName(target)!;
    await user.click(familyChip(family));
    expect(familyPressed()).toBe(family);
    expect(trayNames()).toContain(target); // filtered page 1
    expect(p1).not.toContain(target); // ... and it is not on the unfiltered page 1
    await user.click(chipByName(target));
    expect(selectedName()).toBe(target);

    await openPantry(user);
    await user.click(exactTile(outside)); // pin an outside ingredient: the HAND changes
    await closePantry(user);

    expect(familyPressed()).toBe(family); // the filter is display state and survives
    expect(pageLabel().startsWith("1 /")).toBe(true);
    expect(trayNames()).toContain(target);
    expect(selectedName()).toBe(target); // the P2 case: no longer cleared by the unfiltered rule
  });

  it("still clears a selection that truly leaves the hand (the filtered page no longer holds it)", async () => {
    const { user, p1, outside } = await setup();
    const displaced = p1[0]; // the lowest-priority automatic item is the one the pin displaces (see OD-R5d-1 test)
    const family = familyOfName(displaced)!;
    await user.click(familyChip(family));
    await user.click(chipByName(displaced));
    expect(selectedName()).toBe(displaced);

    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);

    const [n1, n2] = [trayNames(), []];
    expect([...n1, ...n2]).not.toContain(displaced); // it left the hand (and so the filtered page)
    expect(selectedName()).toBeNull();
    // (the family may have vanished with its last member, in which case the filter reads すべて)
    expect([family, "all"]).toContain(familyPressed());
  });

  it("an unfiltered tray keeps today's rule (selection off the new page 0 is cleared)", async () => {
    const { user, p2, outside } = await setup();
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    await user.click(chipByName(p2[p2.length - 1]));
    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);
    expect(familyPressed()).toBe("all");
    expect(selectedName()).toBeNull();
  });

  it("switching the family still clears a selection the new filter hides, and keeps pins", async () => {
    const { user, outside } = await setup();
    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);
    const shown = trayNames();
    const keep = shown[0];
    await user.click(chipByName(keep));
    const offered = [...document.querySelectorAll(".tray-family-chip")].map((c) => c.getAttribute("data-tray-family")!);
    const otherFamily = offered.find((f) => f !== "all" && f !== familyOfName(keep))!;
    await user.click(familyChip(otherFamily));
    expect(selectedName()).toBeNull(); // hidden by the filter: cleared (#397 contract)
    await openPantry(user);
    expect(stripPins()).toBe(1); // the pin survived the filter change
    await closePantry(user);
  });
});
