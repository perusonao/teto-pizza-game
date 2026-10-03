import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { runtimeCatalog } from "./catalogSource";
import { HAND_ENFORCEMENT_ENABLED } from "./handPolicy";
import { emptyHandSession } from "./handSession";
import { pinFitsHand, resolveTrayHandIds } from "./handTray";

/**
 * LC-R5-d OFF equivalence at the pure layer, kept as the LC-R6-e ROLLBACK gate: this file runs in the `hand-off` project (the real
 * `handPolicy.ts` with the production flag literal set back to false). With the flag off no round ever gets a tray hand.
 */
describe("LC-R5-d / R6-e rollback: HAND_ENFORCEMENT_ENABLED = false => no tray hand for any round", () => {
  it("the hand-off project compiles the flag off", () => expect(HAND_ENFORCEMENT_ENABLED).toBe(false));

  it("FREE Cooking with 22 toppings, pins and placed ingredients still resolves to null (today's tray)", () => {
    const toppings = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
    const input = {
      round: { roundKind: "FREE_COOK", dinner: null } as const,
      category: "topping" as const,
      catalog: runtimeCatalog(),
      ownership: { ownedIds: INGREDIENTS.map((i) => i.id), stock: () => 5 },
      session: { ...emptyHandSession(), topping: toppings.slice(0, 10) },
      placedIds: toppings.slice(0, 3),
      starterIds: STARTER_INGREDIENT_IDS,
    };
    for (const candidateCapacity of [9, 12] as const) {
      expect(resolveTrayHandIds({ ...input, candidateCapacity })).toBeNull();
      expect(pinFitsHand({ ...input, candidateCapacity }, input.session, toppings[0])).toBe(true);
    }
  });
});
