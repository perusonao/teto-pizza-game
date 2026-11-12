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

/** The path the dormant tests above cannot reach: eggplant WITH a dedicated drawing (the seam stands in for the catalog). */
const live = (over: Partial<FryOfferInput> = {}) => offer({ pieceVisualOf: () => "eggplant-slice", ...over });

describe("fryOffer once eggplant has a drawing", () => {
  it("is offered in a guided or free-cooking TOPPING step, and only for the selected, owned eggplant", () => {
    for (const roundKind of ["GUIDED", "FREE_COOK"] as const) expect(live({ roundKind })).toEqual({ ingredientId: "eggplant", done: false });
  });
  it("never in Lunch Rush (ranking fairness) or Dinner (no fixed recipe yet), whatever else is true", () => {
    for (const roundKind of ["LUNCH_RUSH", "DINNER"] as const) expect(live({ roundKind })).toBeNull();
  });
  it("shows the done mark, not the pill, once that ingredient is fried this round (other fried ids do not count)", () => {
    expect(live({ friedIngredientIds: ["eggplant"] })).toEqual({ ingredientId: "eggplant", done: true });
    expect(live({ friedIngredientIds: ["shrimp"] })).toEqual({ ingredientId: "eggplant", done: false });
  });
  it("still refuses when off, inactive, outside PREPARE / TOPPING, unselected, not owned, or the drawing is missing", () => {
    expect(live({ enabled: false })).toBeNull();
    expect(live({ active: false })).toBeNull();
    for (const phase of ["BAKE", "RESULT", "DISCOVERED", "HOME"]) expect(live({ phase })).toBeNull();
    for (const makingStep of ["DOUGH", "SAUCE", "CHEESE", "CUT"]) expect(live({ makingStep })).toBeNull();
    expect(live({ selectedIngredientId: null })).toBeNull();
    expect(live({ ownedIngredientIds: ["shrimp"] })).toBeNull();
    expect(offer({ pieceVisualOf: () => undefined })).toBeNull();
  });
  it("is decided by the round's own facts only: the offer shape carries no recipe / target / score", () => {
    expect(Object.keys(live() ?? {}).sort()).toEqual(["done", "ingredientId"]);
  });
  it("other ingredients stay refused even with a drawing (shrimp / hot-dog out of scope; the other treatments' targets)", () => {
    for (const id of ["shrimp", "hot-dog", "clam", "mussel", "sausage", "beef", "potato"]) expect(live({ selectedIngredientId: id })).toBeNull();
  });
});
