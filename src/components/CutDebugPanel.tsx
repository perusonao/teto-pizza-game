import type { CutEvaluation } from "../logic/cut/types";

interface CutDebugPanelProps {
  evaluation: CutEvaluation | null;
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
export function CutDebugPanel({ evaluation }: CutDebugPanelProps) {
  if (!import.meta.env.VITE_PREVIEW_MODE) return null;
  if (!evaluation) return null;

  return (
    <div className="cut-debug-panel">
      <p className="cut-debug-panel__heading">{"✂️"} CUT Debug（開発用）</p>
      <p className="cut-debug-panel__total">cutScore: {round(evaluation.cutScore)} / 100</p>
      <div className="cut-debug-panel__row">
        <span className="cut-debug-panel__chip">
          分割 {evaluation.actualPieceCount}/{evaluation.requestedSliceCount}
        </span>
        <span className="cut-debug-panel__chip">本数 {evaluation.completedCutCount}</span>
        <span className="cut-debug-panel__chip">count {round(evaluation.countCorrectness * 100)}%</span>
        <span className="cut-debug-panel__chip">complete {round(evaluation.completeness * 100)}%</span>
        <span className="cut-debug-panel__chip">center {round(evaluation.centerAccuracy * 100)}%</span>
        <span className="cut-debug-panel__chip">uniform {round(evaluation.uniformity * 100)}%</span>
      </div>
    </div>
  );
}
