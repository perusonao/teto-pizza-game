import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// B案 Phase 3b: the screens under the shop model (what `?progression=shop` selects on Preview). The flag is a per-page-load constant,
// so the module is replaced before anything imports it. The legacy side is ./shopModelUi.phase3b.legacy.test.tsx.
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { cleanup, render, screen, within } from "@testing-library/react";
import { MENU_CATALOG } from "../data/menuCatalog";
import type { RecipeId } from "../data/recipes";
import type { ShopProgressState } from "../logic/progression/shopProgress";
import { identifiedAwaitingCopy, stageOpeningView, stageShopForm } from "../logic/progression/shopStageView";
import { HomeScreen } from "../screens/HomeScreen";
import type { DexEntry, DexState } from "../state/dex";
import { DexOverlay } from "./DexOverlay";
import { ResultPanel } from "./ResultPanel";

afterEach(cleanup);

const SCORE = { total: 80, stars: 3 as const, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 };
const dexOf = (...ids: string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));
const shopAt = (reputation: number): ShopProgressState => ({ reputation, grantedMenuRecipeIds: [] });
const PITZ = { baseReward: 100, multiplier: 1, earnedPitz: 100, discoveryBonusPitz: 0, balanceBefore: 0, balanceAfter: 100 } as never;

function result(extra: Partial<Parameters<typeof ResultPanel>[0]> = {}) {
  return render(
    <ResultPanel
      completion={{ status: "PASS" }}
      score={SCORE}
      bakeState="perfect"
      sauceScore={null}
      headingJa="おいしい！"
      recipeNameJa="ミートラヴァーズ"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={PITZ}
      onRetrySameRecipe={vi.fn()}
      onBackToPizzaSelect={vi.fn()}
      {...extra}
    />,
  );
}

describe("the shop forms the stages open with", () => {
  it("stage 2 小さな店 / 3 人気店 / 4 有名店 / 5 伝説の店", () => {
    expect([2, 3, 4, 5].map(stageShopForm)).toEqual(["小さな店", "人気店", "有名店", "伝説の店"]);
  });
});

describe("RESULT: identified before its stage opens", () => {
  it("first time: the recipe is identified, the shop is not ready, and it says when it joins the menu -- no NEW MENU, no 保留", () => {
    const { container } = result({
      freeCook: true,
      discovery: { kind: "NEW_DISCOVERY" } as never,
      identifiedAwaiting: { recipeNameJa: "ミートラヴァーズ", chapter: 2, firstTime: true },
      onOpenDex: vi.fn(),
    });
    const box = screen.getByTestId("result-identified");
    expect(box).toHaveTextContent("ミートラヴァーズのレシピが判明した！");
    expect(box).toHaveTextContent("仕込みも設備もまだ追いつかなくて");
    expect(box).toHaveTextContent("小さな店になったらメニューに載せよう！");
    expect(within(box).getByRole("button", { name: /図鑑を見る/ })).toBeInTheDocument();
    expect(container).not.toHaveTextContent("NEW MENU");
    expect(container).not.toHaveTextContent("新メニューとして開発");
    expect(container).not.toHaveTextContent("保留");
    expect(container).not.toHaveTextContent("オリジナルピザ");
  });

  it("again while it waits: 判明ずみ, not 「メニューにあります」", () => {
    const { container } = result({
      freeCook: true,
      discovery: { kind: "ALREADY_DISCOVERED" } as never,
      identifiedAwaiting: { recipeNameJa: "ミートラヴァーズ", chapter: 2, firstTime: false },
    });
    expect(screen.getByTestId("result-identified")).toHaveTextContent("ミートラヴァーズができた！（レシピ判明ずみ）");
    expect(container).not.toHaveTextContent("メニューにあります");
  });

  it("the copy names the stage's shop form", () => {
    expect(identifiedAwaitingCopy("X", 5, true).bodyJa).toContain("伝説の店になったら");
  });
});

