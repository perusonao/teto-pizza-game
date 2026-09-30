import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { DEFAULT_HAND_CAPACITY_CANDIDATE, HAND_ENFORCEMENT_ENABLED } from "./logic/catalog/handPolicy";

/**
 * LC-R5-e-h: activation hardening through the real App / reducer / tray / pantry with the REAL `handPolicy.ts`
 * compiled ON by the `hand-on-9` / `hand-on-12` Vitest projects (no `vi.mock`). Production keeps the flag false.
 *
 * - H-1: the #197 safety condition is asserted on the SIDE EFFECT: after a pin changes the hand and the selection
 *   leaves the new page 0, a pizza tap places NOTHING (an absent selected chip alone proves nothing: a hidden
 *   selection has no chip either).
 * - H-3: round / step transitions are not hand changes (behaviour; the structural gate is in catalogBoundary).
 * - H-4: after every step of an activation sequence, a selection is either visible on the current page or absent,
 *   and "absent" is again proven by the placement side effect.
 * - H-5 (App side): the precondition that keeps "hand inactive -> active within one step" unreachable.
 * - H-6: lifecycle (stock 1 -> 0, zero-stock pin, next FREE round, HOME -> FREE, guided / Lunch Rush / Dinner).
 * - H-7: an unpin never restores a selection a pin cleared (current spec; R6 Human Feel observation item).
 */
const CAP = DEFAULT_HAND_CAPACITY_CANDIDATE;
const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping");
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const FINITE_TOPPINGS = TOPPINGS.filter((t) => t.unlockCondition);
const nameOf = (id: string) => INGREDIENTS.find((i) => i.id === id)!.nameJa;
const catalogRank = (name: string) => INGREDIENTS.findIndex((i) => i.nameJa === name);

/** 22 toppings owned. `last` are acquired last (= the top of the "new" tier, so they are on the hand). */
function seedFree(options: { stock?: number; stockOf?: Record<string, number>; last?: string[]; dex?: unknown[] } = {}) {
  const { stock = 5, stockOf = {}, last = [], dex = [] } = options;
  const toppingIds = TOPPINGS.map((t) => t.id).filter((id) => !last.includes(id));
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex,
      pitzBalance: 0,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...toppingIds, ...last],
      missionBest: {},
      inventory: Object.fromEntries(FINITE_TOPPINGS.map((t) => [t.id, stockOf[t.id] ?? stock])),
      starterGrantClaimedRecipeIds: [],
    }),
  );
}
function seedDinner() {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: ["margherita", "bismarck", "breakfast-pizza", "funghi"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 300,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...FINITE],
      missionBest: {},
      inventory: Object.fromEntries(FINITE.map((id) => [id, 9])),
      unlockedForShopIngredientIds: FINITE,
    }),
  );
}
const MARGHERITA_DEX = [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }];

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
/** Distinct spots inside the sauce area, handed out one at a time (a spot is never reused within a test). */
function spots() {
  const all: [number, number][] = [];
  for (let y = 30; y <= 70; y += 8) for (let x = 30; x <= 70; x += 8) all.push([x, y]);
  let next = 0;
  return () => {
    if (next >= all.length) throw new Error("out of fresh spots");
    return all[next++];
  };
}

type User = ReturnType<typeof userEvent.setup>;
const trayChip = (name: RegExp) =>
  [...document.querySelectorAll<HTMLButtonElement>(".ingredient-chip")].find((b) => name.test(b.textContent ?? ""))!;
const chipByName = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".ingredient-chip")].find((b) => b.querySelector(".ingredient-chip__name")?.textContent === name);
const trayNames = () => [...document.querySelectorAll(".ingredient-chip__name")].map((n) => n.textContent ?? "");
const pageLabel = () => document.querySelector(".ingredient-page-nav__label")?.textContent ?? "";
const selectedName = () => document.querySelector(".ingredient-chip--selected .ingredient-chip__name")?.textContent ?? null;
const pieces = (id?: string) => document.querySelectorAll(id ? `.pizza-topping--${id}` : ".pizza-topping").length;
const nextButton = () => screen.queryByRole("button", { name: "次のページ" });
const prevButton = () => screen.queryByRole("button", { name: "前のページ" });
const exactTile = (name: string) => {
  const li = [...document.querySelectorAll<HTMLElement>(".pantry-tile")].find((el) => el.querySelector(".pantry-tile__name")?.textContent === name);
  if (!li) throw new Error(`pantry tile ${name} missing`);
  return within(li).getByRole("button");
};
const openPantry = (user: User) => user.click(screen.getByRole("button", { name: /食材庫/ }));
const closePantry = (user: User) => user.click(screen.getByRole("button", { name: "閉じる" }));

