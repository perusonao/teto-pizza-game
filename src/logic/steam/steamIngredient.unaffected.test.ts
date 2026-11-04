import { describe, expect, it, vi } from "vitest";
import { buildPendingRound, canonicalJson } from "../../state/pendingRound";
import { gameReducer } from "../../state/gameReducer";
import { normalised, placeAndBake, toStep } from "./steamFixtures";

/**
 * Cooking Steam Phase 1 (#726, S2): steaming is display-only. A steamed round scores, consumes, completes and journals exactly like the plain round; the look is in no
 * saved or scored structure. (The steam gate is opened by a mock; the shipped OFF state is pinned in ./steamIngredient.flagOff.test.ts.)
 */
vi.mock("../../data/steamExperienceGate", () => ({ STEAM_EXPERIENCE_PRODUCTION: false, steamExperienceEnabled: () => true }));

describe("a steamed round is the plain round in everything that counts", () => {
  it.each([
    ["GUIDED", "clam"],
    ["GUIDED", "mussel"],
    ["FREE_COOK", "clam"],
    ["FREE_COOK", "mussel"],
  ] as const)("%s / %s: score, stars, completion, stock, Dex, hint and the pizza are identical", (kind, id) => {
    const plain = placeAndBake(toStep(kind, "TOPPING"), id, false);
    const steamed = placeAndBake(toStep(kind, "TOPPING"), id, 0.9);
    expect("steamedLook" in plain).toBe(false);
    expect(steamed.steamedLook).toEqual({ [id]: 0.9 });
    expect(normalised(steamed)).toStrictEqual(normalised(plain));
    expect(steamed.inventory).toEqual(plain.inventory);
    expect(steamed.score).toEqual(plain.score);
  });

  it("every steam amount (closed .. over) leaves the same result", () => {
    const plain = normalised(placeAndBake(toStep("GUIDED", "TOPPING"), "clam", false));
    for (const amount of [0, 0.29, 0.3, 0.5, 0.78, 0.95, 1]) {
      expect(normalised(placeAndBake(toStep("GUIDED", "TOPPING"), "clam", amount)), String(amount)).toStrictEqual(plain);
    }
  });

  it("steaming does not use stock by itself (consumption stays the bake's, once)", () => {
    const s = toStep("GUIDED", "TOPPING");
    const steamed = gameReducer(s, { type: "STEAM_INGREDIENT", ingredientId: "clam", amount: 0.5 });
    expect(steamed.inventory).toEqual(s.inventory);
  });
});

describe("the look is in no saved structure", () => {
  it("the R8 journal is byte-identical with and without the look", () => {
    const plain = placeAndBake(toStep("GUIDED", "TOPPING"), "clam", false);
    const steamed = placeAndBake(toStep("GUIDED", "TOPPING"), "clam", 0.7);
    expect(steamed.pizza.toppings.length).toBeGreaterThan(0);
    // (topping ids come from a module-level counter, so they are normalised; everything else must match as is)
    const journal = (s: typeof plain) => canonicalJson(buildPendingRound(s, "round-1", 70, 1000)).replace(/"topping-\d+"/g, '"topping-N"');
    expect(journal(steamed)).toBe(journal(plain));
    expect(journal(steamed)).not.toMatch(/steam/i);
  });
  it("the pizza (what the save and the journal are built from) does not carry the look", () => {
    const steamed = placeAndBake(toStep("GUIDED", "TOPPING"), "mussel", 0.7);
    expect(JSON.stringify(steamed.pizza)).not.toMatch(/steam/i);
    expect(Object.keys(steamed.pizza)).not.toContain("steamedLook");
  });
});
