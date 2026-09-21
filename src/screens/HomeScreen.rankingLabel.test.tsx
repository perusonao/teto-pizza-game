import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HomeScreen } from "./HomeScreen";
import { EMPTY_DEX } from "../state/dex";

afterEach(cleanup);

/**
 * Visual Polish 2.0B Fresh Audit P1-2: HOME's ranking card promised "今週のTOP10" (This week's
 * TOP 10) as if a live leaderboard always exists, but the overlay it opens can render loading/
 * empty/error/unavailable states with no such list -- see WeeklyRankingOverlay.tsx and its own
 * title "週間ランキング". This test locks the sub-label to that same, more honest wording so a
 * future edit can't silently reintroduce the "TOP10" promise (ranking data/read logic itself is
 * untouched -- this is copy only).
 */
describe("HomeScreen ranking card label", () => {
  it("describes the destination without promising specific live data", () => {
    render(
      <HomeScreen
        pitzBalance={0}
        dex={EMPTY_DEX}
        ownedIngredientCount={0}
        totalIngredientCount={0}
        onStartFreePlay={vi.fn()}
        onStartLunchRush={vi.fn()}
        onOpenDex={vi.fn()}
        onOpenShop={vi.fn()}
        onOpenInventory={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenRanking={vi.fn()}
      />,
    );
    const card = screen.getByRole("button", { name: /ランキング/ });
    expect(card).toHaveTextContent("週間ランキング");
    expect(card).not.toHaveTextContent("今週のTOP10");
  });
});
