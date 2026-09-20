import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GetWeeklyLeaderboardResult } from "../firebase";

const getWeeklyLeaderboard = vi.fn<() => Promise<GetWeeklyLeaderboardResult>>();
vi.mock("../firebase", () => ({
  getWeeklyLeaderboard: () => getWeeklyLeaderboard(),
}));

const WEEK_RANGE = { monday: { year: 2026, month: 9, day: 14 }, sunday: { year: 2026, month: 9, day: 20 } };

afterEach(() => {
  cleanup();
  getWeeklyLeaderboard.mockReset();
});

// Imported after the mock above is registered so every test gets the freshest component module.
async function renderOverlay() {
  const { WeeklyRankingOverlay } = await import("./WeeklyRankingOverlay");
  const onClose = vi.fn();
  render(<WeeklyRankingOverlay onClose={onClose} />);
  return { onClose };
}

describe("WeeklyRankingOverlay", () => {
  it("A. loading: shows a loading status before the fetch resolves", async () => {
    let resolveFetch!: (value: GetWeeklyLeaderboardResult) => void;
    getWeeklyLeaderboard.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
    await renderOverlay();
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    resolveFetch({ status: "success", periodId: "weekly_2026-W38", weekRange: WEEK_RANGE, top: [], currentUserOutsideTop: null });
  });

  it("B. empty: shows the no-records message when top is empty", async () => {
    getWeeklyLeaderboard.mockResolvedValue({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [],
      currentUserOutsideTop: null,
    });
    await renderOverlay();
    await waitFor(() => expect(screen.getByText("まだ今週の記録がありません。")).toBeInTheDocument());
  });

  it("C. success / F. TOP 10: renders ranked entries with formatted scores", async () => {
    getWeeklyLeaderboard.mockResolvedValue({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [
        { rank: 1, score: 1240, achievedAt: 1000, isCurrentUser: false },
        { rank: 2, score: 1180, achievedAt: 2000, isCurrentUser: false },
      ],
      currentUserOutsideTop: null,
    });
    await renderOverlay();
    await waitFor(() => expect(screen.getByText("1,240")).toBeInTheDocument());
    expect(screen.getByText("1,180")).toBeInTheDocument();
    expect(screen.getByText("今週 9/14〜20")).toBeInTheDocument();
  });

  it("G. current player = あなた: highlights the signed-in player's row within the top list", async () => {
    getWeeklyLeaderboard.mockResolvedValue({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [
        { rank: 1, score: 900, achievedAt: 1000, isCurrentUser: false },
        { rank: 2, score: 850, achievedAt: 2000, isCurrentUser: true },
      ],
      currentUserOutsideTop: null,
    });
    await renderOverlay();
    await waitFor(() => expect(screen.getAllByText("あなた")).toHaveLength(1));
  });

  it("current player outside TOP 10: renders a separate own-rank row", async () => {
    getWeeklyLeaderboard.mockResolvedValue({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [{ rank: 1, score: 900, achievedAt: 1000, isCurrentUser: false }],
      currentUserOutsideTop: { rank: 42, score: 120 },
    });
    await renderOverlay();
    await waitFor(() => expect(screen.getByText("42位")).toBeInTheDocument());
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("H. long score: formats a large score with thousands separators without overflow markup", async () => {
    getWeeklyLeaderboard.mockResolvedValue({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [{ rank: 1, score: 1234567, achievedAt: 1000, isCurrentUser: false }],
      currentUserOutsideTop: null,
    });
    await renderOverlay();
    await waitFor(() => expect(screen.getByText("1,234,567")).toBeInTheDocument());
  });

  it("D/E. error: shows an error message and a working retry button", async () => {
    getWeeklyLeaderboard.mockResolvedValueOnce({ status: "error", message: "network down" });
    await renderOverlay();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("読み込めませんでした"));

    getWeeklyLeaderboard.mockResolvedValueOnce({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [],
      currentUserOutsideTop: null,
    });
    await userEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    await waitFor(() => expect(screen.getByText("まだ今週の記録がありません。")).toBeInTheDocument());
    expect(getWeeklyLeaderboard).toHaveBeenCalledTimes(2);
  });

  it("FIREBASE UNCONFIGURED: renders a non-error unavailable message, no crash", async () => {
    getWeeklyLeaderboard.mockResolvedValue({ status: "unavailable" });
    await renderOverlay();
    await waitFor(() => expect(screen.getByText("ランキング機能は準備中です。")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("J. close/back navigation: the close button invokes onClose", async () => {
    getWeeklyLeaderboard.mockResolvedValue({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [],
      currentUserOutsideTop: null,
    });
    const { onClose } = await renderOverlay();
    await userEvent.click(screen.getByText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