describe("RESULT: the promotion banner lists what the stage opened", () => {
  const gain = { gained: 5, before: 38, after: 43, chapterBefore: 1, chapterAfter: 2, nextFloor: 110 };

  it("the new recipes, the arrived materials and the identified recipes that joined the menu (with the bonus)", () => {
    const stage2 = MENU_CATALOG.filter((e) => e.chapter === 2).map((e) => e.recipeId as string);
    const view = stageOpeningView(gain, dexOf("margherita", "meat-lovers"), ["anchovy", "tuna"], ["meat-lovers" as RecipeId]);
    expect(view).toEqual({ newRecipeCount: stage2.length - 1, materialNamesJa: ["アンチョビ", "ツナ"], enteredRecipeNamesJa: ["ミートラヴァーズ"] });
    result({
      reputationGain: gain,
      onNextOrder: vi.fn(),
      stageOpening: view,
      menuEntries: { recipeIds: ["meat-lovers" as RecipeId], bonusPitz: 50, reputation: 3 },
      materialUnlockNotice: { ingredientIds: ["anchovy", "tuna"], namesJa: ["アンチョビ", "ツナ"], messageJa: "" } as never,
      onOpenShop: vi.fn(),
    });
    expect(screen.getByTestId("result-rank-up")).toHaveTextContent("一人前（小さな店）に昇格しました！");
    const list = screen.getByTestId("result-stage-opening");
    expect(list).toHaveTextContent("新しいメニューを開発できるようになった：11品");
    expect(list).toHaveTextContent("新しい材料が入荷：アンチョビ・ツナ");
    expect(list).toHaveTextContent("メニューに追加：ミートラヴァーズ");
    expect(list).toHaveTextContent("メニュー開発ボーナス +50 Pitz・評判 +3");
    // The materials are listed once (in the banner); the Shop CTA stays.
    expect(screen.getAllByText(/アンチョビ/)).toHaveLength(1);
    expect(screen.getByRole("button", { name: /ショップへ/ })).toBeInTheDocument();
    // The entry bonus is part of this round's Pitz.
    expect(screen.getByText(/今回の獲得/)).toHaveTextContent("+150 Pitz");
  });

  it("駆け出し (15) is a title-only promotion: the one line, nothing listed", () => {
    const g = { gained: 3, before: 13, after: 16, chapterBefore: 1, chapterAfter: 1, nextFloor: 40 };
    expect(stageOpeningView(g, dexOf("margherita"), [], [])).toBeNull();
    result({ reputationGain: g, onNextOrder: vi.fn(), stageOpening: null });
    expect(screen.getByTestId("result-rank-up")).toHaveTextContent("駆け出し（屋台）に昇格しました！");
    expect(screen.queryByTestId("result-stage-opening")).toBeNull();
  });

  it("reputation 275 (stage 4's second-half materials) is no stage opening: the ordinary material notice", () => {
    const g = { gained: 8, before: 270, after: 278, chapterBefore: 4, chapterAfter: 4, nextFloor: 340 };
    expect(stageOpeningView(g, dexOf("margherita"), ["mustard"], [])).toBeNull();
  });
});

describe("the Dex and HOME: an identified recipe is 判明, not developed", () => {
  it("the card is shown with 判明 and the shop form it joins the menu at; the counts leave it out", () => {
    render(
      <DexOverlay dex={dexOf("margherita", "meat-lovers")} shop={shopAt(10)} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />,
    );
    const card = document.querySelector("[data-dex-identified]") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent("ミートラヴァーズ");
    expect(card).toHaveTextContent("判明");
    expect(card).toHaveTextContent("小さな店でメニュー入り");
    expect(document.querySelectorAll("[data-dex-identified]")).toHaveLength(1);
    expect(screen.getByText(/開発 1 \/ 60/)).toBeInTheDocument();
  });

  it("once the stage is open it is an ordinary developed card", () => {
    render(
      <DexOverlay dex={dexOf("margherita", "meat-lovers")} shop={shopAt(40)} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />,
    );
    expect(document.querySelector("[data-dex-identified]")).toBeNull();
    expect(screen.getByText(/開発 2 \/ 60/)).toBeInTheDocument();
  });

  it("HOME's pill counts the menu only", () => {
    render(
      <HomeScreen
        pitzBalance={0}
        dex={dexOf("margherita", "meat-lovers")}
        shop={shopAt(10)}
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
    expect(screen.getByLabelText("レシピ図鑑 開発数 1 / 60")).toBeInTheDocument();
  });
});
