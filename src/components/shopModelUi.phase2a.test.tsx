import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReputationGain } from "../logic/progression/shopProgression";
import { HomeScreen } from "../screens/HomeScreen";
import { EMPTY_DEX } from "../state/dex";
import { ResultPanel } from "./ResultPanel";
import { ShopOverlay } from "./ShopOverlay";

/**
 * B案 Phase 2a (Issue #901): the shop model's two UI additions -- RESULT's reputation line + 「次の注文へ」, HOME's
 * reputation line + 「注文を受ける」. Both render only when their props are given (App passes them under the shop model only),
 * so the legacy screens are byte-identical without them.
 */

afterEach(cleanup);

const SCORE = { total: 80, stars: 3 as const, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 };

function result(extra: { reputationGain?: ReputationGain | null; onNextOrder?: () => void; onRetry?: () => void } = {}) {
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
      onRetrySameRecipe={extra.onRetry ?? vi.fn()}
      onBackToPizzaSelect={vi.fn()}
      reputationGain={extra.reputationGain}
      onNextOrder={extra.onNextOrder}
    />,
  );
}

describe("ResultPanel under the shop model", () => {
  it("shows the gain and the distance to the next chapter", () => {
    result({ reputationGain: { gained: 3, before: 12, after: 15, chapterBefore: 1, chapterAfter: 1, nextFloor: 40 } });
    expect(screen.getByTestId("result-reputation")).toHaveTextContent("評判 +3（12 → 15）");
    expect(screen.getByTestId("result-reputation")).toHaveTextContent("第2章まで あと 25");
  });

  it("announces a chapter reached", () => {
    result({ reputationGain: { gained: 5, before: 38, after: 43, chapterBefore: 1, chapterAfter: 2, nextFloor: 110 } });
    expect(screen.getByTestId("result-reputation")).toHaveTextContent("第2章に進みました！");
  });

  it("「次の注文へ」 is the primary CTA when wired; the retry stays, as secondary", () => {
    const onNextOrder = vi.fn();
    result({ onNextOrder });
    const next = screen.getByRole("button", { name: /次の注文へ/ });
    expect(next).toHaveClass("cta-button--primary");
    expect(screen.getByRole("button", { name: "もう一度つくる" })).toHaveClass("cta-button--secondary");
    fireEvent.click(next);
    expect(onNextOrder).toHaveBeenCalledTimes(1);
  });

  it("without the props (legacy) nothing is added and the retry stays primary", () => {
    result();
    expect(screen.queryByTestId("result-reputation")).toBeNull();
    expect(screen.queryByRole("button", { name: /次の注文へ/ })).toBeNull();
    expect(screen.getByRole("button", { name: "もう一度つくる" })).toHaveClass("cta-button--primary");
  });

  it("a zero gain renders no line", () => {
    result({ reputationGain: { gained: 0, before: 4, after: 4, chapterBefore: 1, chapterAfter: 1, nextFloor: 40 } });
    expect(screen.queryByTestId("result-reputation")).toBeNull();
  });
});

function home(extra: { onTakeOrder?: () => void; shopStatus?: { reputation: number; chapter: number; nextFloor: number | null } | null } = {}) {
  const onStartFreePlay = vi.fn();
  render(
    <HomeScreen
      pitzBalance={0}
      dex={EMPTY_DEX}
      ownedIngredientCount={0}
      totalIngredientCount={0}
      onStartFreePlay={onStartFreePlay}
      onStartLunchRush={vi.fn()}
      onOpenDex={vi.fn()}
      onOpenShop={vi.fn()}
      onOpenInventory={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenRanking={vi.fn()}
      onTakeOrder={extra.onTakeOrder}
      shopStatus={extra.shopStatus}
    />,
  );
  return { onStartFreePlay };
}

describe("HomeScreen under the shop model", () => {
  it("shows the reputation line and takes orders from the primary CTA; Pizza Select stays as a link", () => {
    const onTakeOrder = vi.fn();
    const { onStartFreePlay } = home({ onTakeOrder, shopStatus: { reputation: 12, chapter: 1, nextFloor: 40 } });
    const line = screen.getByTestId("home-reputation");
    expect(line).toHaveTextContent("評判 12");
    expect(line).toHaveTextContent("第1章");
    expect(line).toHaveTextContent("次の章まで あと 28");
    fireEvent.click(screen.getByRole("button", { name: /注文を受ける/ }));
    expect(onTakeOrder).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /メニューから選んで作る/ }));
    expect(onStartFreePlay).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /ピザを作る/ })).toBeNull();
  });

  it("the last chapter says so", () => {
    home({ onTakeOrder: vi.fn(), shopStatus: { reputation: 400, chapter: 5, nextFloor: null } });
    expect(screen.getByTestId("home-reputation")).toHaveTextContent("最終章");
  });

  it("without the props (legacy) HOME is as before", () => {
    home();
    expect(screen.queryByTestId("home-reputation")).toBeNull();
    expect(screen.queryByRole("button", { name: /注文を受ける/ })).toBeNull();
    expect(screen.getByRole("button", { name: /ピザを作る/ })).toBeInTheDocument();
  });
});

describe("ShopOverlay under the shop model", () => {
  function shop(shopStatus: { reputation: number; chapter: number; nextFloor: number | null } | null) {
    render(
      <ShopOverlay
        dex={[]}
        ownedIngredientIds={[]}
        unlockedForShopIngredientIds={[]}
        pitzBalance={0}
        inventory={{}}
        onPurchase={vi.fn()}
        onRestock={vi.fn()}
        onClose={vi.fn()}
        shopStatus={shopStatus}
      />,
    );
  }

  it("the progress line names the next chapter's reputation, not a discovery count", () => {
    shop({ reputation: 42, chapter: 2, nextFloor: 110 });
    expect(screen.getByText(/評判があと68で第3章：新しい材料が入荷/)).toBeInTheDocument();
    expect(screen.queryByText(/つ発見で新しい材料が入荷/)).toBeNull();
  });

  it("no progress line once the last chapter is open", () => {
    shop({ reputation: 400, chapter: 5, nextFloor: null });
    expect(screen.queryByText(/新しい材料が入荷/)).toBeNull();
  });

  it("legacy (no status): the discovery-count line is as before", () => {
    shop(null);
    expect(screen.getByText(/つ発見で新しい材料が入荷/)).toBeInTheDocument();
  });
});
