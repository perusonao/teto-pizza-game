import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IngredientPantry } from "./IngredientPantry";
import { FAMILY_DISPLAY } from "../data/familyDisplay";

/** Ingredient Pantry / Category Tabs (OD-1 / OD-B / OD-3): the Pantry stays per active category. */

afterEach(cleanup);

const inventory = { basil: 3, garlic: 3, sausage: 3, pepperoni: 3, mushroom: 3, "olive-oil": 3, "tomato-sauce": 3, mozzarella: 3 } as never;
const owned = ["basil", "garlic", "sausage", "pepperoni", "mushroom", "olive-oil", "tomato-sauce", "mozzarella"];
const open = (category: "sauce" | "cheese" | "topping", ids: readonly string[] = owned) =>
  render(<IngredientPantry category={category} ownedIngredientIds={ids} inventory={inventory} onClose={() => {}} />);
const tileNames = () => [...document.querySelectorAll(".pantry-tile__name")].map((n) => n.textContent);
const subtitle = () => document.querySelector(".pantry-sheet__subtitle");

describe("OD-B: the subtitle", () => {
  it("sauce and cheese have no subtitle; 具材 keeps 「具材」 (never 「トッピング」)", () => {
    open("sauce");
    expect(subtitle()).toBeNull();
    expect(document.body.textContent).not.toMatch(/トッピング/);
    cleanup();
    open("cheese");
    expect(subtitle()).toBeNull();
    cleanup();
    open("topping");
    expect(subtitle()?.textContent).toBe("具材");
  });
});

describe("OD-1: the Pantry is per active category, with the family row only for 具材", () => {
  it("sauce / cheese list only their own rows and render no tab row at all", () => {
    open("sauce");
    expect(tileNames().sort()).toEqual(["オリーブオイル", "トマトソース"].sort());
    expect(document.querySelector(".shelf-chips, .shelf-tabs")).toBeNull();
    expect(screen.queryByRole("group", { name: "材料の大分類" })).not.toBeInTheDocument();
    cleanup();
    open("cheese");
    expect(tileNames()).toEqual(["モッツァレラ"]);
    expect(document.querySelector(".shelf-chips")).toBeNull();
  });

  it("具材 shows exactly one family row (no major row), labelled 「具材の分類」, with the familyDisplay labels", () => {
    open("topping");
    const row = screen.getByRole("group", { name: "具材の分類" });
    expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "すべて",
      FAMILY_DISPLAY.meat.labelJa,
      FAMILY_DISPLAY.vegetable.labelJa,
      FAMILY_DISPLAY.herb.labelJa,
    ]);
    expect(screen.queryByRole("group", { name: "材料の大分類" })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".shelf-chips")).toHaveLength(1);
  });
});

describe("OD-3: the family tag on tiles", () => {
  it("every 具材 tile carries its family tag, also while a family filter is active; sauce / cheese tiles carry none", () => {
    open("topping");
    const tag = (name: string) => {
      const tile = screen.getByText(name).closest(".pantry-tile") as HTMLElement;
      return tile.querySelector(".family-tag")?.textContent ?? null;
    };
    expect(tag("ソーセージ")).toContain("肉系");
    expect(tag("バジル")).toContain("ハーブ・香味系");
    expect(tag("マッシュルーム")).toContain("野菜・きのこ系");
    fireEvent.click(screen.getByRole("button", { name: FAMILY_DISPLAY.meat.labelJa }));
    expect(tileNames()).toEqual(["ソーセージ", "ペパロニ"]);
    expect(tag("ソーセージ")).toContain("肉系");
    cleanup();
    for (const category of ["sauce", "cheese"] as const) {
      open(category);
      expect(document.querySelector(".family-tag")).toBeNull();
      cleanup();
    }
  });

  it("the symbol is decorative (aria-hidden) and the label is read", () => {
    open("topping");
    const tag = document.querySelector(".family-tag") as HTMLElement;
    expect(tag.querySelector(".family-tag__symbol")).toHaveAttribute("aria-hidden", "true");
    expect(tag.querySelector(".family-tag__label")).not.toHaveAttribute("aria-hidden");
  });
});
