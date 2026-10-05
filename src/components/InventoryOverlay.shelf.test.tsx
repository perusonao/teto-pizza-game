import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryOverlay } from "./InventoryOverlay";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { FAMILY_DISPLAY } from "../data/familyDisplay";
import { familiesPresent, ingredientShelf, majorsPresent } from "../data/ingredientShelf";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import { remainingStock, type InventoryState } from "../state/inventory";
import shelfSource from "./InventoryOverlay.tsx?raw";

/** Ingredient Pantry / Category Tabs (OD-1 / OD-8): the Ingredients (Inventory) screen's two-tier shelf tabs. */

afterEach(cleanup);

const STARTERS = [...STARTER_INGREDIENT_IDS];
const names = (group: string) =>
  within(screen.getByRole("group", { name: group }))
    .getAllByRole("button")
    .map((b) => b.textContent);
const majorNames = () => names("材料の大分類");
const familyNames = () => names("具材の分類");
const familyRow = () => screen.queryByRole("group", { name: "具材の分類" });
const cardNames = () => Array.from(document.querySelectorAll(".inventory-card__name")).map((e) => e.textContent);
const show = (owned: readonly string[], inventory: InventoryState = {}) =>
  render(<InventoryOverlay ownedIngredientIds={owned} inventory={inventory} onClose={vi.fn()} />);
const tap = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const label = (family: keyof typeof FAMILY_DISPLAY) => FAMILY_DISPLAY[family].labelJa;

