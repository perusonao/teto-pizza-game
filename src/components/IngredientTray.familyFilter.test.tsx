import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { createEmptyPizza } from "../state/pizzaState";
import { EMPTY_INVENTORY } from "../state/inventory";
import { ingredientsByCategory, MAX_INGREDIENT_PALETTE_SLOTS } from "../data/ingredients";
import { ingredientShelf } from "../data/ingredientShelf";
import { RECIPES } from "../data/recipes";

/**
 * Cooking Tray family filter (Issue #396): the 具材 step offers the family chips on the normal tray, after the
 * population (ownership / HAND) and before pagination; sauce / cheese never get them.
 */

const TOPPINGS = ingredientsByCategory("topping");
const ALL_TOPPING_IDS = TOPPINGS.map((i) => i.id);
const FAMILY_ROW = "具材の絞り込み";
const ALL = "全ての具材を表示";
const only = (label: string) => `${label}の具材だけ表示`;

afterEach(cleanup);

function renderTray(props: Partial<React.ComponentProps<typeof IngredientTray>> = {}) {
  const onClearSelection = vi.fn();
  const utils = render(
    <IngredientTray
      activeCategory="topping"
      selectedIngredientId={null}
      onSelectIngredient={() => {}}
      onClearSelection={onClearSelection}
      ownedIngredientIds={ALL_TOPPING_IDS}
      recipe={RECIPES[0]}
      freeCook
      inventory={EMPTY_INVENTORY}
      pizza={createEmptyPizza()}
      {...props}
    />,
  );
  return { ...utils, onClearSelection };
}

function chipNames(): string[] {
  return screen.getAllByRole("button", { pressed: false }).concat(screen.queryAllByRole("button", { pressed: true }))
    .filter((b) => b.classList.contains("ingredient-chip"))
    .map((b) => b.querySelector(".ingredient-chip__name")?.textContent ?? "");
}

function pickFamilyWithMany() {
  const byFamily = new Map<string, string[]>();
  for (const t of TOPPINGS) {
    const f = ingredientShelf(t.id);
    if (f) byFamily.set(f, [...(byFamily.get(f) ?? []), t.id]);
  }
  return [...byFamily.entries()].find(([, ids]) => ids.length >= 2)!;
}

