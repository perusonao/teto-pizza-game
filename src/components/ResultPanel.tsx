import type { ScoreBreakdown } from "../logic/scoring";

interface ResultPanelProps {
  score: ScoreBreakdown;
  onRegister: () => void;
}

const SCORE_ROWS: Array<{ key: keyof ScoreBreakdown; label: string }> = [
  { key: "matchScore", label: "注文一致度" },
  { key: "ingredientScore", label: "材料の正しさ" },
  { key: "bakeScore", label: "焼き加減" },
];

export function ResultPanel({ score, onRegister }: ResultPanelProps) {
  return (
    <div className="result-panel">
      <div className="result-panel__stars">{"⭐".repeat(score.stars)}</div>
      <div className="result-panel__bars">
        {SCORE_ROWS.map((row) => (
          <div key={row.key} className="score-bar">
            <span className="score-bar__label">{row.label}</span>
            <div className="score-bar__track">
              <div
                className="score-bar__fill"
                style={{ width: `${Math.round(score[row.key] as number)}%` }}
              />
            </div>
            <span className="score-bar__value">{Math.round(score[row.key] as number)}</span>
          </div>
        ))}
      </div>
      <button type="button" className="cta-button cta-button--primary" onClick={onRegister}>
        レシピ図鑑に登録する
      </button>
    </div>
  );
}
