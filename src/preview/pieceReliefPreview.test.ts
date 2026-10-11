import { describe, expect, it } from "vitest";
import { pieceReliefFilterCss } from "../components/pieceRelief";
import { PIECE_RELIEF_PARAM, pieceReliefBadgeLabel, resolvePieceReliefOff } from "./pieceReliefPreview";

describe("#467 Preview-only ?pieceRelief=off", () => {
  it("the query name is what the Owner types", () => {
    expect(PIECE_RELIEF_PARAM).toBe("pieceRelief");
  });

  it("is on only for exactly one pieceRelief=off", () => {
    expect(resolvePieceReliefOff("?pieceRelief=off")).toBe(true);
    expect(resolvePieceReliefOff("?cutAreaPct=0.2&pieceRelief=off")).toBe(true);
    for (const search of ["", "?", "?pieceRelief=on", "?pieceRelief=", "?pieceRelief=OFF", "?pieceRelief=off&pieceRelief=off", "?other=off", undefined, null, 3]) {
      expect(resolvePieceReliefOff(search)).toBe(false);
    }
  });

  it("badge label only while off", () => {
    expect(pieceReliefBadgeLabel(true)).toBe("RELIEF OFF");
    expect(pieceReliefBadgeLabel(false)).toBeNull();
  });

  it("drops only the SVG lighting reference and keeps the drop shadow", () => {
    const on = pieceReliefFilterCss("f1", 1);
    const off = pieceReliefFilterCss("f1", 1, false);
    expect(on).toBe(pieceReliefFilterCss("f1", 1, true)); // default unchanged
    expect(on.startsWith("url(#f1) drop-shadow(")).toBe(true);
    expect(off).not.toContain("url(");
    expect(off).toBe(on.replace("url(#f1) ", ""));
  });
});
