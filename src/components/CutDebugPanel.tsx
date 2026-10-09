import type { DoughShape } from "../logic/doughShape";
import { isThroughCut } from "../logic/cut/cutVisual";
import { computeCutRegions, getCutSignificanceThresholds, isSignificantRegion } from "../logic/cut/regions";
import type { CutEvaluation, CutLine } from "../logic/cut/types";

interface CutDebugPanelProps {
  evaluation: CutEvaluation | null;
  /** #427: with the committed lines (and the dough silhouette the through test uses) the panel also shows how many regions
   *  exist and how many of them are significant (the pieces the evaluation counts). */
  lines?: readonly CutLine[];
  shape?: DoughShape;
}

function round(value: number): number {
  return Math.round(value);
}

/**
 * Pizza Cutting 1.0 Phase 3 (docs/design/TETO_PIZZA-CUTTING_1.0.md §18 "CUT Phase 3" row):
 * mirrors ScoringV2DebugPanel.tsx's own Production/Preview gating pattern verbatim --
 * STRICTLY preview/dev-only, `import.meta.env.VITE_PREVIEW_MODE` (the project's existing
 * Preview/Production SSOT), statically `false` in a production `vite build` so Vite
 * dead-code-eliminates this component's rendered output from what ships.
 *
 * A calibration/debug tool, not final player UI -- exposes the raw 0-1 signals
 * (`countCorrectness`/`completeness`/`centerAccuracy`/`uniformity`) RESULT's own player-facing
 * `.cut-evaluation-summary` (ResultPanel.tsx) never will; that one only ever shows the three
 * signals the design doc's own RESULT UI section calls for, as rounded 0-100 percentages/points.
 */
export function CutDebugPanel({ evaluation, lines, shape }: CutDebugPanelProps) {
  if (!import.meta.env.VITE_PREVIEW_MODE) return null;
  if (!evaluation) return null;

  const thresholds = getCutSignificanceThresholds();
  const regions = lines ? computeCutRegions(lines.filter((line) => isThroughCut(line, shape))) : null;
  const significant = regions ? regions.filter((region) => isSignificantRegion(region, thresholds)).length : null;

  return (
    <div className="cut-debug-panel">
      <p className="cut-debug-panel__heading">{"✂️"} CUT Debug（開発用）</p>
      <p className="cut-debug-panel__total">cutScore: {round(evaluation.cutScore)} / 100</p>
      <div className="cut-debug-panel__row">
        <span className="cut-debug-panel__chip">
          分割 {evaluation.actualPieceCount}/{evaluation.requestedSliceCount}
        </span>
        <span className="cut-debug-panel__chip">本数 {evaluation.completedCutCount}</span>
        {regions && (
          <span className="cut-debug-panel__chip">
            全領域 {regions.length} / 有意 {significant}
          </span>
        )}
        <span className="cut-debug-panel__chip">
          閾値 {(thresholds.areaFraction * 100).toFixed(2)}% / {thresholds.minWidth.toFixed(1)}u
        </span>
        <span className="cut-debug-panel__chip">count {round(evaluation.countCorrectness * 100)}%</span>
        <span className="cut-debug-panel__chip">complete {round(evaluation.completeness * 100)}%</span>
        <span className="cut-debug-panel__chip">center {round(evaluation.centerAccuracy * 100)}%</span>
        <span className="cut-debug-panel__chip">uniform {round(evaluation.uniformity * 100)}%</span>
      </div>
    </div>
  );
}