/** Reads both pages and comes back to page 1. Never call it with a selection that matters (a page switch is #197). */
async function bothPages(user: User): Promise<[string[], string[]]> {
  if (pageLabel().startsWith("2")) await user.click(prevButton()!);
  const first = trayNames();
  if (!nextButton() || nextButton()!.hasAttribute("disabled")) return [first, []];
  await user.click(nextButton()!);
  const second = trayNames();
  await user.click(prevButton()!);
  return [first, second];
}

async function toToppingStep(user: User, entry: RegExp = /フリークッキング/) {
  await user.click(screen.getByRole("button", { name: entry }));
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

/** Bake the current pizza and land on RESULT (same fake clock as App.handPins). */
async function bakeToResult(user: User) {
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
  await screen.findByRole("button", { name: "もう一度じゆうに作る" });
}

/**
 * H-4 invariant: a selection is either a chip on the CURRENT page, or there is none -- and "none" is proven by the
 * side effect (a tap on a fresh spot places nothing), because a hidden `selectedIngredientId` renders no chip either.
 */
function assertSelectionOnVisiblePage(fresh: () => [number, number], label: string) {
  const selected = selectedName();
  if (selected !== null) {
    expect(trayNames(), `${label}: the selected chip is on the visible page`).toContain(selected);
    expect(document.querySelectorAll(".ingredient-chip--selected"), `${label}: one selected chip`).toHaveLength(1);
    return;
  }
  const before = pieces();
  tapPizza(...fresh());
  expect(pieces(), `${label}: no visible selection, so a tap must place nothing (a hidden selection would)`).toBe(before);
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
});

