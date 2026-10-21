import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setSquareStretchForTest } from "../../preview/squareModelPreview";
import { createInitialSquareDough, SQUARE_DOUGH_GRID, SQUARE_COVER_MIN_THICKNESS, isSquareCellOnPan, squareCellCenterPercent, squareCellIndex, type SquareDough } from "./squareDough";
import { dragAlong } from "./squareDoughDrag";
import { squareDoughProgress } from "./squareDoughProgress";
import { holdStep } from "./squareDoughSpread";
import { STRETCH_SOLID_THICKNESS, stretchAlong, stretchBody, stretchCornerReach, stretchProgress, stretchThinHints } from "./squareStretch";

const at = (x: number, y: number) => ({ x, y });
const mass = (d: SquareDough) => d.thickness.reduce((s, v) => s + v, 0);
const G = SQUARE_DOUGH_GRID;

const ON_PAN: { index: number; row: number; col: number; x: number; y: number }[] = [];
for (let row = 0; row < G; row++) for (let col = 0; col < G; col++) if (isSquareCellOnPan(row, col)) ON_PAN.push({ index: squareCellIndex(row, col), row, col, x: squareCellCenterPercent(col), y: squareCellCenterPercent(row) });

/** Connected components (8-neighbourhood) of the cells at or above `min`. */
function components(d: SquareDough, min: number): number {
  const seen = new Set<number>();
  let n = 0;
  for (const cell of ON_PAN) {
    if (seen.has(cell.index) || d.thickness[cell.index] < min) continue;
    n++;
    const stack = [cell];
    seen.add(cell.index);
    while (stack.length > 0) {
      const k = stack.pop()!;
      for (const o of ON_PAN) {
        if (seen.has(o.index) || d.thickness[o.index] < min) continue;
        if (Math.abs(o.row - k.row) <= 1 && Math.abs(o.col - k.col) <= 1) {
          seen.add(o.index);
          stack.push(o);
        }
      }
    }
  }
  return n;
}

const STRATEGIES: Record<string, [number, number, number, number][]> = {
  "centre -> four corners": [[50, 50, 11, 11], [50, 50, 89, 11], [50, 50, 89, 89], [50, 50, 11, 89]],
  "full zigzag": [14, 26, 38, 50, 62, 74, 86].map((y, k) => (k % 2 ? [86, y, 14, y] : [14, y, 86, y])) as [number, number, number, number][],
  "diagonal X": [[11, 11, 89, 89], [89, 11, 11, 89]],
  "cross + ring": [[50, 12, 50, 88], [12, 50, 88, 50], [12, 12, 88, 12], [88, 12, 88, 88], [88, 88, 12, 88], [12, 88, 12, 12]],
};

function play(strategy: [number, number, number, number][]): SquareDough {
  let d = createInitialSquareDough();
  for (const [x1, y1, x2, y2] of strategy) d = stretchAlong(d, at(x1, y1), at(x2, y2));
  return d;
}

describe("push-stretch prototype: the dough model", () => {
  it("conserves the total thickness exactly like the current drag (nothing created, nothing lost)", () => {
    const start = createInitialSquareDough();
    for (const strategy of Object.values(STRATEGIES)) {
      const end = play(strategy);
      expect(mass(end)).toBeCloseTo(mass(start), 9);
    }
  });

  it("never creates dough from nothing: a stroke that starts farther than the brush from any dough changes nothing", () => {
    const start = createInitialSquareDough();
    const far = stretchAlong(start, at(14, 14), at(20, 20)); // the ball's edge is far outside this brush
    expect(far).toBe(start);
    // The current model DOES lay a film there (the behaviour the Owner ruled out): the contrast the prototype exists for.
    expect(dragAlong(start, at(14, 14), at(20, 20))).not.toBe(start);
  });

  it("grabbing the EDGE of the dough and pulling is allowed, and what it lays is connected to the dough", () => {
    const start = createInitialSquareDough();
    const grab = stretchAlong(start, at(66, 50), at(86, 50)); // starts just outside the ball's edge, inside the brush
    expect(grab).not.toBe(start);
    expect(components(grab, SQUARE_COVER_MIN_THICKNESS)).toBe(1);
  });

  it("keeps one connected piece of dough through every strategy (no detached films)", () => {
    for (const [name, strategy] of Object.entries(STRATEGIES)) {
      expect(components(play(strategy), SQUARE_COVER_MIN_THICKNESS), name).toBe(1);
    }
  });

  it("reflects the finger's direction: the dough follows the finger (a pull outward reaches farther than a stroke back toward the lump)", () => {
    const start = createInitialSquareDough();
    const out = stretchAlong(start, at(50, 50), at(88, 12));
    const back = stretchAlong(start, at(88, 12), at(50, 50));
    const covered = (d: SquareDough) => d.thickness.filter((v) => v >= SQUARE_COVER_MIN_THICKNESS).length;
    expect(covered(out)).toBeGreaterThan(covered(back));
  });

  it("the film thins with the distance from the lump (the corner is thinner than the shoulder)", () => {
    const d = stretchAlong(createInitialSquareDough(), at(50, 50), at(11, 11));
    const shoulder = d.thickness[squareCellIndex(4, 4)];
    const corner = d.thickness[squareCellIndex(1, 1)];
    expect(corner).toBeGreaterThan(0);
    expect(corner).toBeLessThan(shoulder);
  });

  it("returns the input itself for non-finite points and zero-length strokes", () => {
    const d = createInitialSquareDough();
    expect(stretchAlong(d, at(NaN, 1), at(2, 3))).toBe(d);
    expect(stretchAlong(d, at(50, 50), at(50, 50))).toBe(d);
  });
});

