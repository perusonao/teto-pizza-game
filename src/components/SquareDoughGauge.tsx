/**
 * Square-Pan Dough B2 + C (Issues #535, #536): the progress gauge under the DOUGH status line of a square-pan round.
 *
 * It shows a REAL number of the dough on screen (what SquareDoughLayer pushes into ../logic/pan/squareDoughGaugeStore.ts), as a bar
 * and a one-decimal percentage, with a tick at the goal and the goal in words. Which number depends on the step, derived from the
 * dough (../logic/pan/squareDoughProgress.ts): STEP 1 「四隅まで伸ばす」 -> ひろがり (coverage, goal 95 %), STEP 2 「厚みを整える」 ->
 * なめらか度 (evenness, goal 60 %). The goal on the screen is the very constant the judgement uses, and "reached" is judged on the
 * number as printed. For a moment after each gesture it also shows how much that gesture changed the number: "+0.4" when it did,
 * "変化なし" when it did not. It never animates a number it was not given.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { squareDoughGaugeStore } from "../logic/pan/squareDoughGaugeStore";
import { SQUARE_COMPLETE_EVENNESS_MIN, SQUARE_STEP1_COVERAGE_MIN } from "../logic/pan/squareDoughProgress";
import type { SquareDough } from "../logic/pan/squareDough";
import { smoothnessText } from "../logic/pan/squareDoughView";
import { useSquareProgress } from "./useSquareProgress";

/** How long the "+0.4" / "変化なし" note stays after a gesture ends. */
const CHANGE_NOTE_MS = 1600;

export function SquareDoughGauge({ fallbackDough }: { fallbackDough: SquareDough }) {
  const { change } = useSyncExternalStore(squareDoughGaugeStore.subscribe, squareDoughGaugeStore.get);
  // Which number the gauge is about (the step) follows the COMMITTED dough; the number itself follows the live dough.
  const { live: progress, committed } = useSquareProgress(fallbackDough);
  // The note of a gesture stays until its timer says it has been shown long enough (the timer callback, not the effect body, sets state).
  const [expiredSeq, setExpiredSeq] = useState<number | null>(null);
  useEffect(() => {
    if (!change) return;
    const id = window.setTimeout(() => setExpiredSeq(change.seq), CHANGE_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [change]);
  const note = change && expiredSeq !== change.seq ? change : null;

  const stepOne = committed.step === 1;
  const shown = stepOne ? progress.coverage : progress.evenness;
  const goal = stepOne ? SQUARE_STEP1_COVERAGE_MIN : SQUARE_COMPLETE_EVENNESS_MIN;
  const reached = stepOne ? progress.coverageReached : progress.evennessReached;
  const percent = Math.min(100, Math.max(0, shown * 100));
  const goalPercent = goal * 100;
  return (
    <div
      className={`square-dough-gauge${reached ? " square-dough-gauge--reached" : ""}`}
      data-testid="square-dough-gauge"
      data-step={committed.step}
      data-metric={stepOne ? "coverage" : "evenness"}
      data-evenness={progress.evenness.toFixed(3)}
      data-coverage={progress.coverage.toFixed(3)}
      data-reached={reached ? "true" : "false"}
    >
      <span className="square-dough-gauge__label">{stepOne ? "ひろがり" : "なめらか度"}</span>
      <span className="square-dough-gauge__bar" role="img" aria-label={`${stepOne ? "ひろがり" : "なめらか度"} ${smoothnessText(shown)}`}>
        <span className="square-dough-gauge__fill" style={{ width: `${percent}%` }} />
        <span className="square-dough-gauge__target" data-testid="square-dough-gauge-target" style={{ left: `${goalPercent}%` }} />
      </span>
      <span className="square-dough-gauge__value" data-testid="square-dough-gauge-value">
        {smoothnessText(shown)}
      </span>
      <span className="square-dough-gauge__goal" data-testid="square-dough-gauge-goal">
        目標 {goalPercent.toFixed(0)}%
      </span>
      <span
        className={`square-dough-gauge__note${note ? (note.points === null ? " square-dough-gauge__note--none" : " square-dough-gauge__note--up") : ""}`}
        data-testid="square-dough-gauge-note"
        data-change={note ? (note.points === null ? "none" : note.points.toFixed(1)) : ""}
        role="status"
      >
        {note ? (note.points === null ? "変化なし" : `${note.points > 0 ? "+" : ""}${note.points.toFixed(1)}`) : ""}
      </span>
    </div>
  );
}
