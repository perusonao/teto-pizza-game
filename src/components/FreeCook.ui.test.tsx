import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { ResultPanel } from "./ResultPanel";
import { HomeScreen } from "../screens/HomeScreen";
import { FREE_COOK_RECIPE } from "../data/freeCook";
import { getRecipe } from "../data/recipes";
import { STARTER_INGREDIENT_IDS, type IngredientCategory } from "../data/ingredients";
import { EMPTY_DEX } from "../state/dex";
import { EMPTY_INVENTORY, type InventoryState } from "../state/inventory";
import { createEmptyPizza } from "../state/pizzaState";
import type { ScoreBreakdown } from "../logic/scoring";

/**
 * Progression 2.0 Phase 3-2 (Issue #194): the free-cook UI surfaces -- the all-OWNED tray, the
 * NEW / KNOWN / ORIGINAL result card and the HOME entry. Reducer behaviour is covered by
 * ../state/gameReducer.freeCook.test.ts.
 */

afterEach(() => cleanup());

function renderTray(
  category: IngredientCategory,
  owned: readonly string[],
  { freeCook = true, inventory = EMPTY_INVENTORY }: { freeCook?: boolean; inventory?: InventoryState } = {},
) {
  return render(
    <IngredientTray
      activeCategory={category}
      selectedIngredientId={null}
      onSelectIngredient={() => {}}
      ownedIngredientIds={owned}
      recipe={freeCook ? FREE_COOK_RECIPE : getRecipe("margherita")!}
      freeCook={freeCook}
      inventory={inventory}
      pizza={createEmptyPizza()}
    />,
  );
}

const chipNames = () =>
  Array.from(document.querySelectorAll(".ingredient-chip__name")).map((n) => n.textContent);

describe("IngredientTray in a free-cook round", () => {
  it("offers every OWNED ingredient of the step's category, not a recipe subset", () => {
    renderTray("cheese", [...STARTER_INGREDIENT_IDS, "gorgonzola", "parmigiano"]);
    expect(chipNames()).toEqual(expect.arrayContaining(["モッツァレラ", "ゴルゴンゾーラ", "パルミジャーノ"]));
    expect(chipNames()).toHaveLength(3);
  });

  it("never lists a LOCKED / AVAILABLE_TO_BUY ingredient", () => {
    renderTray("cheese", STARTER_INGREDIENT_IDS);
    expect(chipNames()).toEqual(["モッツァレラ"]);
  });

  it("the recipe-guided tray is unchanged: still only the recipe's own required ingredients", () => {
    renderTray("cheese", [...STARTER_INGREDIENT_IDS, "gorgonzola"], { freeCook: false });
    expect(chipNames()).toEqual(["モッツァレラ"]);
  });

  it("an owned ingredient with 0 stock stays listed but disabled with its ×0 badge", () => {
    renderTray("topping", [...STARTER_INGREDIENT_IDS, "onion"], { inventory: { onion: 0 } });
    const onion = screen.getByRole("button", { name: /たまねぎ/ });
    expect(onion).toBeDisabled();
    expect(onion).toHaveTextContent("×0");
    expect(screen.getByRole("button", { name: /バジル/ })).toHaveTextContent("∞");
  });

  it("pages a large owned set instead of scrolling (6 per page)", () => {
    const toppings = ["basil", "garlic", "oregano", "mushroom", "egg", "bacon", "onion", "sausage"];
    renderTray("topping", [...STARTER_INGREDIENT_IDS, ...toppings]);
    expect(chipNames()).toHaveLength(6);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    expect(chipNames()).toHaveLength(2);
  });
});

function resultProps() {
  return {
    completion: { status: "PASS" as const },
    bakeState: "perfect" as const,
    sauceScore: null,
    headingJa: "",
    recipeNameJa: "マルゲリータ",
    justDiscovered: false,
    justGotNewBest: false,
    pitzCredit: null,
    starterGrantNotice: null,
    freeCook: true,
    onRetrySameRecipe: vi.fn(),
    onBackToPizzaSelect: vi.fn(),
  };
}

const SCORE: ScoreBreakdown = { matchScore: 80, ingredientScore: 90, placementScore: 70, bakeScore: 60, total: 75, stars: 3 };

