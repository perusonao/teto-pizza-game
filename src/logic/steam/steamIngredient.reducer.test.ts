import { describe, expect, it, vi } from "vitest";
import { gameReducer } from "../../state/gameReducer";
import { normalised, placeAndBake, toStep } from "./steamFixtures";

/** Cooking Steam Phase 1 (#726, S2): STEAM_INGREDIENT with the experience gate OPEN. The shipped gate (production OFF) is pinned in ./steamIngredient.flagOff.test.ts. */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../../data/steamExperienceGate", () => ({ STEAM_EXPERIENCE_PRODUCTION: false, steamExperienceEnabled: () => gate.open }));

const steam = (amount = 0.6, ingredientId = "clam") => ({ type: "STEAM_INGREDIENT" as const, ingredientId, amount });

describe("STEAM_INGREDIENT: allowed (Guided / Free Cooking, TOPPING, clam or mussel owned)", () => {
  it.each(["GUIDED", "FREE_COOK"] as const)("%s: records the amount, once", (kind) => {
    const s = toStep(kind, "TOPPING");
    expect(s.steamedLook).toBeUndefined();
    const once = gameReducer(s, steam(0.6));
    expect(once.steamedLook).toEqual({ clam: 0.6 });
    expect(gameReducer(once, steam(0.9))).toBe(once); // already steamed: same reference, the first look stays
  });

  it("clam and mussel are separate, each once", () => {
    const s = toStep("GUIDED", "TOPPING");
    const both = gameReducer(gameReducer(s, steam(0.3, "clam")), steam(0.95, "mussel"));
    expect(both.steamedLook).toEqual({ clam: 0.3, mussel: 0.95 });
    expect(gameReducer(both, steam(0.1, "mussel"))).toBe(both);
  });

  it("changes nothing but steamedLook (no stock is consumed, nothing re-scored, the other treatments' state is untouched)", () => {
    const s = toStep("GUIDED", "TOPPING");
    const { steamedLook, ...after } = gameReducer(s, steam(0.4));
    expect(steamedLook).toEqual({ clam: 0.4 });
    expect(after).toStrictEqual(s);
  });

  it("clamps the amount into 0..1", () => {
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, steam(7)).steamedLook).toEqual({ clam: 1 });
    expect(gameReducer(s, steam(-2)).steamedLook).toEqual({ clam: 0 });
    expect(gameReducer(s, steam(0)).steamedLook).toEqual({ clam: 0 }); // zero is a kept look, not "absent"
  });
});

describe("STEAM_INGREDIENT: refused with the SAME state reference", () => {
  it.each(["LUNCH_RUSH", "DINNER"] as const)("%s", (roundKind) => {
    const s = { ...toStep("GUIDED", "TOPPING"), roundKind };
    expect(gameReducer(s, steam())).toBe(s);
  });
  it.each(["DOUGH", "SAUCE"] as const)("makingStep %s", (step) => {
    const s = toStep("GUIDED", step);
    expect(gameReducer(s, steam())).toBe(s);
  });
  it("a phase other than PREPARE", () => {
    const baked = placeAndBake(toStep("GUIDED", "TOPPING"), "clam", false);
    expect(gameReducer(baked, steam())).toBe(baked);
  });
  it.each(["beef", "sausage", "shrimp", "salmon", "eggplant", "nope", "", "CLAM"])("a non-target ingredient (%j)", (id) => {
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, steam(0.5, id))).toBe(s);
  });
  it("a target the player does not own", () => {
    const s = toStep("GUIDED", "TOPPING", false);
    expect(s.ownedIngredientIds).not.toContain("clam");
    expect(gameReducer(s, steam(0.5, "clam"))).toBe(s);
    expect(gameReducer(s, steam(0.5, "mussel"))).toBe(s);
  });
  it.each([NaN, Infinity, -Infinity])("an unreadable amount (%s)", (amount) => {
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, steam(amount))).toBe(s);
  });
});

describe("STEAM_INGREDIENT: the look's life", () => {
  it("RESET_PIZZA removes the property itself (never leaves undefined behind)", () => {
    const steamed = gameReducer(toStep("GUIDED", "TOPPING"), steam(0.6));
    const reset = gameReducer(steamed, { type: "RESET_PIZZA" });
    expect("steamedLook" in reset).toBe(false);
    expect(reset.makingStep).toBe("DOUGH");
  });
  it("a steamed round keeps the look through the bake to RESULT (the placed pieces keep their look)", () => {
    const baked = placeAndBake(toStep("GUIDED", "TOPPING"), "clam", 0.6);
    expect(baked.steamedLook).toEqual({ clam: 0.6 });
  });
  it("a new round never inherits it", () => {
    const steamed = gameReducer(toStep("FREE_COOK", "TOPPING"), steam(0.6));
    const next = gameReducer(steamed, { type: "START_FREE_COOK" });
    expect(next.steamedLook).toBeUndefined();
    expect("steamedLook" in next).toBe(false);
  });
  it("steaming does not change which toppings can be placed or how they score", () => {
    const plain = placeAndBake(toStep("GUIDED", "TOPPING"), "mussel", false);
    const steamed = placeAndBake(toStep("GUIDED", "TOPPING"), "mussel", 0.8);
    expect("steamedLook" in plain).toBe(false);
    expect(normalised(steamed)).toStrictEqual(normalised(plain));
  });
});
