import { describe, expect, it } from "vitest";
import {
  hasPieceDragIntent,
  PIECE_DRAG_THRESHOLD_PX,
  PIECE_DROP_EDGE_GRACE,
  resolvePieceDrop,
  stablePieceRotation,
} from "./pieceDrag";
import { clampToDough, DOUGH_CENTER, DOUGH_RADIUS, isInsideDough } from "./pizzaCoordinates";
import { createInitialGameState, gameReducer } from "../state/gameReducer";

const rect = { left: 10, top: 20, width: 300, height: 300 } as DOMRect;

describe("piece drag intent", () => {
  it("keeps a short movement as the existing tap fallback", () => {
    expect(hasPieceDragIntent(10, 10, 10 + PIECE_DRAG_THRESHOLD_PX - 1, 10, "touch")).toBe(false);
  });

  it("accepts an upward touch drag but leaves horizontal tray movement to scrolling", () => {
    expect(hasPieceDragIntent(50, 100, 54, 90, "touch")).toBe(true);
    expect(hasPieceDragIntent(50, 100, 70, 96, "touch")).toBe(false);
  });

  it("allows deliberate mouse movement in any direction", () => {
    expect(hasPieceDragIntent(50, 50, 58, 50, "mouse")).toBe(true);
  });
});

describe("resolvePieceDrop", () => {
  it("converts client coordinates to dough percent", () => {
    expect(resolvePieceDrop(160, 170, rect)).toEqual({ x: 50, y: 50 });
  });

  it("accepts the rim and clamps the four-unit edge grace", () => {
    expect(resolvePieceDrop(304, 170, rect)).toEqual({ x: 98, y: 50 });
    // Independent Review Final P2 (PR #26): clampToDough now lands a hair inside DOUGH_RADIUS
    // (CLAMP_INSET_EPSILON, pizzaCoordinates.ts) so the reducer's own isInsideDough boundary
    // always accepts it -- toBeCloseTo tolerates that imperceptible (1e-9) inward shift.
    const clamped = resolvePieceDrop(316, 170, rect);
    expect(clamped?.x).toBeCloseTo(98, 6);
    expect(clamped?.y).toBe(50);
  });

  it("rejects a clear miss, invalid coordinate, and zero-sized target", () => {
    expect(resolvePieceDrop(320, 170, rect)).toBeNull();
    expect(resolvePieceDrop(Number.NaN, 170, rect)).toBeNull();
    expect(resolvePieceDrop(160, 170, { ...rect, width: 0 })).toBeNull();
  });
});

describe("stablePieceRotation", () => {
  it("is deterministic, bounded, and changes with canonical position", () => {
    const first = stablePieceRotation("basil", 31, 62);
    expect(stablePieceRotation("basil", 31, 62)).toBe(first);
    expect(Math.abs(first)).toBeLessThanOrEqual(14);
    expect(stablePieceRotation("basil", 32, 62)).not.toBe(first);
  });
});

/**
 * Independent Review Final P2 (PR #26, discussion_r4017391946): `clampToDough` scaling a
 * grace-annulus point by `DOUGH_RADIUS / distance` can round to a hair over `DOUGH_RADIUS` at
 * many non-axis angles once `Math.hypot` is recomputed on the result -- `resolvePieceDrop`
 * showed the drop as a valid preview, but the reducer's own `isInsideDough` (`<= DOUGH_RADIUS`)
 * boundary then rejected the identical `PLACE_TOPPING`. Fixed by clamping a hair inside
 * `DOUGH_RADIUS` (`CLAMP_INSET_EPSILON`, pizzaCoordinates.ts) instead of exactly onto it.
 */
function pointAtPolar(distance: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return {
    x: DOUGH_CENTER + distance * Math.cos(rad),
    y: DOUGH_CENTER + distance * Math.sin(rad),
  };
}