describe("ResultPanel in a free-cook round", () => {
  it("NEW: shows the NEW PIZZA discovery banner once", () => {
    render(
      <ResultPanel
        {...resultProps()}
        score={SCORE}
        justDiscovered
        discovery={{ kind: "NEW_DISCOVERY", recipeId: "margherita", targetId: "shipped:margherita" }}
      />,
    );
    // W1-d: stamp and name are separate runs inside the one banner (same text content).
    const banners = document.querySelectorAll(".discovered-banner--new-pizza");
    expect(banners).toHaveLength(1);
    expect(banners[0]).toHaveTextContent("NEW PIZZA! ✨ マルゲリータを発見しました！");
  });

  it("KNOWN: names the recipe as already discovered, with no discovery banner", () => {
    render(
      <ResultPanel
        {...resultProps()}
        score={SCORE}
        discovery={{ kind: "ALREADY_DISCOVERED", recipeId: "margherita", targetId: "shipped:margherita" }}
      />,
    );
    expect(screen.getByText(/マルゲリータができた！（発見済み）/)).toBeInTheDocument();
    expect(screen.queryByText(/を発見しました/)).not.toBeInTheDocument();
  });

  it("ORIGINAL: a completed, non-failure card with the ingredients used and free-cook CTAs", () => {
    const props = resultProps();
    const { container } = render(
      <ResultPanel
        {...props}
        score={null}
        discovery={{ kind: "ORIGINAL", blockedTargetIds: [] }}
        usedIngredientIds={["tomato-sauce", "mozzarella"]}
      />,
    );
    expect(screen.getByText(/オリジナルピザ完成！/)).toBeInTheDocument();
    expect(screen.getByText("図鑑にはない、あなただけのピザ！")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "使った材料" })).toHaveTextContent("モッツァレラ");
    expect(container.querySelector(".result-panel--failed")).toBeNull();
    expect(screen.queryByText("失敗")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "もう一度じゆうに作る" }));
    expect(props.onRetrySameRecipe).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "レシピを選んで作る" })).toBeInTheDocument();
  });

  it("ORIGINAL near miss (INCOMPLETE_MATCH) nudges without naming the recipe", () => {
    render(
      <ResultPanel
        {...resultProps()}
        score={null}
        discovery={{ kind: "INCOMPLETE_MATCH", recipeId: "margherita", targetId: "shipped:margherita" }}
      />,
    );
    expect(screen.getByText(/図鑑のピザまであと少し/)).toBeInTheDocument();
    expect(screen.queryByText(/マルゲリータ/)).not.toBeInTheDocument();
  });

  it("recipe-guided rounds keep their original CTA copy", () => {
    render(<ResultPanel {...resultProps()} freeCook={false} score={SCORE} />);
    expect(screen.getByRole("button", { name: "もう一度つくる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "別のピザを作る" })).toBeInTheDocument();
  });
});

describe("HOME free-cook entry", () => {
  it("フリークッキング starts free cooking without going through recipe selection", () => {
    const onStartFreeCook = vi.fn();
    const onStartFreePlay = vi.fn();
    render(
      <HomeScreen
        pitzBalance={0}
        dex={EMPTY_DEX}
        ownedIngredientCount={3}
        totalIngredientCount={22}
        onStartFreePlay={onStartFreePlay}
        onStartFreeCook={onStartFreeCook}
        onStartLunchRush={() => {}}
        onOpenDex={() => {}}
        onOpenShop={() => {}}
        onOpenInventory={() => {}}
        onOpenSettings={() => {}}
        onOpenRanking={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /フリークッキング/ }));
    expect(onStartFreeCook).toHaveBeenCalledTimes(1);
    expect(onStartFreePlay).not.toHaveBeenCalled();
    // PR #197 review: DOM (focus / reading) order equals the visual rows -- the full-width
    // フリークッキング row is last, with no CSS `order` reshuffling.
    const ctaLabels = Array.from(document.querySelectorAll(".home-cta-row button")).map((b) =>
      b.textContent?.replace(/^\S+\s*/, ""),
    );
    expect(ctaLabels).toEqual(["ピザを作る", "ランチラッシュ", "フリークッキング"]);
  });
});
