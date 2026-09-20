import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MissionResultOverlay } from "./MissionResultOverlay";

/**
 * Visual Polish 1B: Lunch Rush Result was the last screen still showing English UI copy
 * ("LUNCH RUSH RESULT" / "SCORE" / "NEW BEST!" / "BEST") -- this covers the now-Japanese
 * heading/labels and guards against the old English strings creeping back in.
 */
function baseProps() {
  return {
    servedCount: 5,
    averageQuality: 72.4,
    bestQuality: 88.9,
    score: 362,
    isNewBest: false,
    pitzReward: 40,
    pitzBalance: 140,
    onRetry: vi.fn(),
    onExit: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
});

describe("MissionResultOverlay", () => {
  it("renders the Japanese heading, not the old English title", () => {
    render(<MissionResultOverlay {...baseProps()} />);
    expect(screen.getByText("ランチラッシュ結果")).toBeInTheDocument();
    expect(screen.queryByText(/LUNCH RUSH RESULT/)).not.toBeInTheDocument();
  });

  it("renders the score row in Japanese, not the old English label", () => {
    const { container } = render(<MissionResultOverlay {...baseProps()} score={362} />);
    expect(container.querySelector(".mission-result__row--score")?.textContent).toContain("スコア");
    expect(screen.getByText("362")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/SCORE/);
  });

  it("renders the best-quality row in Japanese, not the old English label", () => {
    const { container } = render(<MissionResultOverlay {...baseProps()} bestQuality={88.9} />);
    expect(container.textContent).toContain("最高");
    expect(screen.getByText("89")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bBEST\b/);
  });

  it("shows the Japanese NEW BEST banner when isNewBest", () => {
    render(<MissionResultOverlay {...baseProps()} isNewBest />);
    expect(screen.getByText("ベスト更新！")).toBeInTheDocument();
    expect(screen.queryByText(/NEW BEST!/)).not.toBeInTheDocument();
  });

  it("omits the NEW BEST banner when not isNewBest", () => {
    render(<MissionResultOverlay {...baseProps()} isNewBest={false} />);
    expect(screen.queryByText("ベスト更新！")).not.toBeInTheDocument();
  });

  it("still renders served count, average quality, and Pitz reward/balance unchanged", () => {
    render(<MissionResultOverlay {...baseProps()} servedCount={5} averageQuality={72.4} pitzReward={40} pitzBalance={140} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("+40 Pitz")).toBeInTheDocument();
    expect(screen.getByText(/現在残高.*140 Pitz/)).toBeInTheDocument();
  });
});