describe("push-stretch prototype: what counts as dough", () => {
  it("a paper-thin tendril to a corner reaches nothing (the body needs SOLID thickness)", () => {
    const d = createInitialSquareDough();
    const t = d.thickness.slice();
    for (let i = 8; i >= 1; i--) t[squareCellIndex(i, i)] = STRETCH_SOLID_THICKNESS * 0.6; // a thin film, still "covered" by the current model
    const thin: SquareDough = { thickness: t };
    expect(stretchCornerReach(thin)[0]).toBeLessThan(0.85);
    expect(stretchBody(thin).has(squareCellIndex(2, 2))).toBe(false);
  });

  it("a detached solid patch is not the body", () => {
    const t = new Array<number>(G * G).fill(0);
    t[squareCellIndex(8, 8)] = 1;
    t[squareCellIndex(1, 1)] = 0.5; // thinner than the thickest cell, not connected to it
    const body = stretchBody({ thickness: t });
    expect(body.has(squareCellIndex(8, 8))).toBe(true);
    expect(body.has(squareCellIndex(1, 1))).toBe(false);
  });
});

describe("push-stretch prototype: STEP 1 and STEP 2 are different jobs", () => {
  beforeEach(() => setSquareStretchForTest({ stretch: true, ok: 75 }));
  afterEach(() => setSquareStretchForTest(null));

  it("reaching STEP 2 does not finish STEP 2 (the current model finishes it on arrival)", () => {
    for (const [name, strategy] of Object.entries(STRATEGIES)) {
      let d = play(strategy);
      for (let i = 0; i < 40 && !stretchProgress(d).step1Done; i++) {
        const body = stretchBody(d);
        const bare = ON_PAN.filter((c) => !body.has(c.index));
        if (bare.length === 0) break;
        const target = bare[Math.floor(bare.length / 2)];
        const from = ON_PAN.filter((c) => body.has(c.index)).reduce((best, c) => (Math.hypot(c.x - target.x, c.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y) ? c : best));
        const next = stretchAlong(d, at(from.x, from.y), at(target.x, target.y));
        if (next === d) break;
        d = next;
      }
      const p = stretchProgress(d);
      expect(p.step1Done, name).toBe(true);
      expect(p.complete, name).toBe(false);
      expect(p.stretch.okRate, name).toBeLessThan(0.75);
      expect(p.stretch.thick + p.stretch.thin, name).toBeGreaterThan(0);
    }
  });

  it("classifies every on-pan cell as thin / ok / thick against what the dough can give (mass / cells)", () => {
    const p = stretchProgress(play(STRATEGIES["centre -> four corners"]));
    expect(p.stretch.thin + p.stretch.ok + p.stretch.thick).toBe(ON_PAN.length);
    expect(p.stretch.target).toBeCloseTo(32 / ON_PAN.length, 6);
    expect(p.evenness).toBeCloseTo(p.stretch.okRate, 12);
  });

  it("STEP 2's OK-rate goal follows the Owner's 75 / 85 switch", () => {
    setSquareStretchForTest({ stretch: true, ok: 85 });
    expect(stretchProgress(createInitialSquareDough()).stretch.okGoal).toBe(0.85);
    setSquareStretchForTest({ stretch: true, ok: 75 });
    expect(stretchProgress(createInitialSquareDough()).stretch.okGoal).toBe(0.75);
  });

  it("squareDoughProgress dispatches to the prototype only while the flag is on", () => {
    const d = play(STRATEGIES["centre -> four corners"]);
    expect(squareDoughProgress(d).stretch).toBeDefined();
    setSquareStretchForTest(null);
    expect(squareDoughProgress(d).stretch).toBeUndefined();
  });

  it("pressing (the unchanged tap / hold) flattens the lump and raises the OK rate without touching the mass", () => {
    const d = play(STRATEGIES["centre -> four corners"]);
    const pressed = holdStep(d, at(50, 50), 700, 600);
    expect(mass(pressed)).toBeCloseTo(mass(d), 9);
    expect(stretchProgress(pressed).stretch.okRate).toBeGreaterThan(stretchProgress(d).stretch.okRate);
  });

  it("offers an arrow for a thin patch, from a thicker cell", () => {
    const d = play(STRATEGIES["centre -> four corners"]);
    const p = stretchProgress(d);
    const hints = stretchThinHints(d, p.stretch);
    expect(hints.length).toBeGreaterThan(0);
    for (const h of hints) expect(Math.hypot(h.to.x - h.from.x, h.to.y - h.from.y)).toBeGreaterThanOrEqual(10);
  });
});

describe("push-stretch prototype: the current model is unchanged while the flag is off", () => {
  it("the current drag still lays a film from nothing and the current progress has no stretch detail", () => {
    setSquareStretchForTest(null);
    const d = dragAlong(createInitialSquareDough(), at(14, 14), at(20, 20));
    expect(squareDoughProgress(d).stretch).toBeUndefined();
    expect(d).not.toBe(createInitialSquareDough());
  });
});
