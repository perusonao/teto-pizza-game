import type { ScoreBreakdown } from "../logic/scoring";

interface MissionServePanelProps {
  score: ScoreBreakdown;
  /** How many pizzas were served *before* this one (i.e. `mission.metrics.servedCount`,
   *  which SERVE hasn't yet counted this pizza into -- App.tsx only dispatches SERVE once
   *  the player taps "次の注文へ"). The badge below displays `servedCount + 1` so it reads
   *  as this pizza's own running total, not a stale pre-serve count. */
  servedCount: number;
  onNext: () => void;
}

const MAX_STARS = 5;

/**
 * Mission's compressed stand-in for RESULT + DISCOVERED (Phase 3C-4 section 8/17): free
 * play's `ResultPanel` + DISCOVERED banner/dialogue stay completely untouched for free play,
 * but during a Mission run they'd cost too much tempo (two extra screens, a "register to
 * Dex" button, a discovery banner) for what should be a quick "made it, next!" beat. This
 * reuses the exact same `ScoreBreakdown` free play scores -- no separate Mission scoring
 * path (see ../logic/scoring.ts) -- just displayed and dismissed faster.
 */
export function MissionServePanel({ score, servedCount, onNext }: MissionServePanelProps) {
  const filledStars = "★".repeat(score.stars);
  const emptyStars = "☆".repeat(MAX_STARS - score.stars);

  return (
    <div className="mission-serve-panel">
      <div className="mission-serve-panel__stars">
        {filledStars}
        <span className="mission-serve-panel__stars-empty">{emptyStars}</span>
      </div>
      <div className="mission-serve-panel__score">{Math.round(score.total)}点</div>
      <p className="mission-serve-panel__served">
        {"\u{1F355}"} +1 SERVED{" "}
        <span className="mission-serve-panel__served-count">({servedCount + 1})</span>
      </p>
      <button type="button" className="cta-button cta-button--primary" onClick={onNext}>
        次の注文へ
      </button>
    </div>
  );
}
