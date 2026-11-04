import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { matchDiscovery } from "./matcher";
import { signatureOfPizza } from "./signature";
import { phase2RowClassification, phase2Targets } from "./testSupport/phase2Matrix";

/**
 * B11 S1, Owner decision 2026-10-28 (option A; PROVISIONAL SPEC, GAMEPLAY ASSUMPTION, original pizzadb.jp NOT confirmed):
 * `pescatore` keeps tomato-sauce only. The Phase-2 matrix row `pescatore-pizzadb-p11` (a SHIPPED_KEEP, EVIDENCE_READY_TARGET) lists olive-oil and MULTI_SPREAD_LAYER; the matrix is NOT changed.
 * REASON: a single sauce keeps the recipe on the ordinary one-sauce path (no second spread layer). IMPACT (pinned here): the runtime target is the matrix target minus olive-oil, so a pizza made with the olive-oil
 * (tomato-sauce + olive-oil, the matrix's composition) does not discover pescatore, and the olive-oil-free pizza does. This is the only approved difference from a SHIPPED_KEEP target (discoveryCatalog.test.ts).
 */
const piecesOf = (ids: string[]) => ids.map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 4, y: 50 }));
const pizza = (sauceIds: string[], pieces: string[]): PizzaState => ({ ...createEmptyPizza(), sauceIds, toppings: piecesOf(pieces), bakeResult: 70 });
const PIECES = ["mozzarella", "mozzarella", "shrimp", "shrimp", "clam", "mussel", "garlic", "parsley"];

describe("pescatore: the Owner-approved olive-oil omission (B11 S1, option A)", () => {
  const matrixTarget = phase2Targets("SHIPPED_KEEP").find((t) => t.targetId === "pescatore-pizzadb-p11")!;
  const runtimeTarget = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === "pescatore")!;

  it("the Phase-2 matrix is unchanged: pescatore is still an evidence-ready SHIPPED_KEEP target with olive-oil and MULTI_SPREAD_LAYER", () => {
    expect(matrixTarget.items).toEqual(["clam", "garlic", "mozzarella", "mussel", "olive-oil", "parsley", "shrimp", "tomato-sauce"]);
    expect(matrixTarget.capabilities).toEqual(["MULTI_SPREAD_LAYER"]);
    expect(phase2RowClassification().find((r) => r.evidenceId === "pescatore-pizzadb-p11")?.phase2Class).toBe("EVIDENCE_READY_TARGET");
  });

  it("the runtime target is exactly the matrix target without olive-oil, with no capability and no spreadLayers", () => {
    expect(runtimeTarget.targetId).toBe(matrixTarget.targetId);
    expect(runtimeTarget.items).toEqual(matrixTarget.items.filter((i) => i !== "olive-oil"));
    expect(runtimeTarget.sauceBase).toEqual(["tomato-sauce"]);
    expect(runtimeTarget.capabilities).toEqual([]);
    expect(runtimeTarget.identityDimensions).toEqual({ ...matrixTarget.identityDimensions, spreadLayers: null });
  });

  it("the olive-oil-free pizza (the approved composition) discovers pescatore, and only pescatore", () => {
    const r = matchDiscovery(signatureOfPizza(pizza(["tomato-sauce"], PIECES)), RECIPE_DISCOVERY_CATALOG);
    expect(r.kind).toBe("UNIQUE_MATCH");
    if (r.kind === "UNIQUE_MATCH") expect(r.target.recipeId).toBe("pescatore");
  });

  it("the matrix composition (tomato-sauce + olive-oil) does NOT discover pescatore: it matches no recipe (the documented consequence of the omission)", () => {
    const r = matchDiscovery(signatureOfPizza(pizza(["tomato-sauce", "olive-oil"], PIECES)), RECIPE_DISCOVERY_CATALOG);
    expect(r.kind).toBe("NO_MATCH");
  });

  it("the olive-oil does not change any other recipe: tomato-sauce + olive-oil + the same pieces never matches a different target", () => {
    const r = matchDiscovery(signatureOfPizza(pizza(["olive-oil", "tomato-sauce"], PIECES)), RECIPE_DISCOVERY_CATALOG);
    expect(r.kind === "UNIQUE_MATCH" ? r.target.recipeId : null).toBeNull();
  });
});
