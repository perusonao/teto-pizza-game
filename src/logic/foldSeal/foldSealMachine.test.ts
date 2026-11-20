import { describe, expect, it } from "vitest";
import { DOUGH_RADIUS } from "../pizzaCoordinates";
import { createIdealDoughShape, createInitialDoughShape } from "../doughShape";
import {
  FOLD_D_MIN,
  FOLD_LINE_Y,
  FOLD_SEAL_DEFAULT_RADIUS,
  FOLD_THETA_COMMIT,
  OPEN_RUN_MIN_BINS,
  SEAL_BINS_PER_STEP,
  SEAL_BUTTON_STEPS,
  SEAM_BAND,
  SEAM_BINS,
  circleGeometry,
  createInitialFoldSealState,
  foldAngleFromFinger,
  foldSealInvariantViolations,
  foldSealReduce,
  foldSealVisual,
  geometryFromDoughShape,
  isFoldCommitted,
  isFolded,
  sealCoverage,
  sealOpenRuns,
  stepIsComplete,
  type FoldSealEvent,
  type FoldSealState,
} from "./index";

const G = circleGeometry();
const run = (s: FoldSealState, ...events: FoldSealEvent[]) => events.reduce((acc, e) => foldSealReduce(acc, e, G), s);
const fresh = () => createInitialFoldSealState(0);
const P = 1;

/** A point on the seam at seam angle phi (0 = west end .. PI = east end), `off` units outside the edge. */
const seamPt = (phi: number, off = 0, r = DOUGH_RADIUS) => ({ x: 50 + (r + off) * Math.cos(Math.PI - phi), y: 50 + (r + off) * Math.sin(Math.PI - phi) });
const down = (type: "SEAL_DOWN" | "SEAL_MOVE", phi: number, off = 0, pointerId = P): FoldSealEvent => ({ type, pointerId, ...seamPt(phi, off) });

/** A full drag fold: grab 30 above the line, pull to well past it. */
const dragFold = (s = fresh(), pointerId = P) =>
  run(s, { type: "FOLD_DOWN", pointerId, x: 50, y: 20 }, { type: "FOLD_MOVE", pointerId, x: 50, y: 60 }, { type: "FOLD_MOVE", pointerId, x: 50, y: 78 }, { type: "FOLD_UP", pointerId });

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

describe("constants and geometry", () => {
  it("mirrors the game's ideal radius without importing it", () => expect(FOLD_SEAL_DEFAULT_RADIUS).toBe(DOUGH_RADIUS));
  it("the bin / button arithmetic is consistent", () => {
    expect(SEAL_BINS_PER_STEP * SEAL_BUTTON_STEPS).toBe(SEAM_BINS);
    expect(Number.isInteger(SEAL_BINS_PER_STEP)).toBe(true);
  });
  it("circleGeometry falls back on a bad radius", () => {
    expect(circleGeometry(-3).radiusAt(0)).toBe(DOUGH_RADIUS);
    expect(circleGeometry(NaN).radiusAt(1)).toBe(DOUGH_RADIUS);
    expect(circleGeometry(30).radiusAt(1)).toBe(30);
  });
  it("adapts the hand-stretched dough silhouette", () => {
    const small = geometryFromDoughShape(createInitialDoughShape());
    const ideal = geometryFromDoughShape(createIdealDoughShape());
    expect(small.radiusAt(1)).toBeLessThan(ideal.radiusAt(1));
    expect(ideal.radiusAt(0.7)).toBeGreaterThan(0);
  });
});

