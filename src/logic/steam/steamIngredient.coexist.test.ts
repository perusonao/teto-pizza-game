import { describe, expect, it, vi } from "vitest";
import { gameReducer } from "../../state/gameReducer";
import { toStep } from "./steamFixtures";

/**
 * Cooking Steam Phase 1 (#726, S2): the steam next to the other two treatments. The steam gate is opened by a mock; the sear runs on its REAL gate (ON in
 * production since #727); the 炒める prep stays OFF (its real gate). The three keep separate keys, separate guards and separate targets.
 */
vi.mock("../../data/steamExperienceGate", () => ({ STEAM_EXPERIENCE_PRODUCTION: false, steamExperienceEnabled: () => true }));

const steam = (ingredientId = "clam", amount = 0.6) => ({ type: "STEAM_INGREDIENT" as const, ingredientId, amount });
const sear = (ingredientId = "sausage", amount = 0.4) => ({ type: "SEAR_INGREDIENT" as const, ingredientId, amount });
const prep = (ingredientId = "beef") => ({ type: "PREP_INGREDIENT" as const, ingredientId });

describe("steam + sear in one round", () => {
  it.each(["GUIDED", "FREE_COOK"] as const)("%s: both looks are kept, independently, in either order", (kind) => {
    const s = toStep(kind, "TOPPING");
    const a = gameReducer(gameReducer(s, sear()), steam());
    const b = gameReducer(gameReducer(s, steam()), sear());
    for (const both of [a, b]) {
      expect(both.searedLook).toEqual({ sausage: 0.4 });
      expect(both.steamedLook).toEqual({ clam: 0.6 });
    }
  });
  it("a refusal of one never touches the other's state", () => {
    const s = gameReducer(gameReducer(toStep("GUIDED", "TOPPING"), sear()), steam());
    expect(gameReducer(s, sear("sausage", 0.9))).toBe(s); // already seared
    expect(gameReducer(s, steam("clam", 0.9))).toBe(s); // already steamed
    expect(gameReducer(s, sear("clam"))).toBe(s); // clam is not the sear's
    expect(gameReducer(s, steam("sausage"))).toBe(s); // sausage is not the steam's
  });
  it("the targets are disjoint: each treatment refuses the other's ingredient on a fresh round", () => {
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, steam("sausage"))).toBe(s);
    expect(gameReducer(s, steam("beef"))).toBe(s);
    expect(gameReducer(s, sear("clam"))).toBe(s);
    expect(gameReducer(s, sear("mussel"))).toBe(s);
  });
  it("RESET_PIZZA removes all of them together", () => {
    const s = gameReducer(gameReducer(toStep("GUIDED", "TOPPING"), sear()), steam());
    const reset = gameReducer(s, { type: "RESET_PIZZA" });
    expect("searedLook" in reset).toBe(false);
    expect("steamedLook" in reset).toBe(false);
    expect("preparedLook" in reset).toBe(false);
  });
});

describe("steam + the 炒める prep", () => {
  it("the prep is OFF in production, so the steam works with it off and never switches it on", () => {
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, prep())).toBe(s);
    const steamed = gameReducer(s, steam());
    expect(steamed.steamedLook).toEqual({ clam: 0.6 });
    expect(steamed.preparedIngredientIds).toBeUndefined();
    expect(steamed.preparedLook).toBeUndefined();
    expect(gameReducer(steamed, prep())).toBe(steamed);
  });
});
