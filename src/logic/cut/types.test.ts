import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { createDiameterCutLine } from "./fixtures";
import {
  DEFAULT_REQUESTED_SLICE_COUNT,
  isEdgeToEdgeCutLine,
  isNearRim,
  resolveRequestedSliceCount,
  type CutConfig,
} from "./types";

describe("resolveRequestedSliceCount", () => {
  it("defaults to 6 slices when config is undefined", () => {
    expect(resolveRequestedSliceCount(undefined)).toBe(6);
    expect(DEFAULT_REQUESTED_SLICE_COUNT).toBe(6);
  });

  it("defaults to 6 slices when config is present but requestedSliceCount is unset", () => {
    const config: CutConfig = {};
    expect(resolveRequestedSliceCount(config)).toBe(6);
  });

  it("honors an explicit 4 or 8 slice request without special-casing 6", () => {
    expect(resolveRequestedSliceCount({ requestedSliceCount: 4 })).toBe(4);
    expect(resolveRequestedSliceCount({ requestedSliceCount: 8 })).toBe(8);
  });
});

describe("valid cut line model (edge-to-edge contract)", () => {
  it("accepts a full rim-to-rim diameter chord", () => {
    const line = createDiameterCutLine(30);
    expect(isNearRim(line.start)).toBe(true);
    expect(isNearRim(line.end)).toBe(true);
    expect(isEdgeToEdgeCutLine(line)).toBe(true);
  });

  it("rejects a line whose endpoint sits inside the dough, not on the rim", () => {
    const interior = { start: { x: DOUGH_CENTER, y: DOUGH_CENTER }, end: { x: DOUGH_CENTER + 10, y: DOUGH_CENTER } };
    expect(isEdgeToEdgeCutLine(interior)).toBe(false);
  });

  it("rejects a line whose endpoint sits well outside the dough", () => {
    const outside = {
      start: { x: DOUGH_CENTER - DOUGH_RADIUS, y: DOUGH_CENTER },
      end: { x: DOUGH_CENTER + DOUGH_RADIUS + 50, y: DOUGH_CENTER },
    };
    expect(isEdgeToEdgeCutLine(outside)).toBe(false);
  });
});