describe("IngredientTray family filter (Issue #396)", () => {
  it("offers the family row on the topping tray when the list pages and spans families", () => {
    renderTray();
    const row = screen.getByRole("group", { name: FAMILY_ROW });
    expect(within(row).getByRole("button", { name: ALL })).toHaveAttribute("aria-pressed", "true");
    expect(within(row).getByRole("button", { name: only("肉系") })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "素材ページ切り替え" })).toBeInTheDocument();
  });

  it("never offers it on sauce / cheese", () => {
    for (const category of ["sauce", "cheese"] as const) {
      const ids = ingredientsByCategory(category).map((i) => i.id);
      renderTray({ activeCategory: category, ownedIngredientIds: ids });
      expect(screen.queryByRole("group", { name: FAMILY_ROW })).toBeNull();
      cleanup();
    }
  });

  it("keeps the pager in the same row, idle when the filtered list fits one page", () => {
    renderTray();
    const row = screen.getByRole("group", { name: FAMILY_ROW });
    const nav = row.parentElement!;
    expect(nav.className).toContain("ingredient-page-nav--with-family");
    expect(nav.querySelectorAll(".ingredient-page-nav__pager")).toHaveLength(1);
    fireEvent.click(within(row).getByRole("button", { name: only("果物系") }));
    expect(nav.querySelector(".ingredient-page-nav__pager--idle")).not.toBeNull();
  });

  it("does not appear on a list that fits one page", () => {
    const few = ALL_TOPPING_IDS.slice(0, MAX_INGREDIENT_PALETTE_SLOTS);
    renderTray({ ownedIngredientIds: few });
    expect(screen.queryByRole("group", { name: FAMILY_ROW })).toBeNull();
  });

  it("filters the tray to one family, resets to page 1, and 「すべて」 restores the full list", () => {
    renderTray();
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText(/2 \/ \d/)).toBeInTheDocument();

    const [family] = pickFamilyWithMany();
    const label = { meat: "肉系", seafood: "魚介系", vegetable: "野菜・きのこ系", herb: "ハーブ・香味系", spice: "スパイス・薬味系", fruit: "果物系", other: "ちょっと変わった材料" }[family]!;
    fireEvent.click(within(screen.getByRole("group", { name: FAMILY_ROW })).getByRole("button", { name: only(label) }));

    const shown = chipNames();
    const expected = TOPPINGS.filter((t) => ingredientShelf(t.id) === family).map((t) => t.nameJa);
    expect(shown).toEqual(expected.slice(0, MAX_INGREDIENT_PALETTE_SLOTS));
    expect(screen.getByText(new RegExp(`^1 / ${Math.max(1, Math.ceil(expected.length / MAX_INGREDIENT_PALETTE_SLOTS))}$`))).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("group", { name: FAMILY_ROW })).getByRole("button", { name: ALL }));
    expect(chipNames()).toEqual(TOPPINGS.map((t) => t.nameJa).slice(0, MAX_INGREDIENT_PALETTE_SLOTS));
  });

  it("filters the HAND population (handIds) without changing it", () => {
    const hand = ALL_TOPPING_IDS.slice(0, 12);
    const { rerender, onClearSelection } = renderTray({ handIds: hand });
    const families = new Set(hand.map((id) => ingredientShelf(id)));
    const row = screen.getByRole("group", { name: FAMILY_ROW });
    // only families present in the hand are offered
    expect(within(row).getAllByRole("button")).toHaveLength(families.size + 1);
    const [first] = [...families];
    const label = within(row).getAllByRole("button").map((b) => b.textContent!)[1];
    fireEvent.click(within(row).getByRole("button", { name: only(label) }));
    for (const name of chipNames()) {
      const ing = TOPPINGS.find((t) => t.nameJa === name)!;
      expect(hand).toContain(ing.id);
    }
    expect(first).toBeTruthy();
    expect(onClearSelection).not.toHaveBeenCalled();
    rerender(<div />);
  });

  it("clears a selection the filter hides, and keeps one it still shows", () => {
    const [family, ids] = pickFamilyWithMany();
    const other = TOPPINGS.find((t) => ingredientShelf(t.id) !== family)!;
    const label = { meat: "肉系", seafood: "魚介系", vegetable: "野菜・きのこ系", herb: "ハーブ・香味系", spice: "スパイス・薬味系", fruit: "果物系", other: "ちょっと変わった材料" }[family]!;
    const hidden = renderTray({ selectedIngredientId: other.id });
    fireEvent.click(within(screen.getByRole("group", { name: FAMILY_ROW })).getByRole("button", { name: only(label) }));
    expect(hidden.onClearSelection).toHaveBeenCalledTimes(1);
    cleanup();

    const kept = renderTray({ selectedIngredientId: ids[0] });
    fireEvent.click(within(screen.getByRole("group", { name: FAMILY_ROW })).getByRole("button", { name: only(label) }));
    expect(kept.onClearSelection).not.toHaveBeenCalled();
  });

  it("returns to すべて when the category changes", () => {
    const [family] = pickFamilyWithMany();
    const label = { meat: "肉系", seafood: "魚介系", vegetable: "野菜・きのこ系", herb: "ハーブ・香味系", spice: "スパイス・薬味系", fruit: "果物系", other: "ちょっと変わった材料" }[family]!;
    const { rerender } = renderTray();
    fireEvent.click(within(screen.getByRole("group", { name: FAMILY_ROW })).getByRole("button", { name: only(label) }));
    const props = {
      selectedIngredientId: null,
      onSelectIngredient: () => {},
      ownedIngredientIds: ALL_TOPPING_IDS,
      recipe: RECIPES[0],
      freeCook: true,
      inventory: EMPTY_INVENTORY,
      pizza: createEmptyPizza(),
    };
    rerender(<IngredientTray {...props} activeCategory="cheese" />);
    rerender(<IngredientTray {...props} activeCategory="topping" />);
    expect(within(screen.getByRole("group", { name: FAMILY_ROW })).getByRole("button", { name: ALL })).toHaveAttribute("aria-pressed", "true");
  });
});