describe(`LC-R5-e-h activation hardening (real handPolicy ON, capacity ${CAP})`, () => {
  it("runs with the real flag ON (the hand-on project transform applied)", () => {
    expect(HAND_ENFORCEMENT_ENABLED).toBe(true);
  }, 60_000);

  it("H-1: page-2 selection -> pin changes the hand -> page 0, selection cleared -> a pizza tap places NOTHING", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const fresh = spots();
    const [p1, p2] = await bothPages(user);
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => ![...p1, ...p2].includes(n))!;
    const target = p2[p2.length - 1];
    const targetId = INGREDIENTS.find((i) => i.nameJa === target)!.id;

    await user.click(nextButton()!);
    await user.click(chipByName(target)!);
    expect(selectedName()).toBe(target);
    // Positive control: the probe CAN place (the selection is live, the spot is valid).
    tapPizza(...fresh());
    expect(pieces(targetId)).toBe(1);

    await openPantry(user);
    await user.click(exactTile(outside)); // an actual membership change (Model C: fits, a slot is displaced)
    await closePantry(user);
    expect(pageLabel()).toBe("1 / 2");
    expect(trayNames()).not.toContain(target); // the selection is not on the new page 0 ...
    expect(selectedName()).toBeNull();

    // ... so the SIDE EFFECT must be zero: nothing is placed, of the old selection or of anything else.
    const total = pieces();
    const spot = fresh();
    tapPizza(...spot);
    expect(pieces(targetId)).toBe(1);
    expect(pieces()).toBe(total);
    // The same spot accepts a piece for a VISIBLE selection (the zero above is not a rejected spot).
    const visible = trayNames()[0];
    const visibleId = INGREDIENTS.find((i) => i.nameJa === visible)!.id;
    await user.click(chipByName(visible)!);
    tapPizza(...spot);
    expect(pieces(visibleId)).toBeGreaterThanOrEqual(1);
    expect(pieces()).toBe(total + 1);
  }, 60_000);

  it("H-7: an unpin that restores the previous hand does NOT restore the selection the pin cleared (R6 observation)", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const fresh = spots();
    const [p1, p2] = await bothPages(user);
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => ![...p1, ...p2].includes(n))!;
    const target = p2[p2.length - 1];
    await user.click(nextButton()!);
    await user.click(chipByName(target)!);

    await openPantry(user);
    await user.click(exactTile(outside)); // pin: the hand changes, the selection is cleared
    await user.click(exactTile(outside)); // unpin: the hand is the same set as before
    await closePantry(user);

    expect(pageLabel()).toBe("1 / 2");
    expect(selectedName()).toBeNull();
    assertSelectionOnVisiblePage(fresh, "after pin + unpin"); // not restored, not hidden
    const [n1, n2] = await bothPages(user);
    expect([...n1, ...n2]).toEqual([...p1, ...p2]); // the hand itself is back
    expect(selectedName()).toBeNull(); // page 2 shows no restored selection either
    await user.click(nextButton()!);
    expect(selectedName()).toBeNull();
  }, 60_000);

  it("H-4: selection-on-visible-page invariant after EVERY step of scripted and seeded activation sequences", async () => {
    seedFree({ stock: 99 });
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const fresh = spots();
    const toppingNames = TOPPINGS.map((t) => t.nameJa);
    let step = 0;
    const check = () => assertSelectionOnVisiblePage(fresh, `step ${step++}`);

    // Scripted: the H-1 shape, then reset-to-auto, then a priority-only pin, each followed by the invariant.
    const [p1, p2] = await bothPages(user);
    const outside = toppingNames.filter((n) => ![...p1, ...p2].includes(n));
    await user.click(nextButton()!);
    await user.click(chipByName(p2[0])!);
    check();
    await openPantry(user);
    await user.click(exactTile(outside[0]));
    await closePantry(user);
    check();
    await user.click(chipByName(trayNames()[1])!);
    check();
    await openPantry(user);
    await user.click(exactTile(outside[1]));
    await user.click(screen.getByRole("button", { name: "おまかせに戻す" }));
    await closePantry(user);
    check();
    await user.click(chipByName(trayNames()[0])!);
    await openPantry(user);
    await user.click(exactTile(trayNames()[0] ?? p1[0]));
    await closePantry(user);
    check();

    // Seeded: select / page / pin (inside or outside the hand) / unpin / reset / place, invariant after each op.
    let seed = 20261001 + CAP;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
    for (let i = 0; i < 24; i += 1) {
      const op = rand(6);
      const chips = [...document.querySelectorAll<HTMLButtonElement>(".ingredient-chip:not([disabled])")];
      if (op === 0 && chips.length > 0) await user.click(chips[rand(chips.length)]);
      else if (op === 1 && nextButton() && !nextButton()!.hasAttribute("disabled")) await user.click(nextButton()!);
      else if (op === 2 && prevButton() && !prevButton()!.hasAttribute("disabled")) await user.click(prevButton()!);
      else if (op === 3 || op === 4) {
        await openPantry(user);
        await user.click(exactTile(toppingNames[rand(toppingNames.length)]));
        if (op === 4 && screen.queryByRole("button", { name: "おまかせに戻す" })) await user.click(screen.getByRole("button", { name: "おまかせに戻す" }));
        await closePantry(user);
      } else if (op === 5 && selectedName() !== null) tapPizza(...fresh());
      check();
      const names = trayNames();
      expect(names.map(catalogRank)).toEqual([...names.map(catalogRank)].sort((a, b) => a - b));
    }
  }, 90_000);

  it("H-3: step and round transitions are not hand changes (no extra page / selection effect beyond the existing resets)", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    // Step entry (CHEESE -> TOPPING): page 1, nothing selected, the hand as resolved.
    expect(pageLabel()).toBe("1 / 2");
    expect(selectedName()).toBeNull();
    const [p1, p2] = await bothPages(user);
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => ![...p1, ...p2].includes(n))!;
    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);
    const [h1, h2] = await bothPages(user);
    await user.click(chipByName(h1[0])!);
    tapPizza(45, 55);

    // Round transition (RESULT -> next FREE round): the pins survive, the new round's tray is the same hand minus
    // nothing, on page 1, with nothing selected -- and the first chip tap selects normally (no stale transition).
    await bakeToResult(user);
    await user.click(screen.getByRole("button", { name: "もう一度じゆうに作る" }));
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(trayChip(/トマトソース/));
    expect(selectedName()).toBe("トマトソース");
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      tapPizza(50 + Math.cos(angle) * 25, 50 + Math.sin(angle) * 25);
    }
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(trayChip(/モッツァレラ/));
    expect(selectedName()).toBe("モッツァレラ");
    tapPizza(40, 50);
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(pageLabel()).toBe("1 / 2");
    expect(selectedName()).toBeNull();
    const [r1, r2] = await bothPages(user);
    expect([...r1, ...r2]).toEqual([...h1, ...h2]);
    expect([...r1, ...r2]).toContain(outside);
    await user.click(chipByName(r1[1])!);
    expect(selectedName()).toBe(r1[1]);
  }, 60_000);

  it("H-5 (precondition): the cooking screen offers no Shop / Dex / inventory entry during PREPARE, so ownership and stock cannot change mid-step", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    const buttonNames = () => screen.getAllByRole("button").map((b) => `${b.getAttribute("aria-label") ?? ""} ${b.textContent ?? ""}`);
    // Positive control: HOME does offer them, so the patterns below are not vacuous.
    expect(buttonNames().some((n) => /ショップ/.test(n))).toBe(true);
    expect(buttonNames().some((n) => /図鑑/.test(n))).toBe(true);
    await toToppingStep(user);
    const names = buttonNames();
    for (const forbidden of [/ショップ/, /図鑑/, /在庫/, /もちもの/]) {
      expect(names.filter((n) => forbidden.test(n)), String(forbidden)).toEqual([]);
    }
  }, 60_000);

  it("H-6: stock 1 -> 0 over a round: the unpinned item leaves the tray, the pinned one stays at x0 and can be unpinned", async () => {
    const [unpinnedId, pinnedId] = [FINITE_TOPPINGS[3].id, FINITE_TOPPINGS[7].id];
    const [unpinned, pinned] = [nameOf(unpinnedId), nameOf(pinnedId)];
    seedFree({ stockOf: { [unpinnedId]: 1, [pinnedId]: 1 }, last: [unpinnedId, pinnedId] });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [p1, p2] = await bothPages(user);
    expect([...p1, ...p2]).toEqual(expect.arrayContaining([unpinned, pinned])); // the newest acquisitions are on the hand
    await openPantry(user);
    await user.click(exactTile(pinned)); // priority-only (already on the hand)
    await closePantry(user);
    for (const [id, name] of [[unpinnedId, unpinned], [pinnedId, pinned]] as const) {
      if (!chipByName(name)) await user.click(pageLabel().startsWith("1") ? nextButton()! : prevButton()!);
      await user.click(chipByName(name)!);
      tapPizza(40 + (id === pinnedId ? 20 : 0), 55);
      expect(pieces(id)).toBe(1);
    }
    await bakeToResult(user);

    // Next FREE round: stock is now 0 for both.
    await user.click(screen.getByRole("button", { name: "もう一度じゆうに作る" }));
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    const [n1, n2] = await bothPages(user);
    const hand = [...n1, ...n2];
    expect(hand).toHaveLength(CAP); // refilled from the stocked catalog
    expect(hand).not.toContain(unpinned); // OD-R5e-2: unpinned x0 leaves the tray
    expect(hand).toContain(pinned); // the explicit pin stays ...
    if (!chipByName(pinned)) await user.click(nextButton()!);
    expect(chipByName(pinned)).toBeDisabled(); // ... visible, x0, not placeable
    expect(chipByName(pinned)!.textContent).toContain("×0");
    if (pageLabel().startsWith("2")) await user.click(prevButton()!);

    await openPantry(user);
    expect(exactTile(unpinned)).toHaveAttribute("aria-disabled", "true"); // kept in the pantry at x0, not newly pinnable
    expect(exactTile(unpinned).textContent).toContain("×0");
    await user.click(exactTile(unpinned));
    expect(exactTile(unpinned)).toHaveAttribute("aria-pressed", "false");
    expect(exactTile(pinned)).toHaveAttribute("aria-pressed", "true");
    expect(exactTile(pinned)).not.toHaveAttribute("aria-disabled");
    await user.click(exactTile(pinned)); // an existing zero-stock pin can always be removed
    expect(exactTile(pinned)).toHaveAttribute("aria-pressed", "false");
    await closePantry(user);
    const [m1, m2] = await bothPages(user);
    expect([...m1, ...m2]).not.toContain(pinned);
    expect([...m1, ...m2]).toHaveLength(CAP);

    // HOME -> FREE restart keeps the (now empty) pin state and the same x0 rule.
    await user.click(screen.getByRole("button", { name: /ホーム/ })); // mid-round: window.confirm -> true
    await toToppingStep(user);
    const [k1, k2] = await bothPages(user);
    expect([...k1, ...k2]).not.toContain(unpinned);
    expect([...k1, ...k2]).not.toContain(pinned);
    await openPantry(user);
    expect(screen.queryByRole("group", { name: "選択中の材料" })).toBeNull();
  }, 60_000);

  it("H-6: HOME -> FREE restart keeps the pins and the hand; the save never carries them", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [p1, p2] = await bothPages(user);
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => ![...p1, ...p2].includes(n))!;
    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);
    const [h1, h2] = await bothPages(user);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY) ?? "").not.toMatch(/"(hand|pins?|handSession|pinSession)"/);
    await toToppingStep(user);
    expect(pageLabel()).toBe("1 / 2");
    expect(selectedName()).toBeNull();
    const [r1, r2] = await bothPages(user);
    expect([...r1, ...r2]).toEqual([...h1, ...h2]);
    expect([...r1, ...r2]).toContain(outside);
  }, 60_000);

  it("H-6 isolation: a guided round with pins keeps its recipe tray -- no hand, no pantry, no pin UI", async () => {
    seedFree({ dex: MARGHERITA_DEX });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [p1, p2] = await bothPages(user);
    // A pin the recipe does not use (margherita's own topping is basil).
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => n !== "バジル" && ![...p1, ...p2].includes(n))!;
    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);
    await user.click(screen.getByRole("button", { name: /ホーム/ }));

    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: /^マルゲリータ、/ }));
    await user.click(screen.getByRole("button", { name: /このピザを作る/ }));
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(trayNames()).toEqual(["バジル"]); // the recipe's own tray, pins ignored
    expect(trayNames()).not.toContain(outside);
    expect(screen.queryByRole("button", { name: /食材庫/ })).toBeNull();
    expect(document.querySelector(".pantry-tile__toggle, .pantry-sheet__pins")).toBeNull();
  }, 60_000);

  it("H-6 isolation: a Lunch Rush round with pins keeps its order tray -- no hand, no pantry, no pin UI", async () => {
    seedFree({ dex: MARGHERITA_DEX });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [p1, p2] = await bothPages(user);
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => n !== "バジル" && ![...p1, ...p2].includes(n))!;
    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);
    await user.click(screen.getByRole("button", { name: /ホーム/ }));

    expect(outside).not.toBe("バジル");
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    await user.click(screen.getByRole("button", { name: "スタート" }));
    await user.click(screen.getByRole("button", { name: "ピザを作る！" }));
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(trayNames()).toEqual(["バジル"]);
    expect(screen.queryByRole("button", { name: /食材庫/ })).toBeNull();
    expect(document.querySelector(".pantry-tile__toggle, .pantry-sheet__pins")).toBeNull();
  }, 60_000);

  it("H-6 isolation: a Dinner round with pins keeps today's paged tray of every owned topping", async () => {
    seedDinner();
    window.history.replaceState({}, "", "/?dinnerDuration=120");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [p1, p2] = await bothPages(user);
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => ![...p1, ...p2].includes(n))!;
    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);
    await user.click(screen.getByRole("button", { name: /ホーム/ }));

    await user.click(screen.getByRole("button", { name: /ディナーミッション/ }));
    await user.click(screen.getByRole("button", { name: /ディナーミッション 1/ }));
    await user.click(screen.getByRole("button", { name: /スタート/ }));
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(pageLabel()).toBe(`1 / ${Math.ceil(TOPPINGS.length / 6)}`); // every owned topping, paged: no hand
    expect(screen.queryByRole("button", { name: /食材庫/ })).toBeNull();
    expect(document.querySelector(".pantry-tile__toggle, .pantry-sheet__pins")).toBeNull();
  }, 60_000);
});