describe("the major tabs come from the OWNED rows only", () => {
  it("starters only: すべて / ソース / チーズ / 具材, and no family row until 具材 is chosen", () => {
    show(STARTERS);
    expect(majorNames()).toEqual(["すべて", "ソース", "チーズ", "具材"]);
    expect(familyRow()).not.toBeInTheDocument();
  });

  it("the family row exists only under 具材: owned families only, authority order, 「すべて」 first", async () => {
    show([...STARTERS, "egg", "ham", "mushroom"]);
    expect(majorNames()).toEqual(["すべて", "ソース", "チーズ", "具材"]);
    await tap("具材");
    expect(familyNames()).toEqual(["すべて", label("meat"), label("vegetable"), label("herb"), label("other")]);
    await tap("ソース");
    expect(familyRow()).not.toBeInTheDocument();
    await tap("チーズ");
    expect(familyRow()).not.toBeInTheDocument();
    await tap("すべて");
    expect(familyRow()).not.toBeInTheDocument();
  });

  it("an entitled-but-unbought (Shop NEW) or never-owned material creates no tab, DOM node or text", async () => {
    show(STARTERS);
    await tap("具材");
    for (const family of ["meat", "seafood", "vegetable", "fruit", "spice", "other"] as const) {
      expect(screen.queryByRole("button", { name: label(family) })).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain(label(family));
    }
    expect(document.body.textContent).not.toContain("スパイス");
  });

  it("there is no 「トッピング」 anywhere and no tab / tablist (role=group + aria-pressed, OD-7)", async () => {
    show([...STARTERS, "ham"]);
    await tap("具材");
    expect(screen.queryByRole("button", { name: "トッピング" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/トッピング/);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("shows no counts in either row, and no hidden / aria-hidden nodes inside them", async () => {
    show(INGREDIENTS.map((i) => i.id));
    await tap("具材");
    for (const name of ["材料の大分類", "具材の分類"]) {
      const row = screen.getByRole("group", { name });
      expect(row.textContent).not.toMatch(/\d/);
      expect(row.querySelectorAll("[hidden], [aria-hidden]")).toHaveLength(0);
    }
  });

  it("the tabs are derived from owned rows only: the source never reads the Shop entitlement or the obtainable set", () => {
    expect(shelfSource).not.toMatch(/unlockedForShop|obtainableIngredientIds|materialShopState|DISCOVERY_LADDER/);
    expect(shelfSource).toMatch(/majorsPresent\(owned\)/);
    expect(shelfSource).toMatch(/familiesPresent\(owned\)/);
  });
});

describe("progression: a family tab appears with the first OWNED ingredient of the family, never earlier", () => {
  const steps = DISCOVERY_LADDER.steps;
  const entitledAt = (n: number) => materialIdsOfSteps(steps.filter((s) => s.step <= n));

  it.each([
    [1, "other"],
    [2, "meat"],
    [3, "vegetable"],
    [10, "fruit"],
    [15, "seafood"],
    [23, "spice"],
  ] as const)("Dex %i: %s is absent while unbought and present once one of its materials is owned", async (n, family) => {
    const entitled = entitledAt(n);
    const ofFamily = entitled.filter((id) => ingredientShelf(id) === family);
    expect(ofFamily.length).toBeGreaterThan(0);
    // The tab did not exist one step earlier (this is the step that introduces the family).
    expect(entitledAt(n - 1).filter((id) => ingredientShelf(id) === family)).toHaveLength(0);
    // Everything entitled is bought EXCEPT this family's materials -> still no tab.
    const boughtAllElse = entitled.filter((id) => ingredientShelf(id) !== family);
    show([...STARTERS, ...boughtAllElse]);
    await tap("具材");
    expect(familyNames()).not.toContain(label(family));
    cleanup();
    // Buying just one of them makes the tab appear.
    show([...STARTERS, ...boughtAllElse, ofFamily[0]]);
    await tap("具材");
    expect(familyNames()).toContain(label(family));
  });

  it("at every Dex the tabs equal majorsPresent / familiesPresent of the owned rows", async () => {
    for (let n = 0; n <= 24; n++) {
      const owned = [...STARTERS, ...entitledAt(n)];
      show(owned);
      const rows = INGREDIENTS.filter((i) => owned.includes(i.id));
      expect(majorNames(), `Dex ${n}`).toEqual(["すべて", ...majorsPresent(rows).map((m) => (m === "topping" ? "具材" : m === "sauce" ? "ソース" : "チーズ"))]);
      await tap("具材");
      expect(familyNames(), `Dex ${n}`).toEqual(["すべて", ...familiesPresent(rows).map(label)]);
      cleanup();
    }
  });
});

describe("filtering is display-only", () => {
  it("a family lists exactly its owned rows; 具材 lists all toppings; すべて lists all; stock text is unchanged", async () => {
    const owned = [...STARTERS, "ham", "bacon", "mushroom", "egg"];
    show(owned, { ham: 7, bacon: 0, mushroom: 3, egg: 1 });
    const allNames = cardNames();
    expect(allNames).toHaveLength(owned.length);
    await tap("具材");
    expect(cardNames()).toHaveLength(owned.length - 2); // the starter sauce and cheese are not 具材
    await tap(label("meat"));
    expect(cardNames()).toEqual(["ベーコン", "ハム"].sort((a, b) => allNames.indexOf(a) - allNames.indexOf(b)));
    expect(screen.getByText("×7")).toBeInTheDocument();
    expect(screen.getByText("×0")).toBeInTheDocument();
    await tap("ソース");
    expect(cardNames()).toEqual(["トマトソース"].filter((n) => allNames.includes(n)));
    await tap("すべて");
    expect(cardNames()).toEqual(allNames);
  });

  it("changes nothing but the filter: props are not mutated and no stock changes", async () => {
    const owned = Object.freeze([...STARTERS, "ham", "mushroom"]);
    const inventory = Object.freeze({ ham: 7, mushroom: 3 });
    const before = JSON.stringify({ owned, inventory });
    show(owned, inventory);
    for (const name of ["具材", label("meat"), "ソース", "具材", label("vegetable")]) await tap(name);
    await userEvent.click(within(screen.getByRole("group", { name: "材料の大分類" })).getByRole("button", { name: "すべて" }));
    expect(JSON.stringify({ owned, inventory })).toBe(before);
    expect(remainingStock(INGREDIENTS.find((i) => i.id === "ham")!, inventory)).toBe(7);
  });

  it("aria-pressed follows the active tab in each tier", async () => {
    show([...STARTERS, "ham"]);
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    await tap("具材");
    expect(screen.getByRole("button", { name: "具材" })).toHaveAttribute("aria-pressed", "true");
    const family = within(screen.getByRole("group", { name: "具材の分類" }));
    expect(family.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(family.getByRole("button", { name: label("meat") }));
    expect(family.getByRole("button", { name: label("meat") })).toHaveAttribute("aria-pressed", "true");
    expect(family.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("OD-5 / OD-D: the family selection", () => {
  it("re-tapping the active 具材 keeps the family; another major resets it; coming back starts at 「すべて」", async () => {
    show([...STARTERS, "ham", "mushroom"]);
    await tap("具材");
    await tap(label("meat"));
    expect(cardNames()).toEqual(["ハム"]);
    await tap("具材");
    expect(cardNames()).toEqual(["ハム"]);
    expect(within(screen.getByRole("group", { name: "具材の分類" })).getByRole("button", { name: label("meat") })).toHaveAttribute("aria-pressed", "true");
    await tap("ソース");
    await tap("具材");
    const family = within(screen.getByRole("group", { name: "具材の分類" }));
    expect(family.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toHaveLength(3); // basil, ham, mushroom
  });
});

describe("family tag on the cards (OD-3 / OD-C)", () => {
  it("a 具材 card always shows its family tag, even while that family is filtered; sauce / cheese cards show none", async () => {
    show([...STARTERS, "ham"]);
    const ham = () => screen.getByText("ハム").closest(".inventory-card") as HTMLElement;
    expect(within(ham()).getByText(label("meat"))).toBeInTheDocument();
    await tap("具材");
    await tap(label("meat"));
    expect(within(ham()).getByText(label("meat"))).toBeInTheDocument();
    cleanup();
    show(STARTERS);
    for (const name of ["トマトソース", "モッツァレラ"]) {
      const card = screen.getByText(name).closest(".inventory-card") as HTMLElement;
      expect(card.querySelector(".family-tag")).toBeNull();
      expect(card.querySelector(".inventory-card__category")).toBeNull();
    }
  });
});

describe("selected tab disappearing / unknown ids", () => {
  it("falls back to 「すべて」 when the active family is no longer owned", async () => {
    const { rerender } = show([...STARTERS, "ham", "mushroom"]);
    await tap("具材");
    await tap(label("meat"));
    expect(cardNames()).toEqual(["ハム"]);
    rerender(<InventoryOverlay ownedIngredientIds={[...STARTERS, "mushroom"]} inventory={{}} onClose={vi.fn()} />);
    expect(familyNames()).toEqual(["すべて", label("vegetable"), label("herb")]);
    expect(within(screen.getByRole("group", { name: "具材の分類" })).getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toHaveLength(2);
  });

  it("falls back to 「すべて」 when the active major is no longer owned (the family row goes with it)", async () => {
    const { rerender } = show(["mozzarella"]);
    await tap("チーズ");
    rerender(<InventoryOverlay ownedIngredientIds={["basil"]} inventory={{}} onClose={vi.fn()} />);
    expect(majorNames()).toEqual(["すべて", "具材"]);
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toHaveLength(1);
  });

  it("an owned id that is not in the catalog is ignored and creates no tab", () => {
    show([...STARTERS, "ghost-ingredient"]);
    expect(majorNames()).toEqual(["すべて", "ソース", "チーズ", "具材"]);
    expect(cardNames()).toHaveLength(3);
  });
});
