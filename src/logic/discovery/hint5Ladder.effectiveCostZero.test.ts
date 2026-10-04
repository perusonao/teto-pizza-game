import { describe, expect, it } from "vitest";
import { RECIPES, type Recipe } from "../../data/recipes";
import type { HintRoles } from "../../data/recipeHintRoles";
import { HINT5_RUNG_MARKER, HINT5_RUNG_PRICE, hint5Presentation, requestHint5Rung, type Hint5RequestInput } from "./hint5Ladder";

/**
 * #360 S3 (OD-360-3, OD-360-S3-1/3): a fully known rung has an effective cost of 0 Pitz and completes
 * even when the balance is below the normal price. Everything else is gated exactly as before. The
 * gate lives in `requestHint5Rung` only; the pre-purchase presentation never carries it (M3 / H5-INV-5).
 */

const req = (recipeId: string, over: Partial<Hint5RequestInput> = {}) =>
  requestHint5Rung({ recipeId, discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, expectedRungIndex: 1, pitzBalance: 0, ...over });
const REFUSED = { outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" };

describe("fully known rung + wallet 0: completes for 0 Pitz", () => {
  it("SAUCE", () => {
    expect(req("hawaiian", { storedFactIds: ["ing:tomato-sauce"] })).toEqual({
      outcome: "ALREADY_KNOWN",
      rungIndex: 1,
      kind: "SAUCE",
      addFactIds: [HINT5_RUNG_MARKER.SAUCE],
      charge: 0,
      persist: true,
    });
  });
  it("CHEESE", () => {
    expect(req("hawaiian", { storedFactIds: ["h5:sauce", "ing:mozzarella"], expectedRungIndex: 2 })).toEqual({
      outcome: "ALREADY_KNOWN",
      rungIndex: 2,
      kind: "CHEESE",
      addFactIds: [HINT5_RUNG_MARKER.CHEESE],
      charge: 0,
      persist: true,
    });
  });
  it("KEY_TOPPING (a legacy key topping that is known)", () => {
    const r = req("capricciosa", { storedFactIds: ["h5:sauce", "h5:cheese", "ing:mushroom"], expectedRungIndex: 3 });
    expect(r).toMatchObject({ outcome: "ALREADY_KNOWN", kind: "KEY_TOPPING", charge: 0 });
  });
  it("a balance just under the price behaves the same as 0", () => {
    for (const pitzBalance of [0, 1, HINT5_RUNG_PRICE.SAUCE - 1]) {
      expect(req("hawaiian", { storedFactIds: ["ing:tomato-sauce"], pitzBalance })).toMatchObject({ outcome: "ALREADY_KNOWN", charge: 0 });
    }
  });
  it("a non-finite balance cannot block a 0 Pitz completion (and never pays for anything else)", () => {
    expect(req("hawaiian", { storedFactIds: ["ing:tomato-sauce"], pitzBalance: Number.NaN })).toMatchObject({ outcome: "ALREADY_KNOWN", charge: 0 });
    expect(req("hawaiian", { pitzBalance: Number.NaN })).toEqual(REFUSED);
  });
});

describe("not fully known + wallet below the price: refused as before (no completion, no charge)", () => {
  it("PARTIALLY known CHEESE", () => {
    const r = req("parmigiana-pizza", { storedFactIds: ["h5:sauce", "ing:mozzarella"], expectedRungIndex: 2 });
    expect(r).toEqual(REFUSED);
    expect(r).not.toHaveProperty("addFactIds");
    expect(r).not.toHaveProperty("charge");
  });
  it("unknown SAUCE / CHEESE / KEY / STRUCTURE", () => {
    expect(req("hawaiian")).toEqual(REFUSED);
    expect(req("hawaiian", { storedFactIds: ["h5:sauce"], expectedRungIndex: 2 })).toEqual(REFUSED);
    expect(req("capricciosa", { storedFactIds: ["h5:sauce", "h5:cheese"], expectedRungIndex: 3 })).toEqual(REFUSED);
    expect(req("hawaiian", { storedFactIds: ["h5:sauce", "h5:cheese", "h5:key"], expectedRungIndex: 4 })).toEqual(REFUSED);
  });
  it("a known name on another rung does not free this rung", () => {
    expect(req("hawaiian", { storedFactIds: ["ing:mozzarella"] })).toEqual(REFUSED);
  });
  it("stale / not-a-target / complete keep their own refusals ahead of the price", () => {
    expect(req("hawaiian", { storedFactIds: ["ing:tomato-sauce"], expectedRungIndex: 2 })).toEqual({ outcome: "REJECTED", reason: "STALE" });
    expect(req("not-a-recipe")).toEqual({ outcome: "REJECTED", reason: "NOT_A_TARGET" });
  });
});

describe("sufficient balance: the existing paid behaviour is unchanged", () => {
  it("unknown rung: ANSWERED at the normal price", () => {
    expect(req("hawaiian", { pitzBalance: 100 })).toMatchObject({ outcome: "ANSWERED", kind: "SAUCE", charge: HINT5_RUNG_PRICE.SAUCE });
  });
  it("partially known rung: ANSWERED at the normal price with only the unknown names", () => {
    expect(req("parmigiana-pizza", { storedFactIds: ["h5:sauce", "ing:mozzarella"], expectedRungIndex: 2, pitzBalance: 100 })).toMatchObject({
      outcome: "ANSWERED",
      addFactIds: ["ing:parmigiano", HINT5_RUNG_MARKER.CHEESE],
      charge: HINT5_RUNG_PRICE.CHEESE,
    });
  });
  it("fully known rung: still ALREADY_KNOWN for 0 Pitz", () => {
    expect(req("hawaiian", { storedFactIds: ["ing:tomato-sauce"], pitzBalance: 100 })).toMatchObject({ outcome: "ALREADY_KNOWN", charge: 0 });
  });
});

describe("onboarding free (Dex 0 + margherita): unchanged", () => {
  it("answers at price 0 with nothing persisted, wallet 0", () => {
    expect(req("margherita", { discoveredCount: 0 })).toMatchObject({ outcome: "ANSWERED", charge: 0, persist: false });
  });
});

describe("legacy KEY (hintKeyToppingId) compatibility: unchanged", () => {
  it("an empty KEY rung (quattro-formaggi) is never already known: refused below the price, answered at it", () => {
    const stored = ["h5:sauce", "h5:cheese"];
    expect(req("quattro-formaggi", { storedFactIds: [...stored, "ing:mozzarella"], expectedRungIndex: 3 })).toEqual(REFUSED);
    expect(req("quattro-formaggi", { storedFactIds: stored, expectedRungIndex: 3, pitzBalance: 100 })).toMatchObject({
      outcome: "ANSWERED",
      kind: "KEY_TOPPING",
      addFactIds: [HINT5_RUNG_MARKER.KEY_TOPPING],
      charge: HINT5_RUNG_PRICE.KEY_TOPPING,
    });
  });
  it("CHEESE: an empty CHEESE rung (marinara) is not freed by a stored name or by the total; only the legacy count line frees it (M3, unchanged)", () => {
    expect(req("marinara", { storedFactIds: ["h5:sauce", "meta:ingredient-total"], expectedRungIndex: 2 })).toEqual(REFUSED);
  });
});

describe("key-free recipe: unchanged", () => {
  type Req = { ingredientId: string; minCount: number };
  const fixture = (id: string, reqs: Req[]): Recipe =>
    ({ id, nameJa: id, description: "", requiredIngredients: reqs, bakeTarget: { start: 60, end: 80 }, baseRewardPitz: 100 }) as unknown as Recipe;
  const KEY_FREE: HintRoles = { keyFree: true };
  const r = fixture("kf-s3", [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "mozzarella", minCount: 2 },
    { ingredientId: "sausage", minCount: 2 },
  ]);
  const recipes = [...RECIPES, r];
  const kreq = (over: Partial<Hint5RequestInput>) => requestHint5Rung({ recipeId: r.id, discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, expectedRungIndex: 1, pitzBalance: 0, ...over }, recipes, { [r.id]: KEY_FREE });
  it("fully known SAUCE completes at wallet 0; unknown CHEESE is refused; paid behaviour unchanged", () => {
    expect(kreq({ storedFactIds: ["ing:tomato-sauce"] })).toMatchObject({ outcome: "ALREADY_KNOWN", charge: 0 });
    expect(kreq({ storedFactIds: ["h5:sauce"], expectedRungIndex: 2 })).toEqual(REFUSED);
    expect(kreq({ storedFactIds: ["h5:sauce"], expectedRungIndex: 2, pitzBalance: 100 })).toMatchObject({ outcome: "ANSWERED", kind: "CHEESE", charge: HINT5_RUNG_PRICE.CHEESE });
  });
});

