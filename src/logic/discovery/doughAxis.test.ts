import { describe, expect, it } from "vitest";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { evaluateDiscovery, matchDiscovery, type DiscoveryTarget, type RecipeDiscoveryTarget } from "./matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, IDENTITY_DIMENSION_KEYS, signatureOfPizza } from "./signature";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPES } from "../../data/recipes";

/** Dough Kind P1 (#577): the `dough` identity axis. Synthetic fixtures only -- no production recipe has a dough kind yet. */
const PINSA = "material-multigrain-long-ferment";
const ITEMS = ["arugula", "mozzarella", "prosciutto-crudo", "tomato-sauce"];

function pizzaOf(over: Partial<PizzaState> = {}): PizzaState {
  return {
    ...createEmptyPizza(),
    ...over,
    sauceIds: ["tomato-sauce"],
    toppings: ["mozzarella", "prosciutto-crudo", "arugula"].map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 8, y: 50 })),
    bakeResult: 70,
  };
}

function target(id: string, dough: string, pan: string | null = null, capabilities: string[] = []): DiscoveryTarget {
  return {
    targetId: id,
    items: ITEMS,
    sauceBase: ["tomato-sauce"],
    capabilities,
    identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, dough, pan },
    eligibility: { status: "ELIGIBLE" },
  };
}

describe("dough identity axis (P1)", () => {
  it("absent, undefined and malformed values all read as 'standard', status OBSERVED", () => {
    for (const dough of [undefined, "standard", "", "pinsa", 1, null, {}] as unknown[]) {
      expect(signatureOfPizza({ ...pizzaOf(), dough } as PizzaState).dimensions.dough).toEqual({ status: "OBSERVED", value: "standard" });
    }
  });

  it("only the explicit Pinsa vocabulary value reads as Pinsa", () => {
    expect(signatureOfPizza(pizzaOf({ dough: PINSA })).dimensions.dough).toEqual({ status: "OBSERVED", value: PINSA });
  });

  it("is never inferred from pan or squareDough, and pan is never inferred from dough", () => {
    expect(signatureOfPizza(pizzaOf({ pan: "tray" })).dimensions.dough.value).toBe("standard");
    expect(signatureOfPizza({ ...pizzaOf(), squareDough: {} } as unknown as PizzaState).dimensions.dough.value).toBe("standard");
    expect(signatureOfPizza(pizzaOf({ dough: PINSA })).dimensions.pan.value).toBeNull();
  });

  it("PK-1: for an undoughed pizza every axis value is unchanged; only dough's status moved FIXED_BY_FLOW -> OBSERVED", () => {
    const sig = signatureOfPizza(pizzaOf());
    for (const key of IDENTITY_DIMENSION_KEYS) {
      expect(sig.dimensions[key].value).toEqual(DEFAULT_IDENTITY_DIMENSIONS[key]);
      if (key !== "dough" && key !== "pan" && key !== "late") expect(sig.dimensions[key].status).not.toBe("OBSERVED");
    }
    expect(sig.dimensions.dough.status).toBe("OBSERVED");
  });

  it("every other axis, the ingredient set and the base are unchanged by the dough kind", () => {
    const a = signatureOfPizza(pizzaOf());
    const b = signatureOfPizza(pizzaOf({ dough: PINSA }));
    for (const key of IDENTITY_DIMENSION_KEYS) if (key !== "dough") expect(b.dimensions[key]).toEqual(a.dimensions[key]);
    expect(b.ingredientSet).toEqual(a.ingredientSet);
    expect(b.sauceBase).toEqual(a.sauceBase);
  });

  it("PK-3: the same ingredients in a standard and a Pinsa target are not ambiguous; each pizza picks its own", () => {
    const catalog = [target("std", "standard"), target("pinsa", PINSA, null, ["DOUGH_VARIANT"])];
    const std = matchDiscovery(signatureOfPizza(pizzaOf()), catalog);
    const pin = matchDiscovery(signatureOfPizza(pizzaOf({ dough: PINSA })), catalog);
    expect(std.kind === "UNIQUE_MATCH" && std.target.targetId).toBe("std");
    expect(pin.kind === "UNIQUE_MATCH" && pin.target.targetId).toBe("pinsa");
  });

  it("PK-3: Pinsa dough on a tray, or standard dough on a tray, matches neither (no target requires the combination)", () => {
    const catalog = [target("std", "standard"), target("pinsa", PINSA, null, ["DOUGH_VARIANT"])];
    expect(matchDiscovery(signatureOfPizza(pizzaOf({ dough: PINSA, pan: "tray" })), catalog).kind).toBe("NO_MATCH");
    expect(matchDiscovery(signatureOfPizza(pizzaOf({ pan: "tray" })), catalog).kind).toBe("NO_MATCH");
  });

  it("a Pinsa target needs DOUGH_VARIANT to be supported: it is by default, and unsupported means no match", () => {
    const pinsa = target("pinsa", PINSA, null, ["DOUGH_VARIANT"]);
    const sig = signatureOfPizza(pizzaOf({ dough: PINSA }));
    expect(matchDiscovery(sig, [pinsa]).kind).toBe("UNIQUE_MATCH");
    expect(matchDiscovery(sig, [pinsa], { supportedCapabilities: [] }).kind).toBe("NO_MATCH");
  });

  it("a standard cook of Pinsa's ingredients is not a Pinsa discovery (evaluateDiscovery)", () => {
    const pinsa = { ...target("pinsa", PINSA, null, ["DOUGH_VARIANT"]), recipeId: "syn-pinsa" } as unknown as RecipeDiscoveryTarget;
    expect(evaluateDiscovery(signatureOfPizza(pizzaOf()), [pinsa], []).kind).toBe("ORIGINAL");
    expect(evaluateDiscovery(signatureOfPizza(pizzaOf({ dough: PINSA })), [pinsa], []).kind).toBe("NEW_DISCOVERY");
  });

  it("Production is inert: every runtime target is standard dough and nothing requires DOUGH_VARIANT", () => {
    expect(RECIPES.length).toBe(RECIPE_DISCOVERY_CATALOG.length);
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      expect(t.identityDimensions.dough, t.targetId).toBe("standard");
      expect(t.capabilities, t.targetId).not.toContain("DOUGH_VARIANT");
    }
  });

  it("PK-1 / fingerprint: every existing recipe's composition still matches exactly its own target, (its attempt fingerprint is pinned in attemptFingerprint.test.ts)", () => {
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      const base = t.sauceBase ?? [];
      const pizza: PizzaState = {
        ...createEmptyPizza(),
        sauceIds: [...base],
        toppings: t.items.filter((id) => !base.includes(id)).map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i, y: 50 })),
      };
      const sig = signatureOfPizza(pizza);
      const match = matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG);
      expect(match.kind === "UNIQUE_MATCH" && match.target.targetId, t.targetId).toBe(t.targetId);
    }
  });
});
