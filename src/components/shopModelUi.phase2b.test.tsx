import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// B案 Phase 2b: the screens under the shop model (what `?progression=shop` selects on Preview). The wording switch is a
// per-page-load constant, so the flag module is replaced before anything imports it. The legacy side is
// ./shopModelUi.phase2b.legacy.test.tsx.
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { cleanup, render, screen } from "@testing-library/react";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { SHOP_COPY_ACTIVE } from "../logic/progression/shopCopy";
import { SHOP_MODEL_ACTIVE } from "../logic/progression/shopStatus";
import { HomeScreen } from "../screens/HomeScreen";
import { PizzaSelectScreen } from "../screens/PizzaSelectScreen";
import { EMPTY_DEX } from "../state/dex";
import { homeBubbleJa } from "../state/homeBubble";
import { describeSettledRound } from "../state/roundNoticeCopy";
import { ANONYMOUS_LOCK_HINTS } from "./anonymousLockHints";
import { ResultPanel } from "./ResultPanel";
import { NOTEBOOK_COPY } from "./trialNotebookCopy";

afterEach(cleanup);

const SCORE = { total: 80, stars: 3 as const, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 };
const GAIN = { gained: 3, before: 20, after: 23, chapterBefore: 1, chapterAfter: 1, nextFloor: 40 };

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

it("the copy switch agrees with the model switch", () => {
  expect(SHOP_COPY_ACTIVE).toBe(true);
  expect(SHOP_COPY_ACTIVE).toBe(SHOP_MODEL_ACTIVE);
});

describe("RESULT of a practice round (Q7)", () => {
  it("says it earned nothing, shows no reputation line and no 「次の注文へ」 -- even when they are wired", () => {
    result({ practice: true, reputationGain: GAIN, onNextOrder: vi.fn() });
    expect(screen.getByTestId("result-practice")).toHaveTextContent("練習なので、Pitz・評判は入りません");
    expect(screen.queryByTestId("result-reputation")).toBeNull();
    expect(screen.queryByRole("button", { name: /次の注文へ/ })).toBeNull();
    expect(screen.getByRole("button", { name: "もう一度練習する" })).toHaveClass("cta-button--primary");
    expect(screen.getByRole("button", { name: "メニューから選んで練習する" })).toBeInTheDocument();
  });

  it("an order's RESULT has no practice line; its retry is labelled as practice", () => {
    result({ reputationGain: GAIN, onNextOrder: vi.fn() });
    expect(screen.queryByTestId("result-practice")).toBeNull();
    expect(screen.getByTestId("result-reputation")).toHaveTextContent("評判 +3");
    expect(screen.getByRole("button", { name: /次の注文へ/ })).toHaveClass("cta-button--primary");
    expect(screen.getByRole("button", { name: "練習でもう一度つくる" })).toHaveClass("cta-button--secondary");
  });
});

describe("the rank ladder replaces the chapter on RESULT", () => {
  it.each([
    [{ gained: 3, before: 13, after: 16, chapterBefore: 1, chapterAfter: 1, nextFloor: 40 }, "駆け出し（屋台）に昇格しました！"],
    [{ gained: 8, before: 105, after: 113, chapterBefore: 2, chapterAfter: 3, nextFloor: 210 }, "職人（人気店）に昇格しました！"],
    [{ gained: 8, before: 335, after: 343, chapterBefore: 4, chapterAfter: 5, nextFloor: null }, "匠（伝説の店）に昇格しました！"],
  ])("a promotion is announced by title (%#)", (gain, text) => {
    result({ reputationGain: gain, onNextOrder: vi.fn() });
    expect(screen.getByTestId("result-rank-up")).toHaveTextContent(text);
    expect(screen.getByTestId("result-reputation")).not.toHaveTextContent("章");
  });

  it("no promotion: the distance to the next title", () => {
    result({ reputationGain: { gained: 2, before: 41, after: 43, chapterBefore: 2, chapterAfter: 2, nextFloor: 110 }, onNextOrder: vi.fn() });
    expect(screen.queryByTestId("result-rank-up")).toBeNull();
    expect(screen.getByTestId("result-reputation")).toHaveTextContent("次のランクまで あと 67");
  });

  it("at the top: no next line", () => {
    result({ reputationGain: { gained: 8, before: 400, after: 408, chapterBefore: 5, chapterAfter: 5, nextFloor: null }, onNextOrder: vi.fn() });
    expect(screen.getByTestId("result-reputation")).not.toHaveTextContent("次のランク");
  });
});

describe("「発見」 reads 「メニュー開発」 under the shop model", () => {
  it("RESULT: a Free Cooking first discovery is a new menu, and its Pitz bonus is the menu-development bonus", () => {
    result({
      freeCook: true,
      justDiscovered: true,
      discovery: { kind: "NEW_DISCOVERY", recipeId: "margherita", targetId: "margherita" },
      pitzCredit: { baseReward: 100, multiplier: 1, earnedPitz: 100, discoveryBonusPitz: 50, balanceBefore: 0, balanceAfter: 150 },
    });
    expect(screen.getByText(/NEW MENU!/)).toBeInTheDocument();
    expect(screen.getByText(/を新メニューとして開発しました！/)).toBeInTheDocument();
    expect(screen.getByText(/メニュー開発 \+50/)).toBeInTheDocument();
    expect(screen.queryByText(/発見/)).toBeNull();
  });

  it("RESULT: an already-known Free Cooking match is on the menu", () => {
    result({ freeCook: true, discovery: { kind: "ALREADY_DISCOVERED", recipeId: "margherita", targetId: "margherita" } });
    expect(screen.getByText(/マルゲリータができた！（メニューにあります）/)).toBeInTheDocument();
  });

  it("HOME: the Free Cooking CTA, the Dex count and the Dinner card", () => {
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
        onTakeOrder={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /^\u{1F3A8} メニュー開発$/u })).toBeInTheDocument();
    expect(screen.getByText(/開発 0\//)).toBeInTheDocument();
    expect(screen.getByText(/メニュー開発で解放/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /メニューから選んで練習する/ })).toBeInTheDocument();
    expect(screen.queryByText(/発見/)).toBeNull();
  });

  it("Pizza Select: practice heading and note; the discovery prompt is menu development", () => {
    render(<PizzaSelectScreen dex={EMPTY_DEX} ownedIngredientIds={STARTER_INGREDIENT_IDS} onSelectRecipe={vi.fn()} onBack={vi.fn()} onGoFreeCook={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "練習するピザを選ぼう！" })).toBeInTheDocument();
    expect(screen.getByTestId("pizza-select-practice-note")).toHaveTextContent("ここで作るピザは練習です（Pitz・評判は入りません）");
    expect(screen.queryByText(/発見/)).toBeNull();
  });

  it("the copy modules", () => {
    expect(homeBubbleJa({ lunchRushLocked: true, newShopMaterialCount: 0, discoverableCount: 0 })).toBe(
      "まずはメニュー開発で最初の1枚を見つけよう！",
    );
    expect(NOTEBOOK_COPY.emptyHint).toBe("メニュー開発で作ってみよう！");
    expect(ANONYMOUS_LOCK_HINTS.AGGREGATED).toBe("\u{1F3A8} まだ開発できるメニューがあるよ");
    const lines = describeSettledRound({
      outcome: "REGISTERED",
      recipeId: "margherita",
      stars: 3,
      earnedPitz: 0,
      discovered: true,
      newBest: false,
      newMaterialIds: [],
      newTechniqueIds: [],
    }).lines;
    expect(lines).toContain("新しいメニューを開発しました。");
  });
});
