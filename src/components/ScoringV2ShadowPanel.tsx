import type {
  PieceGroupScoreV2,
  ScoringV2Components,
  ScoringV2Result,
  ScoringV2Unavailable,
} from "../logic/scoringV2";

interface ScoringV2ShadowPanelProps {
  result: ScoringV2Result | null;
}

function isUnavailable(
  component: ScoringV2Components[keyof ScoringV2Components],
): component is ScoringV2Unavailable {
  return component.available === false;
}

function round(value: number): number {
  return Math.round(value);
}

function ComponentChip({
  label,
  component,
}: {
  label: string;
  component: ScoringV2Components[keyof ScoringV2Components];
}) {
  return (
    <span className="scoring-v2-panel__chip">
      {label} <strong>{isUnavailable(component) ? "N/A" : `${round(component.score)}`}</strong>
    </span>
  );
}

function PieceGroupRow({ group }: { group: PieceGroupScoreV2 }) {
  return (
    <div className="scoring-v2-panel__row" key={group.ingredientId}>
      <span className="scoring-v2-panel__chip">
        {group.ingredientId} {group.playerCount}/{group.targetCount}
      </span>
      <span className="scoring-v2-panel__chip">量 {round(group.quantitySimilarity * 100)}%</span>
      <span className="scoring-v2-panel__chip">
        配置 {group.placementSimilarity === null ? "N/A" : `${round(group.placementSimilarity * 100)}%`}
      </span>
      <span className="scoring-v2-panel__chip scoring-v2-panel__chip--score">{round(group.score)}</span>
    </div>
  );
}

/**
 * Phase 4A-2: compact developer/calibration debug panel for Scoring 2.0 Shadow
 * (src/logic/scoringV2/). STRICTLY preview/dev-only -- `import.meta.env.VITE_PREVIEW_MODE` is
 * the project's existing Preview/Production SSOT (see PreviewBadge.tsx, SauceMetricsPanel.tsx,
 * persistence.ts's SAVE_STORAGE_KEY), statically `false` in a production `vite build` so Vite
 * dead-code-eliminates this whole component's rendered output from what ships (pinned by
 * scoringV2.test.ts's production-build assertion).
 *
 * This is a calibration tool, not final player UI -- it intentionally exposes raw component
 * numbers RESULT never will. It never renders anything that could be mistaken for the
 * player's actual score: no ★, no "Total" without the word "Shadow" beside it.
 */
export function ScoringV2ShadowPanel({ result }: ScoringV2ShadowPanelProps) {
  if (!import.meta.env.VITE_PREVIEW_MODE) return null;
  if (!result) return null;

  return (
    <div className="scoring-v2-panel">
      <p className="scoring-v2-panel__heading">
        {"\u{1F9EA}"} Scoring 2.0 Shadow（開発用・{result.rulesetVersion}）
      </p>

      {!result.available && (
        <p className="scoring-v2-panel__unavailable">Reference unavailable</p>
      )}

      {result.available && result.totalScore !== null && (
        <>
          <p className="scoring-v2-panel__total">Total: {round(result.totalScore)} / 100</p>
          <div className="scoring-v2-panel__row">
            <ComponentChip label="Sauce" component={result.components.sauce} />
            <ComponentChip label="Pieces" component={result.components.pieces} />
            <ComponentChip label="Recipe" component={result.components.recipe} />
            <ComponentChip label="Bake" component={result.components.bake} />
          </div>

          {!isUnavailable(result.components.sauce) && (
            <div className="scoring-v2-panel__row">
              <span className="scoring-v2-panel__chip">
                量 {round(result.components.sauce.quantitySimilarity * 100)}%
              </span>
              <span className="scoring-v2-panel__chip">
                被覆 {round(result.components.sauce.coverageSimilarity * 100)}%
              </span>
              <span className="scoring-v2-panel__chip">
                均一性 {round(result.components.sauce.evennessScore * 100)}%
              </span>
              <span className="scoring-v2-panel__chip">
                ふち {round(result.components.sauce.edgeScore * 100)}%
              </span>
            </div>
          )}

          {!isUnavailable(result.components.pieces) &&
            result.components.pieces.groups.map((group) => (
              <PieceGroupRow group={group} key={group.ingredientId} />
            ))}

          {!isUnavailable(result.components.recipe) && (
            <div className="scoring-v2-panel__row">
              <span className="scoring-v2-panel__chip">
                必須 {result.components.recipe.requiredTypesPresent}/{result.components.recipe.requiredTypesTotal}
              </span>
              <span className="scoring-v2-panel__chip">
                余分な種類 {result.components.recipe.extraTypesCount}
              </span>
              <span className="scoring-v2-panel__chip">
                純度 {round(result.components.recipe.purityMultiplier * 100)}%
              </span>
            </div>
          )}

          {!isUnavailable(result.components.bake) && (
            <div className="scoring-v2-panel__row">
              <span className="scoring-v2-panel__chip">
                焼き加減 {result.components.bake.bakeState ?? "未焼成"}
              </span>
              <span className="scoring-v2-panel__chip">
                目標との差 {round(result.components.bake.distanceFromIdeal)}
              </span>
              <span className="scoring-v2-panel__chip">
                類似度 {round(result.components.bake.similarity * 100)}%
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