describe("foldAngleFromFinger: the grabbed edge sticks to the finger", () => {
  it("0 at the grab, PI/2 on the fold line, PI one grab-distance below it", () => {
    const d = 30;
    expect(foldAngleFromFinger(20, d)).toBeCloseTo(0, 10);
    expect(foldAngleFromFinger(FOLD_LINE_Y, d)).toBeCloseTo(Math.PI / 2, 10);
    expect(foldAngleFromFinger(80, d)).toBeCloseTo(Math.PI, 10);
  });
  it("clamps above the grab and below the full fold, and is monotonic in y", () => {
    expect(foldAngleFromFinger(-40, 30)).toBe(0);
    expect(foldAngleFromFinger(500, 30)).toBe(Math.PI);
    let prev = -1;
    for (let y = 0; y <= 100; y += 0.5) {
      const a = foldAngleFromFinger(y, 30);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });
  it.each([[NaN, 30], [Infinity, 30], [40, NaN], [40, 0], [40, -3]])("(%s, %s) -> 0", (y, d) => expect(foldAngleFromFinger(y, d)).toBe(0));
  it("isFoldCommitted is the provisional threshold, inclusive", () => {
    expect(isFoldCommitted(FOLD_THETA_COMMIT)).toBe(true);
    expect(isFoldCommitted(FOLD_THETA_COMMIT - 1e-9)).toBe(false);
    expect(isFoldCommitted(NaN)).toBe(false);
  });
});

describe("FOLD by drag", () => {
  it("grab -> follow -> commit on release -> folded, nothing sealed", () => {
    let s = run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 });
    expect(s.phase).toBe("folding");
    expect(s.grab).toEqual({ pointerId: P, startY: 20, d: 30 });
    s = run(s, { type: "FOLD_MOVE", pointerId: P, x: 50, y: 50 });
    expect(s.foldAngle).toBeCloseTo(Math.PI / 2, 10);
    expect(stepIsComplete(s)).toBe(false);
    s = run(s, { type: "FOLD_MOVE", pointerId: P, x: 50, y: 78 }, { type: "FOLD_UP", pointerId: P });
    expect(s.phase).toBe("folded");
    expect(s.foldAngle).toBe(Math.PI);
    expect(s.foldedVia).toBe("drag");
    expect(sealCoverage(s)).toBe(0);
    expect(stepIsComplete(s)).toBe(true);
    expect(foldSealInvariantViolations(s)).toEqual([]);
  });
  it("commits only on RELEASE: reaching the threshold while down does not fold", () => {
    const s = run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 }, { type: "FOLD_MOVE", pointerId: P, x: 50, y: 80 });
    expect(s.phase).toBe("folding");
    expect(isFoldCommitted(s.foldAngle)).toBe(true);
  });
  it("a release short of the threshold springs back to idle with no penalty", () => {
    const s = run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 }, { type: "FOLD_MOVE", pointerId: P, x: 50, y: 60 }, { type: "FOLD_UP", pointerId: P });
    expect(s).toEqual(fresh());
  });
  it("dragging back up un-folds (reversible) and the horizontal component is ignored", () => {
    let s = run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 }, { type: "FOLD_MOVE", pointerId: P, x: 50, y: 70 });
    const mid = s.foldAngle;
    s = run(s, { type: "FOLD_MOVE", pointerId: P, x: 5, y: 30 });
    expect(s.foldAngle).toBeLessThan(mid);
    const a = run(s, { type: "FOLD_MOVE", pointerId: P, x: 5, y: 45 });
    const b = run(s, { type: "FOLD_MOVE", pointerId: P, x: 95, y: 45 });
    expect(a.foldAngle).toBe(b.foldAngle);
    expect(run(s, { type: "FOLD_MOVE", pointerId: P, x: 50, y: -30 }).foldAngle).toBe(0);
  });
  it("rejects a grab too close to the fold line, below it, or outside the dough (state untouched)", () => {
    const s = fresh();
    for (const [x, y] of [[50, FOLD_LINE_Y - FOLD_D_MIN + 0.1], [50, 50], [50, 80], [2, 4], [50, -30], [NaN, 20], [50, NaN], [Infinity, 20]]) {
      expect(foldSealReduce(s, { type: "FOLD_DOWN", pointerId: P, x, y }, G)).toBe(s);
    }
  });
  it("accepts a grab exactly at D_MIN and inside the grab margin just outside the edge", () => {
    expect(run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: FOLD_LINE_Y - FOLD_D_MIN }).phase).toBe("folding");
    expect(run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 50 - 48 - 5 }).phase).toBe("folding");
    expect(run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 50 - 48 - 7 }).phase).toBe("idle");
  });
  it("a second finger is ignored; only the grabbing pointer moves or releases the fold", () => {
    const s = run(fresh(), { type: "FOLD_DOWN", pointerId: 1, x: 50, y: 20 });
    expect(foldSealReduce(s, { type: "FOLD_DOWN", pointerId: 2, x: 40, y: 20 }, G)).toBe(s);
    expect(foldSealReduce(s, { type: "FOLD_MOVE", pointerId: 2, x: 50, y: 70 }, G)).toBe(s);
    expect(foldSealReduce(s, { type: "FOLD_UP", pointerId: 2 }, G)).toBe(s);
  });
  it("ignores non-finite moves", () => {
    const s = run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 });
    expect(foldSealReduce(s, { type: "FOLD_MOVE", pointerId: P, x: 50, y: NaN }, G)).toBe(s);
    expect(foldSealReduce(s, { type: "FOLD_MOVE", pointerId: P, x: Infinity, y: 40 }, G)).toBe(s);
  });
  it("follows a hand-stretched silhouette: a lid grab is allowed up to its (smaller) edge + margin", () => {
    const small = geometryFromDoughShape(createInitialDoughShape());
    const edgeY = 50 - small.radiusAt(-Math.PI / 2);
    expect(foldSealReduce(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: edgeY + 1 }, small).phase).toBe("folding");
    expect(foldSealReduce(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: edgeY - 10 }, small).phase).toBe("idle");
  });
});

