import type { CSSProperties } from "react";
import { sauceRemainingFraction } from "../logic/sauceRemaining";

interface SauceRemainingGaugeProps {
  /** Sum of deposits from finished strokes (PizzaStage `committedTotalRef`). */
  committedTotal: number;
  /** Sum of the in-progress stroke's deposits (PizzaStage `pendingTotalRef`). */
  pendingTotal: number;
  /** The selected sauce's own colour (hex). Absent: the stage-1 red. */
  color?: string;
  /**
   * Fraction in [0, 1] of the bar that is still full for this sauce but blocked by the pizza-wide cap. Drawn as a quiet diagonal
   * hatch above the fill, so "this sauce is empty" (no hatch) reads differently from "the pizza reached its total limit" (hatch).
   */
  capBlocked?: number;
}

/**
 * Issue #489 stage 1: standalone, display-only vertical gauge (14x96px via CSS) for the sauce
 * left in the current application. No numeric text (a % would read as a score), never
 * interactive (`pointer-events: none`). Owner Decision on PR #494: it shows the selected sauce's colour and tells a drained sauce from the
 * pizza-wide limit; the track and fill outlines keep a pale sauce (olive oil) visible.
 */
export function SauceRemainingGauge({ committedTotal, pendingTotal, color, capBlocked = 0 }: SauceRemainingGaugeProps) {
  const fraction = sauceRemainingFraction(committedTotal, pendingTotal);
  const now = Math.round(fraction * 100);
  const blocked = Math.round(Math.min(1, Math.max(0, capBlocked)) * 100);
  const capped = blocked > 0;
  return (
    <div
      className="sauce-remaining-gauge"
      role="meter"
      aria-label="ソースの残り"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={now}
      aria-valuetext={capped ? (now === 0 ? "ピザ全体の上限に達しました" : `${now}%（ピザ全体の上限あり）`) : undefined}
      data-empty={fraction === 0 ? "true" : undefined}
      data-limit={capped ? "total" : undefined}
      style={color ? ({ "--sauce-gauge-color": color } as CSSProperties) : undefined}
    >
      <div className="sauce-remaining-gauge__fill" style={{ height: `${now}%` }} />
      {capped && <div className="sauce-remaining-gauge__cap" style={{ height: `${blocked}%` }} />}
    </div>
  );
}
