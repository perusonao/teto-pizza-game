import { describe, expect, it } from "vitest";
import { fryOffer, type FryOfferInput } from "./fryOffer";

/** eggplant has no drawing yet, so today the offer is refused for every input: the whole F1 slice is dormant. */
const base: FryOfferInput = {
  enabled: true,
  phase: "PREPARE",
  makingStep: "TOPPING",
  roundKind: "GUIDED",
  active: true,
  selectedIngredientId: "eggplant",
  ownedIngredientIds: ["eggplant", "shrimp", "hot-dog", "clam"],
  friedIngredientIds: [],
};
const offer = (over: Partial<FryOfferInput>) => fryOffer({ ...base, ...over });

describe("fryOffer (dormant until eggplant has a drawing)", () => {
  it("offers nothing today, whatever the round says", () => {
    for (const roundKind of ["GUIDED", "FREE_COOK", "LUNCH_RUSH", "DINNER"] as const) expect(offer({ roundKind })).toBeNull();
    expect(offer({ friedIngredientIds: ["eggplant"] })).toBeNull();
  });
  it("never offers the out-of-scope or other treatments' ingredients", () => {
    for (const id of ["shrimp", "hot-dog", "clam", "mussel", "sausage", "beef"]) expect(offer({ selectedIngredientId: id })).toBeNull();
    expect(offer({ selectedIngredientId: null })).toBeNull();
  });
  it("not when off, inactive, in another phase / step, or not owned", () => {
    expect(offer({ enabled: false })).toBeNull();
    expect(offer({ active: false })).toBeNull();
    expect(offer({ phase: "BAKE" })).toBeNull();
    expect(offer({ makingStep: "SAUCE" })).toBeNull();
    expect(offer({ ownedIngredientIds: [] })).toBeNull();
  });
});