describe("FOLD by button converges on the same folded state", () => {
  it("equals the drag fold in everything except foldedVia", () => {
    const b = run(fresh(), { type: "FOLD_BUTTON" });
    const d = dragFold();
    expect({ ...b, foldedVia: null }).toEqual({ ...d, foldedVia: null });
    expect(b.foldedVia).toBe("button");
  });
  it("is a no-op unless idle (not during a drag, not when already folded)", () => {
    const dragging = run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 });
    expect(foldSealReduce(dragging, { type: "FOLD_BUTTON" }, G)).toBe(dragging);
    const folded = run(fresh(), { type: "FOLD_BUTTON" });
    expect(foldSealReduce(folded, { type: "FOLD_BUTTON" }, G)).toBe(folded);
  });
});

describe("SEAL by stroke", () => {
  it("only starts on the seam band of a folded pizza", () => {
    expect(foldSealReduce(fresh(), down("SEAL_DOWN", 1.5), G)).toEqual(fresh());
    const f = dragFold();
    expect(foldSealReduce(f, down("SEAL_DOWN", 1.5, SEAM_BAND + 1), G)).toBe(f);
    expect(foldSealReduce(f, down("SEAL_DOWN", 1.5, -(SEAM_BAND + 1)), G)).toBe(f);
    expect(foldSealReduce(f, { type: "SEAL_DOWN", pointerId: P, x: 50, y: 20 }, G)).toBe(f);
    expect(foldSealReduce(f, { type: "SEAL_DOWN", pointerId: P, x: NaN, y: 90 }, G)).toBe(f);
    expect(run(f, down("SEAL_DOWN", 1.5, SEAM_BAND)).phase).toBe("sealing");
    expect(run(f, down("SEAL_DOWN", 1.5, -SEAM_BAND)).phase).toBe("sealing");
  });
  it("seals the bin under the finger and numbers bins west to east", () => {
    const west = run(dragFold(), down("SEAL_DOWN", 0.01), { type: "SEAL_UP", pointerId: P });
    const east = run(dragFold(), down("SEAL_DOWN", Math.PI - 0.01), { type: "SEAL_UP", pointerId: P });
    expect(west.seal.bins[0]).toBe(1);
    expect(east.seal.bins[SEAM_BINS - 1]).toBe(1);
    expect(west.seal.bins.reduce<number>((a, b) => a + b, 0)).toBe(1);
  });
  it("a full west-to-east sweep seals everything; coverage is 1 and gaps are empty", () => {
    let s = run(dragFold(), down("SEAL_DOWN", 0.02));
    for (let phi = 0.05; phi <= Math.PI; phi += 0.05) s = run(s, down("SEAL_MOVE", Math.min(phi, Math.PI - 0.001)));
    s = run(s, { type: "SEAL_UP", pointerId: P });
    expect(s.phase).toBe("folded");
    expect(sealCoverage(s)).toBe(1);
    expect(sealOpenRuns(s)).toEqual([]);
    expect(foldSealVisual(s).gaps).toEqual([]);
  });
  it("interpolates a fast sweep between two in-band samples, in either direction", () => {
    const lr = run(dragFold(), down("SEAL_DOWN", 0.3), down("SEAL_MOVE", 1.2));
    const rl = run(dragFold(), down("SEAL_DOWN", 1.2), down("SEAL_MOVE", 0.3));
    expect(lr.seal.bins).toEqual(rl.seal.bins);
    expect(sealCoverage(lr)).toBeGreaterThan(8 / SEAM_BINS);
  });
  it("does not interpolate across a discontinuity larger than SEAL_MAX_INTERP", () => {
    const s = run(dragFold(), down("SEAL_DOWN", 0.2), down("SEAL_MOVE", 2.9));
    expect(s.seal.bins.reduce<number>((a, b) => a + b, 0)).toBe(2);
  });
  it("leaving the band breaks the stroke: crossing through the middle seals nothing, re-entering starts fresh", () => {
    let s = run(dragFold(), down("SEAL_DOWN", 0.3), { type: "SEAL_MOVE", pointerId: P, x: 50, y: 70 });
    expect(s.seal.lastAngle).toBeNull();
    const before = sealCoverage(s);
    s = run(s, down("SEAL_MOVE", 1.4));
    expect(s.seal.bins.reduce<number>((a, b) => a + b, 0)).toBe(Math.round(before * SEAM_BINS) + 1);
  });
  it("progress is KEPT on release and on cancel; the seal can be continued afterwards", () => {
    const part = run(dragFold(), down("SEAL_DOWN", 0.3), down("SEAL_MOVE", 1.0));
    const released = run(part, { type: "SEAL_UP", pointerId: P });
    const cancelled = run(part, { type: "CANCEL" });
    expect(released.phase).toBe("folded");
    expect(cancelled).toEqual(released);
    expect(sealCoverage(released)).toBeGreaterThan(0);
    const more = run(released, down("SEAL_DOWN", 2.0), down("SEAL_MOVE", 2.6));
    expect(sealCoverage(more)).toBeGreaterThan(sealCoverage(released));
  });
  it("only the stroke's pointer moves or ends it", () => {
    const s = run(dragFold(), down("SEAL_DOWN", 0.3));
    expect(foldSealReduce(s, down("SEAL_DOWN", 1, 0, 2), G)).toBe(s);
    expect(foldSealReduce(s, down("SEAL_MOVE", 1, 0, 2), G)).toBe(s);
    expect(foldSealReduce(s, { type: "SEAL_UP", pointerId: 2 }, G)).toBe(s);
  });
  it("a seal event does nothing before the fold, and a fold event does nothing after it", () => {
    const f = dragFold();
    expect(foldSealReduce(f, { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 }, G)).toBe(f);
    expect(foldSealReduce(f, { type: "FOLD_UP", pointerId: P }, G)).toBe(f);
    const dragging = run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 });
    expect(foldSealReduce(dragging, down("SEAL_DOWN", 1), G)).toBe(dragging);
  });
  it("the seam follows a hand-stretched silhouette", () => {
    const small = geometryFromDoughShape(createInitialDoughShape());
    const folded = foldSealReduce(createInitialFoldSealState(), { type: "FOLD_BUTTON" }, small);
    const r = small.radiusAt(Math.PI / 2);
    expect(r).toBeLessThan(DOUGH_RADIUS - 10);
    const onSmall = foldSealReduce(folded, { type: "SEAL_DOWN", pointerId: P, x: 50, y: 50 + r }, small);
    expect(onSmall.phase).toBe("sealing");
    expect(foldSealReduce(folded, { type: "SEAL_DOWN", pointerId: P, x: 50, y: 50 + DOUGH_RADIUS }, small)).toBe(folded);
  });
});

