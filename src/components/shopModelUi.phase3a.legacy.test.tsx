import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, getRecipe } from "../data/recipes";
import { LEGACY_PROGRESSION, activeProgressionModel } from "../logic/progression/progressionModel";
import { HomeScreen } from "../screens/HomeScreen";
import type { DexEntry, DexState } from "../state/dex";
import { buildPizzaSelectView } from "../state/pizzaSelect";
import {
  buildRecipeChapters,
  dexDiscoveredCount,
  dexRecipes,
  legacyRecipeChapter,
  recipeChapterSlot,
} from "../state/recipeChapters";
import { DexOverlay } from "./DexOverlay";

// B案 Phase 3a: flag OFF (the Production default, legacy). The Dex, HOME's Dex pill and Pizza Select read every recipe at
// its legacy chapter, exactly as before the curated catalog landed. The shop side is ./shopModelUi.phase3a.test.tsx.

afterEach(cleanup);

const dexOf = (...ids: string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));

describe("legacy: the Dex is every recipe (unchanged by Phase 3a)", () => {
  it("dexRecipes() is RECIPES itself", () => {
    expect(activeProgressionModel()).toBe(LEGACY_PROGRESSION);
    expect(dexRecipes()).toBe(RECIPES);
    expect(LEGACY_PROGRESSION.catalogRecipes()).toBe(RECIPES);
  });

  it("chapters are the legacy chapters over every recipe", () => {
    const chapters = buildRecipeChapters();
    expect(chapters.reduce((n, c) => n + c.recipes.length, 0)).toBe(RECIPES.length);
    for (const c of chapters) for (const r of c.recipes) expect(legacyRecipeChapter(r)).toBe(c.chapter);
    expect(recipeChapterSlot(getRecipe("margherita")!)).toBeGreaterThan(0);
  });

  it("the discovered count is every discovered entry, as before (pizza-salad counts)", () => {
    expect(dexDiscoveredCount(dexOf("margherita", "pizza-salad"))).toBe(2);
  });

  it("HOME's Dex pill reads x/RECIPES.length", () => {
    render(
      <HomeScreen
        pitzBalance={0}
        dex={dexOf("margherita", "pizza-salad")}
        ownedIngredientCount={0}
        totalIngredientCount={0}
        onStartFreePlay={vi.fn()}
        onStartFreeCook={vi.fn()}
        onStartLunchRush={vi.fn()}
        onOpenDinner={vi.fn()}
        onOpenDex={vi.fn()}
        onOpenShop={vi.fn()}
        onOpenInventory={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenRanking={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(`レシピ図鑑 発見数 2 / ${RECIPES.length}`)).toBeInTheDocument();
  });

  it("the Dex lists every recipe", () => {
    const { container } = render(<DexOverlay dex={dexOf("margherita")} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />);
    expect(container.querySelectorAll(".dex-overlay__chapter .dex-card")).toHaveLength(RECIPES.length);
    expect(screen.getByText(new RegExp(`発見 1 / ${RECIPES.length}`))).toBeInTheDocument();
  });

  it("Pizza Select's chapter totals sum to every recipe", () => {
    const view = buildPizzaSelectView({ dex: dexOf("margherita"), ownedIngredientIds: STARTER_INGREDIENT_IDS, unlockedForShopIngredientIds: [], inventory: {} });
    expect(view.chapters.reduce((n, c) => n + c.total, 0)).toBe(RECIPES.length);
  });
});