describe("pre-purchase privacy (H5-INV-5 / M3): hidden knowledge never changes the offer", () => {
  const view = (recipeId: string, storedFactIds: string[], pitzBalance: number) =>
    hint5Presentation({ recipeId, discoveredCount: 5, storedFactIds, legacyPurchases: {}, pitzBalance })!;
  it("a fully known and an unknown SAUCE rung give the same next offer (price, label, affordable) at every balance", () => {
    for (const pitzBalance of [0, 5, 10, 300]) {
      const known = view("hawaiian", ["ing:tomato-sauce"], pitzBalance);
      const unknown = view("hawaiian", [], pitzBalance);
      expect(known.next, String(pitzBalance)).toEqual(unknown.next);
      expect(known.board).toEqual(unknown.board);
      expect(known.next?.affordable).toBe(pitzBalance >= HINT5_RUNG_PRICE.SAUCE);
    }
  });
  it("the same for a fully known vs partially known CHEESE rung", () => {
    const full = view("parmigiana-pizza", ["h5:sauce", "ing:mozzarella", "ing:parmigiano"], 0);
    const part = view("parmigiana-pizza", ["h5:sauce", "ing:mozzarella"], 0);
    expect(full.next).toEqual(part.next);
    expect(full.board).toEqual(part.board);
  });
});
