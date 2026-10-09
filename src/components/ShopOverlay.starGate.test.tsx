import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ShopOverlay } from "./ShopOverlay";
import { MissionResultOverlay } from "./MissionResultOverlay";
import { DexOverlay } from "./DexOverlay";
import { RECIPES, countsTowardLadder } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import { buildMaterialUnlockNotice } from "../state/materialEntitlement";
import type { DexEntry, DexState } from "../state/dex";

/** Batch 6 PR-3 (OD-B6-PR3-3/5): one aggregated line, outside the LOCKED slots; nothing names a material. */
afterEach(cleanup);

const CREDITED = RECIPES.filter((r) => countsTowardLadder(r.id)).map((r) => r.id);
function dexOf(count: number, stars: number): DexState {
  let left = stars;
  return CREDITED.slice(0, count).map((recipeId): DexEntry => {
    const s = Math.min(5, left);
    left -= s;
    return { recipeId, discovered: true, bestScore: 1, bestStars: s as DexEntry["bestStars"], timesMade: 1 };
  });
}
const GOAT = getIngredient("goat-cheese")!.nameJa;
const SPINACH = getIngredient("spinach")!.nameJa;

function shop(dex: DexState, unlocked: string[] = []) {
  return render(
    <ShopOverlay
      dex={dex}
      ownedIngredientIds={["tomato-sauce", "mozzarella", "basil"]}
      unlockedForShopIngredientIds={unlocked}
      pitzBalance={0}
      inventory={{}}
      onPurchase={vi.fn()}
      onRestock={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}
const line = () => document.querySelector<HTMLElement>("[data-shop-star-progress]");

describe("Shop ⭐ shortfall line", () => {
  it("step 50 reached with 119 stars: 「⭐あと1個」, outside the LOCKED section", () => {
    shop(dexOf(50, 119), ["avocado"]);
    expect(line()).toHaveTextContent("あと1個で新しい材料が入荷");
    expect(line()!.closest(".shop-locked")).toBeNull();
    expect(document.querySelector(".shop-locked")!.textContent).not.toMatch(/⭐|あと/);
  });
  it("120 stars with the material entitled: the line is gone", () => {
    shop(dexOf(50, 120), ["avocado", "goat-cheese"]);
    expect(line()).toBeNull();
  });
  it("step not reached: the discovery-count hint is used and no ⭐ line is shown", () => {
    shop(dexOf(48, 200));
    expect(line()).toBeNull();
    expect(document.querySelector(".shop-overlay__progress")?.textContent).toContain("あと1つ発見");
  });
  it("129 stars at step 51: only the smallest shortfall (1)", () => {
    shop(dexOf(51, 129), ["avocado", "goat-cheese", "artichoke"]);
    expect(line()).toHaveTextContent("あと1個");
  });
  it("never names a locked material or exposes an id/gate", () => {
    shop(dexOf(51, 100), ["avocado", "artichoke"]);
    const html = document.body.innerHTML;
    for (const name of [GOAT, SPINACH]) expect(html).not.toContain(name);
    for (const id of ["goat-cheese", "spinach"]) expect(html).not.toContain(id);
    // every LOCKED slot is identical markup (no per-slot ⭐ or text difference)
    const cells = Array.from(document.querySelectorAll(".shop-locked__cell")).map((c) => c.innerHTML);
    expect(new Set(cells).size).toBe(1);
  });
});

describe("Dex does not leak the star condition", () => {
  it("no ⭐あと / gate text", () => {
    render(
      <DexOverlay
        dex={dexOf(50, 119)}
        ownedIngredientIds={[]}
        unlockedForShopIngredientIds={["avocado"]}
        inventory={{}}
        newlyDiscoveredId={null}
        newBestRecipeId={null}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.textContent).not.toMatch(/あと\d+個|新しい材料が入荷/);
    expect(document.body.innerHTML).not.toContain("goat-cheese");
  });
});

describe("Lunch Rush run result overlay", () => {
  const base = {
    stats: { attempts: 3, successes: 3, failures: 0, successRatePercent: 100 },
    averageQuality: 80,
    bestQuality: 90,
    score: 100,
    isNewBest: false,
    pitzReward: 10,
    pitzBalance: 100,
    onRetry: vi.fn(),
    onExit: vi.fn(),
    onShowRanking: vi.fn(),
    onGoHome: vi.fn(),
  };
  it("shows the notice once when a material was unlocked in the run", () => {
    render(<MissionResultOverlay {...base} materialUnlockNotice={buildMaterialUnlockNotice(["goat-cheese"])} />);
    expect(document.querySelectorAll(".material-unlock-notice")).toHaveLength(1);
    expect(document.querySelector(".material-unlock-notice")).toHaveTextContent(`新しい材料が入荷：${GOAT}`);
  });
  it("shows nothing without an unlock (layout unchanged)", () => {
    render(<MissionResultOverlay {...base} />);
    expect(document.querySelector(".material-unlock-notice")).toBeNull();
  });
});
