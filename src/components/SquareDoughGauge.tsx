/**
 * Square-Pan Dough B2 (Issue #535): the smoothness gauge ("なめらか度") under the DOUGH status line of a square-pan round.
 *
 * It shows the dough's REAL evenness (what SquareDoughLayer pushes into ../logic/pan/squareDoughGaugeStore.ts -- the same number as the
 * layer's own `data-evenness`), as a bar and a one-decimal percentage, and, for a moment after each gesture, how much that gesture
 * changed it: "+0.4" when it did, "変化なし" when it did not. It never animates a number it was not given.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { squareDoughGaugeStore } from "../logic/pan/squareDoughGaugeStore";
import { smoothnessText } from "../logic/pan/squareDoughView";

/** How long the "+0.4" / "変化なし" note stays after a gesture ends. */
const CHANGE_NOTE_MS = 1600;

export function SquareDoughGauge({ fallbackEvenness }: { fallbackEvenness: number }) {
  const { evenness, change } = useSyncExternalStore(squareDoughGaugeStore.subscribe, squareDoughGaugeStore.get);
  const shown = evenness ?? fallbackEvenness;
  // The note of a gesture stays until its timer says it has been shown long enough (the timer callback, not the effect body, sets state).
  const [expiredSeq, setExpiredSeq] = useState<number | null>(null);
  useEffect(() => {
    if (!change) return;
    const id = window.setTimeout(() => setExpiredSeq(change.seq), CHANGE_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [change]);
  const note = change && expiredSeq !== change.seq ? change : null;
  const percent = Math.min(100, Math.max(0, shown * 100));
  return (
    <div className="square-dough-gauge" data-testid="square-dough-gauge" data-evenness={shown.toFixed(3)}>
      <span className="square-dough-gauge__label">なめらか度</span>
      <span className="square-dough-gauge__bar" role="img" aria-label={`なめらか度 ${smoothnessText(shown)}`}>
        <span className="square-dough-gauge__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="square-dough-gauge__value" data-testid="square-dough-gauge-value">
        {smoothnessText(shown)}
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
