import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReputationGain } from "../logic/progression/shopProgression";
import { isReputationTableComplete, REPUTATION_TABLE } from "../logic/progression/reputationTable";
import { buildShopReputationStatus, type ShopReputationStatus } from "../logic/progression/shopStatus";
import { HomeScreen } from "../screens/HomeScreen";
import { EMPTY_DEX } from "../state/dex";
import { ResultPanel } from "./ResultPanel";
import { ShopOverlay } from "./ShopOverlay";

/**
 * B案 Phase 2a (Issue #901): the shop model's two UI additions -- RESULT's reputation line + 「次の注文へ」, HOME's
 * reputation line + 「注文を受ける」. Both render only when their props are given (App passes them under the shop model only),
 * so the legacy screens are byte-identical without them.
 *
 * Phase 2b (Owner 2026-11-26): the chapter wording became the owner's title ladder (見習い / 駆け出し / 一人前 / 職人 / 達人 / 匠), so
 * the lines that named 「第○章」 now name the title; the numbers they show are the same.
 */

if (!isReputationTableComplete(REPUTATION_TABLE)) throw new Error("the reputation table is complete since Phase 2a");
const TABLE = REPUTATION_TABLE;
const status = (reputation: number): ShopReputationStatus => buildShopReputationStatus(reputation, TABLE);

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
  it("shows the gain and the distance to the next rank", () => {
    result({ reputationGain: { gained: 3, before: 20, after: 23, chapterBefore: 1, chapterAfter: 1, nextFloor: 40 } });
    expect(screen.getByTestId("result-reputation")).toHaveTextContent("評判 +3（20 → 23）");
    expect(screen.getByTestId("result-reputation")).toHaveTextContent("次のランクまで あと 17");
  });

  it("announces a rank reached (the chapter floor 40 is 一人前)", () => {
    result({ reputationGain: { gained: 5, before: 38, after: 43, chapterBefore: 1, chapterAfter: 2, nextFloor: 110 } });
    expect(screen.getByTestId("result-reputation")).toHaveTextContent("一人前（小さな店）に昇格しました！");
  });

  it("「次の注文へ」 is the primary CTA when wired; the retry stays, as secondary", () => {
    const onNextOrder = vi.fn();
    result({ onNextOrder });
    const next = screen.getByRole("button", { name: /次の注文へ/ });
    expect(next).toHaveClass("cta-button--primary");
    // Phase 2b (Q7): under the shop model a retry is practice, and its label says so.
    expect(screen.getByRole("button", { name: "練習でもう一度つくる" })).toHaveClass("cta-button--secondary");
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

function home(extra: { onTakeOrder?: () => void; shopStatus?: ShopReputationStatus | null } = {}) {
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
    const { onStartFreePlay } = home({ onTakeOrder, shopStatus: status(12) });
    const line = screen.getByTestId("home-reputation");
    expect(line).toHaveTextContent("評判 12");
    expect(line).toHaveTextContent("見習い（屋台）");
    expect(line).toHaveTextContent("次のランクまで あと 3");
    fireEvent.click(screen.getByRole("button", { name: /注文を受ける/ }));
    expect(onTakeOrder).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /メニューから選んで練習する/ }));
    expect(onStartFreePlay).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /ピザを作る/ })).toBeNull();
  });

  it("the top rank says so", () => {
    home({ onTakeOrder: vi.fn(), shopStatus: status(400) });
    expect(screen.getByTestId("home-reputation")).toHaveTextContent("匠（伝説の店）");
    expect(screen.getByTestId("home-reputation")).toHaveTextContent("最高ランク");
  });

  it("without the props (legacy) HOME is as before", () => {
    home();
    expect(screen.queryByTestId("home-reputation")).toBeNull();
    expect(screen.queryByRole("button", { name: /注文を受ける/ })).toBeNull();
    expect(screen.getByRole("button", { name: /ピザを作る/ })).toBeInTheDocument();
  });
});

describe("ShopOverlay under the shop model", () => {
  function shop(shopStatus: ShopReputationStatus | null) {
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

  it("the progress line names the reputation to the next materials, not a discovery count", () => {
    shop(status(42));
    expect(screen.getByText(/評判があと68で職人：新しい材料が入荷/)).toBeInTheDocument();
    expect(screen.queryByText(/つ発見で新しい材料が入荷/)).toBeNull();
  });

  it("no progress line once the last chapter is open", () => {
    shop(status(400));
    expect(screen.queryByText(/新しい材料が入荷/)).toBeNull();
  });

  it("legacy (no status): the discovery-count line is as before", () => {
    shop(null);
    expect(screen.getByText(/つ発見で新しい材料が入荷/)).toBeInTheDocument();
  });
});
