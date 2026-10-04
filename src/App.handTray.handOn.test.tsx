import "@testing-library/jest-dom/vitest";
import { Profiler, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { DEFAULT_HAND_CAPACITY_CANDIDATE } from "./logic/catalog/handPolicy";
import { pickFirstResearchIfDexOpened } from "./test/discoveryEntry";

/**
 * LC-R5-d: the DORMANT tray hand through the real App / reducer / tray / pantry, with the enforcement flag forced ON
 * (production keeps it false; `App.handTray.off.test.tsx` and `handTray.off.test.ts` prove the OFF side). 22 toppings are owned,
 * so the topping hand (capacity candidate CAP = 9 or 12, one per project) is ACTIVE: the tray shows CAP of 22 in
 * catalog order on 2 pages (6 + CAP - 6).
 * OD-R5d-1 (R-α page 0 + page-level selection, catalog order, priority-only reorder is not a change) /
 * OD-R5d-2 / OD-R5d-3 (Model C: an accepted pin is always on the tray).
 */
// LC-R5-e-h (H-2): no `vi.mock` any more. The `hand-on-9` / `hand-on-12` Vitest projects compile the REAL
// `handPolicy.ts` with the flag on and one capacity candidate, so the real `handCapacityFor` / `resolveTrayHandIds`
// wiring runs, and every expectation below holds for BOTH supported capacities (CAP; 12 = OD-5 production, 9 = coverage parameter).
const CAP = DEFAULT_HAND_CAPACITY_CANDIDATE;

const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping");
const DM_A = ["margherita", "bismarck", "breakfast-pizza", "funghi"];

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
const trayNames = () => [...document.querySelectorAll(".ingredient-chip__name")].map((n) => n.textContent ?? "");
const pageLabel = () => document.querySelector(".ingredient-page-nav__label")?.textContent ?? "";
const selectedName = () => document.querySelector(".ingredient-chip--selected .ingredient-chip__name")?.textContent ?? null;
const catalogRank = (name: string) => INGREDIENTS.findIndex((i) => i.nameJa === name);
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

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
});

