import { describe, expect, it } from "vitest";
import { createEmptyPizza, type PizzaState, type PlacedTopping } from "../../state/pizzaState";
import {
  DEFAULT_IDENTITY_DIMENSIONS,
  IDENTITY_DIMENSION_KEYS,
  RUNTIME_DIMENSION_OBSERVATION,
  RUNTIME_SUPPORTED_CAPABILITIES,
  signatureOfPizza,
} from "./signature";

function piece(ingredientId: string, i: number): PlacedTopping {
  return { id: `p-${ingredientId}-${i}`, ingredientId, x: 30 + i * 3, y: 40 + i * 2 };
}

function pizzaOf(sauceIds: string[], pieces: string[]): PizzaState {
  return { ...createEmptyPizza(), sauceIds, toppings: pieces.map(piece), bakeResult: 70 };
}

describe("signatureOfPizza (P3-1 runtime signature)", () => {
  it("ingredient set is sorted, de-duplicated and includes the base sauce", () => {
    const sig = signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella", "basil", "mozzarella", "basil"]));
    expect(sig.ingredientSet).toEqual({ status: "OBSERVED", value: ["basil", "mozzarella", "tomato-sauce"] });
    expect(sig.sauceBase).toEqual({ status: "OBSERVED", value: ["tomato-sauce"] });
  });

  it("placement order never changes the signature", () => {
    const a = signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella", "mozzarella", "basil"]));
    const b = signatureOfPizza(pizzaOf(["tomato-sauce"], ["basil", "mozzarella", "mozzarella"]));
    expect(b).toEqual(a);
  });

  it("quantity is recorded but is not part of the ingredient set (presence-only identity)", () => {
    const few = signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella", "basil"]));
    const many = signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella", "mozzarella", "mozzarella", "basil", "basil"]));
    expect(many.ingredientSet).toEqual(few.ingredientSet);
    expect(few.ingredientCounts).toEqual({ "tomato-sauce": 1, mozzarella: 1, basil: 1 });
    expect(many.ingredientCounts).toEqual({ "tomato-sauce": 1, mozzarella: 3, basil: 2 });
  });

  it("an empty pizza has an empty ingredient set and no base", () => {
    const sig = signatureOfPizza(createEmptyPizza());
    expect(sig.ingredientSet.value).toEqual([]);
    expect(sig.sauceBase.value).toEqual([]);
  });

  it("malformed collections are normalized, never thrown on", () => {
    const malformed = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce", 42, null] as unknown as string[],
      toppings: [null, { id: "x", ingredientId: "basil", x: Number.NaN, y: 1 }, piece("mozzarella", 0)] as unknown as PlacedTopping[],
    };
    const sig = signatureOfPizza(malformed);
    expect(sig.ingredientSet.value).toEqual(["mozzarella", "tomato-sauce"]);
  });

  it("every Phase-2 identity dimension is present with an explicit, never-OBSERVED status today", () => {
    const sig = signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella"]));
    expect(Object.keys(sig.dimensions).sort()).toEqual([...IDENTITY_DIMENSION_KEYS].sort());
    for (const key of IDENTITY_DIMENSION_KEYS) {
      expect(sig.dimensions[key].status).toBe(RUNTIME_DIMENSION_OBSERVATION[key].status);
      expect(sig.dimensions[key].value).toEqual(DEFAULT_IDENTITY_DIMENSIONS[key]);
    }
  });

  it("only zones and shape are UNAVAILABLE; the rest are fixed by the current flow", () => {
    const unavailable = IDENTITY_DIMENSION_KEYS.filter((k) => RUNTIME_DIMENSION_OBSERVATION[k].status === "UNAVAILABLE");
    expect(unavailable).toEqual(["zones", "shape"]);
  });

  it("no Phase-2 capability is supported by the runtime yet", () => {
    expect(RUNTIME_SUPPORTED_CAPABILITIES).toEqual([]);
  });

  it("the dough stretch shape, sauce amounts, bake value and piece positions are not identity", () => {
    const base = pizzaOf(["tomato-sauce"], ["mozzarella", "basil"]);
    const varied: PizzaState = {
      ...base,
      doughShape: { radii: base.doughShape.radii.map((r, i) => r + (i % 2 === 0 ? 6 : -4)) },
      sauceDeposits: [{ x: 50, y: 50, amount: 0.3 }],
      bakeResult: 12,
      toppings: base.toppings.map((t) => ({ ...t, x: t.x + 10, y: t.y - 5 })),
    };
    expect(signatureOfPizza(varied)).toEqual(signatureOfPizza(base));
  });
});
