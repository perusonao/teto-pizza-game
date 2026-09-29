import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryOverlay } from "./InventoryOverlay";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { INGREDIENT_SHELF_ORDER, ingredientShelf, ingredientShelfLabel, shelvesPresent } from "../data/ingredientShelf";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import { remainingStock, type InventoryState } from "../state/inventory";
import shelfSource from "./InventoryOverlay.tsx?raw";

/** Ingredient Category Tabs 1.0 Phase 4: the Ingredients (Inventory) screen's shelf chips. */

afterEach(cleanup);

const STARTERS = [...STARTER_INGREDIENT_IDS];
const chipNames = () =>
  within(screen.getByRole("group", { name: "材料の分類" }))
    .getAllByRole("button")
    .map((b) => b.textContent);
const cardNames = () => Array.from(document.querySelectorAll(".inventory-card__name")).map((e) => e.textContent);
const show = (owned: readonly string[], inventory: InventoryState = {}) =>
  render(<InventoryOverlay ownedIngredientIds={owned} inventory={inventory} onClose={vi.fn()} />);

describe("chips come from the OWNED rows only", () => {
  it("starters only: すべて / ソース / チーズ / ハーブ・香味", () => {
    show(STARTERS);
    expect(chipNames()).toEqual(["すべて", "ソース", "チーズ", "ハーブ・香味"]);
  });

  it("owned shelves only, in authority order, 「すべて」 first", () => {
    show([...STARTERS, "egg", "ham", "mushroom"]);
    expect(chipNames()).toEqual(["すべて", "ソース", "チーズ", "肉", "野菜・きのこ", "ハーブ・香味", "その他"]);
  });

  it("an entitled-but-unbought (Shop NEW) or never-owned material creates no chip, DOM node or text", () => {
    // The player owns only the starters; every other material is at most a Shop NEW / LOCKED row.
    show(STARTERS);
    for (const shelf of ["meat", "seafood", "vegetable", "fruit", "spice", "other"] as const) {
      const label = ingredientShelfLabel(shelf)!;
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain(label);
    }
    expect(document.body.textContent).not.toContain("スパイス");
  });

  it("there is no 「トッピング」 chip and no tab / tablist; the per-card 「トッピング」 metadata stays", () => {
    show([...STARTERS, "ham"]);
    expect(screen.queryByRole("button", { name: "トッピング" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    const ham = screen.getByText("ハム").closest(".inventory-card") as HTMLElement;
    expect(within(ham).getByText("トッピング")).toBeInTheDocument();
  });

  it("shows no counts in the chip row, and no hidden / aria-hidden nodes inside it", () => {
    show(INGREDIENTS.map((i) => i.id));
    const row = screen.getByRole("group", { name: "材料の分類" });
    expect(row.textContent).not.toMatch(/\d/);
    expect(row.querySelectorAll("[hidden], [aria-hidden]")).toHaveLength(0);
    expect(row.getAttribute("aria-label")).toBe("材料の分類");
  });

  it("the chip row is derived from owned rows only: the source never reads the Shop entitlement or the obtainable set", () => {
    expect(shelfSource).not.toMatch(/unlockedForShop|obtainableIngredientIds|materialShopState|DISCOVERY_LADDER/);
    expect(shelfSource).toMatch(/shelvesPresent\(owned\)/);
  });
});

describe("progression: a chip appears with the first OWNED ingredient of the shelf, never earlier", () => {
  const steps = DISCOVERY_LADDER.steps;
  const entitledAt = (n: number) => materialIdsOfSteps(steps.filter((s) => s.step <= n));

  it.each([
    [1, "その他"],
    [2, "肉"],
    [3, "野菜・きのこ"],
    [10, "果物"],
    [15, "魚介"],
    [23, "スパイス・薬味"],
  ])("Dex %i: %s is absent while unbought and present once one of its materials is owned", (n, label) => {
    const entitled = entitledAt(n);
    const shelf = INGREDIENT_SHELF_ORDER.find((s) => ingredientShelfLabel(s) === label)!;
    const ofShelf = entitled.filter((id) => ingredientShelf(id) === shelf);
    expect(ofShelf.length).toBeGreaterThan(0);
    // The chip did not exist one step earlier (audit: this is the step that introduces the shelf).
    const before = entitledAt(n - 1).filter((id) => ingredientShelf(id) === shelf);
    expect(before).toHaveLength(0);
    // Everything entitled is bought EXCEPT this shelf's materials -> still no chip.
    const boughtAllElse = entitled.filter((id) => ingredientShelf(id) !== shelf);
    show([...STARTERS, ...boughtAllElse]);
    expect(chipNames()).not.toContain(label);
    cleanup();
    // Buying just one of them makes the chip appear.
    show([...STARTERS, ...boughtAllElse, ofShelf[0]]);
    expect(chipNames()).toContain(label);
  });

  it("at every Dex the chips equal shelvesPresent(owned rows) for the largest owned set", () => {
    for (let n = 0; n <= 24; n++) {
      const owned = [...STARTERS, ...entitledAt(n)];
      show(owned);
      const rows = INGREDIENTS.filter((i) => owned.includes(i.id));
      expect(chipNames(), `Dex ${n}`).toEqual(["すべて", ...shelvesPresent(rows).map((s) => ingredientShelfLabel(s)!)]);
      cleanup();
    }
  });
});

describe("filtering is display-only", () => {
  it("a shelf lists exactly its owned rows; すべて lists all; stock text is unchanged by filtering", async () => {
    const owned = [...STARTERS, "ham", "bacon", "mushroom", "egg"];
    show(owned, { ham: 7, bacon: 0, mushroom: 3, egg: 1 });
    const allNames = cardNames();
    expect(allNames).toHaveLength(owned.length);
    await userEvent.click(screen.getByRole("button", { name: "肉" }));
    expect(cardNames()).toEqual(["ベーコン", "ハム"].filter((n) => allNames.includes(n)).sort((a, b) => allNames.indexOf(a) - allNames.indexOf(b)));
    expect(screen.getByText("×7")).toBeInTheDocument();
    expect(screen.getByText("×0")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "すべて" }));
    expect(cardNames()).toEqual(allNames);
  });

  it("changes nothing but the filter: props are not mutated and no stock changes", async () => {
    const owned = Object.freeze([...STARTERS, "ham", "mushroom"]);
    const inventory = Object.freeze({ ham: 7, mushroom: 3 });
    const before = JSON.stringify({ owned, inventory });
    show(owned, inventory);
    for (const name of ["肉", "ソース", "野菜・きのこ", "すべて"]) await userEvent.click(screen.getByRole("button", { name }));
    expect(JSON.stringify({ owned, inventory })).toBe(before);
    expect(remainingStock(INGREDIENTS.find((i) => i.id === "ham")!, inventory)).toBe(7);
    expect(screen.getByText("×7")).toBeInTheDocument();
    expect(screen.getByText("×3")).toBeInTheDocument();
  });

  it("aria-pressed follows the active chip", async () => {
    show([...STARTERS, "ham"]);
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "肉" }));
    expect(screen.getByRole("button", { name: "肉" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("selected shelf disappearing / unknown ids", () => {
  it("falls back to 「すべて」 when the active shelf is no longer owned", async () => {
    const { rerender } = show([...STARTERS, "ham"]);
    await userEvent.click(screen.getByRole("button", { name: "肉" }));
    expect(cardNames()).toEqual(["ハム"]);
    rerender(<InventoryOverlay ownedIngredientIds={STARTERS} inventory={{}} onClose={vi.fn()} />);
    expect(chipNames()).toEqual(["すべて", "ソース", "チーズ", "ハーブ・香味"]);
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toHaveLength(3);
  });

  it("an owned id that is not in the catalog is ignored and creates no chip", () => {
    show([...STARTERS, "ghost-ingredient"]);
    expect(chipNames()).toEqual(["すべて", "ソース", "チーズ", "ハーブ・香味"]);
    expect(cardNames()).toHaveLength(3);
  });
});