describe("SEAL by button converges on the same bins", () => {
  it("four presses seal the whole seam left to right, in quarters; a fifth is a no-op", () => {
    let s = run(fresh(), { type: "FOLD_BUTTON" });
    const covs: number[] = [];
    for (let i = 0; i < SEAL_BUTTON_STEPS; i += 1) {
      s = run(s, { type: "SEAL_BUTTON" });
      covs.push(sealCoverage(s));
    }
    expect(covs).toEqual([0.25, 0.5, 0.75, 1]);
    expect(s.seal.buttonStep).toBe(4);
    expect(foldSealReduce(s, { type: "SEAL_BUTTON" }, G)).toBe(s);
  });
  it("a full button seal equals a full stroke seal bin for bin", () => {
    let stroke = run(dragFold(), down("SEAL_DOWN", 0.02));
    for (let phi = 0.05; phi <= Math.PI; phi += 0.05) stroke = run(stroke, down("SEAL_MOVE", Math.min(phi, Math.PI - 0.001)));
    let button = run(fresh(), { type: "FOLD_BUTTON" });
    for (let i = 0; i < SEAL_BUTTON_STEPS; i += 1) button = run(button, { type: "SEAL_BUTTON" });
    expect(button.seal.bins).toEqual(stroke.seal.bins);
  });
  it("mixes with strokes without un-sealing anything (monotonic)", () => {
    let s = run(dragFold(), down("SEAL_DOWN", 2.5), { type: "SEAL_UP", pointerId: P });
    const before = s.seal.bins;
    s = run(s, { type: "SEAL_BUTTON" });
    for (let i = 0; i < SEAM_BINS; i += 1) if (before[i] === 1) expect(s.seal.bins[i]).toBe(1);
  });
  it("is ignored before the fold and during a stroke", () => {
    expect(foldSealReduce(fresh(), { type: "SEAL_BUTTON" }, G)).toEqual(fresh());
    const sealing = run(dragFold(), down("SEAL_DOWN", 1));
    expect(foldSealReduce(sealing, { type: "SEAL_BUTTON" }, G)).toBe(sealing);
  });
});

