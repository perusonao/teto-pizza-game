import { describe, expect, it } from "vitest";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "./pizzaState";
import { sauceLayersOf } from "./sauceLayers";

const dep = (amount: number, ingredientId?: string, x = 50, y = 50): SauceDeposit =>
  ingredientId === undefined ? { x, y, amount } : { x, y, amount, ingredientId };
const pizza = (sauceIds: string[], sauceDeposits: SauceDeposit[]): PizzaState => ({ ...createEmptyPizza(), sauceIds, sauceDeposits });

describe("sauceLayersOf (Sauce B2: which deposits each sauce laid, bottom layer first)", () => {
  it("one sauce kind: null, so the single heatmap is drawn as it always was", () => {
    expect(sauceLayersOf(pizza(["tomato-sauce"], [dep(0.1), dep(0.2)]), [], null)).toBeNull();
    expect(sauceLayersOf(createEmptyPizza(), [], null)).toBeNull();
    expect(sauceLayersOf(pizza(["pesto"], [dep(0.1)]), [dep(0.02)], "pesto")).toBeNull(); // the same kind in progress
  });

  it("two kinds: one layer per kind in first-use order, each with only its own deposits", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.1, "tomato-sauce", 20, 20), dep(0.2, "pesto", 70, 70), dep(0.3, "tomato-sauce", 25, 25)]);
    const layers = sauceLayersOf(p, [], null)!;
    expect(layers.map((l) => l.ingredientId)).toEqual(["tomato-sauce", "pesto"]);
    expect(layers[0].deposits.map((d) => d.amount)).toEqual([0.1, 0.3]);
    expect(layers[1].deposits.map((d) => d.amount)).toEqual([0.2]);
  });

  it("switching back adds to the earlier layer, which keeps its place at the bottom", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.1, "tomato-sauce"), dep(0.1, "pesto"), dep(0.1, "tomato-sauce")]);
    expect(sauceLayersOf(p, [], null)!.map((l) => [l.ingredientId, l.deposits.length])).toEqual([["tomato-sauce", 2], ["pesto", 1]]);
  });

  it("three kinds stack in first-use order", () => {
    const p = pizza(["olive-oil", "tomato-sauce", "pesto"], [dep(0.1, "olive-oil"), dep(0.1, "tomato-sauce"), dep(0.1, "pesto")]);
    expect(sauceLayersOf(p, [], null)!.map((l) => l.ingredientId)).toEqual(["olive-oil", "tomato-sauce", "pesto"]);
  });

  it("the stroke in progress joins its own kind's layer, or becomes the top layer when the kind is new", () => {
    const committed = pizza(["tomato-sauce"], [dep(0.3), dep(0.2)]); // one kind, unstamped history
    const layers = sauceLayersOf(committed, [dep(0.02), dep(0.02)], "pesto")!;
    expect(layers.map((l) => l.ingredientId)).toEqual(["tomato-sauce", "pesto"]);
    expect(layers[0].deposits).toHaveLength(2); // the unstamped history belongs to the only sauce used so far
    expect(layers[1].deposits).toHaveLength(2);
    const both = pizza(["tomato-sauce", "pesto"], [dep(0.1, "tomato-sauce"), dep(0.1, "pesto")]);
    expect(sauceLayersOf(both, [dep(0.02)], "tomato-sauce")!.map((l) => [l.ingredientId, l.deposits.length])).toEqual([["tomato-sauce", 2], ["pesto", 1]]);
  });

  it("a sauce that laid nothing has no layer: a one-shot sauce plus a painted one is a single layer", () => {
    expect(sauceLayersOf(pizza(["tomato-sauce", "pesto"], [dep(0.3, "pesto")]), [], null)).toBeNull();
  });

  it("a pending stroke without a kind is ignored (nothing to attribute it to)", () => {
    expect(sauceLayersOf(pizza(["tomato-sauce"], [dep(0.1)]), [dep(0.02)], null)).toBeNull();
  });

  it("never mutates its input", () => {
    const deposits = [dep(0.1, "tomato-sauce"), dep(0.1, "pesto")];
    const p = pizza(["tomato-sauce", "pesto"], deposits);
    sauceLayersOf(p, [dep(0.02)], "pesto");
    expect(p.sauceDeposits).toBe(deposits);
    expect(deposits).toHaveLength(2);
  });
});
