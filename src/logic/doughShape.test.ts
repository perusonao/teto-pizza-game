import { describe, expect, it } from "vitest";
import { DOUGH_RADIUS } from "./pizzaCoordinates";
import {
  DOUGH_COMPLETION_THRESHOLD,
  DOUGH_SHAPE_MIN_RADIUS,
  DOUGH_SHAPE_POINTS,
  DOUGH_SHAPE_TECHNICAL_MAX_RADIUS,
  DOUGH_TINY_GESTURE_EPSILON,
  INITIAL_DOUGH_RADIUS,
  applyStretchPoint,
  createInitialDoughShape,
  doughShapeRadiusAtAngle,
  doughSizeProgress,
  isDoughShapeComplete,
  isInsideDoughShape,
  isValidDoughShape,
  smoothDoughShapeForDisplay,
  type DoughShape,
} from "./doughShape";

/** Point on the dough's own coordinate circle at `angleIndex * (360/DOUGH_SHAPE_POINTS)`
 *  degrees, `distance` out from DOUGH_CENTER -- mirrors `applyStretchPoint`'s own angle
 *  convention exactly (index 0 = angle 0 = dough-local "east"). */
function pointAt(angleIndex: number, distance: number): [number, number] {
  const angle = (angleIndex / DOUGH_SHAPE_POINTS) * Math.PI * 2;
  return [50 + Math.cos(angle) * distance, 50 + Math.sin(angle) * distance];
}

function uniformShape(radius: number): DoughShape {
  return { radii: new Array(DOUGH_SHAPE_POINTS).fill(radius) };
}

describe("createInitialDoughShape", () => {
  it("starts as a small, uniform circle (all N radii equal)", () => {
    const shape = createInitialDoughShape();
    expect(shape.radii).toHaveLength(DOUGH_SHAPE_POINTS);
    expect(shape.radii.every((r) => r === INITIAL_DOUGH_RADIUS)).toBe(true);
    expect(INITIAL_DOUGH_RADIUS).toBeLessThan(DOUGH_RADIUS);
  });

  it("is a valid shape", () => {
    expect(isValidDoughShape(createInitialDoughShape())).toBe(true);
  });
});

