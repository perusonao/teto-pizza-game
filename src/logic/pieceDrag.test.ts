import { describe, expect, it } from "vitest";
import {
  hasPieceDragIntent,
  PIECE_DRAG_THRESHOLD_PX,
  resolvePieceDrop,
  stablePieceRotation,
} from "./pieceDrag";

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
    expect(resolvePieceDrop(316, 170, rect)).toEqual({ x: 98, y: 50 });
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