describe("clampToDough / isInsideDough boundary consistency (Independent Review Final P2)", () => {
  it("invariant: every point clampToDough returns satisfies isInsideDough, for any angle/distance", () => {
    for (let deg = 0; deg < 360; deg += 1) {
      for (const distance of [48.001, 48.5, 49, 50, 51, 52, 60, 100]) {
        const { x, y } = pointAtPolar(distance, deg);
        const clamped = clampToDough(x, y);
        expect(isInsideDough(clamped.x, clamped.y)).toBe(true);
        expect(Number.isFinite(clamped.x)).toBe(true);
        expect(Number.isFinite(clamped.y)).toBe(true);
      }
    }
  });

  it("+X axis grace drop clamps to a point isInsideDough accepts", () => {
    const { x, y } = pointAtPolar(51, 0);
    const clamped = clampToDough(x, y);
    expect(isInsideDough(clamped.x, clamped.y)).toBe(true);
  });

  it("+Y axis grace drop clamps to a point isInsideDough accepts", () => {
    const { x, y } = pointAtPolar(50, 90);
    const clamped = clampToDough(x, y);
    expect(isInsideDough(clamped.x, clamped.y)).toBe(true);
  });

  it("45-degree grace drop clamps to a point isInsideDough accepts", () => {
    const { x, y } = pointAtPolar(49.5, 45);
    const clamped = clampToDough(x, y);
    expect(isInsideDough(clamped.x, clamped.y)).toBe(true);
  });

  it("30-degree grace drop clamps to a point isInsideDough accepts", () => {
    const { x, y } = pointAtPolar(51.5, 30);
    const clamped = clampToDough(x, y);
    expect(isInsideDough(clamped.x, clamped.y)).toBe(true);
  });

  it("a non-axis angle reproducing the reported ~2.8e-14 pre-fix overflow stays inside", () => {
    // 22.31 degrees at distance 52 is the worst-observed pre-fix overflow found while
    // reproducing this finding (clampToDough returned a point ~2.8e-14 outside DOUGH_RADIUS) --
    // pinned directly here so a regression in CLAMP_INSET_EPSILON is caught even if the fuzz
    // sweep above is ever narrowed.
    const { x, y } = pointAtPolar(52, 22.31);
    const clamped = clampToDough(x, y);
    expect(isInsideDough(clamped.x, clamped.y)).toBe(true);
    expect(Math.hypot(clamped.x - DOUGH_CENTER, clamped.y - DOUGH_CENTER)).toBeLessThanOrEqual(
      DOUGH_RADIUS,
    );
  });

  it("multiple grace-annulus distances at a fixed non-axis angle all clamp inside", () => {
    for (const distance of [48.001, 48.5, 49, 49.9, 50, 51, 52]) {
      const { x, y } = pointAtPolar(distance, 30);
      const clamped = clampToDough(x, y);
      expect(isInsideDough(clamped.x, clamped.y)).toBe(true);
    }
  });

  it("the inward safety shift is far below anything visible (well under one dough-percent point)", () => {
    const { x, y } = pointAtPolar(52, 22.31);
    const clamped = clampToDough(x, y);
    const clampedDistance = Math.hypot(clamped.x - DOUGH_CENTER, clamped.y - DOUGH_CENTER);
    expect(DOUGH_RADIUS - clampedDistance).toBeGreaterThanOrEqual(0);
    expect(DOUGH_RADIUS - clampedDistance).toBeLessThan(1e-6);
  });

  it("a drop past the edge-grace boundary remains rejected by resolvePieceDrop", () => {
    const distance = DOUGH_RADIUS + PIECE_DROP_EDGE_GRACE + 0.5;
    const { x, y } = pointAtPolar(distance, 22.31);
    const clientX = rect.left + (x / 100) * rect.width;
    const clientY = rect.top + (y / 100) * rect.height;
    expect(resolvePieceDrop(clientX, clientY, rect)).toBeNull();
  });

  it("an ordinary inside-dough drop (no clamping) is unaffected by the safety margin", () => {
    const { x, y } = pointAtPolar(30, 22.31);
    const clientX = rect.left + (x / 100) * rect.width;
    const clientY = rect.top + (y / 100) * rect.height;
    const resolved = resolvePieceDrop(clientX, clientY, rect);
    expect(resolved?.x).toBeCloseTo(x, 9);
    expect(resolved?.y).toBeCloseTo(y, 9);
  });
});

describe("PLACE_TOPPING accepts every grace-annulus drop resolvePieceDrop resolves (Independent Review Final P2)", () => {
  // Issue #32 Phase 2: mozzarella (cheese) and basil (topping) each now require the making
  // flow to have reached their own step -- `atStep` advances via CONFIRM_MAKING_STEP (never by
  // constructing `makingStep` by hand) to the step the ingredient under test actually needs.
  function freshPrepareState(atStep: "CHEESE" | "TOPPING") {
    let state = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
    while (state.makingStep !== atStep) {
      state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    }
    return state;
  }

  it.each([
    ["Mozzarella", "mozzarella", "CHEESE"] as const,
    ["Basil", "basil", "TOPPING"] as const,
  ])(
    "%s: the exact reported overflow angle (52 units @ 22.31°) always places, never silently rejected",
    (_label, ingredientId, atStep) => {
      const { x, y } = pointAtPolar(52, 22.31);
      const clamped = clampToDough(x, y);
      let state = freshPrepareState(atStep);
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId, x: clamped.x, y: clamped.y });
      expect(state.pizza.toppings).toHaveLength(1);
      expect(state.placement?.status).not.toBe("rejected");
    },
  );

  it("Mozzarella and Basil both place successfully across a spread of grace distances/angles", () => {
    let state = freshPrepareState("CHEESE");
    const mozzarellaCases: Array<{ distance: number; angle: number }> = [
      { distance: 48.5, angle: 0 },
      { distance: 49, angle: 90 },
      { distance: 52, angle: 22.31 },
    ];
    const basilCases: Array<{ distance: number; angle: number }> = [
      { distance: 50, angle: 45 },
      { distance: 51, angle: 30 },
    ];
    let placedCount = 0;
    for (const { distance, angle } of mozzarellaCases) {
      const { x, y } = pointAtPolar(distance, angle);
      const clamped = clampToDough(x, y);
      state = gameReducer(state, {
        type: "PLACE_TOPPING",
        ingredientId: "mozzarella",
        x: clamped.x,
        y: clamped.y,
      });
      placedCount += 1;
      expect(state.pizza.toppings).toHaveLength(placedCount);
    }
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
    for (const { distance, angle } of basilCases) {
      const { x, y } = pointAtPolar(distance, angle);
      const clamped = clampToDough(x, y);
      state = gameReducer(state, {
        type: "PLACE_TOPPING",
        ingredientId: "basil",
        x: clamped.x,
        y: clamped.y,
      });
      placedCount += 1;
      expect(state.pizza.toppings).toHaveLength(placedCount);
    }
  });
});
