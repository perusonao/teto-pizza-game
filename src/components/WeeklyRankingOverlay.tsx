import { useCallback, useEffect, useState } from "react";
import { getWeeklyLeaderboard, type GetWeeklyLeaderboardResult } from "../firebase";
import type { JstWeekRange } from "../shared/lunchRushPeriodIds";
import { formatAchievedAt } from "../shared/formatAchievedAt";

interface WeeklyRankingOverlayProps {
  onClose: () => void;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "loaded"; result: GetWeeklyLeaderboardResult };

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** e.g. "9/14〜9/20" -- month is only repeated on the end date when the week crosses a month
 *  boundary, so the common case stays short enough for a single-line 390px header. */
function formatWeekRangeLabel(range: JstWeekRange): string {
  const start = `${range.monday.month}/${pad2(range.monday.day)}`;
  const end =
    range.monday.month === range.sunday.month
      ? `${pad2(range.sunday.day)}`
      : `${range.sunday.month}/${pad2(range.sunday.day)}`;
  return `${start}〜${end}`;
}

/** 1st/2nd/3rd get a medal; everyone else gets "N位" -- matches the emoji-forward visual
 *  language MissionResultOverlay already established. */
function rankLabel(rank: number): string {
  if (rank === 1) return "\u{1F947}";
  if (rank === 2) return "\u{1F948}";
  if (rank === 3) return "\u{1F949}";
  return `${rank}位`;
}

function formatScore(score: number): string {
  return score.toLocaleString("ja-JP");
}

/**
 * Firebase Ranking 1.0 Phase 2A (Issue #87). The first Lunch Rush ranking UI -- weekly TOP 10
 * only (monthly/all-time/nicknames/avatars all deferred, see docs/design/
 * TETO_FIREBASE-RANKING_SETUP.md's Phase 2A section). Reads through
 * `../firebase`'s `getWeeklyLeaderboard()` only -- this component never imports `firebase/
 * firestore` itself (this task's own "don't scatter Firebase access into UI components"
 * requirement).
 *
 * One overlay, one screen, no internal navigation -- loading/empty/error/unavailable all render
 * inside the same body region, so a ranking-read failure of any kind never looks like a
 * different, broken part of the app. Crucially, nothing here can fail Lunch Rush itself: this
 * overlay is only ever reachable from the RESULT screen once a run has already finished, and
 * every one of `getWeeklyLeaderboard`'s outcomes (including a thrown network error) resolves to
 * a typed, renderable state instead of propagating.
 *
 * Visual Polish 2.0B (Fresh Audit P1-3): since HOME's own ranking card opens this exact overlay
 * as a peer of Dex/Shop/Inventory/Settings, it now shares their `.dex-overlay`/
 * `.dex-overlay__panel` bottom-sheet shell (App.css) instead of the small centered
 * `.mission-overlay__panel` dialog card -- the same shell those four already share, not a new
 * one. `.ranking-overlay` only overrides the shared shell's z-index (see App.css) back up to 25,
 * matching `.mission-overlay`'s own layer, because this overlay can still be opened on top of an
 * already-mounted `MissionResultOverlay` from Lunch Rush RESULT ("ランキングを見る") and must
 * stay visually in front of it.
 */
export function WeeklyRankingOverlay({ onClose }: WeeklyRankingOverlayProps) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  // The initial fetch: the effect itself never calls setState synchronously (the mount-time
  // "loading" phase is already `state`'s own initial value above) -- only the async `.then`
  // callback does, once the read actually resolves.
  const fetchLeaderboard = useCallback(() => {
    void getWeeklyLeaderboard().then((result) => setState({ phase: "loaded", result }));
  }, []);
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // The retry button's own handler: a plain event-handler state update (not effect-driven),
  // resetting to "loading" before firing the same fetch again.
  const retry = useCallback(() => {
    setState({ phase: "loading" });
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const result = state.phase === "loaded" ? state.result : null;

  return (
    <div className="dex-overlay ranking-overlay">
      <div className="dex-overlay__panel ranking-overlay__panel">
        <div className="dex-overlay__header">
          <h2>{"\u{1F3C6}"} 週間ランキング</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="dex-overlay__body ranking-overlay__body">
          {result?.status === "success" && (
            <p className="ranking-overlay__week">今週 {formatWeekRangeLabel(result.weekRange)}</p>
          )}

          {state.phase === "loading" && (
            <p className="ranking-overlay__status" role="status">
              読み込み中...
            </p>
          )}

          {result?.status === "unavailable" && (
            <p className="ranking-overlay__status">ランキング機能は準備中です。</p>
          )}

          {result?.status === "error" && (
            <>
              <p className="ranking-overlay__status ranking-overlay__status--error" role="alert">
                ランキングを読み込めませんでした。
              </p>
              <button type="button" className="secondary-button" onClick={retry}>
                再読み込み
              </button>
            </>
          )}

          {result?.status === "success" && result.top.length === 0 && (
            <p className="ranking-overlay__status">まだ今週の記録がありません。</p>
          )}

          {result?.status === "success" && result.top.length > 0 && (
            <ol className="ranking-overlay__list">
              {result.top.map((entry) => (
                <li
                  key={entry.rank}
                  className={
                    entry.isCurrentUser
                      ? "ranking-overlay__row ranking-overlay__row--you"
                      : "ranking-overlay__row"
                  }
                >
                  <span className="ranking-overlay__rank">{rankLabel(entry.rank)}</span>
                  <div className="ranking-overlay__identity">
                    <span className="ranking-overlay__name" title={entry.displayName}>
                      {entry.displayName}
                    </span>
                    <span className="ranking-overlay__achieved-at">
                      {formatAchievedAt(entry.achievedAt)}
                    </span>
                  </div>
                  <span className="ranking-overlay__score">{formatScore(entry.score)}</span>
                  {entry.isCurrentUser && <span className="ranking-overlay__you-badge">あなた</span>}
                </li>
              ))}
            </ol>
          )}

          {result?.status === "success" && result.currentUserOutsideTop && (
            <div className="ranking-overlay__row ranking-overlay__row--you ranking-overlay__row--outside">
              <span className="ranking-overlay__rank">{result.currentUserOutsideTop.rank}位</span>
              <div className="ranking-overlay__identity">
                <span className="ranking-overlay__name" title={result.currentUserOutsideTop.displayName}>
                  {result.currentUserOutsideTop.displayName}
                </span>
                <span className="ranking-overlay__achieved-at">
                  {formatAchievedAt(result.currentUserOutsideTop.achievedAt)}
                </span>
              </div>
              <span className="ranking-overlay__score">
                {formatScore(result.currentUserOutsideTop.score)}
              </span>
              <span className="ranking-overlay__you-badge">あなた</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
