import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MissionResultOverlay } from "./MissionResultOverlay";

/**
 * Visual Polish 1B: Lunch Rush Result was the last screen still showing English UI copy
 * ("LUNCH RUSH RESULT" / "SCORE" / "NEW BEST!" / "BEST") -- this covers the now-Japanese
 * heading/labels and guards against the old English strings creeping back in.
 */
function baseProps() {
  return {
    stats: { attempts: 6, successes: 5, failures: 1, successRatePercent: 83 },
    averageQuality: 72.4,
    bestQuality: 88.9,
    score: 362,
    isNewBest: false,
    pitzReward: 40,
    pitzBalance: 140,
    onRetry: vi.fn(),
    onExit: vi.fn(),
    onShowRanking: vi.fn(),
    onGoHome: vi.fn(),
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

  it("still renders average quality and Pitz reward/balance unchanged", () => {
    render(<MissionResultOverlay {...baseProps()} averageQuality={72.4} pitzReward={40} pitzBalance={140} />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("+40 Pitz")).toBeInTheDocument();
    expect(screen.getByText(/現在残高.*140 Pitz/)).toBeInTheDocument();
  });

  /** Lunch Rush Phase 4 (Result Summary): attempts/successes/failures/success rate, rendered
   *  directly from the `stats` prop -- this component trusts the derivation
   *  (../logic/missionResultStats.ts) rather than recomputing anything itself. */
  describe("result stats (Phase 4)", () => {
    it("renders attempts, successes, failures, and success rate from the stats prop", () => {
      render(
        <MissionResultOverlay
          {...baseProps()}
          stats={{ attempts: 6, successes: 5, failures: 1, successRatePercent: 83 }}
        />,
      );
      expect(screen.getByText("6")).toBeInTheDocument();
      expect(screen.getByText(/枚挑戦/)).toBeInTheDocument();
      const grid = document.querySelector(".mission-result__attempt-grid");
      expect(grid?.textContent).toContain("成功");
      expect(grid?.textContent).toContain("5");
      expect(grid?.textContent).toContain("失敗");
      expect(grid?.textContent).toContain("1");
      expect(grid?.textContent).toContain("成功率");
      expect(grid?.textContent).toContain("83%");
    });

    it("0 attempts renders 0%, never NaN or a crash", () => {
      render(
        <MissionResultOverlay
          {...baseProps()}
          stats={{ attempts: 0, successes: 0, failures: 0, successRatePercent: 0 }}
        />,
      );
      const grid = document.querySelector(".mission-result__attempt-grid");
      expect(grid?.textContent).toContain("0%");
      expect(grid?.textContent).not.toContain("NaN");
    });

    it("all-successes run shows 0 failures and 100%", () => {
      render(
        <MissionResultOverlay
          {...baseProps()}
          stats={{ attempts: 4, successes: 4, failures: 0, successRatePercent: 100 }}
        />,
      );
      const grid = document.querySelector(".mission-result__attempt-grid");
      expect(grid?.textContent).toContain("100%");
    });

    it("all-failures run shows 0 successes and 0%", () => {
      render(
        <MissionResultOverlay
          {...baseProps()}
          stats={{ attempts: 3, successes: 0, failures: 3, successRatePercent: 0 }}
        />,
      );
      const grid = document.querySelector(".mission-result__attempt-grid");
      expect(grid?.textContent).toContain("0%");
    });
  });

  it("Firebase Ranking Phase 2A: the ranking entry point calls onShowRanking", async () => {
    const props = baseProps();
    render(<MissionResultOverlay {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /ランキングを見る/ }));
    expect(props.onShowRanking).toHaveBeenCalledTimes(1);
  });

  it("still calls onRetry exactly once for もう一度 (regression)", async () => {
    const props = baseProps();
    render(<MissionResultOverlay {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "もう一度" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("still calls onExit exactly once for フリープレイへ (regression)", async () => {
    const props = baseProps();
    render(<MissionResultOverlay {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "フリープレイへ" }));
    expect(props.onExit).toHaveBeenCalledTimes(1);
  });

  /** Gameplay UX Phase 2 (Issue #157): the new 🏠 ホームへ CTA -- present, correctly labeled,
   *  and calls onGoHome exactly once per click (reuses App.tsx's handleGoHome, no new logic
   *  here to test beyond the wiring itself). */
  it("renders a 🏠 ホームへ button that calls onGoHome exactly once", async () => {
    const props = baseProps();
    render(<MissionResultOverlay {...props} />);
    const homeButton = screen.getByRole("button", { name: /ホームへ/ });
    expect(homeButton).toBeInTheDocument();
    await userEvent.click(homeButton);
    expect(props.onGoHome).toHaveBeenCalledTimes(1);
  });

  it("ホームへ does not trigger onExit/onRetry/onShowRanking (no accidental cross-wiring)", async () => {
    const props = baseProps();
    render(<MissionResultOverlay {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /ホームへ/ }));
    expect(props.onExit).not.toHaveBeenCalled();
    expect(props.onRetry).not.toHaveBeenCalled();
    expect(props.onShowRanking).not.toHaveBeenCalled();
  });
});

describe("MissionResultOverlay -- Issue #212 (OD-2)", () => {
  it("a time-up run shows no early-end note and a live 「もう一度」", () => {
    render(<MissionResultOverlay {...baseProps()} />);
    expect(screen.queryByText("作れるピザがなくなったので終了しました")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度" })).toBeEnabled();
  });

  it("endedEarly explains why the run ended; retryBlocked disables 「もう一度」 and says how to recover", async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<MissionResultOverlay {...props} endedEarly retryBlocked />);
    expect(screen.getByText("作れるピザがなくなったので終了しました")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "もう一度" });
    expect(retry).toBeDisabled();
    await user.click(retry);
    expect(props.onRetry).not.toHaveBeenCalled();
    expect(screen.getByText(/ショップで材料を補充すると再挑戦できます/)).toBeInTheDocument();
  });
});
