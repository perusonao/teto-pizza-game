interface MissionResultOverlayProps {
  servedCount: number;
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
}

/** Shown once a Lunch Rush run's timer expires (Phase 3C-4 section 11). One screen, no extra
 *  navigation -- summarizes the run and offers to go again or head back to free play. */
export function MissionResultOverlay({
  servedCount,
  averageQuality,
  bestQuality,
  score,
  isNewBest,
  pitzReward,
  pitzBalance,
  onRetry,
  onExit,
}: MissionResultOverlayProps) {
  return (
    <div className="mission-overlay">
      <div className="mission-overlay__panel">
        <h2 className="mission-overlay__title">ランチラッシュ結果</h2>
        <div className="mission-result__stats">
          <p className="mission-result__row">
            {"\u{1F355}"} 提供 <strong>{servedCount}</strong>枚
          </p>
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
        <div className="action-row action-row--column">
          <button type="button" className="cta-button cta-button--primary" onClick={onRetry}>
            もう一度
          </button>
          <button type="button" className="secondary-button" onClick={onExit}>
            フリープレイへ
          </button>
        </div>
      </div>
    </div>
  );
}
