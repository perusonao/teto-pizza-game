import { describe, expect, it } from "vitest";
import { allowsPieceDragInRound, type RoundKind } from "./roundKind";

describe("allowsPieceDragInRound (Issue #476 S1)", () => {
  it.each<[RoundKind, boolean]>([
    ["GUIDED", true],
    ["FREE_COOK", true], // Research is a Free Cooking round
    ["DINNER", true],
    ["LUNCH_RUSH", false],
  ])("%s -> %s", (roundKind, expected) => {
    expect(allowsPieceDragInRound({ roundKind })).toBe(expected);
  });
});
