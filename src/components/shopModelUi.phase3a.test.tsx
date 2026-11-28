import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// B案 Phase 3a: the Dex, HOME's Dex pill and Pizza Select under the shop model (what `?progression=shop` selects on
// Preview) read the curated 60 (`MENU_CATALOG`). The flag is a per-page-load constant, so the module is replaced before
// anything imports it. The legacy side is ./shopModelUi.phase3a.legacy.test.tsx.
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { cleanup, render, screen, within } from "@testing-library/react";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { MENU_CATALOG } from "../data/menuCatalog";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { HomeScreen } from "../screens/HomeScreen";
import { PizzaSelectScreen } from "../screens/PizzaSelectScreen";
import type { DexEntry, DexState } from "../state/dex";
import { buildPizzaSelectView } from "../state/pizzaSelect";
import {
  buildRecipeChapters,
  dexDiscoveredCount,
  dexRecipes,
  recipeChapter,
  recipeChapterSlot,
} from "../state/recipeChapters";
import { DexOverlay } from "./DexOverlay";

afterEach(cleanup);

const ADOPTED = new Set(MENU_CATALOG.map((e) => e.recipeId as string));
/** A recipe in `RECIPES` the curated catalog does not adopt. */
const NOT_ADOPTED = RECIPES.find((r) => !ADOPTED.has(r.id))!;

const dexOf = (...ids: string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));

function home(dex: DexState) {
  return render(
    <HomeScreen
      pitzBalance={0}
      dex={dex}
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
      onTakeOrder={vi.fn()}
    />,
  );
}

describe("the shop model's Dex recipes are the curated 60", () => {
  it("dexRecipes() is the adopted recipes in RECIPES order", () => {
    expect(activeProgressionModel().id).toBe("shop");
    expect(dexRecipes().map((r) => r.id)).toEqual(RECIPES.filter((r) => ADOPTED.has(r.id)).map((r) => r.id));
    expect(dexRecipes()).toHaveLength(60);
    expect(dexRecipes()).toBe(dexRecipes());
  });

  it("a recipe's chapter is its stage in the catalog", () => {
    for (const e of MENU_CATALOG) expect(recipeChapter(getRecipe(e.recipeId as RecipeId)!)).toBe(e.chapter);
  });

  it("the chapters are the five stages of 12, in the Owner's stage assignment", () => {
    const chapters = buildRecipeChapters();
    expect(chapters.map((c) => [c.chapter, c.recipes.length])).toEqual([
      [1, 12],
      [2, 12],
      [3, 12],
      [4, 12],
      [5, 12],
    ]);
    for (const c of chapters) {
      expect(new Set(c.recipes.map((r) => r.id))).toEqual(
        new Set(MENU_CATALOG.filter((e) => e.chapter === c.chapter).map((e) => e.recipeId)),
      );
    }
  });

  it("a recipe the catalog does not adopt has no Dex slot", () => {
    expect(recipeChapterSlot(NOT_ADOPTED)).toBe(0);
    expect(recipeChapterSlot(getRecipe("margherita")!)).toBeGreaterThan(0);
  });

  it("the discovered count counts only adopted recipes", () => {
    expect(dexDiscoveredCount(dexOf("margherita", NOT_ADOPTED.id))).toBe(1);
    expect(dexDiscoveredCount([{ recipeId: "margherita", discovered: false, bestScore: 0, bestStars: 1, timesMade: 0 }])).toBe(0);
  });
});

describe("screens", () => {
  it("HOME's Dex pill reads x/60 and ignores a non-adopted discovery", () => {
    home(dexOf("margherita", NOT_ADOPTED.id));
    expect(screen.getByText(/^\u{1F451} メニュー 1\/60$/u)).toBeInTheDocument();
    expect(screen.getByLabelText("ピザ図鑑 メニュー 1 / 60")).toBeInTheDocument();
    expect(screen.getByText(/^メニュー 1\/60$/)).toBeInTheDocument();
  });

  it("the Dex lists 60 slots in five stages of 12 and counts x/60", () => {
    const { container } = render(
      <DexOverlay dex={dexOf("margherita", NOT_ADOPTED.id)} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />,
    );
    const chapters = container.querySelectorAll(".dex-overlay__chapter");
    expect(chapters).toHaveLength(5);
    expect([...container.querySelectorAll(".dex-overlay__chapter-count")].map((n) => n.textContent)).toEqual([
      "1/12",
      "0/12",
      "0/12",
      "0/12",
      "0/12",
    ]);
    expect(container.querySelectorAll(".dex-overlay__chapter .dex-card")).toHaveLength(60);
    expect(screen.getByText(/開発 1 \/ 60/)).toBeInTheDocument();
    expect(screen.queryByText(NOT_ADOPTED.nameJa)).toBeNull();
  });

  it("Pizza Select (practice): each stage counts x/12; a non-adopted recipe gets no card", () => {
    const dex = dexOf("margherita", "capricciosa", NOT_ADOPTED.id);
    // Phase 3b: capricciosa is a stage-2 recipe, so it is on the menu (and gets a card) once stage 2 is open (reputation 40).
    const shop = { reputation: 40, grantedMenuRecipeIds: [] };
    const view = buildPizzaSelectView({ dex, ownedIngredientIds: STARTER_INGREDIENT_IDS, unlockedForShopIngredientIds: [], inventory: {}, shop });
    expect(view.chapters.map((c) => [c.chapter, c.discovered, c.total])).toEqual([
      [1, 1, 12],
      [2, 1, 12],
      [3, 0, 12],
      [4, 0, 12],
      [5, 0, 12],
    ]);
    expect(view.chapters.flatMap((c) => c.cards.map((card) => card.recipe.id))).not.toContain(NOT_ADOPTED.id);
    render(<PizzaSelectScreen dex={dex} ownedIngredientIds={STARTER_INGREDIENT_IDS} shop={shop} onSelectRecipe={vi.fn()} onBack={vi.fn()} onGoFreeCook={vi.fn()} />);
    const sections = document.querySelectorAll(".pizza-select-section");
    expect(sections).toHaveLength(5);
    expect(within(sections[0] as HTMLElement).getByText(/開発 1\/12/)).toBeInTheDocument();
    expect(within(sections[1] as HTMLElement).getByText(/開発 1\/12/)).toBeInTheDocument();
  });
});