/**
 * Issue #399 (Owner HV): the family filter may sit ABOVE the tray (`familyPlacement="above"`), with the pager alone in the
 * utility row below it (the 食材庫 entry is gone). The filter itself is the same element in both placements.
 */
describe("family filter placement (Issue #399)", () => {
  it("inline (the default) keeps the filter in the utility row beside the pager", () => {
    renderTray();
    const row = screen.getByRole("group", { name: FAMILY_ROW });
    const nav = row.parentElement!;
    expect(nav.className).toContain("ingredient-page-nav--with-family");
    expect(nav.querySelector(".pantry-entry")).toBeNull();
    expect(nav.querySelector(".ingredient-page-nav__pager")).not.toBeNull();
    expect(document.querySelector(".tray-family-row")).toBeNull();
  });

  it("above: the filter is its own row BEFORE the ingredients; the utility row below keeps only the pager", () => {
    const { container } = renderTray({ familyPlacement: "above" });
    const group = screen.getByRole("group", { name: FAMILY_ROW });
    expect(screen.getAllByRole("group", { name: FAMILY_ROW })).toHaveLength(1); // one filter, never a copy per placement
    const familyRow = group.parentElement!;
    expect(familyRow.className).toBe("tray-family-row");
    const tray = container.querySelector(".ingredient-tray")!;
    // document order: the filter row, then the ingredients, then the utility row
    expect(familyRow.compareDocumentPosition(tray) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const nav = container.querySelector(".ingredient-page-nav")!;
    expect(tray.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nav.className).not.toContain("ingredient-page-nav--with-family");
    expect(nav.contains(group)).toBe(false);
    expect(nav.querySelector(".pantry-entry")).toBeNull();
    expect(nav.querySelector(".ingredient-page-nav__button")).not.toBeNull(); // the pager alone
    expect(container.querySelector(".ingredient-page-nav--with-family")).toBeNull();
  });

  it("above: the same chips, labels and accessible names as inline", () => {
    const names = (placement: "above" | "inline") => {
      const { unmount } = renderTray({ familyPlacement: placement });
      const out = within(screen.getByRole("group", { name: FAMILY_ROW })).getAllByRole("button").map((b) => [b.textContent, b.getAttribute("aria-label")]);
      unmount();
      return out;
    };
    expect(names("above")).toEqual(names("inline"));
  });

  it("above: choosing a family returns to page 1, shows only that family, and the pager stays below (idle when it fits one page)", () => {
    const { container } = renderTray({ familyPlacement: "above" });
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    expect(container.querySelector(".ingredient-page-nav__label")?.textContent).toContain("2 /");
    const row = screen.getByRole("group", { name: FAMILY_ROW });
    fireEvent.click(within(row).getByRole("button", { name: only("果物系") }));
    const nav = container.querySelector(".ingredient-page-nav")!;
    expect(nav.className).toContain("ingredient-page-nav--placeholder"); // one page: the row keeps its place, the pager is inert
    fireEvent.click(within(row).getByRole("button", { name: ALL }));
    expect(container.querySelector(".ingredient-page-nav__label")?.textContent).toContain("1 /");
  });

  it("above: no 食材庫 entry anywhere, the pager row below as before, the filter still above", () => {
    const { container } = renderTray({ familyPlacement: "above" });
    expect(container.querySelector(".tray-family-row")).not.toBeNull();
    expect(container.querySelector(".pantry-entry")).toBeNull();
    expect(container.querySelector(".ingredient-page-nav__pager, .ingredient-page-nav[role='group']")).not.toBeNull();
  });

  it("no family choices (one page): no filter row in either placement", () => {
    const few = ALL_TOPPING_IDS.slice(0, MAX_INGREDIENT_PALETTE_SLOTS);
    for (const placement of ["above", "inline"] as const) {
      const { container, unmount } = renderTray({ ownedIngredientIds: few, familyPlacement: placement });
      expect(container.querySelector(".tray-family-row")).toBeNull();
      expect(screen.queryByRole("group", { name: FAMILY_ROW })).toBeNull();
      unmount();
    }
  });
});
