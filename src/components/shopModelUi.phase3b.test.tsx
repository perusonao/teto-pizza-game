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
import { identifiedAwaitingCopy, stageOpeningView, stageShopForm, stageUnlockLabel } from "../logic/progression/shopStageView";
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
    expect(within(box).getByRole("button", { name: /ピザ図鑑を見る/ })).toBeInTheDocument();
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
    expect(view).toEqual({
      newRecipeCount: stage2.length - 1,
      waitingRecipeCount: 0,
      waitingArrivalReputations: [],
      materialNamesJa: ["アンチョビ", "ツナ"],
      enteredRecipeNamesJa: ["ミートラヴァーズ"],
    });
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
    expect(list).not.toHaveTextContent("入荷待ち");
    expect(list).toHaveTextContent("新しい材料が入荷：アンチョビ・ツナ");
    expect(list).toHaveTextContent("メニューに追加：ミートラヴァーズ");
    expect(list).toHaveTextContent("メニュー開発ボーナス +50 Pitz・評判 +3");
    // The materials are listed once (in the banner); the Shop CTA stays.
    expect(screen.getAllByText(/アンチョビ/)).toHaveLength(1);
    expect(screen.getByRole("button", { name: /お店へ/ })).toBeInTheDocument();
    // The entry bonus is part of this round's Pitz.
    expect(screen.getByText(/今回の獲得/)).toHaveTextContent("+150 Pitz");
  });

  it("stage 4 (Owner 2026-11-27): developable now and waiting for materials are counted apart -- 8品／あと4品（評判275で入荷）", () => {
    const g4 = { gained: 8, before: 205, after: 213, chapterBefore: 3, chapterAfter: 4, nextFloor: 340 };
    const view = stageOpeningView(g4, dexOf("margherita"), [], [])!;
    expect(view.newRecipeCount).toBe(8);
    expect(view.waitingRecipeCount).toBe(4);
    expect(view.waitingArrivalReputations).toEqual([275]);
    result({ reputationGain: g4, onNextOrder: vi.fn(), stageOpening: view });
    expect(screen.getByTestId("result-rank-up")).toHaveTextContent("達人（有名店）に昇格しました！");
    expect(screen.getByTestId("result-stage-opening")).toHaveTextContent(
      "新しいメニューを開発できるようになった：8品／あと4品は材料の入荷待ち（評判275で入荷）",
    );
  });

  it("the split is counted from the materials, not fixed: the waiting four are キューバン・カリフォルニア・北京ダック・タイチキン", () => {
    const g4 = { gained: 8, before: 205, after: 213, chapterBefore: 3, chapterAfter: 4, nextFloor: 340 };
    // Already in the Dex: one waiting recipe and one developable one leave each count.
    const fewer = stageOpeningView(g4, dexOf("margherita", "cuban-pizza", "flammkuchen"), [], [])!;
    expect([fewer.newRecipeCount, fewer.waitingRecipeCount]).toEqual([7, 3]);
    // A jump straight past 275 (e.g. from 205 to 280) waits for nothing.
    const past = stageOpeningView({ ...g4, after: 280 }, dexOf("margherita"), [], [])!;
    expect([past.newRecipeCount, past.waitingRecipeCount, past.waitingArrivalReputations]).toEqual([12, 0, []]);
    // Which four wait: removing each from the Dex count changes only the waiting count.
    for (const id of ["cuban-pizza", "california-style-pizza", "peking-duck-pizza", "thai-chicken-pizza"]) {
      expect(stageOpeningView(g4, dexOf("margherita", id), [], [])!.waitingRecipeCount, id).toBe(3);
    }
    // Stages 2, 3 and 5 wait for nothing at their floors.
    for (const [before, after, from, to] of [[39, 40, 1, 2], [109, 110, 2, 3], [339, 340, 4, 5]] as const) {
      const v = stageOpeningView({ gained: after - before, before, after, chapterBefore: from, chapterAfter: to, nextFloor: null }, dexOf("margherita"), [], [])!;
      expect(v.waitingRecipeCount, `stage ${to}`).toBe(0);
    }
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
    expect(screen.getByText(/メニュー 1 \/ 60/)).toBeInTheDocument();
  });

  it("once the stage is open it is an ordinary developed card", () => {
    render(
      <DexOverlay dex={dexOf("margherita", "meat-lovers")} shop={shopAt(40)} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />,
    );
    expect(document.querySelector("[data-dex-identified]")).toBeNull();
    expect(screen.getByText(/メニュー 2 \/ 60/)).toBeInTheDocument();
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
    expect(screen.getByLabelText("ピザ図鑑 メニュー 1 / 60")).toBeInTheDocument();
  });
});

describe("the Dex: a stage not open yet says what opens it (PR #915 play check, 2026-11-27)", () => {
  const labels = () =>
    [...document.querySelectorAll(".dex-overlay__chapter")].map((section) =>
      section.querySelector("[data-testid='dex-stage-unlock']")?.textContent ?? null,
    );

  it("the labels come from the title ladder and the stage floors (駆け出し 15 is no stage)", () => {
    expect([1, 2, 3, 4, 5].map(stageUnlockLabel)).toEqual([
      null,
      "一人前（評判40）で解放",
      "職人（評判110）で解放",
      "達人（評判210）で解放",
      "匠（評判340）で解放",
    ]);
    expect([1, 2, 3, 4, 5].map(stageUnlockLabel).join("")).not.toContain("駆け出し");
  });

  it("reputation 45: stages 3-5 carry their condition in the heading; the open stages 1-2 carry none", () => {
    render(<DexOverlay dex={dexOf("margherita")} shop={shopAt(45)} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />);
    expect(labels()).toEqual([null, null, "🔒 職人（評判110）で解放", "🔒 達人（評判210）で解放", "🔒 匠（評判340）で解放"]);
    const headings = [...document.querySelectorAll(".dex-overlay__chapter .dex-overlay__chapter-title")];
    expect(headings[2]).toHaveTextContent("職人（評判110）で解放");
    expect(headings[2]).toHaveTextContent("0/12");
    expect(document.querySelectorAll("[data-stage-locked]")).toHaveLength(3);
  });

  it("a new shop (reputation 0): every stage but the first; at 340 none", () => {
    render(<DexOverlay dex={dexOf("margherita")} shop={shopAt(0)} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />);
    expect(labels()).toEqual([null, "🔒 一人前（評判40）で解放", "🔒 職人（評判110）で解放", "🔒 達人（評判210）で解放", "🔒 匠（評判340）で解放"]);
    cleanup();
    render(<DexOverlay dex={dexOf("margherita")} shop={shopAt(340)} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />);
    expect(labels()).toEqual([null, null, null, null, null]);
  });

  it("the boundary: 39 still shows stage 2's condition, 40 does not", () => {
    render(<DexOverlay dex={dexOf("margherita")} shop={shopAt(39)} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />);
    expect(labels()[1]).toBe("🔒 一人前（評判40）で解放");
    cleanup();
    render(<DexOverlay dex={dexOf("margherita")} shop={shopAt(40)} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />);
    expect(labels()[1]).toBeNull();
  });
});
