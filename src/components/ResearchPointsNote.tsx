/**
 * B案再構成 Phase 3c (Issue #901, shop model only): research points -- "貯める・見える". The points cannot be spent yet (the hint
 * purchase is Phase 3d), so every place that shows them says so in one short line. Nothing here renders under the legacy model:
 * the callers pass `null` there.
 */
import type { ResearchPointGain } from "../state/gameReducer";

export const RESEARCH_POINTS_COPY = {
  /** The name, with its icon (HOME pill, RESULT, the hint sheet). */
  label: "研究ポイント",
  icon: "\u{1F52C}",
  /** Phase 3c: they cannot be used yet. */
  notYetUsable: "ヒントと交換できるようになるのは、もう少し先です",
} as const;

/** RESULT: what this trial earned and the balance after it. */
export function ResearchPointsResultLine({ gain }: { gain: ResearchPointGain }) {
  return (
    <div className="result-research-points" data-testid="result-research-points" aria-live="polite">
      <p className="result-research-points__gain">
        {RESEARCH_POINTS_COPY.icon} {RESEARCH_POINTS_COPY.label} <strong>+{gain.earned}</strong>
        <span className="result-research-points__total">（所持 {gain.balanceAfter}）</span>
      </p>
      <p className="result-research-points__note">{RESEARCH_POINTS_COPY.notYetUsable}</p>
    </div>
  );
}

/** The hint sheet: the balance, and that it cannot buy a hint yet. */
export function ResearchPointsHintBalance({ balance }: { balance: number }) {
  return (
    <div className="hint-sheet__research-points" data-testid="hint-research-points">
      <p className="hint-sheet__research-points-balance">
        {RESEARCH_POINTS_COPY.icon} {RESEARCH_POINTS_COPY.label} <strong>{balance}</strong>
      </p>
      <p className="hint-sheet__research-points-note">{RESEARCH_POINTS_COPY.notYetUsable}</p>
    </div>
  );
}