describe("partial sealing is visual only and never blocks the step", () => {
  it("an unsealed folded pizza is complete, and shows the whole seam as one gap", () => {
    const s = run(fresh(), { type: "FOLD_BUTTON" });
    expect(stepIsComplete(s)).toBe(true);
    expect(sealOpenRuns(s)).toEqual([{ from: 0, to: SEAM_BINS - 1 }]);
    expect(foldSealVisual(s).gaps).toEqual([{ from: 0, to: SEAM_BINS - 1 }]);
    expect(foldSealVisual(s).sealProgress).toBe(0);
  });
  it("sealOpenRuns lists every run; the visual draws only runs >= OPEN_RUN_MIN_BINS", () => {
    // seal bins 0..9, leave a 2-bin hole at 10..11, seal 12..30, leave 31..35 open.
    let s = run(fresh(), { type: "FOLD_BUTTON" }, { type: "SEAL_BUTTON" }, { type: "SEAL_BUTTON" }); // bins 0..17
    s = { ...s, seal: { ...s.seal, bins: s.seal.bins.map((_, i) => (i <= 9 || (i >= 12 && i <= 30) ? 1 : 0)) as typeof s.seal.bins } };
    expect(sealOpenRuns(s)).toEqual([{ from: 10, to: 11 }, { from: 31, to: 35 }]);
    expect(foldSealVisual(s).gaps).toEqual([{ from: 31, to: 35 }]);
    expect(OPEN_RUN_MIN_BINS).toBe(3);
  });
  it("skipping records the choice and changes nothing else; skip is idempotent", () => {
    const f = run(fresh(), { type: "FOLD_BUTTON" });
    const skipped = run(f, { type: "SEAL_SKIP" });
    expect(skipped.sealSkipped).toBe(true);
    expect(skipped.seal).toEqual(f.seal);
    expect(foldSealReduce(skipped, { type: "SEAL_SKIP" }, G)).toBe(skipped);
    expect(foldSealReduce(fresh(), { type: "SEAL_SKIP" }, G)).toEqual(fresh());
  });
  it("the visual before the fold has no gaps and no seal", () => {
    const v = foldSealVisual(fresh());
    expect(v).toEqual({ phase: "idle", foldAngle: 0, sealedBins: fresh().seal.bins, sealProgress: 0, gaps: [] });
  });
  it("the visual carries only drawing data (no score / id / flag fields)", () => {
    expect(Object.keys(foldSealVisual(dragFold())).sort()).toEqual(["foldAngle", "gaps", "phase", "sealProgress", "sealedBins"]);
  });
});

