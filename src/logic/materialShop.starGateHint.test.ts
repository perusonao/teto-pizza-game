import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { nextMaterialHint, nextStarGateHint } from "./materialShop";

/** Batch 6 PR-3 (OD-B6-PR3-3/4): the aggregated "⭐あと○個" number, production ladder. */
const hint = (count: number, stars: number, unlocked: readonly string[] = []) =>
  nextStarGateHint(count, stars, unlocked, DISCOVERY_LADDER);

describe("nextStarGateHint", () => {
  it("is null before the gated step is reached, whatever the stars", () => {
    expect(hint(49, 0)).toBeNull();
    expect(hint(49, 119)).toBeNull();
  });
  it("step 50 reached: 119 stars -> 1 short; 120 -> null once the stars meet the gate", () => {
    expect(hint(50, 119)).toEqual({ starsNeeded: 1 });
    expect(hint(50, 0)).toEqual({ starsNeeded: 120 });
    expect(hint(50, 120)).toBeNull();
  });
  it("step 51 reached: only the smallest shortfall is reported (129 -> 1; goat-cheese already met)", () => {
    expect(hint(51, 129)).toEqual({ starsNeeded: 1 });
    expect(hint(51, 100)).toEqual({ starsNeeded: 20 }); // goat-cheese (20) beats spinach (30)
    expect(hint(51, 130)).toBeNull();
  });
  it("an already entitled material is not counted", () => {
    expect(hint(50, 10, ["goat-cheese"])).toBeNull();
    expect(hint(51, 125, ["goat-cheese"])).toEqual({ starsNeeded: 5 });
  });
  it("corrupt star totals can only keep the hint showing the full gap", () => {
    expect(hint(50, Number.NaN)).toEqual({ starsNeeded: 120 });
    expect(hint(50, -5)).toEqual({ starsNeeded: 120 });
  });
  it("exposes a number only", () => {
    expect(Object.keys(hint(50, 0)!)).toEqual(["starsNeeded"]);
  });
  it("Step not reached keeps the existing discovery-count hint", () => {
    expect(nextMaterialHint(48, [])).toEqual({ discoveriesNeeded: 1, step: 49 });
  });
});
