import { afterEach, describe, expect, it } from "vitest";
import { setSquareStretchForTest, type SquareOkRate } from "../../preview/squareModelPreview";
import { createInitialSquareDough, type SquareDough } from "./squareDough";
import { stretchAlong, stretchProgress } from "./squareStretch";
import { STRETCH_OPENINGS, nextEvenOp, nextSpreadStroke } from "./squareStretchPlayer";

/**
 * A small SIMULATION of the push-stretch prototype with a "smart player" (greedy: each operation is the candidate that raises the OK rate
 * most), to give the Owner's 75 % vs 85 % decision real operation counts and to pin the working target "STEP 2 in about 5-15 operations".
 * It is a model of a careful player, not a human: on a phone the numbers are measured by the Owner's iPhone HV.
 */
const at = (x: number, y: number) => ({ x, y });

/** STEP 1: the opening strokes, then the player's strokes into the bare patches until STEP 1 is done. */
function spread(opening: readonly (readonly [number, number, number, number])[]): { dough: SquareDough; ops: number } {
  let d = createInitialSquareDough();
  let ops = 0;
  for (const [x1, y1, x2, y2] of opening) {
    d = stretchAlong(d, at(x1, y1), at(x2, y2));
    ops++;
  }
  for (let guard = 0; guard < 40; guard++) {
    const stroke = nextSpreadStroke(d);
    if (!stroke) break;
    d = stretchAlong(d, stroke.from, stroke.to);
    ops++;
  }
  return { dough: d, ops };
}

/** STEP 2: the greedy smart player. */
function even(start: SquareDough, limit = 40): { ops: number; complete: boolean; okRate: number } {
  let b = start;
  let ops = 0;
  while (!stretchProgress(b).complete && ops < limit) {
    const next = nextEvenOp(b);
    if (!next) break;
    b = next.result;
    ops++;
  }
  const end = stretchProgress(b);
  return { ops, complete: end.complete, okRate: end.stretch.okRate };
}

function playRound(opening: string, ok: SquareOkRate) {
  setSquareStretchForTest({ stretch: true, ok });
  const { dough, ops: spreadOps } = spread(STRETCH_OPENINGS[opening]);
  const p1 = stretchProgress(dough);
  return { spreadOps, step1Done: p1.step1Done, okAtStep1: p1.stretch.okRate, ...even(dough) };
}

describe("push-stretch prototype: simulated play (smart player), 75 % vs 85 %", () => {
  afterEach(() => setSquareStretchForTest(null));

  it("STEP 1 never leaves STEP 2 already done, and at 75 % STEP 2 takes a handful of operations (working target 5-15; the centre-to-corner opening needs 17 in this model)", () => {
    for (const opening of Object.keys(STRETCH_OPENINGS)) {
      const r = playRound(opening, 75);
      expect(r.step1Done, opening).toBe(true);
      expect(r.okAtStep1, `${opening}: the OK rate when STEP 1 ends`).toBeLessThan(0.75);
      expect(r.complete, opening).toBe(true);
      expect(r.ops, `${opening}: operations in STEP 2`).toBeGreaterThanOrEqual(3);
      expect(r.ops, `${opening}: operations in STEP 2`).toBeLessThanOrEqual(20);
    }
  });

  it("85 % asks for clearly more work than 75 % (and may be out of reach for this player): the numbers behind the Owner's decision", () => {
    for (const opening of Object.keys(STRETCH_OPENINGS)) {
      const at75 = playRound(opening, 75);
      const at85 = playRound(opening, 85);
      expect(at85.ops, opening).toBeGreaterThan(at75.ops);
      expect(at85.okRate, opening).toBeGreaterThanOrEqual(0.8); // gets close even when it cannot finish
    }
  });
});
