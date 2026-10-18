/**
 * Square-Pan Dough B2 (Issue #535): what the player is doing and where it leads, in words, for the DOUGH step of a square-pan round.
 * Owner iPhone HV: the dough reacted but "what to do / what happens / what to aim for" was not clear. Two stages are named up front:
 * STEP 1 「生地を平らにする」 (this file's job, B2) and STEP 2 「四隅まで伸ばす」 (C, #536: not playable yet, so it is only announced).
 *
 * `SquareDoughSteps` is the step strip plus the goal sentence (above the operation line and the gauge); `SquareDoughNext` is the line
 * under the gauge that says what comes next. Both read the same real evenness the gauge shows (useSyncExternalStore on the gauge store),
 * so "平らになった" is only ever said when the number on screen has reached the goal.
 */
import { useSyncExternalStore } from "react";
import { squareDoughGaugeStore } from "../logic/pan/squareDoughGaugeStore";
import { isFlatTargetReached } from "../logic/pan/squareDoughView";

function useReached(fallbackEvenness: number): boolean {
  const { evenness } = useSyncExternalStore(squareDoughGaugeStore.subscribe, squareDoughGaugeStore.get);
  return isFlatTargetReached(evenness ?? fallbackEvenness);
}

export function SquareDoughSteps({ fallbackEvenness }: { fallbackEvenness: number }) {
  const reached = useReached(fallbackEvenness);
  return (
    <div className="square-dough-steps" data-testid="square-dough-steps" data-step="1" data-reached={reached ? "true" : "false"}>
      <ol className="square-dough-steps__list" aria-label="生地の2だんかい">
        <li className="square-dough-steps__item square-dough-steps__item--now" aria-current="step" data-testid="square-dough-step-1">
          <b>STEP 1</b> 生地を平らにする
        </li>
        <li className="square-dough-steps__arrow" aria-hidden="true">
          ›
        </li>
        <li className="square-dough-steps__item square-dough-steps__item--next" data-testid="square-dough-step-2">
          <b>STEP 2</b> 四隅まで伸ばす
        </li>
      </ol>
      <p className="square-dough-steps__goal" data-testid="square-dough-goal">
        {reached ? "平らになりました！" : "盛り上がった濃いところを押して、平らにしよう"}
      </p>
    </div>
  );
}

export function SquareDoughNext({ fallbackEvenness }: { fallbackEvenness: number }) {
  const reached = useReached(fallbackEvenness);
  return (
    <p className="square-dough-next" data-testid="square-dough-next" data-reached={reached ? "true" : "false"}>
      {reached ? "つぎは「四隅まで伸ばす」（じゅんび中）" : "平らになったら、つぎは「四隅まで伸ばす」"}
    </p>
  );
}
