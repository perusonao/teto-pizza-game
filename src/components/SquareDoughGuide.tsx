/**
 * Square-Pan Dough B2 + C (Issues #535, #536): what the player is doing and where it leads, in words, for the DOUGH step of a
 * square-pan round. Two stages are named up front and told apart by what the finger does in them (Owner decision on the C plan):
 *   STEP 1 「四隅まで伸ばす」: the main operation is the DRAG -- pull the dough out to the four corners.
 *   STEP 2 「厚みを整える」 : the main operation is TAP / LONG PRESS -- push the thick places flat (dragging still works).
 * The step is derived from the dough (../logic/pan/squareDoughProgress.ts), so it can neither be skipped nor go back, and the words
 * follow the real numbers: "できあがり" is only ever said when the dough is complete and 「次へ」 is available.
 *
 * `SquareDoughSteps` is the step strip plus the goal sentence (above the operation line and the gauge); `SquareDoughNext` is the line
 * under the gauge that says what comes next. Both read the same dough the gauge shows (useSyncExternalStore on the gauge store).
 * The text carries the count and the story; the pan itself carries the picture (corner marks, drag hints -- SquareDoughLayer).
 */
import type { SquareDough } from "../logic/pan/squareDough";
import { isGapGuideActive } from "../logic/pan/squareDoughGaps";
import { smoothnessText } from "../logic/pan/squareDoughView";
import { useSquareProgress } from "./useSquareProgress";

export function SquareDoughSteps({ fallbackDough }: { fallbackDough: SquareDough }) {
  const { live, committed: p } = useSquareProgress(fallbackDough);
  const step1State = p.step === 1 ? "now" : "done";
  const step2State = p.step === 1 ? "next" : "now";
  // All four corners reached but the coverage bar is not: the corners are not the goal any more, the bare places are (AB-min). Same line, no new row.
  const gaps = isGapGuideActive(live, p.step);
  const goal = p.step === 1
    ? gaps
      ? `すき間をうめよう（ひろがり ${smoothnessText(live.coverage)}）`
      : `なぞって、生地を四隅まで伸ばそう（四隅 ${live.cornersReached}/4）`
    : p.complete
      ? "できあがり！「次へ」で形が決まります"
      : "盛り上がった濃いところを押して、平らにしよう";
  return (
    <div
      className="square-dough-steps"
      data-testid="square-dough-steps"
      data-step={p.step}
      data-complete={p.complete ? "true" : "false"}
      data-corners={live.cornersReached}
      data-gaps={gaps ? "true" : "false"}
    >
      <ol className="square-dough-steps__list" aria-label="生地の2だんかい">
        <li
          className={`square-dough-steps__item square-dough-steps__item--${step1State}`}
          aria-current={p.step === 1 ? "step" : undefined}
          data-testid="square-dough-step-1"
          data-state={step1State}
        >
          <b>{p.step1Done ? "✓" : "STEP 1"}</b> 四隅まで伸ばす
        </li>
        <li className="square-dough-steps__arrow" aria-hidden="true">
          ›
        </li>
        <li
          className={`square-dough-steps__item square-dough-steps__item--${step2State}`}
          aria-current={p.step === 2 ? "step" : undefined}
          data-testid="square-dough-step-2"
          data-state={step2State}
        >
          <b>STEP 2</b> 厚みを整える
        </li>
      </ol>
      <p className="square-dough-steps__goal" data-testid="square-dough-goal">
        {goal}
      </p>
    </div>
  );
}

export function SquareDoughNext({ fallbackDough }: { fallbackDough: SquareDough }) {
  const { live, committed: p } = useSquareProgress(fallbackDough);
  const text = p.step === 1
    ? isGapGuideActive(live, p.step)
      ? "天板いっぱいに広がったら、つぎは「厚みを整える」"
      : "四隅まで伸びたら、つぎは「厚みを整える」"
    : p.complete
      ? "「次へ」を押すまで、まだ整えられるよ"
      : "平らになったら「次へ」が使えるよ";
  return (
    <p className="square-dough-next" data-testid="square-dough-next" data-step={p.step} data-complete={p.complete ? "true" : "false"}>
      {text}
    </p>
  );
}
