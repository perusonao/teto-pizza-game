import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * LC-R4: fail-closed shelf behavior that the production catalog cannot produce (every production topping has a
 * shelf), exercised by making `ingredientShelf` return `null` for one ingredient. Membership still comes only
 * from `ingredientShelf`; the pantry classifies nothing itself.
 */
vi.mock("../data/ingredientShelf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/ingredientShelf")>();
  return { ...actual, ingredientShelf: (x: unknown) => (x === "onion" ? null : actual.ingredientShelf(x)) };
});

import { IngredientPantry } from "./IngredientPantry";

const inventory = { basil: 3, garlic: 3, onion: 3, sausage: 3, pepperoni: 3, mushroom: 3 } as never;
const tileNames = () => [...document.querySelectorAll(".pantry-tile__name")].map((n) => n.textContent);
const chips = () => [...document.querySelectorAll(".shelf-chip")].map((n) => n.textContent);

afterEach(() => cleanup());

describe("LC-R4 unclassified (shelf === null) rows", () => {
  const owned = ["basil", "garlic", "onion", "sausage", "pepperoni", "mushroom"];

  it("are listed under すべて, get no chip, and never appear under a specific shelf", () => {
    render(<IngredientPantry category="topping" ownedIngredientIds={owned} inventory={inventory} onClose={() => {}} />);
    expect(tileNames()).toContain("たまねぎ");
    expect(chips()).toEqual(["すべて", "肉", "野菜・きのこ", "ハーブ・香味"]);
    for (const label of ["肉", "野菜・きのこ", "ハーブ・香味"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(tileNames(), label).not.toContain("たまねぎ");
    }
    fireEvent.click(screen.getByRole("button", { name: "すべて" }));
    expect(tileNames()).toContain("たまねぎ");
  });

  it("one classified shelf plus unclassified rows is still a single shelf: no chip row", () => {
    render(<IngredientPantry category="topping" ownedIngredientIds={["onion", "sausage"]} inventory={inventory} onClose={() => {}} />);
    expect(document.querySelector(".shelf-chips")).toBeNull();
    expect(tileNames()).toHaveLength(2);
  });

  it("a single shelf shows no chip row", () => {
    render(<IngredientPantry category="topping" ownedIngredientIds={["sausage", "pepperoni"]} inventory={inventory} onClose={() => {}} />);
    expect(document.querySelector(".shelf-chips")).toBeNull();
    expect(tileNames()).toEqual(["ソーセージ", "ペパロニ"]);
  });
});

describe("LC-R4 a stored shelf that is no longer represented reads as すべて", () => {
  it("falls back while rendering, never showing an empty list for a vanished shelf", () => {
    const { rerender } = render(
      <IngredientPantry category="topping" ownedIngredientIds={["basil", "sausage", "pepperoni"]} inventory={inventory} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "肉" }));
    expect(tileNames()).toHaveLength(2);
    rerender(<IngredientPantry category="topping" ownedIngredientIds={["basil", "mushroom"]} inventory={inventory} onClose={() => {}} />);
    expect(chips()).toEqual(["すべて", "野菜・きのこ", "ハーブ・香味"]);
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    expect(tileNames()).toHaveLength(2);
  });
});
