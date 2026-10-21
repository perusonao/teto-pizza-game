/**
 * A "smart player" for the push-stretch prototype (marker: square-stretch-preview-v1): plans the next operation from the dough alone.
 * Used by the simulation test (squareStretch.sim.test.ts) and by the E2E / video capture, which load it in the page; the app never imports it,
 * so it is not in any bundle. It is a model of a careful player, not a human.
 */
import type { DoughPoint } from "../pizzaCoordinates";
import { SQUARE_DOUGH_GRID as G, isSquareCellOnPan, squareCellCenterPercent, squareCellIndex, type SquareDough } from "./squareDough";
import { holdStep } from "./squareDoughSpread";
import { stretchAlong, stretchBody, stretchProgress, stretchThinHints } from "./squareStretch";

interface C { i: number; r: number; c: number; x: number; y: number }
const CELLS: C[] = [];
for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) if (isSquareCellOnPan(r, c)) CELLS.push({ i: squareCellIndex(r, c), r, c, x: squareCellCenterPercent(c), y: squareCellCenterPercent(r) });

export type StretchOp = { readonly kind: "hold"; readonly at: DoughPoint } | { readonly kind: "drag"; readonly from: DoughPoint; readonly to: DoughPoint };

/** The model's result of an operation (a hold of ~0.7 s, or the drag). */
export function applyStretchOp(dough: SquareDough, op: StretchOp): SquareDough {
  return op.kind === "hold" ? holdStep(dough, op.at, 700, 600) : stretchAlong(dough, op.from, op.to);
}

/** Opening strokes by player style (dough-percent): from the centre to the corners, a full zigzag, the diagonals, a cross + ring. */
export const STRETCH_OPENINGS: Record<string, readonly (readonly [number, number, number, number])[]> = {
  A: [[50, 50, 11, 11], [50, 50, 89, 11], [50, 50, 89, 89], [50, 50, 11, 89]],
  B: [14, 26, 38, 50, 62, 74, 86].map((y, k) => (k % 2 ? [86, y, 14, y] : [14, y, 86, y]) as [number, number, number, number]),
  C: [[11, 11, 89, 89], [89, 11, 11, 89]],
  D: [[50, 12, 50, 88], [12, 50, 88, 50], [12, 12, 88, 12], [88, 12, 88, 88], [88, 88, 12, 88], [12, 88, 12, 12]],
};

function patches(inSet: (c: C) => boolean): C[][] {
  const seen = new Set<number>();
  const out: C[][] = [];
  for (const c of CELLS) {
    if (seen.has(c.i) || !inSet(c)) continue;
    const patch = [c];
    seen.add(c.i);
    const stack = [c];
    while (stack.length > 0) {
      const k = stack.pop() as C;
      for (const n of CELLS) {
        if (seen.has(n.i) || !inSet(n) || Math.abs(n.r - k.r) > 1 || Math.abs(n.c - k.c) > 1) continue;
        seen.add(n.i);
        patch.push(n);
        stack.push(n);
      }
    }
    out.push(patch);
  }
  return out.sort((a, b) => b.length - a.length);
}
const centroid = (p: C[]) => ({ x: p.reduce((s, c) => s + c.x, 0) / p.length, y: p.reduce((s, c) => s + c.y, 0) / p.length });
const nearest = (cells: C[], p: DoughPoint) => cells.reduce((best, c) => (Math.hypot(c.x - p.x, c.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? c : best));

/** STEP 1: the next stroke from the body's edge into the biggest bare patch (null when STEP 1 is done or nothing would change). */
export function nextSpreadStroke(dough: SquareDough): { from: DoughPoint; to: DoughPoint } | null {
  if (stretchProgress(dough).step1Done) return null;
  const body = stretchBody(dough);
  const bare = patches((c) => !body.has(c.i));
  if (bare.length === 0) return null;
  const target = nearest(bare[0], centroid(bare[0]));
  const from = nearest(CELLS.filter((c) => body.has(c.i)), target);
  const stroke = { from: { x: from.x, y: from.y }, to: { x: target.x, y: target.y } };
  return stretchAlong(dough, stroke.from, stroke.to) === dough ? null : stroke;
}

/** STEP 2: the operation that raises the OK rate most (null when none does). */
export function nextEvenOp(dough: SquareDough): { op: StretchOp; result: SquareDough } | null {
  const pr = stretchProgress(dough);
  const cls = pr.stretch.classes;
  const thick = patches((c) => cls[c.i] === "thick");
  const thin = patches((c) => cls[c.i] === "thin");
  const ops: StretchOp[] = [];
  for (const p of thick.slice(0, 3)) ops.push({ kind: "hold", at: centroid(p) });
  for (const p of thin.slice(0, 4)) ops.push({ kind: "hold", at: centroid(p) });
  for (const h of stretchThinHints(dough, pr.stretch, 3)) ops.push({ kind: "drag", from: h.from, to: h.to });
  for (const p of thin.slice(0, 3)) {
    const m = centroid(p);
    const src = nearest(CELLS.filter((c) => cls[c.i] !== "thin" && Math.hypot(c.x - m.x, c.y - m.y) > 6), m);
    ops.push({ kind: "drag", from: { x: src.x, y: src.y }, to: m }, { kind: "drag", from: { x: src.x, y: src.y }, to: { x: m.x + (m.x - src.x) * 0.6, y: m.y + (m.y - src.y) * 0.6 } });
  }
  let best: { op: StretchOp; result: SquareDough } | null = null;
  let bestRate = pr.stretch.okRate;
  for (const op of ops) {
    const result = applyStretchOp(dough, op);
    const rate = stretchProgress(result).stretch.okRate;
    if (rate > bestRate + 1e-9) {
      bestRate = rate;
      best = { op, result };
    }
  }
  return best;
}