describe("retry, reopen, cancel and upstream edits", () => {
  it("SEAL_RESET clears the seam (and the skip) but stays folded; a no-op when already pristine", () => {
    const s = run(fresh(), { type: "FOLD_BUTTON" }, { type: "SEAL_BUTTON" }, { type: "SEAL_SKIP" });
    const r = run(s, { type: "SEAL_RESET" });
    expect(r.phase).toBe("folded");
    expect(sealCoverage(r)).toBe(0);
    expect(r.seal.buttonStep).toBe(0);
    expect(r.sealSkipped).toBe(false);
    expect(foldSealReduce(r, { type: "SEAL_RESET" }, G)).toBe(r);
  });
  it("REOPEN returns to a pristine idle (from folded and from an active stroke), keeping the revision", () => {
    const r = createInitialFoldSealState(7);
    const folded = foldSealReduce(r, { type: "FOLD_BUTTON" }, G);
    expect(foldSealReduce(folded, { type: "REOPEN" }, G)).toEqual(r);
    const sealing = foldSealReduce(folded, down("SEAL_DOWN", 1), G);
    expect(foldSealReduce(sealing, { type: "REOPEN" }, G)).toEqual(r);
    expect(foldSealReduce(r, { type: "REOPEN" }, G)).toBe(r);
  });
  it("CANCEL during a fold drag springs back; during a stroke keeps the seam; otherwise a no-op", () => {
    const dragging = run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 }, { type: "FOLD_MOVE", pointerId: P, x: 50, y: 70 });
    expect(foldSealReduce(dragging, { type: "CANCEL" }, G)).toEqual(fresh());
    const idle = fresh();
    expect(foldSealReduce(idle, { type: "CANCEL" }, G)).toBe(idle);
    const f = dragFold();
    expect(foldSealReduce(f, { type: "CANCEL" }, G)).toBe(f);
  });
  it("a cancelled fold can be retried straight away", () => {
    const cancelled = foldSealReduce(run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 }), { type: "CANCEL" }, G);
    expect(dragFold(cancelled).phase).toBe("folded");
  });
  it("INVALIDATE with a new revision discards fold, stroke and seam from every phase", () => {
    const states = [fresh(), run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 }), dragFold(), run(dragFold(), down("SEAL_DOWN", 1), down("SEAL_MOVE", 1.5)), run(fresh(), { type: "FOLD_BUTTON" }, { type: "SEAL_BUTTON" })];
    for (const s of states) expect(foldSealReduce(s, { type: "INVALIDATE", revision: 5 }, G)).toEqual(createInitialFoldSealState(5));
  });
  it("INVALIDATE with the same or a non-integer revision changes nothing", () => {
    const s = dragFold();
    expect(foldSealReduce(s, { type: "INVALIDATE", revision: 0 }, G)).toBe(s);
    expect(foldSealReduce(s, { type: "INVALIDATE", revision: 1.5 }, G)).toBe(s);
    expect(foldSealReduce(s, { type: "INVALIDATE", revision: NaN }, G)).toBe(s);
  });
  it("a stale pointer event after an invalidate is ignored (no resurrection)", () => {
    const dragging = run(createInitialFoldSealState(0), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 });
    const reset = foldSealReduce(dragging, { type: "INVALIDATE", revision: 1 }, G);
    expect(foldSealReduce(reset, { type: "FOLD_MOVE", pointerId: P, x: 50, y: 80 }, G)).toBe(reset);
    expect(foldSealReduce(reset, { type: "FOLD_UP", pointerId: P }, G)).toBe(reset);
  });
  it("createInitialFoldSealState sanitises a bad revision", () => {
    expect(createInitialFoldSealState(NaN).inputsRevision).toBe(0);
    expect(createInitialFoldSealState(2.5).inputsRevision).toBe(0);
    expect(createInitialFoldSealState(3).inputsRevision).toBe(3);
  });
});

