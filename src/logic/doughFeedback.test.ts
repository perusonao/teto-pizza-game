import { describe, expect, it } from "vitest";
import { DOUGH_RADIUS } from "./pizzaCoordinates";
import {
  DOUGH_COMPLETION_THRESHOLD,
  DOUGH_SHAPE_POINTS,
  DOUGH_SHAPE_TECHNICAL_MAX_RADIUS,
  createInitialDoughShape,
  isDoughShapeComplete,
  type DoughShape,
} from "./doughShape";
import { DOUGH_SIZE_STATUS_TEXT, doughSizeStatus } from "./doughFeedback";

function uniform(radius: number): DoughShape {
  return { radii: new Array(DOUGH_SHAPE_POINTS).fill(radius) };
}

describe("doughSizeStatus (Issue #474 A-0)", () => {
  it("a fresh dough is SMALL", () => {
    expect(doughSizeStatus(createInitialDoughShape())).toBe("SMALL");
  });

  it("flips from SMALL to READY exactly where the completion rule does", () => {
    const at = uniform(DOUGH_RADIUS * DOUGH_COMPLETION_THRESHOLD);
    const below = uniform(DOUGH_RADIUS * DOUGH_COMPLETION_THRESHOLD - 0.01);
    expect(doughSizeStatus(at)).toBe("READY");
    expect(doughSizeStatus(below)).toBe("SMALL");
  });

  it("stays READY up to and including the ideal size, then is LARGE past it", () => {
    expect(doughSizeStatus(uniform(DOUGH_RADIUS))).toBe("READY");
    expect(doughSizeStatus(uniform(DOUGH_RADIUS + 0.01))).toBe("LARGE");
    expect(doughSizeStatus(uniform(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS))).toBe("LARGE");
  });

  it("never disagrees with isDoughShapeComplete across the whole radius range", () => {
    for (let r = 10; r <= DOUGH_SHAPE_TECHNICAL_MAX_RADIUS; r += 0.25) {
      const shape = uniform(r);
      expect(doughSizeStatus(shape) !== "SMALL").toBe(isDoughShapeComplete(shape));
    }
  });

  it("reads the mean, so one stretched side alone does not make it READY", () => {
    const lopsided: DoughShape = { radii: [58, 58, 58, 10, 10, 10, 10, 10] };
    expect(doughSizeStatus(lopsided)).toBe("SMALL");
  });

  it("is deterministic and does not mutate its input", () => {
    const shape = uniform(30);
    const copy = JSON.stringify(shape);
    expect(doughSizeStatus(shape)).toBe(doughSizeStatus(shape));
    expect(JSON.stringify(shape)).toBe(copy);
  });

  it("copy is one plain line each: no digits, no score wording", () => {
    for (const text of Object.values(DOUGH_SIZE_STATUS_TEXT)) {
      expect(text).not.toMatch(/[0-9０-９%％]/);
      expect(text).not.toMatch(/点|スコア|Pitz|★/);
      expect(text.length).toBeLessThanOrEqual(20);
    }
  });
});
