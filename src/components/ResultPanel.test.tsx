import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ResultPanel } from "./ResultPanel";
import type { ScoreBreakdown } from "../logic/scoring";
import type { PitzCredit } from "../logic/pitzReward";

/**
 * A1 Authority Cutover: ResultPanel gained a 4th feedback row ("ソース") so Scoring 2.0's Sauce
 * component -- its single heaviest component, 52/100, with no legacy `ScoreBreakdown` field of
 * its own -- is never silently discarded from player-facing feedback (see
 * docs/reports/TETO_SCORING2-A1_AUTHORITY_PreImplementation-Audit.md section 2, Option 1).
 *
 * RESULT 2.0 Slice 1: this is now the merged RESULT+DISCOVERED screen (see this file's own
 * header comment) -- these tests cover the banner/Pitz-credit/CTA content that used to live in
 * a separate DISCOVERED-only block in GameScreen.tsx, alongside the pre-existing score/stars/
 * bars coverage above.
 */
function baseScore(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    matchScore: 80,
    ingredientScore: 90,
    placementScore: 70,
    bakeScore: 60,
    total: 75,
    stars: 3,
    ...overrides,
  };
}

function basePitzCredit(overrides: Partial<PitzCredit> = {}): PitzCredit {
  return {
    earnedPitz: 42,
    baseReward: 100,
    multiplier: 0.8,
    balanceBefore: 100,
    balanceAfter: 142,
    ...overrides,
  };
}

function baseProps() {
  return {
    score: baseScore(),
    bakeState: "perfect" as const,
    sauceScore: 42,
    headingJa: "いいできばえだね！",
    recipeNameJa: "マルゲリータ",
    justDiscovered: false,
    justGotNewBest: false,
    pitzCredit: null,
    onRetrySameRecipe: vi.fn(),
    onBackToPizzaSelect: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
});

describe("ResultPanel", () => {
  it("renders the short heading directly (no bureaucratic registration button)", () => {
    render(<ResultPanel {...baseProps()} />);
    expect(screen.getByText("いいできばえだね！")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "レシピ図鑑に登録する" }),
    ).not.toBeInTheDocument();
  });

  it("renders a ソース (Sauce) feedback row when sauceScore is available", () => {
    render(<ResultPanel {...baseProps()} sauceScore={42} />);
    expect(screen.getByText("ソース")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("omits the ソース row rather than fabricating a number when sauceScore is null", () => {
    render(<ResultPanel {...baseProps()} sauceScore={null} />);
    expect(screen.queryByText("ソース")).not.toBeInTheDocument();
  });

  it("still renders the legacy 具材/配置/焼き rows alongside ソース, collapsed by default", () => {
    render(<ResultPanel {...baseProps()} sauceScore={42} />);
    expect(screen.getByText("具材")).toBeInTheDocument();
    expect(screen.getByText("配置")).toBeInTheDocument();
    expect(screen.getByText("焼き")).toBeInTheDocument();
    expect(document.querySelector(".result-panel__details")).not.toHaveAttribute("open");
  });

  it("renders the headline total/stars from score, unaffected by sauceScore", () => {
    const { container } = render(
      <ResultPanel {...baseProps()} score={baseScore({ total: 88, stars: 4 })} sauceScore={null} />,
    );
    expect(screen.getByText("88点")).toBeInTheDocument();
    expect(container.querySelector(".result-panel__stars")?.textContent).toBe("★★★★☆");
  });

  it("shows the discovery banner when justDiscovered, not the BEST banner", () => {
    render(<ResultPanel {...baseProps()} justDiscovered justGotNewBest={false} />);
    expect(screen.getByText(/を発見しました/)).toBeInTheDocument();
    expect(screen.queryByText(/NEW BEST!/)).not.toBeInTheDocument();
  });

  it("shows the NEW BEST banner when justGotNewBest and not a first discovery", () => {
    render(<ResultPanel {...baseProps()} justDiscovered={false} justGotNewBest />);
    expect(screen.getByText(/NEW BEST!/)).toBeInTheDocument();
    expect(screen.queryByText(/を発見しました/)).not.toBeInTheDocument();
  });

  it("shows neither banner on an ordinary repeat play", () => {
    render(<ResultPanel {...baseProps()} justDiscovered={false} justGotNewBest={false} />);
    expect(screen.queryByText(/NEW BEST!/)).not.toBeInTheDocument();
    expect(screen.queryByText(/を発見しました/)).not.toBeInTheDocument();
  });

  it("renders the Pitz credit summary when provided", () => {
    render(<ResultPanel {...baseProps()} pitzCredit={basePitzCredit({ earnedPitz: 42 })} />);
    expect(screen.getByText(/\+42 Pitz/)).toBeInTheDocument();
  });

  it("omits the Pitz credit summary for a Mission round (pitzCredit null)", () => {
    render(<ResultPanel {...baseProps()} pitzCredit={null} />);
    expect(screen.queryByText(/今回の獲得/)).not.toBeInTheDocument();
  });

  it("shows a zero-Pitz explanatory note when earnedPitz is 0", () => {
    render(<ResultPanel {...baseProps()} pitzCredit={basePitzCredit({ earnedPitz: 0 })} />);
    expect(screen.getByText(/今回はPitzを獲得できませんでした/)).toBeInTheDocument();
  });

  it("wires the retry-same-recipe and back-to-select CTAs", () => {
    const onRetrySameRecipe = vi.fn();
    const onBackToPizzaSelect = vi.fn();
    render(
      <ResultPanel {...baseProps()} onRetrySameRecipe={onRetrySameRecipe} onBackToPizzaSelect={onBackToPizzaSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "もう一度つくる" }));
    expect(onRetrySameRecipe).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "別のピザを作る" }));
    expect(onBackToPizzaSelect).toHaveBeenCalledTimes(1);
  });
});
