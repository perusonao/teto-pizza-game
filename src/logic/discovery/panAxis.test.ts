import { describe, expect, it } from "vitest";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { evaluateDiscovery, matchDiscovery, type DiscoveryTarget } from "./matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza } from "./signature";

/** Square Dough F1: the `pan` identity axis. Synthetic fixtures only -- no real recipe uses a pan yet. */
const ITEMS = ["garlic", "mozzarella", "olive-oil", "tomato-sauce"];

function pizzaOf(pan?: PizzaState["pan"]): PizzaState {
  const base = createEmptyPizza();
  return {
    ...base,
    ...(pan === undefined ? {} : { pan }),
    sauceIds: ["tomato-sauce", "olive-oil"],
    toppings: ["mozzarella", "garlic"].map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 8, y: 50 })),
    bakeResult: 70,
  };
}

function target(id: string, pan: string | null): DiscoveryTarget {
  return {
    targetId: id,
    items: ITEMS,
    sauceBase: ["olive-oil", "tomato-sauce"],
    capabilities: [],
    identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, pan },
    eligibility: { status: "ELIGIBLE" },
  };
}

describe("pan identity axis (F1)", () => {
  it("absent, null and malformed values all read as the ordinary cook (null), status OBSERVED", () => {
    for (const pan of [undefined, null, "round", "deep-pan", 1, {}] as unknown[]) {
      const pizza = { ...pizzaOf(), pan } as PizzaState;
      expect(signatureOfPizza(pizza).dimensions.pan).toEqual({ status: "OBSERVED", value: null });
    }
  });

  it("only the explicit 'tray' reads as tray", () => {
    expect(signatureOfPizza(pizzaOf("tray")).dimensions.pan).toEqual({ status: "OBSERVED", value: "tray" });
  });

  it("the pan is never inferred from squareDough", () => {
    const withSquare = { ...pizzaOf(), squareDough: {} } as unknown as PizzaState;
    expect(signatureOfPizza(withSquare).dimensions.pan.value).toBeNull();
  });

  it("the shape axis stays UNAVAILABLE and every other axis is unchanged by the pan", () => {
    const a = signatureOfPizza(pizzaOf());
    const b = signatureOfPizza(pizzaOf("tray"));
    expect(b.dimensions.shape).toEqual(a.dimensions.shape);
    expect(b.dimensions.shape.status).toBe("UNAVAILABLE");
    for (const key of Object.keys(a.dimensions) as (keyof typeof a.dimensions)[]) {
      if (key !== "pan") expect(b.dimensions[key]).toEqual(a.dimensions[key]);
    }
    expect(b.ingredientSet).toEqual(a.ingredientSet);
    expect(b.sauceBase).toEqual(a.sauceBase);
  });

  it("identity separation: a pan:null target matches only the ordinary cook, a pan:'tray' target only the tray cook", () => {
    const round = target("round-one", null);
    const tray = target("tray-one", "tray");
    const ordinary = signatureOfPizza(pizzaOf());
    const trayed = signatureOfPizza(pizzaOf("tray"));

    expect(matchDiscovery(ordinary, [round]).kind).toBe("UNIQUE_MATCH");
    expect(matchDiscovery(ordinary, [tray]).kind).toBe("NO_MATCH");
    expect(matchDiscovery(trayed, [tray]).kind).toBe("UNIQUE_MATCH");
    expect(matchDiscovery(trayed, [round]).kind).toBe("NO_MATCH");
  });

  it("the same ingredients in two targets that differ only in pan are not ambiguous", () => {
    const catalog = [target("round-one", null), target("tray-one", "tray")];
    const ordinary = matchDiscovery(signatureOfPizza(pizzaOf()), catalog);
    const trayed = matchDiscovery(signatureOfPizza(pizzaOf("tray")), catalog);
    expect(ordinary.kind === "UNIQUE_MATCH" && ordinary.target.targetId).toBe("round-one");
    expect(trayed.kind === "UNIQUE_MATCH" && trayed.target.targetId).toBe("tray-one");
  });

  it("a round cook of a tray recipe's ingredients is an original pizza (no discovery)", () => {
    const outcome = evaluateDiscovery(signatureOfPizza(pizzaOf()), [{ ...target("tray-one", "tray"), recipeId: "margherita" }], []);
    expect(outcome.kind).toBe("ORIGINAL");
  });
});
