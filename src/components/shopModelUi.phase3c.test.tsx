import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// B案 Phase 3c: the screens under the shop model (what `?progression=shop` selects on Preview). The flag is a per-page-load constant,
// so the module is replaced before anything imports it. The legacy side is ./shopModelUi.phase3c.legacy.test.tsx.
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { cleanup, render, screen } from "@testing-library/react";
import { SHOP_MODEL_ACTIVE } from "../logic/progression/shopStatus";
import type { ShopProgressState } from "../logic/progression/shopProgress";
import { HomeScreen } from "../screens/HomeScreen";
import type { DexEntry, DexState } from "../state/dex";
import type { HintSheetView } from "../state/discoveryHint";
import { HintSheet } from "./HintSheet";
import { RESEARCH_POINTS_COPY } from "./ResearchPointsNote";
import { ResultPanel } from "./ResultPanel";

afterEach(cleanup);

const SCORE = { total: 80, stars: 3 as const, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 };
const dexOf = (...ids: string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));
const shopAt = (reputation: number): ShopProgressState => ({ reputation, grantedMenuRecipeIds: [] });
const PITZ = { baseReward: 100, multiplier: 1, earnedPitz: 100, discoveryBonusPitz: 0, balanceBefore: 0, balanceAfter: 100 } as never;
const GAIN = { earned: 2, stage: 2, balanceAfter: 9 };
// Phase 3d: the points now buy hints, so the line says where (it was 「ヒントと交換できるようになるのは、もう少し先です」 in 3c).
const NOT_YET = "ピザ図鑑やヒント画面で、ヒントと交換できます";

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

function home(researchPointBalance: number | null | undefined) {
  return render(
    <HomeScreen
      pitzBalance={133}
      dex={dexOf("margherita")}
      shop={shopAt(48)}
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
      {...(researchPointBalance === undefined ? {} : { researchPointBalance })}
    />,
  );
}

const FREE_NOTE_VIEW: HintSheetView = { kind: "TARGET", steps: [], canRevealMore: false, next: null, pitzBalance: 30 };

describe("Phase 3c: the shop model runs here", () => {
  it("SHOP_MODEL_ACTIVE (App and GameScreen pass the balance only then)", () => {
    expect(SHOP_MODEL_ACTIVE).toBe(true);
  });
});

describe("HOME: the balance beside Pitz", () => {
  it("shows 🔬 N right after the Pitz pill, labelled with the name and the 'not yet' line", () => {
    home(2);
    const pill = screen.getByTestId("home-research-points");
    expect(pill).toHaveTextContent("🔬 2");
    expect(pill).toHaveAttribute("aria-label", `研究ポイント 2（${NOT_YET}）`);
    expect(pill.previousElementSibling).toHaveClass("app-header__pitz");
  });

  it("a balance of 0 still shows (a save without the key)", () => {
    home(0);
    expect(screen.getByTestId("home-research-points")).toHaveTextContent("🔬 0");
  });

  it("null / absent: no pill", () => {
    home(null);
    expect(screen.queryByTestId("home-research-points")).toBeNull();
    cleanup();
    home(undefined);
    expect(screen.queryByTestId("home-research-points")).toBeNull();
  });
});

describe("RESULT: this trial's +N and the balance, on every Free Cooking card", () => {
  const expectLine = () => {
    const line = screen.getByTestId("result-research-points");
    expect(line).toHaveTextContent("研究ポイント +2");
    expect(line).toHaveTextContent("（所持 9）");
    expect(line).toHaveTextContent(NOT_YET);
  };

  it("a matched trial (menu development)", () => {
    result({ freeCook: true, discovery: { kind: "NEW_DISCOVERY" } as never, justDiscovered: true, researchPointGain: GAIN });
    expectLine();
  });

  it("an original pizza", () => {
    result({ freeCook: true, score: null, discovery: { kind: "ORIGINAL" } as never, usedIngredientIds: ["mozzarella"], researchPointGain: GAIN });
    expectLine();
  });

  it("a failed (burnt) trial", () => {
    result({
      freeCook: true,
      score: null,
      completion: { status: "FAILED", reason: "OVERBAKED", failures: [{ reason: "OVERBAKED" }] } as never,
      researchPointGain: GAIN,
    });
    expectLine();
  });

  it("no gain (an order, practice, legacy): nothing", () => {
    result({ researchPointGain: null });
    expect(screen.queryByTestId("result-research-points")).toBeNull();
    cleanup();
    result({});
    expect(screen.queryByTestId("result-research-points")).toBeNull();
  });
});

describe("the hint sheet: the balance and that it cannot buy a hint yet", () => {
  it("shows both; the hint prices stay in Pitz", () => {
    render(<HintSheet view={FREE_NOTE_VIEW} onUnlock={vi.fn()} onClose={vi.fn()} researchPointBalance={4} />);
    const box = screen.getByTestId("hint-research-points");
    expect(box).toHaveTextContent(`${RESEARCH_POINTS_COPY.icon} 研究ポイント 4`);
    expect(box).toHaveTextContent(NOT_YET);
    expect(box).not.toHaveTextContent("Pitz");
    expect(box.querySelector("button")).toBeNull();
  });

  it("null / absent: nothing", () => {
    render(<HintSheet view={FREE_NOTE_VIEW} onUnlock={vi.fn()} onClose={vi.fn()} researchPointBalance={null} />);
    expect(screen.queryByTestId("hint-research-points")).toBeNull();
    cleanup();
    render(<HintSheet view={FREE_NOTE_VIEW} onUnlock={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId("hint-research-points")).toBeNull();
  });
});
