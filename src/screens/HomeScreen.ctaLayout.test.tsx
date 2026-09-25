import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HomeScreen } from "./HomeScreen";
import { EMPTY_DEX } from "../state/dex";

afterEach(cleanup);

/**
 * Progression 2.0 W1 I5b-4: HOME keeps the same 2+1 CTA layout before and after the first
 * discovery -- row 1 「ピザを作る」+「ランチラッシュ」, row 2 a full-width フリークッキング. Before the first
 * discovery フリークッキング is the primary CTA and ランチラッシュ is LOCKED (Phase 3-3 intent);
 * previously the three buttons shared one row and 「フリークッキングで探す」 broke over 5-7 lines at
 * 360-390px.
 */
function renderHome(lunchRushLocked: boolean) {
  render(
    <HomeScreen
      pitzBalance={0}
      dex={EMPTY_DEX}
      ownedIngredientCount={3}
      totalIngredientCount={29}
      onStartFreePlay={vi.fn()}
      onStartLunchRush={vi.fn()}
      onStartFreeCook={vi.fn()}
      lunchRushLocked={lunchRushLocked}
      onOpenDex={vi.fn()}
      onOpenShop={vi.fn()}
      onOpenInventory={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenRanking={vi.fn()}
    />,
  );
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".home-cta-row .cta-button"));
}

describe("HomeScreen CTA layout (W1 I5b-4)", () => {
  it("fresh save: ピザを作る / LOCKED ランチラッシュ, then a full-width primary フリークッキングで探す", () => {
    const [make, rush, freeCook] = renderHome(true);
    expect(make).toHaveTextContent("ピザを作る");
    expect(make).toHaveClass("cta-button--secondary", "cta-button--home-secondary");
    expect(make).toBeEnabled();
    expect(rush).toHaveTextContent("ランチラッシュ");
    expect(rush).toBeDisabled();
    expect(freeCook).toHaveTextContent("フリークッキングで探す");
    expect(freeCook).toHaveClass("cta-button--primary", "cta-button--free-cook", "cta-button--free-cook-lead");
    expect(screen.getByText(/まず1枚ピザを発見しよう/)).toBeInTheDocument();
  });

  it("after the first discovery: primary ピザを作る, enabled ランチラッシュ, secondary フリークッキング", () => {
    const [make, rush, freeCook] = renderHome(false);
    expect(make).toHaveClass("cta-button--primary", "cta-button--home");
    expect(rush).toBeEnabled();
    expect(freeCook).toHaveTextContent("フリークッキング");
    expect(freeCook).not.toHaveTextContent("で探す");
    expect(freeCook).toHaveClass("cta-button--secondary", "cta-button--free-cook");
    expect(freeCook).not.toHaveClass("cta-button--free-cook-lead");
  });
});
