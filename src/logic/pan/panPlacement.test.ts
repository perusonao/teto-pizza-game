import { describe, expect, it } from "vitest";
import { findOpenSpot, MIN_TOPPING_DISTANCE, type PlacedTopping } from "../../state/pizzaState";
import { resolvePieceDrop } from "../pieceDrag";
import { ROUND_PAN_GEOMETRY, SQUARE_PAN_GEOMETRY, SQUARE_PAN_HALF_SIDE } from "./panGeometry";
import { findOpenSpotOnPan, resolveGeometryPieceDrop } from "./panPlacement";

const RECT = { left: 0, top: 0, width: 200, height: 200 }; // 1 client px = 0.5 dough-percent
const at = (x: number, y: number) => [x * 2, y * 2] as const; // dough-percent -> client px

describe("resolveGeometryPieceDrop (square)", () => {
  const drop = (x: number, y: number) => resolveGeometryPieceDrop(SQUARE_PAN_GEOMETRY, ...at(x, y), RECT);

  it("keeps a drop on the pan, including all four corners and edges", () => {
    expect(drop(50, 50)).toEqual({ x: 50, y: 50 });
    for (const [x, y] of [[6, 6], [94, 6], [6, 94], [94, 94], [6, 50], [94, 50], [50, 6], [50, 94]]) expect(drop(x, y)).toEqual({ x, y });
  });

  it("pulls a drop within the finger grace onto the edge, and the result is on the pan", () => {
    const p = drop(97, 50)!;
    expect(p).not.toBeNull();
    expect(SQUARE_PAN_GEOMETRY.contains(p.x, p.y)).toBe(true);
    expect(p.x).toBeGreaterThan(93.9);
    expect(drop(97, 97)).toBeNull(); // 3 past the corner on both axes: ~4.2 away diagonally
    const nearCorner = drop(95.5, 95.5)!;
    expect(SQUARE_PAN_GEOMETRY.contains(nearCorner.x, nearCorner.y)).toBe(true);
  });

  it("measures the grace to the nearest point of the square, also near a corner (Codex P2 on #549)", () => {
    // 3.5 past the right edge, 4 in from the bottom: radial clamp would read ~4.6 and reject it.
    expect(drop(97.5, 90)).toEqual({ x: 94, y: 90 });
    expect(drop(90, 97.5)).toEqual({ x: 90, y: 94 });
    // 2 past each of two edges: ~2.83 diagonal, within the grace; 3 past each: ~4.24, outside it.
    expect(drop(96, 96)).toEqual({ x: 94, y: 94 });
    expect(drop(97, 97)).toBeNull();
    // Side centres and corners tolerate the same distance.
    expect(drop(97.9, 50)).not.toBeNull();
    expect(drop(98.1, 50)).toBeNull();
    expect(drop(97.9, 94)).not.toBeNull();
  });

  it("a point the round dough would reject (corner area) is accepted on the square pan", () => {
    expect(resolvePieceDrop(...at(90, 90), RECT)).toBeNull();
    expect(drop(90, 90)).toEqual({ x: 90, y: 90 });
  });

  it("rejects a drop farther than the grace past an edge, non-finite input and a degenerate rect", () => {
    expect(drop(50 + SQUARE_PAN_HALF_SIDE + 5, 50)).toBeNull();
    expect(resolveGeometryPieceDrop(SQUARE_PAN_GEOMETRY, Number.NaN, 10, RECT)).toBeNull();
    expect(resolveGeometryPieceDrop(SQUARE_PAN_GEOMETRY, 10, 10, { ...RECT, width: 0 })).toBeNull();
  });
});

describe("resolveGeometryPieceDrop (round) agrees with resolvePieceDrop", () => {
  it("on a probe grid (away from the exact grace boundary)", () => {
    let checked = 0;
    for (let x = -10; x <= 110; x += 1.3) {
      for (let y = -10; y <= 110; y += 1.7) {
        const dist = Math.hypot(x - 50, y - 50);
        if (Math.abs(dist - 52) < 1e-3 || Math.abs(dist - 48) < 1e-3) continue;
        const a = resolvePieceDrop(...at(x, y), RECT);
        const b = resolveGeometryPieceDrop(ROUND_PAN_GEOMETRY, ...at(x, y), RECT);
        expect(b === null).toBe(a === null);
        if (a && b) {
          expect(b.x).toBeCloseTo(a.x, 6);
          expect(b.y).toBeCloseTo(a.y, 6);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });
});

function pieces(points: [number, number][]): PlacedTopping[] {
  return points.map(([x, y], i) => ({ id: `p${i}`, ingredientId: "x", x, y }));
}

describe("findOpenSpotOnPan", () => {
  it("returns the requested point when it is free", () => {
    expect(findOpenSpotOnPan(SQUARE_PAN_GEOMETRY, [], 20, 20, MIN_TOPPING_DISTANCE)).toEqual({ x: 20, y: 20 });
  });

  it("nudges to a spot that is on the pan and clear of every piece, also in a corner", () => {
    const existing = pieces([[10, 10]]);
    const spot = findOpenSpotOnPan(SQUARE_PAN_GEOMETRY, existing, 10, 10, MIN_TOPPING_DISTANCE)!;
    expect(spot).not.toBeNull();
    expect(SQUARE_PAN_GEOMETRY.contains(spot.x, spot.y)).toBe(true);
    expect(Math.hypot(spot.x - 10, spot.y - 10)).toBeGreaterThanOrEqual(9);
  });

  it("returns null when the pan is packed around the point", () => {
    const ring: [number, number][] = [[50, 50]];
    for (let r = 1; r <= 4; r++) for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2 + r;
      ring.push([50 + Math.cos(a) * 9 * 0.6 * r, 50 + Math.sin(a) * 9 * 0.6 * r]);
    }
    expect(findOpenSpotOnPan(SQUARE_PAN_GEOMETRY, pieces(ring), 50, 50, MIN_TOPPING_DISTANCE)).toBeNull();
  });

  it("round geometry gives exactly findOpenSpot's answer (regression guard)", () => {
    const existing = pieces([[50, 50], [58, 50], [42, 50], [50, 58], [88, 50], [12, 50], [50, 90]]);
    for (let x = 4; x <= 96; x += 4.5) {
      for (let y = 4; y <= 96; y += 4.5) {
        expect(findOpenSpotOnPan(ROUND_PAN_GEOMETRY, existing, x, y, MIN_TOPPING_DISTANCE)).toEqual(findOpenSpot(existing, x, y));
      }
    }
  });
});
