import { describe, expect, it } from "vitest";
import { steamOffer, type SteamOfferInput } from "./steamOffer";

const base: SteamOfferInput = {
  enabled: true,
  phase: "PREPARE",
  makingStep: "TOPPING",
  roundKind: "GUIDED",
  active: true,
  selectedIngredientId: "clam",
  ownedIngredientIds: ["clam", "mussel", "shrimp"],
  steamedIngredientIds: [],
};
const offer = (over: Partial<SteamOfferInput>) => steamOffer({ ...base, ...over });

describe("steamOffer", () => {
  it("offered for clam and mussel in Guided and Free Cooking during TOPPING", () => {
    expect(offer({})).toEqual({ ingredientId: "clam", done: false });
    expect(offer({ selectedIngredientId: "mussel" })).toEqual({ ingredientId: "mussel", done: false });
    expect(offer({ roundKind: "FREE_COOK" })).toEqual({ ingredientId: "clam", done: false });
  });
  it("an ingredient already steamed shows the mark instead", () => {
    expect(offer({ steamedIngredientIds: ["clam"] })).toEqual({ ingredientId: "clam", done: true });
    expect(offer({ steamedIngredientIds: ["mussel"] })).toEqual({ ingredientId: "clam", done: false });
  });
  it("never in Lunch Rush or Dinner", () => {
    expect(offer({ roundKind: "LUNCH_RUSH" })).toBeNull();
    expect(offer({ roundKind: "DINNER" })).toBeNull();
  });
  it("not when off, inactive, in another phase or another step", () => {
    expect(offer({ enabled: false })).toBeNull();
    expect(offer({ active: false })).toBeNull();
    for (const phase of ["ORDER", "BAKE", "POST_BAKE", "RESULT", "DISCOVERED"]) expect(offer({ phase })).toBeNull();
    for (const makingStep of ["DOUGH", "SAUCE", "CHEESE", "CUT", "FINISH"]) expect(offer({ makingStep })).toBeNull();
  });
  it("not for a non-target, an unowned or no selection", () => {
    expect(offer({ selectedIngredientId: "shrimp" })).toBeNull();
    expect(offer({ selectedIngredientId: "beef", ownedIngredientIds: ["beef"] })).toBeNull();
    expect(offer({ selectedIngredientId: "sausage", ownedIngredientIds: ["sausage"] })).toBeNull();
    expect(offer({ ownedIngredientIds: ["mussel"] })).toBeNull();
    expect(offer({ selectedIngredientId: null })).toBeNull();
  });
  it("the input has no recipe, target or mode field -- so the answer cannot depend on one", () => {
    expect(Object.keys(base).sort()).toEqual(
      ["active", "enabled", "makingStep", "ownedIngredientIds", "phase", "roundKind", "selectedIngredientId", "steamedIngredientIds"].sort(),
    );
  });
});
