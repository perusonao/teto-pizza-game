import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ResultPanel } from "./ResultPanel";
import type { ScoreBreakdown } from "../logic/scoring";

/**
 * A1 Authority Cutover: ResultPanel gained a 4th feedback row ("ソース") so Scoring 2.0's Sauce
 * component -- its single heaviest component, 52/100, with no legacy `ScoreBreakdown` field of
 * its own -- is never silently discarded from player-facing feedback (see
 * docs/reports/TETO_SCORING2-A1_AUTHORITY_PreImplementation-Audit.md section 2, Option 1).
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

afterEach(() => {
  cleanup();
});

describe("ResultPanel", () => {
  it("renders a ソース (Sauce) feedback row when sauceScore is available", () => {
    render(
      <ResultPanel score={baseScore()} bakeState="perfect" sauceScore={42} onRegister={vi.fn()} />,
    );
    expect(screen.getByText("ソース")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("omits the ソース row rather than fabricating a number when sauceScore is null", () => {
    render(
      <ResultPanel score={baseScore()} bakeState="perfect" sauceScore={null} onRegister={vi.fn()} />,
    );
    expect(screen.queryByText("ソース")).not.toBeInTheDocument();
  });

  it("still renders the legacy 具材/配置/焼き rows alongside ソース", () => {
    render(
      <ResultPanel score={baseScore()} bakeState="perfect" sauceScore={42} onRegister={vi.fn()} />,
    );
    expect(screen.getByText("具材")).toBeInTheDocument();
    expect(screen.getByText("配置")).toBeInTheDocument();
    expect(screen.getByText("焼き")).toBeInTheDocument();
  });

  it("renders the headline total/stars from score, unaffected by sauceScore", () => {
    const { container } = render(
      <ResultPanel
        score={baseScore({ total: 88, stars: 4 })}
        bakeState="perfect"
        sauceScore={null}
        onRegister={vi.fn()}
      />,
    );
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(container.querySelector(".result-panel__stars")?.textContent).toBe("★★★★☆");
  });
});
