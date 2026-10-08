import { describe, expect, it } from "vitest";
import { createIdealDoughShape } from "../doughShape";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { buildSidePolygons, computePieceLayout, placeTopping, sidesAt } from "./pieces";
import type { CutLine } from "./types";

const C = DOUGH_CENTER;
const R = DOUGH_RADIUS;
const shape = createIdealDoughShape();

function diameter(deg: number): CutLine {
  const a = (deg * Math.PI) / 180;
  const start = { x: C - Math.cos(a) * R, y: C - Math.sin(a) * R };
  const end = { x: C + Math.cos(a) * R, y: C + Math.sin(a) * R };
  return { start, end, path: [start, end] };
}
const partial: CutLine = {
  start: { x: C - R, y: C },
  end: { x: C + R, y: C },
  path: [{ x: C, y: C }, { x: C + 20, y: C }],
};

describe("computePieceLayout", () => {
  it("returns null when no cut ran through (partial strokes never separate)", () => {
    expect(computePieceLayout([], shape)).toBeNull();
    expect(computePieceLayout([partial], shape)).toBeNull();
  });

  it("one through cut makes two pieces on opposite sides, pushed in opposite directions", () => {
    const layout = computePieceLayout([diameter(0)], shape)!;
    expect(layout.cuts).toHaveLength(1);
    expect(layout.pieces).toHaveLength(2);
    const [a, b] = layout.pieces;
    expect(a.sides[0]).not.toBe(b.sides[0]);
    expect(a.outward.y * b.outward.y).toBeLessThan(0);
    expect(Math.hypot(a.outward.x, a.outward.y)).toBeCloseTo(1, 6);
  });

  it("three concurrent diameters make six slices; a partial stroke among them changes nothing", () => {
    const lines = [diameter(0), partial, diameter(60), diameter(120)];
    const layout = computePieceLayout(lines, shape)!;
    expect(layout.cuts.map((c) => c.lineIndex)).toEqual([0, 2, 3]);
    expect(layout.pieces).toHaveLength(6);
    // Each slice is pushed away from the centre, in distinct directions.
    const dirs = new Set(layout.pieces.map((p) => `${p.outward.x.toFixed(2)},${p.outward.y.toFixed(2)}`));
    expect(dirs.size).toBe(6);
  });

  it("crossing cuts that meet off-centre make four pieces", () => {
    const horizontal: CutLine = { start: { x: C - R, y: C + 10 }, end: { x: C + R, y: C + 10 }, path: [{ x: C - R, y: C + 10 }, { x: C + R, y: C + 10 }] };
    const vertical: CutLine = { start: { x: C + 12, y: C - R }, end: { x: C + 12, y: C + R }, path: [{ x: C + 12, y: C - R }, { x: C + 12, y: C + R }] };
    const layout = computePieceLayout([horizontal, vertical], shape)!;
    expect(layout.pieces).toHaveLength(4);
  });

  it("a curved through cut splits along its own path, not the straight chord", () => {
    const path = [{ x: C - R, y: C }, { x: C, y: C - 25 }, { x: C + R, y: C }];
    const curved: CutLine = { start: path[0], end: path[2], path };
    const layout = computePieceLayout([curved], shape)!;
    expect(layout.pieces).toHaveLength(2);
    // A point between the chord (y = C) and the bowed path (y = C - 25 at x = C) is on the same
    // side as the pizza's lower half, which a straight chord would have put on the upper side.
    const between = sidesAt(layout, C, C - 10)[0];
    const below = sidesAt(layout, C, C + 20)[0];
    const above = sidesAt(layout, C, C - 40)[0];
    expect(between).toBe(below);
    expect(above).not.toBe(below);
  });
});

describe("buildSidePolygons", () => {
  it("tiles the plane: every probe point is inside exactly one of the two polygons", () => {
    const path = [{ x: C - 53, y: C }, { x: C, y: C + 15 }, { x: C + 53, y: C }];
    const [a, b] = buildSidePolygons(path);
    const layout = { cuts: [{ lineIndex: 0, sideA: a, sideB: b }] };
    for (const [x, y] of [[10, 10], [90, 10], [10, 90], [90, 90], [50, 30], [50, 70], [0, 50], [100, 50]]) {
      expect(sidesAt(layout, x, y)).toHaveLength(1);
    }
    expect(sidesAt(layout, 50, 30)[0]).not.toBe(sidesAt(layout, 50, 80)[0]);
  });
});

describe("placeTopping", () => {
  it("puts a topping in its home piece and shows the sliced part in the neighbour it straddles", () => {
    const layout = computePieceLayout([diameter(0)], shape)!;
    const clear = placeTopping(layout, C, C - 25);
    expect(clear.halves).toEqual([]);
    const straddling = placeTopping(layout, C, C - 2);
    expect(straddling.halves).toHaveLength(1);
    expect(straddling.halves[0]).not.toBe(straddling.home);
  });
});

describe("traced (curved) cuts: the piece boundary is the finger's path", () => {
  const arc = (bow: number, y: number): CutLine => {
    const path = Array.from({ length: 41 }, (_, i) => {
      const t = i / 40;
      return { x: 4 + 92 * t, y: y + bow * 92 * Math.sin(Math.PI * t) };
    });
    return { start: path[0], end: path[40], path };
  };
  const sidesOf = (lines: CutLine[], p: { x: number; y: number }, cut = 0) => {
    const layout = computePieceLayout(lines, shape)!;
    return sidesAt(layout, p.x, p.y)[cut];
  };

  it("points just either side of the traced arc fall in different pieces, along its whole length", () => {
    for (const bow of [0.06, 0.1, 0.14]) {
      const line = arc(bow, 60);
      for (const p of line.path!.filter((q) => Math.hypot(q.x - C, q.y - C) < 40)) {
        expect(sidesOf([line], { x: p.x, y: p.y - 1.5 })).not.toBe(sidesOf([line], { x: p.x, y: p.y + 1.5 }));
      }
    }
  });

  it("the first cut's boundary does not move when a 2nd and 3rd cut are added", () => {
    const first = arc(0.1, 60);
    const second = { ...diameter(90) };
    const third = arc(-0.07, 38);
    const one = computePieceLayout([first], shape)!;
    const three = computePieceLayout([first, second, third], shape)!;
    expect(three.cuts[0].sideA).toEqual(one.cuts[0].sideA);
    expect(three.cuts[0].sideB).toEqual(one.cuts[0].sideB);
  });
});