describe("applyStretchPoint -- outward stretch (Issue #33 D2 Human Feel Fix math, unchanged by D3A)", () => {
  it("a pull at a control point's own angle changes that point most, its neighbors somewhat, and leaves the opposite side untouched", () => {
    const shape = createInitialDoughShape();
    const [x, y] = pointAt(0, 40);
    const next = applyStretchPoint(shape, x, y);

    // Exact values for this fixture (distance=40 at index 0's own angle) -- identical to the
    // pre-D3A pinned values, since a pure expansion from a smaller current radius exercises
    // the exact same lerp/spike-clamp arithmetic the old monotonic-only code did (Fresh Audit
    // §3: the old floor was only ever a no-op in the growth direction).
    expect(next.radii[0]).toBeCloseTo(30.24, 4); // primary, spike-clamped (see below)
    expect(next.radii[1]).toBeCloseTo(28.032, 4); // immediate neighbor (weight 0.45)
    expect(next.radii[7]).toBeCloseTo(28.032, 4); // circular immediate neighbor
    expect(next.radii[2]).toBeCloseTo(20.8512, 4); // next ring out (weight 0.12)
    expect(next.radii[6]).toBeCloseTo(20.8512, 4);
    // Opposite side and its near neighbors (circular distance >= 3) are untouched.
    expect(next.radii[3]).toBe(INITIAL_DOUGH_RADIUS);
    expect(next.radii[4]).toBe(INITIAL_DOUGH_RADIUS);
    expect(next.radii[5]).toBe(INITIAL_DOUGH_RADIUS);

    // Ordering: primary > immediate neighbor > next ring > untouched.
    expect(next.radii[0]).toBeGreaterThan(next.radii[1]);
    expect(next.radii[1]).toBeGreaterThan(next.radii[2]);
    expect(next.radii[2]).toBeGreaterThan(next.radii[3]);
  });

  it("circular neighbor wrapping works at the 0/7 boundary the same way as any other pair", () => {
    const shape = createInitialDoughShape();
    // Touch near index 7's own angle -- index 0 (wrapping past the array end) must react
    // exactly like index 6 (the non-wrapping neighbor) does.
    const [x, y] = pointAt(7, 40);
    const next = applyStretchPoint(shape, x, y);
    expect(next.radii[0]).toBeCloseTo(next.radii[6], 6);
    expect(next.radii[0]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
  });

  it("a pull exactly between two control points affects a wider, smoothly-tapered spread (not just the old two bracketing points)", () => {
    const shape = createInitialDoughShape();
    const step = (Math.PI * 2) / DOUGH_SHAPE_POINTS;
    const midAngle = step / 2; // exactly between control point 0 and 1
    const distance = 30;
    const x = 50 + Math.cos(midAngle) * distance;
    const y = 50 + Math.sin(midAngle) * distance;
    const next = applyStretchPoint(shape, x, y);

    expect(next.radii[0]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    expect(next.radii[1]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    // Exactly halfway between 0 and 1: both are equally close, so they move equally.
    expect(next.radii[0]).toBeCloseTo(next.radii[1], 5);
    // Points one ring further out (2 and 7) also pick up some propagated stretch.
    expect(next.radii[2]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    expect(next.radii[7]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    expect(next.radii[2]).toBeCloseTo(next.radii[7], 5);
    expect(next.radii[2]).toBeLessThan(next.radii[0]);
    // Still nothing reaches all the way to the far side.
    expect(next.radii[4]).toBe(INITIAL_DOUGH_RADIUS);
  });

  it("spike suppression: a single full-reach pull no longer jumps one point straight to the technical max while its neighbor stays untouched", () => {
    const shape = createInitialDoughShape();
    const [x, y] = pointAt(0, DOUGH_RADIUS);
    const next = applyStretchPoint(shape, x, y);

    expect(next.radii[0]).toBeLessThan(DOUGH_RADIUS);
    const gapToNeighbor = next.radii[0] - next.radii[1];
    const d1BaselineGap = DOUGH_RADIUS - INITIAL_DOUGH_RADIUS;
    expect(gapToNeighbor).toBeLessThan(d1BaselineGap * 0.5);
  });

  it("repeated pulls at the exact same spot cannot create a pathological spike worse than the D1/D2 single-pull baseline", () => {
    let shape = createInitialDoughShape();
    const [x, y] = pointAt(0, DOUGH_RADIUS);
    for (let i = 0; i < 30; i += 1) {
      shape = applyStretchPoint(shape, x, y);
    }
    let maxAdjacentGap = 0;
    for (let i = 0; i < DOUGH_SHAPE_POINTS; i += 1) {
      const next = (i + 1) % DOUGH_SHAPE_POINTS;
      maxAdjacentGap = Math.max(maxAdjacentGap, Math.abs(shape.radii[i] - shape.radii[next]));
    }
    const d1BaselineGap = DOUGH_RADIUS - INITIAL_DOUGH_RADIUS;
    expect(maxAdjacentGap).toBeLessThan(d1BaselineGap);
  });

  it("asymmetry remains fully achievable: pulling only one side leaves the opposite side visibly smaller", () => {
    let shape = createInitialDoughShape();
    const [x, y] = pointAt(0, DOUGH_RADIUS);
    for (let i = 0; i < 5; i += 1) {
      shape = applyStretchPoint(shape, x, y);
    }
    // The untouched far side (circular distance >= 3 from index 0) never moves at all --
    // asymmetry is not smoothed away by the propagation/clamp.
    expect(shape.radii[3]).toBe(INITIAL_DOUGH_RADIUS);
    expect(shape.radii[4]).toBe(INITIAL_DOUGH_RADIUS);
    expect(shape.radii[5]).toBe(INITIAL_DOUGH_RADIUS);
    expect(shape.radii[0]).toBeGreaterThan(shape.radii[4] * 1.3);
  });

  it("a few (4-6) natural outward gestures spread around the circle reach the 0.75 completion threshold", () => {
    for (const gestureCount of [4, 5, 6]) {
      let shape = createInitialDoughShape();
      for (let g = 0; g < gestureCount; g += 1) {
        const [x, y] = pointAt((g / gestureCount) * DOUGH_SHAPE_POINTS, DOUGH_RADIUS);
        shape = applyStretchPoint(shape, x, y);
      }
      expect(doughSizeProgress(shape)).toBeGreaterThanOrEqual(0.75);
    }
  });

  it("clamps a touch far beyond the dough to DOUGH_SHAPE_TECHNICAL_MAX_RADIUS, not DOUGH_RADIUS (Issue #33 D3A free boundary)", () => {
    const shape = createInitialDoughShape();
    const next = applyStretchPoint(shape, 50 + 1000, 50);
    expect(next.radii[0]).toBeLessThanOrEqual(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS);
    // A single call is still spike-clamped relative to its neighbors (see the spike-suppression
    // test above) -- reaching all the way past the ideal size in one call requires the touched
    // point's own neighborhood to already be large, which the dedicated "repeated outward pulls
    // ... exceed DOUGH_RADIUS" test below covers. This test only pins the distance clamp itself.
  });

  it("a pull exactly at dough center is a no-op (distance 0, no defined angle)", () => {
    const shape = createInitialDoughShape();
    const next = applyStretchPoint(shape, 50, 50);
    expect(next).toBe(shape);
  });

  it("never mutates the input shape", () => {
    const shape = createInitialDoughShape();
    const before = [...shape.radii];
    applyStretchPoint(shape, 50 + 40, 50);
    expect(shape.radii).toEqual(before);
  });
});

describe("applyStretchPoint -- reversible shrink (Issue #33 D3A)", () => {
  it("a pull toward center shrinks the touched region instead of being a no-op", () => {
    const shape = uniformShape(40);
    const [x, y] = pointAt(0, 15);
    const next = applyStretchPoint(shape, x, y);

    // Pinned: primary point's blend-toward-15 would be 15, but the symmetric spike clamp
    // (neighborAverage(40) - 12 = 28) floors this call's own reach -- "no abrupt jump," now
    // in the shrink direction too.
    expect(next.radii[0]).toBeCloseTo(28, 4);
    expect(next.radii[1]).toBeCloseTo(28.75, 4);
    expect(next.radii[7]).toBeCloseTo(28.75, 4);
    expect(next.radii[2]).toBeCloseTo(37, 4);
    expect(next.radii[6]).toBeCloseTo(37, 4);
    // Untouched far side is unchanged.
    expect(next.radii[3]).toBe(40);
    expect(next.radii[4]).toBe(40);
    expect(next.radii[5]).toBe(40);
    // Ordering: primary shrinks most, then immediate neighbor, then next ring.
    expect(next.radii[0]).toBeLessThan(next.radii[1]);
    expect(next.radii[1]).toBeLessThan(next.radii[2]);
    expect(next.radii[2]).toBeLessThan(next.radii[3]);
  });

  it("stretch too far, then shrink back -- the core D3A recovery loop", () => {
    let shape = createInitialDoughShape();
    // Stretch one direction well past the initial radius.
    for (let i = 0; i < 4; i += 1) {
      shape = applyStretchPoint(shape, ...pointAt(0, DOUGH_RADIUS));
    }
    const stretched = shape.radii[0];
    expect(stretched).toBeGreaterThan(INITIAL_DOUGH_RADIUS);

    // Now correct it: drag the same region back toward the center.
    for (let i = 0; i < 4; i += 1) {
      shape = applyStretchPoint(shape, ...pointAt(0, 12));
    }
    expect(shape.radii[0]).toBeLessThan(stretched);
    // The player's shape is not force-reset to a perfect circle -- only the corrected
    // direction moved; a never-touched far side is unaffected the whole time.
    expect(shape.radii[4]).toBe(INITIAL_DOUGH_RADIUS);
  });

  it("shrinking one region never moves an untouched region elsewhere, even after that region was itself asymmetrically stretched earlier (Fresh Audit §5 regression)", () => {
    let shape = createInitialDoughShape();
    // Stretch index 0 repeatedly, creating an asymmetric gap between it and its neighbors.
    for (let i = 0; i < 3; i += 1) {
      shape = applyStretchPoint(shape, ...pointAt(0, DOUGH_RADIUS));
    }
    const farSideBefore = shape.radii[4];
    // A completely unrelated shrink on the opposite side must not retroactively reclamp the
    // already-established asymmetric region near index 0.
    const index0Before = shape.radii[0];
    const index1Before = shape.radii[1];
    shape = applyStretchPoint(shape, ...pointAt(4, 12));
    expect(shape.radii[0]).toBe(index0Before);
    expect(shape.radii[1]).toBe(index1Before);
    expect(shape.radii[4]).toBeLessThanOrEqual(farSideBefore);
  });

  it("minimum clamp: repeated shrink pulls at the same spot never go below DOUGH_SHAPE_MIN_RADIUS", () => {
    let shape = uniformShape(40);
    for (let i = 0; i < 40; i += 1) {
      shape = applyStretchPoint(shape, ...pointAt(0, 0.01));
    }
    expect(shape.radii[0]).toBeGreaterThanOrEqual(DOUGH_SHAPE_MIN_RADIUS);
    expect(shape.radii[0]).toBeCloseTo(DOUGH_SHAPE_MIN_RADIUS, 1);
  });

  it("isValidDoughShape still accepts a shape at exactly the minimum radius", () => {
    expect(isValidDoughShape(uniformShape(DOUGH_SHAPE_MIN_RADIUS))).toBe(true);
  });
});

describe("applyStretchPoint -- technical maximum vs. ideal/reference boundary (Issue #33 D3A free boundary)", () => {
  it("repeated outward pulls at the same spot can exceed DOUGH_RADIUS (the ideal size) and eventually reach DOUGH_SHAPE_TECHNICAL_MAX_RADIUS", () => {
    let shape = createInitialDoughShape();
    for (let i = 0; i < 40; i += 1) {
      shape = applyStretchPoint(shape, ...pointAt(0, DOUGH_SHAPE_TECHNICAL_MAX_RADIUS + 50));
    }
    expect(shape.radii[0]).toBeGreaterThan(DOUGH_RADIUS);
    expect(shape.radii[0]).toBeCloseTo(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS, 1);
  });

  it("exceeding the ideal size is not hard-stopped mid-gesture: the operation keeps working past DOUGH_RADIUS", () => {
    // A single pull whose target already sits between the ideal size and the technical max
    // must still visibly move the touched point further, not silently clamp back to ideal.
    const shape = uniformShape(DOUGH_RADIUS); // already at the ideal size everywhere
    const next = applyStretchPoint(shape, ...pointAt(0, DOUGH_SHAPE_TECHNICAL_MAX_RADIUS));
    expect(next.radii[0]).toBeGreaterThan(DOUGH_RADIUS);
  });

  it("mean size progress can exceed 100% once the shape is pulled past the ideal boundary, and stays there (not clamped back)", () => {
    let shape = createInitialDoughShape();
    for (let i = 0; i < 8; i += 1) {
      for (let g = 0; g < 10; g += 1) {
        shape = applyStretchPoint(shape, ...pointAt(i, DOUGH_SHAPE_TECHNICAL_MAX_RADIUS));
      }
    }
    expect(doughSizeProgress(shape)).toBeGreaterThan(1);
    expect(isDoughShapeComplete(shape)).toBe(true);
  });

  it("isValidDoughShape accepts a shape whose radii exceed the ideal DOUGH_RADIUS but stay within the technical max", () => {
    expect(isValidDoughShape(uniformShape((DOUGH_RADIUS + DOUGH_SHAPE_TECHNICAL_MAX_RADIUS) / 2))).toBe(true);
  });

  it("isValidDoughShape rejects a radius above DOUGH_SHAPE_TECHNICAL_MAX_RADIUS", () => {
    expect(isValidDoughShape(uniformShape(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS + 1))).toBe(false);
  });

  it("isValidDoughShape rejects a radius below DOUGH_SHAPE_MIN_RADIUS", () => {
    expect(isValidDoughShape(uniformShape(DOUGH_SHAPE_MIN_RADIUS - 1))).toBe(false);
  });
});

describe("applyStretchPoint -- accidental tiny gesture is ignored (Issue #33 D3A)", () => {
  it("a touch whose implied target is already within DOUGH_TINY_GESTURE_EPSILON of the current radius is a complete no-op", () => {
    const shape = uniformShape(30);
    const next = applyStretchPoint(shape, ...pointAt(0, 30 + DOUGH_TINY_GESTURE_EPSILON / 2));
    expect(next).toBe(shape);
  });

  it("a touch just past the epsilon threshold does register a (small) change", () => {
    const shape = uniformShape(30);
    const next = applyStretchPoint(shape, ...pointAt(0, 30 + DOUGH_TINY_GESTURE_EPSILON * 2));
    expect(next).not.toBe(shape);
    expect(next.radii[0]).toBeGreaterThan(30);
  });

  it("a deliberate tap far from the current radius still registers instantly and meaningfully (D1/D2 behavior preserved)", () => {
    const shape = createInitialDoughShape();
    const next = applyStretchPoint(shape, ...pointAt(0, DOUGH_RADIUS));
    expect(next.radii[0]).toBeGreaterThan(shape.radii[0] + 5);
  });
});

describe("doughSizeProgress / isDoughShapeComplete", () => {
  it("progress is mean(radii) / DOUGH_RADIUS at known fixture values", () => {
    expect(doughSizeProgress(uniformShape(DOUGH_RADIUS))).toBeCloseTo(1, 5);
    expect(doughSizeProgress(uniformShape(DOUGH_RADIUS / 2))).toBeCloseTo(0.5, 5);
    expect(doughSizeProgress(uniformShape(0))).toBe(0);
  });

  it("completion is false below the threshold", () => {
    const shape = uniformShape(DOUGH_RADIUS * (DOUGH_COMPLETION_THRESHOLD - 0.1));
    expect(isDoughShapeComplete(shape)).toBe(false);
  });

  it("completion is true at/above the threshold", () => {
    const atThreshold = uniformShape(DOUGH_RADIUS * DOUGH_COMPLETION_THRESHOLD);
    expect(isDoughShapeComplete(atThreshold)).toBe(true);
    const above = uniformShape(DOUGH_RADIUS);
    expect(isDoughShapeComplete(above)).toBe(true);
  });

  it("evaluates size only -- an uneven-but-large-mean shape still completes", () => {
    // No roundness/evenness/symmetry gate: a lopsided shape whose mean already clears the
    // threshold must complete exactly the same as a perfectly even one.
    const radii = new Array(DOUGH_SHAPE_POINTS).fill(DOUGH_RADIUS);
    radii[0] = 0; // one wildly short point
    const meanRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
    const shape: DoughShape = { radii };
    expect(isDoughShapeComplete(shape)).toBe(meanRadius / DOUGH_RADIUS >= DOUGH_COMPLETION_THRESHOLD);
  });

  it("the completion threshold is unchanged at 0.75 and remains reachable under the D3A bidirectional math", () => {
    expect(DOUGH_COMPLETION_THRESHOLD).toBe(0.75);
    let shape = createInitialDoughShape();
    for (let i = 0; i < 8; i += 1) {
      shape = applyStretchPoint(shape, ...pointAt(i, DOUGH_RADIUS));
    }
    expect(doughSizeProgress(shape)).toBeGreaterThanOrEqual(0.75);
  });

  it("completion can be lost again by shrinking back below the threshold, then re-reached (reversibility affects the live CTA gate too)", () => {
    let shape = createInitialDoughShape();
    for (let i = 0; i < 8; i += 1) {
      shape = applyStretchPoint(shape, ...pointAt(i, DOUGH_RADIUS));
    }
    expect(isDoughShapeComplete(shape)).toBe(true);

    for (let round = 0; round < 6; round += 1) {
      for (let i = 0; i < 8; i += 1) {
        shape = applyStretchPoint(shape, ...pointAt(i, DOUGH_SHAPE_MIN_RADIUS));
      }
    }
    expect(isDoughShapeComplete(shape)).toBe(false);

    for (let round = 0; round < 8; round += 1) {
      for (let i = 0; i < 8; i += 1) {
        shape = applyStretchPoint(shape, ...pointAt(i, DOUGH_RADIUS));
      }
    }
    expect(isDoughShapeComplete(shape)).toBe(true);
  });
});

describe("isValidDoughShape", () => {
  it("rejects wrong length", () => {
    expect(isValidDoughShape({ radii: [1, 2, 3] })).toBe(false);
  });

  it("rejects non-finite radii", () => {
    const radii = new Array(DOUGH_SHAPE_POINTS).fill(INITIAL_DOUGH_RADIUS);
    expect(isValidDoughShape({ radii: [...radii.slice(1), NaN] })).toBe(false);
  });

  it("accepts a valid shape", () => {
    expect(isValidDoughShape(createInitialDoughShape())).toBe(true);
  });
});

describe("smoothDoughShapeForDisplay", () => {
  it("produces a closed SVG path starting and ending consistently", () => {
    const d = smoothDoughShapeForDisplay(createInitialDoughShape());
    expect(d.startsWith("M ")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("produces a path for an asymmetric shape without throwing", () => {
    const shape = applyStretchPoint(createInitialDoughShape(), 50 + 45, 50);
    expect(() => smoothDoughShapeForDisplay(shape)).not.toThrow();
  });

  it("produces a path for a shape shrunk below the initial radius without throwing", () => {
    const shape = applyStretchPoint(uniformShape(30), ...pointAt(0, DOUGH_SHAPE_MIN_RADIUS));
    expect(() => smoothDoughShapeForDisplay(shape)).not.toThrow();
  });
});

/** Sauce Free Boundary: D3A's dough is no longer a fixed circle -- these pin the boundary
 *  test the sauce render path (../sauceField.ts's isCellInsideDoughShape/
 *  insideDoughShapeFraction) uses instead of the old fixed DOUGH_RADIUS circle. */
describe("doughShapeRadiusAtAngle / isInsideDoughShape", () => {
  it("matches every control point's own radius exactly at its own angle, for a uniform shape", () => {
    const shape = uniformShape(40);
    for (let i = 0; i < DOUGH_SHAPE_POINTS; i += 1) {
      const angle = (i / DOUGH_SHAPE_POINTS) * Math.PI * 2;
      expect(doughShapeRadiusAtAngle(shape, angle)).toBeCloseTo(40, 10);
    }
  });

  it("linearly interpolates between two bracketing control points for an asymmetric shape", () => {
    const shape: DoughShape = { radii: uniformShape(40).radii.slice() };
    shape.radii[0] = 20; // angle 0
    shape.radii[1] = 40; // angle 2*PI/8 (index 1)
    const step = (Math.PI * 2) / DOUGH_SHAPE_POINTS;
    const halfway = doughShapeRadiusAtAngle(shape, step / 2);
    expect(halfway).toBeCloseTo(30, 10); // midpoint of 20 and 40
  });

  it("a uniform shape's isInsideDoughShape agrees with a plain circle test at every angle", () => {
    const shape = uniformShape(40);
    const [insideX, insideY] = pointAt(3, 39);
    const [outsideX, outsideY] = pointAt(3, 41);
    expect(isInsideDoughShape(shape, insideX, insideY)).toBe(true);
    expect(isInsideDoughShape(shape, outsideX, outsideY)).toBe(false);
  });

  it("respects an asymmetric D3A shape: inside on the stretched side, outside on the shrunk side", () => {
    // A directly-constructed shape (not built via applyStretchPoint's own gesture-shaping
    // rules, e.g. spike suppression, which are unrelated to this boundary-math test): angle
    // index 0 stretched out past the *old* fixed DOUGH_RADIUS (48); index 4 (opposite side)
    // shrunk down near the minimum.
    const shape: DoughShape = { radii: uniformShape(30).radii.slice() };
    shape.radii[0] = 55;
    shape.radii[4] = DOUGH_SHAPE_MIN_RADIUS;

    // A point at distance 52 along the stretched direction -- past the *old* fixed circle
    // (48) but this shape itself now legitimately reaches out to 55 there.
    const [stretchedX, stretchedY] = pointAt(0, 52);
    expect(isInsideDoughShape(shape, stretchedX, stretchedY)).toBe(true);

    // A point at distance 20 along the shrunk direction -- well inside the old fixed circle,
    // but now outside this player's own much smaller dough there.
    const [shrunkX, shrunkY] = pointAt(4, 20);
    expect(isInsideDoughShape(shape, shrunkX, shrunkY)).toBe(false);
  });

  it("the exact center is always inside, for any shape (including a shrunk-to-minimum one)", () => {
    const shape = uniformShape(DOUGH_SHAPE_MIN_RADIUS);
    expect(isInsideDoughShape(shape, 50, 50)).toBe(true);
  });

  it("technical-max-radius shape reaches out to DOUGH_SHAPE_TECHNICAL_MAX_RADIUS, not DOUGH_RADIUS", () => {
    const shape = uniformShape(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS);
    const [justInsideX, justInsideY] = pointAt(2, DOUGH_SHAPE_TECHNICAL_MAX_RADIUS - 1);
    expect(isInsideDoughShape(shape, justInsideX, justInsideY)).toBe(true);
    expect(DOUGH_RADIUS).toBeLessThan(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS);
  });
});
