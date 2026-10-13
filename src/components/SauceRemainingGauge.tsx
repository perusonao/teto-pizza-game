import { sauceRemainingFraction } from "../logic/sauceRemaining";

interface SauceRemainingGaugeProps {
  /** Sum of deposits from finished strokes (PizzaStage `committedTotalRef`). */
  committedTotal: number;
  /** Sum of the in-progress stroke's deposits (PizzaStage `pendingTotalRef`). */
  pendingTotal: number;
}

/**
 * Issue #489 stage 1: standalone, display-only vertical gauge (14x96px via CSS) for the sauce
 * left in the current application. No numeric text (a % would read as a score), never
 * interactive (`pointer-events: none`), and not wired into any screen yet.
 */
export function SauceRemainingGauge({ committedTotal, pendingTotal }: SauceRemainingGaugeProps) {
  const fraction = sauceRemainingFraction(committedTotal, pendingTotal);
  const now = Math.round(fraction * 100);
  return (
    <div
      className="sauce-remaining-gauge"
      role="meter"
      aria-label="ソースの残り"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={now}
      data-empty={fraction === 0 ? "true" : undefined}
    >
      <div className="sauce-remaining-gauge__fill" style={{ height: `${now}%` }} />
    </div>
  );
}
