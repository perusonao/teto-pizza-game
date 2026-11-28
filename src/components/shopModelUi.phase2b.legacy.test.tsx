import "../test/legacyProgression";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { SHOP_COPY_ACTIVE } from "../logic/progression/shopCopy";
import { HomeScreen } from "../screens/HomeScreen";
import { PizzaSelectScreen } from "../screens/PizzaSelectScreen";
import { EMPTY_DEX } from "../state/dex";
import { homeBubbleJa } from "../state/homeBubble";
import { ANONYMOUS_LOCK_HINTS } from "./anonymousLockHints";
import { ResultPanel } from "./ResultPanel";
import { NOTEBOOK_COPY } from "./trialNotebookCopy";

/**
 * B案 Phase 2b (Issue #901): under the legacy model every string Phase 2b switches is the legacy one, and
 * the practice line never renders. The shop side is ./shopModelUi.phase2b.test.tsx.
 */

afterEach(cleanup);

const SCORE = { total: 80, stars: 3 as const, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 };

function result(extra: Partial<Parameters<typeof ResultPanel>[0]> = {}) {
  return render(
    <ResultPanel
      completion={{ status: "PASS" }}
      score={SCORE}
      bakeState="perfect"
      sauceScore={null}
      headingJa="おいしい！"
      recipeNameJa="マルゲリータ"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={null}
      onRetrySameRecipe={vi.fn()}
      onBackToPizzaSelect={vi.fn()}
      {...extra}
    />,
  );
}

it("the legacy model is running", () => {
  expect(SHOP_COPY_ACTIVE).toBe(false);
});

describe("the legacy wording is unchanged", () => {
  it("RESULT of a guided round: the legacy CTAs, no practice line", () => {
    result();
    expect(screen.queryByTestId("result-practice")).toBeNull();
    expect(screen.getByRole("button", { name: "もう一度つくる" })).toHaveClass("cta-button--primary");
    expect(screen.getByRole("button", { name: "別のピザを作る" })).toBeInTheDocument();
  });

  it("RESULT of a first discovery", () => {
    result({
      freeCook: true,
      justDiscovered: true,
      discovery: { kind: "NEW_DISCOVERY", recipeId: "margherita", targetId: "margherita" },
      pitzCredit: { baseReward: 100, multiplier: 1, earnedPitz: 100, discoveryBonusPitz: 50, balanceBefore: 0, balanceAfter: 150 },
    });
    expect(screen.getByText(/NEW PIZZA!/)).toBeInTheDocument();
    expect(screen.getByText(/を発見しました！/)).toBeInTheDocument();
    expect(screen.getByText(/初回発見 \+50/)).toBeInTheDocument();
  });

  it("HOME", () => {
    render(
      <HomeScreen
        pitzBalance={0}
        dex={EMPTY_DEX}
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
    expect(screen.getByRole("button", { name: /^\u{1F3A8} レシピ発見$/u })).toBeInTheDocument();
    expect(screen.getByText(/発見 0\//)).toBeInTheDocument();
    expect(screen.getByText(/発見で解放/)).toBeInTheDocument();
    expect(screen.queryByText(/メニュー開発|練習/)).toBeNull();
  });

  it("Pizza Select", () => {
    render(<PizzaSelectScreen dex={EMPTY_DEX} ownedIngredientIds={STARTER_INGREDIENT_IDS} onSelectRecipe={vi.fn()} onBack={vi.fn()} onGoFreeCook={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "作るピザを選ぼう！" })).toBeInTheDocument();
    expect(screen.queryByTestId("pizza-select-practice-note")).toBeNull();
    expect(screen.queryByText(/メニュー開発|練習/)).toBeNull();
  });

  it("the copy modules", () => {
    expect(homeBubbleJa({ lunchRushLocked: true, newShopMaterialCount: 0, discoverableCount: 0 })).toBe(
      "まずはレシピ発見で最初の1枚を見つけよう！",
    );
    expect(NOTEBOOK_COPY.emptyHint).toBe("レシピ発見で作ってみよう！");
    expect(ANONYMOUS_LOCK_HINTS.AGGREGATED).toBe("\u{1F3A8} まだ発見できるピザがあるよ");
  });
});
