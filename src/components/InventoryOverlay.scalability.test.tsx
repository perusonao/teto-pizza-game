import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InventoryOverlay } from "./InventoryOverlay";
import type { IngredientCategory } from "../data/ingredients";

/**
 * Inventory Screen scalability, mirroring Issue #86's own IngredientTray.scalability.test.tsx
 * exactly: a synthetic (mocked) 62-ingredient catalog standing in for the Recipe Master
 * foundation's future scale, well past today's real ~14-ingredient catalog. Real production
 * data is untouched -- `vi.mock` below (hoisted above every import in this file, including
 * `./InventoryOverlay`'s own transitive import of `../data/ingredients`) only replaces
 * `INGREDIENTS`/`CATEGORY_ORDER`/`CATEGORY_LABEL` for this one test file. The current real
 * ~14-ingredient catalog's own coverage lives in the sibling InventoryOverlay.test.tsx, which
 * imports the real, unmocked module.
 */

const { MOCK_CATALOG } = vi.hoisted(() => {
  const categories = ["sauce", "cheese", "topping"] as const;
  const catalog = Array.from({ length: 62 }, (_, i) => ({
    id: `mock-${i}`,
    category: categories[i % 3],
    nameJa: `素材${i}`,
    color: "#cccccc",
    emoji: "\u{1F355}",
    placement: categories[i % 3] === "sauce" ? "spread" : ("scatter" as const),
  }));
  return { MOCK_CATALOG: catalog };
});

vi.mock("../data/ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/ingredients")>();
  return {
    ...actual,
    INGREDIENTS: MOCK_CATALOG,
  };
});

function idsForCategory(category: IngredientCategory, count: number): string[] {
  return MOCK_CATALOG.filter((i) => i.category === category)
    .slice(0, count)
    .map((i) => i.id);
}

afterEach(() => {
  cleanup();
});

describe("InventoryOverlay scalability (Issue #86-style catalog growth)", () => {
  it("test 17 (mocked ~30): does not crash and renders every owned ingredient across categories", () => {
    const owned30 = [...idsForCategory("sauce", 10), ...idsForCategory("topping", 20)];
    render(<InventoryOverlay ownedIngredientIds={owned30} inventory={{}} onClose={() => {}} />);
    expect(screen.getAllByText(/^素材\d+$/)).toHaveLength(30);
    expect(screen.getByText(/所持 30\/62種/)).toBeInTheDocument();
  });

  it("test 18 (mocked 62): does not crash and renders the full mocked 62-ingredient catalog when all are owned", () => {
    const allOwned = MOCK_CATALOG.map((i) => i.id);
    render(<InventoryOverlay ownedIngredientIds={allOwned} inventory={{}} onClose={() => {}} />);
    expect(screen.getAllByText(/^素材\d+$/)).toHaveLength(62);
    expect(screen.getByText(/所持 62\/62種/)).toBeInTheDocument();
  });

  it("test 19 (mocked 62): a category tab still bounds the grid to just that category's owned items, never dumping all 62 at once", () => {
    const allOwned = MOCK_CATALOG.map((i) => i.id);
    render(<InventoryOverlay ownedIngredientIds={allOwned} inventory={{}} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "チーズ" }));
    const cheeseCount = MOCK_CATALOG.filter((i) => i.category === "cheese").length;
    expect(screen.getAllByText(/^素材\d+$/)).toHaveLength(cheeseCount);
    expect(cheeseCount).toBeLessThan(62);
  });
});
