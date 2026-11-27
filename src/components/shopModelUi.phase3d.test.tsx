import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// B案 Phase 3d: the screens under the shop model (what `?progression=shop` selects on Preview).
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { EMPTY_SHOP_PROGRESS, type ShopProgressState } from "../logic/progression/shopProgress";
import type { DexEntry, DexState } from "../state/dex";
import type { HintSheetView } from "../state/discoveryHint";
import { shopHintBoardFor, type ShopHintStateInputs } from "../state/shopHintState";
import { DexOverlay } from "./DexOverlay";
import { HintSheet } from "./HintSheet";
import { ShopHintBoard, ShopHintStrip } from "./ShopHintBoard";

afterEach(cleanup);

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const dexOf = (...ids: string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));
function inputs(shop: Partial<ShopProgressState>, dex: DexState = dexOf("margherita")): ShopHintStateInputs {
  return { dex, shop: { ...EMPTY_SHOP_PROGRESS, ...shop }, discoveryHintFacts: {}, discoveryHintPurchases: {} };
}
const TARGET_VIEW: HintSheetView = { kind: "TARGET", steps: [], canRevealMore: false, next: null, pitzBalance: 300 };

describe("the hint sheet under the shop model: research points only", () => {
  it("shows the board instead of any Pitz body, and a purchase echoes the recipe, the item and the price", () => {
    const board = shopHintBoardFor(inputs({ reputation: 0, researchPointsEarned: 5 }), "funghi")!;
    const onBuy = vi.fn();
    render(<HintSheet view={TARGET_VIEW} onUnlock={vi.fn()} onClose={vi.fn()} researchPointBalance={5} shopHint={{ board }} onBuyShopHint={onBuy} />);
    const sheet = screen.getByRole("dialog");
    expect(sheet).toHaveAttribute("data-hint-ladder", "shop");
    expect(sheet).not.toHaveTextContent("Pitz");
    expect(screen.queryByTestId("hint-research-points")).toBeNull();
    expect(screen.getByTestId("shop-hint-wallet")).toHaveTextContent("研究ポイント 5");
    expect(screen.getByTestId("shop-hint-board").querySelectorAll('[data-shop-hint-slot="unknown"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /ソースを見る/ }));
    expect(onBuy).toHaveBeenCalledWith("funghi", "SAUCE", 1);
  });

  it("not enough points: the buttons are disabled and the sheet says so", () => {
    const board = shopHintBoardFor(inputs({ reputation: 250, researchPointsEarned: 1 }), "flammkuchen")!;
    const onBuy = vi.fn();
    render(<ShopHintBoard board={board} onBuy={onBuy} />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByTestId("shop-hint-short")).toHaveTextContent("研究ポイントが足りません（あと 2点）");
  });

  it("a target without research point hints offers nothing (and never Pitz)", () => {
    render(<HintSheet view={TARGET_VIEW} onUnlock={vi.fn()} onClose={vi.fn()} shopHint={{ board: null }} />);
    const sheet = screen.getByRole("dialog");
    expect(sheet).not.toHaveTextContent("Pitz");
    expect(within(sheet).queryByRole("button", { name: /ヒント/ })).toBeNull();
  });

  it("the free Margherita hint says it is free", () => {
    const board = shopHintBoardFor(inputs({ reputation: 0 }, []), "margherita")!;
    render(<ShopHintBoard board={board} onBuy={vi.fn()} />);
    expect(screen.getByText(/はじめてのピザはヒント無料/)).toBeInTheDocument();
    expect(screen.getAllByRole("button")[0]).toBeEnabled();
    expect(screen.getAllByRole("button")[0]).toHaveTextContent("無料");
  });
});

describe("the board shows what was revealed, 「？」 for the rest", () => {
  it("revealed items and counts; the total once the sauce is known", () => {
    const board = shopHintBoardFor(
      inputs({ reputation: 0, researchPointsEarned: 9, hintRevealsByRecipe: { "breakfast-pizza": ["ing:mozzarella", "count", "sauce", "shape"] } }),
      "breakfast-pizza",
    )!;
    render(<ShopHintBoard board={board} />);
    const root = screen.getByTestId("shop-hint-board");
    expect(root.querySelector('[data-shop-hint-row="SAUCE"]')).toHaveTextContent("トマトソース");
    expect(root.querySelector('[data-shop-hint-row="SHAPE"]')).toHaveTextContent("まるい生地");
    expect(root.querySelector('[data-shop-hint-row="METHOD"]')).toHaveTextContent("？");
    const slots = root.querySelectorAll(".shop-hint__slot");
    const texts = [...slots].map((s) => s.textContent ?? "");
    expect(texts[0]).toContain("モッツァレラ×2");
    expect(texts.slice(1)).toEqual(["？×1", "？×3"]);
    expect(root).toHaveTextContent("全部で 4 種類");
    // Read-only (no onBuy): nothing for sale.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("the cooking screen line lists only revealed items", () => {
    const board = shopHintBoardFor(
      inputs({ reputation: 0, researchPointsEarned: 9, hintRevealsByRecipe: { "breakfast-pizza": ["ing:mozzarella", "sauce"] } }),
      "breakfast-pizza",
    )!;
    render(<ShopHintStrip board={board} />);
    const strip = screen.getByTestId("shop-hint-strip");
    expect(strip).toHaveTextContent("ソース：トマトソース");
    expect(strip).toHaveTextContent("モッツァレラ");
    expect(strip).not.toHaveTextContent("？");
    expect(strip).not.toHaveTextContent("生地");
    cleanup();
    render(<ShopHintStrip board={shopHintBoardFor(inputs({ reputation: 0 }), "breakfast-pizza")!} />);
    expect(screen.queryByTestId("shop-hint-strip")).toBeNull();
  });
});

describe("the Dex under the shop model", () => {
  function dex(shop: Partial<ShopProgressState>, onBuy = vi.fn()) {
    const state = inputs(shop);
    return render(
      <DexOverlay
        dex={state.dex}
        shop={state.shop}
        newlyDiscoveredId={null}
        newBestRecipeId={null}
        onClose={vi.fn()}
        ownedIngredientIds={ALL_IDS}
        unlockedForShopIngredientIds={ALL_IDS}
        inventory={Object.fromEntries(ALL_IDS.map((id) => [id, 9]))}
        shopHint={{ boardOf: (id) => shopHintBoardFor(state, id), onBuy }}
      />,
    );
  }

  it("every recipe of an open stage (developed or not) has a hint fold; a closed stage has none", () => {
    dex({ reputation: 0, researchPointsEarned: 3 });
    // Stage 1 is open (12 recipes), stages 2..5 are closed.
    expect(screen.getAllByTestId("dex-shop-hint")).toHaveLength(12);
  });

  it("a fold's purchase echoes that slot's recipe; the summary counts what is known", () => {
    const onBuy = vi.fn();
    dex({ reputation: 0, researchPointsEarned: 3, hintRevealsByRecipe: { funghi: ["sauce"] } }, onBuy);
    const folds = screen.getAllByTestId("dex-shop-hint");
    const known = folds.filter((f) => f.textContent?.includes("わかったこと 1"));
    expect(known).toHaveLength(1);
    fireEvent.click(within(known[0]).getByRole("button", { name: /生地の形を見る/ }));
    expect(onBuy).toHaveBeenCalledWith("funghi", "SHAPE", 2);
  });

  it("the 🔎 研究中のピザ cards list only recipes of an open stage (3b 論点)", () => {
    dex({ reputation: 0 });
    const cardsAtZero = document.querySelectorAll(".dex-research-card").length;
    cleanup();
    dex({ reputation: 400 });
    const cardsAtTop = document.querySelectorAll(".dex-research-card").length;
    expect(cardsAtTop).toBeGreaterThan(cardsAtZero);
  });
});
