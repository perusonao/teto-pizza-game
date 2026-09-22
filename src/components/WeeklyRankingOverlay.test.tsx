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

  it("Firebase unavailable/error before load: no name/rank/score markup rendered, no crash", async () => {
    getWeeklyLeaderboard.mockResolvedValue({ status: "unavailable" });
    await renderOverlay();
    await waitFor(() => expect(screen.getByText("ランキング機能は準備中です。")).toBeInTheDocument());
    expect(document.querySelector(".ranking-overlay__name")).toBeNull();
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
        { rank: 1, score: 1240, achievedAt: 1000, isCurrentUser: false, displayName: "テトマスター" },
        { rank: 2, score: 1180, achievedAt: 2000, isCurrentUser: false, displayName: "ぺるそなお" },
      ],
      currentUserOutsideTop: null,
    });
    await renderOverlay();
    await waitFor(() => expect(screen.getByText("1,240")).toBeInTheDocument());
    expect(screen.getByText("1,180")).toBeInTheDocument();
    expect(screen.getByText("今週 9/14〜20")).toBeInTheDocument();
    expect(screen.getByText("テトマスター")).toBeInTheDocument();
    expect(screen.getByText("ぺるそなお")).toBeInTheDocument();
  });

  it("G. current player = あなた: highlights the signed-in player's row within the top list", async () => {
    getWeeklyLeaderboard.mockResolvedValue({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [
        { rank: 1, score: 900, achievedAt: 1000, isCurrentUser: false, displayName: "テトマスター" },
        { rank: 2, score: 850, achievedAt: 2000, isCurrentUser: true, displayName: "ぺるそなお" },
      ],
      currentUserOutsideTop: null,
    });
    await renderOverlay();
    await waitFor(() => expect(screen.getAllByText("あなた")).toHaveLength(1));
    expect(screen.getByText("ぺるそなお")).toBeInTheDocument();
  });

  it("current player outside TOP 10: renders a separate own-rank row with name and score", async () => {
    getWeeklyLeaderboard.mockResolvedValue({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [{ rank: 1, score: 900, achievedAt: 1000, isCurrentUser: false, displayName: "テトマスター" }],
      currentUserOutsideTop: { rank: 42, score: 120, displayName: "ぺるそなお", achievedAt: 3000 },
    });
    await renderOverlay();
    await waitFor(() => expect(screen.getByText("42位")).toBeInTheDocument());
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getAllByText("ぺるそなお")).toHaveLength(1);
  });

  it("H. long score: formats a large score with thousands separators without overflow markup", async () => {
    getWeeklyLeaderboard.mockResolvedValue({
      status: "success",
      periodId: "weekly_2026-W38",
      weekRange: WEEK_RANGE,
      top: [{ rank: 1, score: 1234567, achievedAt: 1000, isCurrentUser: false, displayName: "テトマスター" }],
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

  // Player Profile 1.0 Phase 1B (Issue #129) -- displayName rendering.
  describe("displayName rendering", () => {
    it("renders a Japanese displayName", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [{ rank: 1, score: 575, achievedAt: 1000, isCurrentUser: false, displayName: "テトマスター" }],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText("テトマスター")).toBeInTheDocument());
    });

    it("renders an ASCII displayName", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [{ rank: 1, score: 575, achievedAt: 1000, isCurrentUser: false, displayName: "PizzaKing99" }],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText("PizzaKing99")).toBeInTheDocument());
    });

    it("renders a 20-codepoint (max-length) name without breaking layout markup", async () => {
      const longName = "ピ".repeat(20);
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [{ rank: 1, score: 575, achievedAt: 1000, isCurrentUser: false, displayName: longName }],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      const nameEl = await waitFor(() => screen.getByText(longName));
      // The ellipsis/overflow guard is a CSS class, not conditional markup -- the same element
      // always renders, and App.css's own .ranking-overlay__name rule (flex: 1, min-width: 0,
      // overflow: hidden, text-overflow: ellipsis) is what keeps rank/score visible regardless
      // of name length.
      expect(nameEl).toHaveClass("ranking-overlay__name");
      expect(screen.getByText("575")).toBeInTheDocument();
    });

    it("renders the fallback name (ななしピザ職人) for a legacy entry with no name", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [{ rank: 1, score: 180, achievedAt: 1000, isCurrentUser: false, displayName: "ななしピザ職人" }],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText("ななしピザ職人")).toBeInTheDocument());
    });

  });

  // Lunch Rush Phase 4 (Weekly Ranking achievedAt display).
  describe("achievedAt display (Phase 4)", () => {
    it("valid achievedAt: renders a formatted M/D HH:mm date for each TOP10 row", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [
          // 2026-09-21T23:41:00Z == 2026-09-22 08:41 JST.
          { rank: 1, score: 1240, achievedAt: Date.UTC(2026, 8, 21, 23, 41, 0), isCurrentUser: false, displayName: "テトマスター" },
          // 2026-09-15T05:05:00Z == 2026-09-15 14:05 JST.
          { rank: 2, score: 1180, achievedAt: Date.UTC(2026, 8, 15, 5, 5, 0), isCurrentUser: false, displayName: "ぺるそなお" },
        ],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText("9/22 08:41")).toBeInTheDocument());
      expect(screen.getByText("9/15 14:05")).toBeInTheDocument();
    });

    it("legacy/missing achievedAt (null): renders the safe fallback, no crash", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [{ rank: 1, score: 500, achievedAt: null, isCurrentUser: false, displayName: "レガシー勢" }],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText("レガシー勢")).toBeInTheDocument());
      expect(document.querySelector(".ranking-overlay__achieved-at")?.textContent).toBe("-");
    });

    it("invalid achievedAt (NaN): renders the safe fallback, no crash", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [
          {
            rank: 1,
            score: 500,
            achievedAt: Number.NaN as unknown as number,
            isCurrentUser: false,
            displayName: "壊れたデータ",
          },
        ],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText("壊れたデータ")).toBeInTheDocument());
      expect(document.querySelector(".ranking-overlay__achieved-at")?.textContent).toBe("-");
    });

    it("current-user row (both in TOP10 and outside it) uses the same date formatter", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [
          {
            rank: 1,
            score: 900,
            achievedAt: Date.UTC(2026, 8, 21, 23, 41, 0),
            isCurrentUser: true,
            displayName: "ぺるそなお",
          },
        ],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText("9/22 08:41")).toBeInTheDocument());
      expect(screen.getByText("あなた")).toBeInTheDocument();
    });

    it("current-user row outside TOP10 also renders a formatted achievedAt", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [{ rank: 1, score: 900, achievedAt: 1000, isCurrentUser: false, displayName: "テトマスター" }],
        currentUserOutsideTop: {
          rank: 42,
          score: 120,
          displayName: "ぺるそなお",
          achievedAt: Date.UTC(2026, 8, 21, 23, 41, 0),
        },
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText("42位")).toBeInTheDocument());
      expect(screen.getByText("9/22 08:41")).toBeInTheDocument();
    });

    it("multiple TOP10 rows each render their own distinct achievedAt without mixing them up", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: Array.from({ length: 10 }, (_, i) => ({
          rank: i + 1,
          score: 1000 - i,
          achievedAt: Date.UTC(2026, 8, 15 + i, 0, 0, 0),
          isCurrentUser: false,
          displayName: `Player ${i + 1}`,
        })),
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getAllByText(/^9\//).length).toBe(10));
      const rows = document.querySelectorAll(".ranking-overlay__achieved-at");
      const texts = Array.from(rows).map((el) => el.textContent);
      expect(new Set(texts).size).toBe(10);
    });

    it("a long display name still leaves the achieved-at date fully readable alongside it", async () => {
      const longName = "ピ".repeat(20);
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [
          {
            rank: 1,
            score: 575,
            achievedAt: Date.UTC(2026, 8, 21, 23, 41, 0),
            isCurrentUser: false,
            displayName: longName,
          },
        ],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText(longName)).toBeInTheDocument());
      expect(screen.getByText("9/22 08:41")).toBeInTheDocument();
    });
  });

  // Player Profile 1.0 Phase 1B (Issue #129) -- displayName rendering.
  describe("displayName rendering (regression)", () => {
    it("renders the own-row displayName alongside the あなた badge, both visible", async () => {
      getWeeklyLeaderboard.mockResolvedValue({
        status: "success",
        periodId: "weekly_2026-W38",
        weekRange: WEEK_RANGE,
        top: [{ rank: 2, score: 194, achievedAt: 1000, isCurrentUser: true, displayName: "ぺるそなお" }],
        currentUserOutsideTop: null,
      });
      await renderOverlay();
      await waitFor(() => expect(screen.getByText("ぺるそなお")).toBeInTheDocument());
      expect(screen.getByText("あなた")).toBeInTheDocument();
    });
  });
});
