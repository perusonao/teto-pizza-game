import type { MissionResultStats } from "../logic/missionResultStats";

interface MissionResultOverlayProps {
  /** Lunch Rush Phase 4 (Result Summary): `deriveMissionResultStats(mission.serves)` --
   *  attempts/successes/failures/successRatePercent for this run, PASS-vs-FAILED per the
   *  Completion Gate (../logic/completionGate.ts). `stats.successes` is what the old standalone
   *  `servedCount` prop used to carry (both count PASS-only serves from the same run) -- this
   *  replaces that prop rather than duplicating it alongside. */
  stats: MissionResultStats;
  averageQuality: number;
  bestQuality: number;
  score: number;
  isNewBest: boolean;
  /** This run's Pitz reward (Phase 3C-5, ../logic/economy.ts's `calculateMissionReward`) --
   *  always 0 for a 0-serve run. Shown as "+N Pitz", never as a standalone balance. */
  pitzReward: number;
  /** Pitz balance *after* this run's reward has been applied (src/state/gameReducer.ts's
   *  CLAIM_MISSION_REWARD) -- current balance, not the reward amount itself. */
  pitzBalance: number;
  onRetry: () => void;
  onExit: () => void;
  /** Firebase Ranking 1.0 Phase 2A (Issue #87): opens the weekly ranking overlay
   *  (WeeklyRankingOverlay). This run's own score submission (App.tsx's Phase 1B effect) has
   *  already fired by the time RESULT renders -- see that effect's own comment -- so tapping
   *  this immediately after a run typically already reflects the just-submitted score, though
   *  nothing here waits on or guarantees that (Phase 2A intentionally avoids adding global
   *  submission/read synchronization; a player who wants the very latest can retry from the
   *  ranking overlay itself). */
  onShowRanking: () => void;
  /** Gameplay UX Phase 2 (Issue #157): reuses App.tsx's own `handleGoHome` -- RESULT means
   *  `isRoundInProgress()` is already false, so this never shows the leave-confirmation dialog,
   *  and `handleGoHome`'s own `mission.mode !== "FREE"` branch tidies the Mission state back to
   *  FREE before navigating HOME. No new navigation/reset logic here. */
  onGoHome: () => void;
}

/** Shown once a Lunch Rush run's timer expires (Phase 3C-4 section 11). One screen, no extra
 *  navigation -- summarizes the run and offers to go again or head back to free play. */
export function MissionResultOverlay({
  stats,
  averageQuality,
  bestQuality,
  score,
  isNewBest,
  pitzReward,
  pitzBalance,
  onRetry,
  onExit,
  onShowRanking,
  onGoHome,
}: MissionResultOverlayProps) {
  return (
    <div className="mission-overlay">
      <div className="mission-overlay__panel">
        <h2 className="mission-overlay__title">ランチラッシュ結果</h2>
        <div className="mission-result__stats">
          {/* Lunch Rush Phase 4 (Result Summary): attempts/successes/failures/success rate,
              derived once by ../logic/missionResultStats.ts's `deriveMissionResultStats` from
              `mission.serves` -- this replaces the old standalone "提供 N枚" row (`successes`
              carries the exact same value that row used to show). Two lines, not four separate
              `.mission-result__row`s, to keep this compact on a 360x800 viewport (task's own
              "don't turn RESULT into a dense dashboard" instruction). */}
          <p className="mission-result__row mission-result__row--attempts">
            {"\u{1F355}"} <strong>{stats.attempts}</strong>枚挑戦
          </p>
          <div className="mission-result__attempt-grid">
            <span className="mission-result__attempt-chip mission-result__attempt-chip--success">
              成功 <strong>{stats.successes}</strong>
            </span>
            <span className="mission-result__attempt-chip mission-result__attempt-chip--failure">
              失敗 <strong>{stats.failures}</strong>
            </span>
            <span className="mission-result__attempt-chip mission-result__attempt-chip--rate">
              成功率 <strong>{stats.successRatePercent}%</strong>
            </span>
          </div>
          <p className="mission-result__row">
            {"⭐"} 平均 <strong>{Math.round(averageQuality)}</strong>点
          </p>
          <p className="mission-result__row">
            {"🏆"} 最高 <strong>{Math.round(bestQuality)}</strong>点
          </p>
          <p className="mission-result__row mission-result__row--score">
            {"🎯"} スコア <strong>{score}</strong>
            {isNewBest && <span className="mission-result__new-best">ベスト更新！</span>}
          </p>
          <p className="mission-result__row mission-result__row--pitz">
            {"\u{1FA99}"} <strong>+{pitzReward} Pitz</strong>
          </p>
        </div>
        <p className="mission-result__balance">
          現在残高: {"\u{1FA99}"} {pitzBalance} Pitz
        </p>
        <button type="button" className="secondary-button mission-result__ranking-link" onClick={onShowRanking}>
          {"\u{1F3C6}"} ランキングを見る
        </button>
        <div className="action-row action-row--column">
          <button type="button" className="cta-button cta-button--primary" onClick={onRetry}>
            もう一度
          </button>
          {/* Gameplay UX Phase 2 (Issue #157): フリープレイへ/🏠ホームへ paired side-by-side
              (`.mission-result__nav-row`, `.home-cta-row`'s own flex:1-pair pattern) instead of
              stacked, so the 4th CTA adds ~0 vertical height to the RESULT panel and both
              existing 390x844/360x800 "fits without page scroll" e2e assertions keep holding. */}
          <div className="mission-result__nav-row">
            <button type="button" className="secondary-button mission-result__nav-button" onClick={onExit}>
              フリープレイへ
            </button>
            <button type="button" className="secondary-button mission-result__nav-button" onClick={onGoHome}>
              {"\u{1F3E0}"} ホームへ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
