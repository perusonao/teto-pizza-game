import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./data/ingredients";

/**
 * LC-R5-c: the App-level, session-only pins (OD-R5-9) and the #197 no-clear contract, through the real App,
 * reducer and tray. Pin editing is dormant in production (`handEditing = HAND_ENFORCEMENT_ENABLED && an ACTIVE hand`,
 * the flag is false), so this file runs in the hand-on projects, where the UI exists only for an ACTIVE hand.
 * LC-R6-c (OD-R5e-1): the pin UI no longer exists for an INACTIVE hand, so these tests own every topping (an ACTIVE
 * hand at both candidates) and the inactive case is asserted in `App.handPinUi.handOn.test.tsx`.
 */
// LC-R5-e-h (H-2): no `vi.mock`; the `hand-on-9` / `hand-on-12` projects compile the real `handPolicy.ts` ON. `seedFree`
// owns every topping (> either candidate): the hand is ACTIVE. (`seedDinner` owns all of them too, so its FREE part has
// an ACTIVE hand; the Dinner round itself never has one.)

const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
// Active hand: the tray shows `capacity` ingredients in catalog order (basil first); the rest are reached through the pantry.
const EXTRA_TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping" && i.unlockCondition).map((i) => i.id);
const DM_A = ["margherita", "bismarck", "breakfast-pizza", "funghi"];

function seedFree() {
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
function seedDinner() {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: DM_A.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 })),
      pitzBalance: 300,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...FINITE],
      missionBest: {},
      inventory: Object.fromEntries(FINITE.map((id) => [id, 9])),
      unlockedForShopIngredientIds: FINITE,
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
  await user.click(screen.getByRole("button", { name: /レシピ発見/ }));
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
const pantryTile = (name: string) => {
  const list = screen.getByRole("region", { name: "所持している材料" });
  return within(list).getByRole("button", { name: new RegExp(name) });
};
async function openPantry(user: User) {
  await user.click(screen.getByRole("button", { name: /食材庫/ }));
  return screen.getByRole("dialog", { name: /食材庫/ });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
});

describe("LC-R5-c #197: a pin edit never clears a Builder selection that stays on the hand's page 0", () => {
  it("a pinned page-0 selection (basil) survives further pin / unpin / search / shelf edits in the pantry and still places", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    // With the full catalog owned the hand is ACTIVE and basil (a starter) is not guaranteed to be on it: pin it first.
    await openPantry(user);
    await user.click(pantryTile("バジル"));
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    await user.click(trayChip(/バジル/));
    expect(trayChip(/バジル/)).toHaveAttribute("aria-pressed", "true");
    const saveBefore = window.localStorage.getItem(SAVE_STORAGE_KEY);

    await openPantry(user);
    await user.click(pantryTile("たまねぎ"));
    expect(pantryTile("たまねぎ")).toHaveAttribute("aria-pressed", "true");
    await user.click(pantryTile("たまねぎ"));
    expect(pantryTile("たまねぎ")).toHaveAttribute("aria-pressed", "false");
    await user.type(screen.getByRole("searchbox", { name: "材料を検索" }), "に");
    await user.click(pantryTile("にんにく"));
    await user.clear(screen.getByRole("searchbox", { name: "材料を検索" }));
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    // Basil is pinned (priority) and first in catalog order: it stays on the hand's page 0, still selected.
    expect(trayChip(/バジル/)).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(saveBefore);
    const pieces = document.querySelectorAll(".pizza-topping").length;
    tapPizza(55, 45);
    expect(document.querySelectorAll(".pizza-topping").length).toBe(pieces + 1);
  });
});

describe("LC-R5-c App-level session-only pins (OD-R5-9)", () => {
  it("kept across a finished round, HOME and a FREE restart; never written to the save; gone after an app restart", async () => {
    seedFree();
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await toToppingStep(user);
    await openPantry(user);
    const saveBefore = window.localStorage.getItem(SAVE_STORAGE_KEY);
    await user.click(pantryTile("バジル")); // an ACTIVE hand does not always hold the starter basil: the finish below needs it
    await user.click(pantryTile("たまねぎ"));
    await user.click(pantryTile("オレガノ"));
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(saveBefore);
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    // Finish the round (bake -> RESULT).
    await user.click(trayChip(/バジル/));
    tapPizza(45, 60);
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
    await screen.findByText("NEW PIZZA! ✨");
    const saved = window.localStorage.getItem(SAVE_STORAGE_KEY)!;
    expect(saved).not.toMatch(/"(hand|pins?|handSession|pinSession)"/);

    // HOME, then a fresh FREE round: the pins are still there (a new round key, a new GameScreen).
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    await toToppingStep(user);
    await openPantry(user);
    expect(pantryTile("たまねぎ")).toHaveAttribute("aria-pressed", "true");
    expect(pantryTile("オレガノ")).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "選択中の材料" })).getAllByRole("button", { name: /を外す$/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "バジルを外す",
      "たまねぎを外す",
      "オレガノを外す",
    ]);

    // App restart (= reload): empty.
    unmount();
    render(<App />);
    await toToppingStep(user);
    await openPantry(user);
    expect(pantryTile("たまねぎ")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("group", { name: "選択中の材料" })).toBeNull();
  });

  it("kept across a mid-round HOME (confirmed) and a Dinner run; a Dinner round shows no pantry and no pin UI", async () => {
    seedDinner();
    window.history.replaceState({}, "", "/?dinnerDuration=120");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    await openPantry(user);
    await user.click(pantryTile("たまねぎ"));
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    await user.click(screen.getByRole("button", { name: /ホーム/ })); // mid-round: window.confirm -> true

    await user.click(screen.getByRole("button", { name: /ディナーミッション/ }));
    await user.click(screen.getByRole("button", { name: /ディナーミッション 1/ }));
    await user.click(screen.getByRole("button", { name: /スタート/ }));
    expect(screen.getByTestId("dinner-target-row")).toBeInTheDocument();
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(screen.queryByRole("button", { name: /食材庫/ })).toBeNull();
    expect(document.querySelector(".pantry-tile__toggle, .pantry-sheet__pins")).toBeNull();
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "やめる" }));

    await toToppingStep(user);
    await openPantry(user);
    expect(pantryTile("たまねぎ")).toHaveAttribute("aria-pressed", "true");
  });
});
