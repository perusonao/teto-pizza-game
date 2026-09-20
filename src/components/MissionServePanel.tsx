import type { ScoreBreakdown } from "../logic/scoring";
import type { PizzaCompletionResult } from "../logic/completionGate";
import { buildCompletionFailureMessage } from "../data/completionMessages";

interface MissionServePanelProps {
  score: ScoreBreakdown;
  /** How many pizzas were served *before* this one (i.e. `mission.metrics.servedCount`,
   *  which SERVE hasn't yet counted this pizza into -- App.tsx only dispatches SERVE once
   *  the player taps "次の注文へ"). The badge below displays `servedCount + 1` so it reads
   *  as this pizza's own running total, not a stale pre-serve count. Only meaningful on the
   *  PASS branch below -- a FAILED order never becomes `+ 1` of this (see `completion`). */
  servedCount: number;
  /** Lunch Rush Completion Gate 1A: the same `evaluatePizzaCompletion` result FREE's own
   *  ResultPanel already branches on (../logic/completionGate.ts), computed unconditionally
   *  at CONFIRM_BAKE for every round. `FAILED` renders this panel's own compact failure
   *  variant instead of the score/stars/+1 SERVED card -- reusing the exact same reason copy
   *  (../data/completionMessages.ts) FREE shows, never a new independent message. */
  completion: PizzaCompletionResult;
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
export function MissionServePanel({ score, servedCount, completion, onNext }: MissionServePanelProps) {
  // Lunch Rush Completion Gate 1A: a FAILED order gets its own small, distinct card, the same
  // "reuse the RESULT structure, don't build new UI" approach ResultPanel already takes for
  // FREE (see ../components/ResultPanel.tsx) -- never the stars/score/+1 SERVED markup, so a
  // FAILED pizza can never be misread as a normal served one. The "次の注文へ" CTA stays: the
  // order is still consumed and the run still advances (App.tsx's handleMissionServeNext),
  // this is not a retry of the same order.
  if (completion.status === "FAILED") {
    const failureMessage = buildCompletionFailureMessage(completion);
    return (
      <div className="mission-serve-panel mission-serve-panel--failed">
        <p className="mission-serve-panel__failed-reason" role="alert">
          {failureMessage}
        </p>
        <p className="mission-serve-panel__served mission-serve-panel__served--failed">
          注文失敗 {"\u{1F6AB}"}{" "}
          <span className="mission-serve-panel__served-count">({servedCount})</span>
        </p>
        <button type="button" className="cta-button cta-button--primary" onClick={onNext}>
          次の注文へ
        </button>
      </div>
    );
  }

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