describe("idempotency and purity", () => {
  const terminal: FoldSealEvent[] = [{ type: "FOLD_BUTTON" }, { type: "REOPEN" }, { type: "SEAL_SKIP" }, { type: "SEAL_RESET" }, { type: "CANCEL" }, { type: "INVALIDATE", revision: 3 }, { type: "SEAL_UP", pointerId: P }, { type: "FOLD_UP", pointerId: P }];
  it.each(terminal.map((e) => [e.type, e] as const))("applying %s twice equals applying it once (from every reachable phase)", (_n, e) => {
    const starts = [fresh(), run(fresh(), { type: "FOLD_DOWN", pointerId: P, x: 50, y: 20 }), dragFold(), run(dragFold(), down("SEAL_DOWN", 1)), run(fresh(), { type: "FOLD_BUTTON" }, { type: "SEAL_BUTTON" })];
    for (const s of starts) {
      const once = foldSealReduce(s, e, G);
      expect(foldSealReduce(once, e, G)).toEqual(once);
    }
  });
  it("never mutates its input (deep-frozen states and events do not throw)", () => {
    const s = deepFreeze(dragFold());
    const events: FoldSealEvent[] = [down("SEAL_DOWN", 1), down("SEAL_MOVE", 1.4), { type: "SEAL_BUTTON" }, { type: "SEAL_RESET" }, { type: "REOPEN" }, { type: "INVALIDATE", revision: 9 }];
    for (const e of events) expect(() => foldSealReduce(s, deepFreeze({ ...e }), G)).not.toThrow();
    expect(s).toEqual(dragFold());
  });
  it("the same event sequence always gives the same state (replay)", () => {
    const seq: FoldSealEvent[] = [{ type: "FOLD_DOWN", pointerId: P, x: 50, y: 22 }, { type: "FOLD_MOVE", pointerId: P, x: 52, y: 61 }, { type: "FOLD_MOVE", pointerId: P, x: 50, y: 80 }, { type: "FOLD_UP", pointerId: P }, down("SEAL_DOWN", 0.4), down("SEAL_MOVE", 1.3), { type: "SEAL_UP", pointerId: P }, { type: "SEAL_BUTTON" }];
    expect(run(fresh(), ...seq)).toEqual(run(fresh(), ...seq));
  });
  it("unknown events are ignored", () => {
    const s = dragFold();
    expect(foldSealReduce(s, { type: "NOPE" } as unknown as FoldSealEvent, G)).toBe(s);
  });
});

describe("invariants hold over random event sequences (deterministic fuzz)", () => {
  function lcg(seed: number) {
    let x = seed >>> 0;
    return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  }
  const weird = [NaN, Infinity, -Infinity, -1000, 1000, 0, 50, 100];
  it("2000 sequences x 60 events keep every invariant; coverage only drops on reset/reopen/invalidate", () => {
    const rnd = lcg(20261107);
    const num = () => (rnd() < 0.08 ? weird[Math.floor(rnd() * weird.length)] : rnd() * 110 - 5);
    const pid = () => (rnd() < 0.8 ? 1 : 2);
    for (let t = 0; t < 2000; t += 1) {
      let s = createInitialFoldSealState(0);
      for (let i = 0; i < 60; i += 1) {
        const r = rnd();
        let e: FoldSealEvent;
        if (r < 0.1) e = { type: "FOLD_DOWN", pointerId: pid(), x: num(), y: num() };
        else if (r < 0.22) e = { type: "FOLD_MOVE", pointerId: pid(), x: num(), y: num() };
        else if (r < 0.3) e = { type: "FOLD_UP", pointerId: pid() };
        else if (r < 0.34) e = { type: "FOLD_BUTTON" };
        else if (r < 0.37) e = { type: "REOPEN" };
        else if (r < 0.5) e = { type: "SEAL_DOWN", pointerId: pid(), ...seamPt(rnd() * Math.PI, (rnd() - 0.5) * 20) };
        else if (r < 0.7) e = { type: "SEAL_MOVE", pointerId: pid(), ...seamPt(rnd() * Math.PI, (rnd() - 0.5) * 20) };
        else if (r < 0.78) e = { type: "SEAL_UP", pointerId: pid() };
        else if (r < 0.84) e = { type: "SEAL_BUTTON" };
        else if (r < 0.87) e = { type: "SEAL_SKIP" };
        else if (r < 0.9) e = { type: "SEAL_RESET" };
        else if (r < 0.95) e = { type: "CANCEL" };
        else e = { type: "INVALIDATE", revision: Math.floor(rnd() * 3) };
        const before = s;
        s = foldSealReduce(s, e, G);
        expect(foldSealInvariantViolations(s), `${t}:${i} ${e.type}`).toEqual([]);
        const resets = e.type === "REOPEN" || e.type === "SEAL_RESET" || e.type === "INVALIDATE";
        if (!resets && isFolded(before) && isFolded(s)) expect(sealCoverage(s)).toBeGreaterThanOrEqual(sealCoverage(before));
        if (before === s) continue;
        if (stepIsComplete(s)) expect(s.foldAngle).toBe(Math.PI);
      }
    }
  });
});
