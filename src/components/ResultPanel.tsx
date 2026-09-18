import type { ScoreBreakdown } from "../logic/scoring";
import { BAKE_STATE_LABEL, type BakeState } from "../logic/bake";

interface ResultPanelProps {
  score: ScoreBreakdown;
  bakeState: BakeState | null;
  /** A1 Authority Cutover: Scoring 2.0's Sauce component score (0-100), Scoring 2.0's single
   *  heaviest component (52/100) and the one dimension `ScoreBreakdown` itself has no field
   *  for (see ../logic/scoringV2/toLegacyScoreBreakdown.ts's file header). Read straight from
   *  `state.scoringV2Shadow.components.sauce` at the call site rather than folded into any of
   *  `score`'s four legacy fields, so it is never silently discarded from player-facing
   *  feedback. `null` only when Scoring 2.0 itself came back unavailable (should not happen
   *  for any of the 7 shipped recipes -- see the adapter's own fallback contract) -- the row is
   *  simply omitted in that case rather than showing a fabricated number. */
  sauceScore: number | null;
  onRegister: () => void;
}

const MAX_STARS = 5;

const BAKE_STATE_ICON: Record<BakeState, string> = {
  raw: "\u{1F4A7}",
  perfect: "✅",
  burnt: "\u{1F525}",
};

/**
 * Small feedback rows shown under the headline stars/score. "具材" blends recipe-required-
 * ingredient presence and purity (the two ingredient-related legacy fields) into one number
 * for display purposes only — ScoreBreakdown itself keeps them separate for scoring and
 * testing. "ソース" (Sauce) is intentionally not part of this table -- `ScoreBreakdown` has no
 * field for it (see `sauceScore` prop above), so it is rendered as its own row below instead.
 */
function ingredientFeedbackScore(score: ScoreBreakdown): number {
  return score.matchScore * 0.7 + score.ingredientScore * 0.3;
}

const FEEDBACK_ROWS: Array<{ key: string; label: string; value: (score: ScoreBreakdown) => number }> = [
  { key: "ingredients", label: "具材", value: ingredientFeedbackScore },
  { key: "placement", label: "配置", value: (score) => score.placementScore },
  { key: "bake", label: "焼き", value: (score) => score.bakeScore },
];

export function ResultPanel({ score, bakeState, sauceScore, onRegister }: ResultPanelProps) {
  const filledStars = "★".repeat(score.stars);
  const emptyStars = "☆".repeat(MAX_STARS - score.stars);

  return (
    <div className="result-panel">
      <div className="result-panel__headline">
        <div className="result-panel__stars">
          {filledStars}
          <span className="result-panel__stars-empty">{emptyStars}</span>
        </div>
        <div className="result-panel__score">{Math.round(score.total)}</div>
      </div>
      {bakeState && (
        <p className={`result-panel__bake-badge result-panel__bake-badge--${bakeState}`}>
          {BAKE_STATE_ICON[bakeState]} 焼き加減: {BAKE_STATE_LABEL[bakeState]}
        </p>
      )}
      <div className="result-panel__bars">
        {sauceScore !== null && (
          <div className="score-bar">
            <span className="score-bar__label">ソース</span>
            <div className="score-bar__track">
              <div className="score-bar__fill" style={{ width: `${Math.round(sauceScore)}%` }} />
            </div>
            <span className="score-bar__value">{Math.round(sauceScore)}</span>
          </div>
        )}
        {FEEDBACK_ROWS.map((row) => (
          <div key={row.key} className="score-bar">
            <span className="score-bar__label">{row.label}</span>
            <div className="score-bar__track">
              <div
                className="score-bar__fill"
                style={{ width: `${Math.round(row.value(score))}%` }}
              />
            </div>
            <span className="score-bar__value">{Math.round(row.value(score))}</span>
          </div>
        ))}
      </div>
      <button type="button" className="cta-button cta-button--primary" onClick={onRegister}>
        レシピ図鑑に登録する
      </button>
    </div>
  );
}