describe(`LC-R5-d tray hand (real handPolicy compiled ON, capacity ${CAP}, active hand)`, () => {
  it(`the tray shows ${CAP} of 22 toppings in CATALOG order on 2 pages (priority selects membership only)`, async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    expect(pageLabel()).toBe("1 / 2");
    const [p1, p2] = await bothPages(user);
    expect(p1).toHaveLength(6);
    expect(p2).toHaveLength(CAP - 6); // 12 -> 6 + 6, 9 -> 6 + 3
    const all = [...p1, ...p2];
    expect(all.map(catalogRank)).toEqual([...all.map(catalogRank)].sort((a, b) => a - b));
    expect(new Set(all).size).toBe(CAP);
  });

  it("OD-R5d-1: an actual hand change returns to page 0 and clears a selection that is not on the new page 0", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [p1, p2] = await bothPages(user);
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => ![...p1, ...p2].includes(n))!;
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    await user.click(chipByName(p2[p2.length - 1]));
    expect(selectedName()).toBe(p2[p2.length - 1]);
    expect(pageLabel()).toBe("2 / 2");

    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);

    expect(pageLabel()).toBe("1 / 2"); // page 0, in the same commit as the new list
    expect(selectedName()).toBeNull(); // it is not on the new page 0
    expect([...trayNames()]).toHaveLength(6);
    const [n1, n2] = await bothPages(user);
    expect([...n1, ...n2]).toContain(outside); // Model C: an accepted pin IS on the tray
    // and the tray is still catalog ordered
    expect([...n1, ...n2].map(catalogRank)).toEqual([...[...n1, ...n2].map(catalogRank)].sort((a, b) => a - b));
  });

  it("OD-R5d-1: a selection that is on the new page 0 is retained through a hand change", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [p1, p2] = await bothPages(user);
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => ![...p1, ...p2].includes(n))!;
    // The pin displaces the lowest-priority automatic item (here p1[0]: the oldest 'new' one); p1[1] shifts by at most
    // one place, so it is still on the new page 0.
    await user.click(chipByName(p1[1]));
    await openPantry(user);
    await user.click(exactTile(outside));
    await closePantry(user);
    expect(pageLabel()).toBe("1 / 2");
    expect(selectedName()).toBe(p1[1]);
  });

  it("F-1: pinning an ingredient already on the hand (priority-only change) is not a hand change: page, selection and tray are untouched", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [, p2] = await bothPages(user);
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    await user.click(chipByName(p2[1]));
    const before = JSON.stringify({ names: trayNames(), page: pageLabel(), sel: selectedName() });
    await openPantry(user);
    await user.click(exactTile(p2[1])); // pin (already on the hand)
    await user.click(exactTile(p2[0]));
    await user.click(exactTile(p2[1])); // unpin
    await closePantry(user);
    expect(JSON.stringify({ names: trayNames(), page: pageLabel(), sel: selectedName() })).toBe(before);
  });

  it("a placement never moves the tray: same list, same page, selection kept", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [p1] = await bothPages(user);
    await user.click(chipByName(p1[0]));
    const before = JSON.stringify({ names: trayNames(), page: pageLabel() });
    const pieces = document.querySelectorAll(".pizza-topping").length;
    tapPizza(45, 55);
    expect(document.querySelectorAll(".pizza-topping").length).toBe(pieces + 1);
    expect(JSON.stringify({ names: trayNames(), page: pageLabel() })).toBe(before);
    expect(selectedName()).toBe(p1[0]);
  });

  it("pantry open / close / search / shelf never clear the selection or move the page (#197 P1)", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [, p2] = await bothPages(user);
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    await user.click(chipByName(p2[0]));
    await openPantry(user);
    await user.type(screen.getByRole("searchbox", { name: "材料を検索" }), "に");
    await user.clear(screen.getByRole("searchbox", { name: "材料を検索" }));
    await closePantry(user);
    expect(pageLabel()).toBe("2 / 2");
    expect(selectedName()).toBe(p2[0]);
  });

  it(`OD-R5d-3 (Model C): pinning every tile accepts exactly ${CAP} (the capacity), all on the tray; the rest are refused without a change`, async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    await openPantry(user);
    for (const t of TOPPINGS) await user.click(exactTile(t.nameJa));
    expect(stripPins()).toBe(CAP);
    const pinned = within(screen.getByRole("group", { name: "選択中の材料" })).getAllByRole("button", { name: /を外す$/ }).map((b) => b.getAttribute("aria-label")!.replace("を外す", ""));
    await closePantry(user);
    const [n1, n2] = await bothPages(user);
    expect([...n1, ...n2].sort()).toEqual([...pinned].sort());
  });

  it("OD-R5d-2: an ingredient already on the pizza stays on the tray even when every pin slot is taken by others", async () => {
    seedFree();
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    const [, p2] = await bothPages(user);
    // Place two of the LAST catalog items; then pin toppings from the START of the catalog until the hand is full.
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    const placedNames = [p2[p2.length - 1], p2[p2.length - 2]];
    for (const [index, name] of placedNames.entries()) {
      await user.click(chipByName(name));
      tapPizza(40 + index * 20, 55);
    }
    await user.click(screen.getByRole("button", { name: "前のページ" }));
    await openPantry(user);
    for (const t of TOPPINGS) await user.click(exactTile(t.nameJa));
    // Model C: CAP - 2 free slots for the others; a pin on an already-placed ingredient costs no slot (it is on the hand).
    expect(stripPins()).toBe(CAP);
    await closePantry(user);
    const [n1, n2] = await bothPages(user);
    for (const name of placedNames) expect([...n1, ...n2]).toContain(name);
    expect([...n1, ...n2]).toHaveLength(CAP);
  });

  it("invariant I1 (fuzz): after ANY sequence of select / page / pin / unpin / clear / place, an active selection is always on the visible page (the next tap places it)", async () => {
    seedFree(99);
    const user = userEvent.setup();
    render(<App />);
    await toToppingStep(user);
    let seed = 20260930;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
    const chips = () => [...document.querySelectorAll<HTMLButtonElement>(".ingredient-chip:not([disabled])")];
    for (let step = 0; step < 36; step += 1) {
      const op = rand(6);
      if (op === 0) await user.click(chips()[rand(chips().length)]);
      else if (op === 1 && !screen.getByRole("button", { name: "次のページ" }).hasAttribute("disabled")) await user.click(screen.getByRole("button", { name: "次のページ" }));
      else if (op === 2 && !screen.getByRole("button", { name: "前のページ" }).hasAttribute("disabled")) await user.click(screen.getByRole("button", { name: "前のページ" }));
      else if (op === 3 || op === 4) {
        await openPantry(user);
        const tiles = [...document.querySelectorAll<HTMLElement>(".pantry-tile__toggle")];
        await user.click(tiles[rand(tiles.length)]);
        if (op === 4 && screen.queryByRole("button", { name: "おまかせに戻す" })) await user.click(screen.getByRole("button", { name: "おまかせに戻す" }));
        await closePantry(user);
      } else if (op === 5) tapPizza(30 + rand(40), 30 + rand(40));
      // I1: an INVISIBLE selection would still place a piece on the next tap (the #197 bug). With no selected chip on the
      // tray, a tap must place nothing. (With one, a crowded dough may legitimately reject, so that side is not asserted.)
      const selected = selectedName() !== null;
      const pieces = document.querySelectorAll(".pizza-topping").length;
      tapPizza(30 + rand(40), 30 + rand(40));
      const placedNow = document.querySelectorAll(".pizza-topping").length - pieces;
      if (!selected) expect(placedNow, `step ${step} op ${op}: invisible selection placed a piece`).toBe(0);
      expect(placedNow).toBeLessThanOrEqual(1);
      // the tray is always catalog ordered and never longer than a page
      const names = trayNames();
      expect(names.length).toBeLessThanOrEqual(6);
      expect(names.map(catalogRank)).toEqual([...names.map(catalogRank)].sort((a, b) => a - b));
    }
  }, 60_000);

  it.each([
    ["plain", false],
    ["React.StrictMode", true],
  ] as const)("render-phase transition (%s): ONE commit carries the new list, page 0 and the cleared selection (no torn frame, no loop)", async (_label, strict) => {
    seedFree();
    const user = userEvent.setup();
    let commits = 0;
    const tree = (
      <Profiler id="app" onRender={() => { commits += 1; }}>
        <App />
      </Profiler>
    );
    render(strict ? <StrictMode>{tree}</StrictMode> : tree);
    await toToppingStep(user);
    const [p1, p2] = await bothPages(user);
    const outside = TOPPINGS.map((t) => t.nameJa).find((n) => ![...p1, ...p2].includes(n))!;
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    await user.click(chipByName(p2[p2.length - 1]));
    await openPantry(user);
    const snapshots: string[] = [];
    const observer = new MutationObserver(() => snapshots.push(JSON.stringify({ page: pageLabel(), names: trayNames(), sel: selectedName() })));
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    const before = commits;
    await user.click(exactTile(outside));
    await Promise.resolve();
    observer.disconnect();
    // Exactly one commit for the pin edit (an effect-driven clear / page reset would add a second one).
    expect(commits - before).toBe(1);
    // No observed frame shows the old page 2 over the new list, or a stale selection with the new page 0.
    for (const snap of snapshots) {
      const { page, sel } = JSON.parse(snap) as { page: string; sel: string | null };
      expect(page === "2 / 2" && sel === null).toBe(false);
      if (page === "1 / 2") expect(sel).toBeNull();
    }
    await closePantry(user);
    expect(pageLabel()).toBe("1 / 2");
    expect(selectedName()).toBeNull();
  });

  it("Dinner keeps the paged 22-topping tray even with pins in the session", async () => {
    seedDinner();
    window.history.replaceState({}, "", "/?dinnerDuration=120");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ディナーミッション/ }));
    await user.click(screen.getByRole("button", { name: /ディナーミッション 1/ }));
    await user.click(screen.getByRole("button", { name: /スタート/ }));
    completeDoughStep();
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(screen.queryByRole("button", { name: /食材庫/ })).toBeNull();
    expect(pageLabel()).toBe("1 / 5"); // 27 toppings (Expansion Wave 2), 6 per page
    expect(trayNames()).toHaveLength(6);
  });
});
