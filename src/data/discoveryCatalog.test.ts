import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG, RECIPE_DISCOVERY_TARGET_IDS } from "./discoveryCatalog";
import { RECIPES } from "./recipes";
import { getReferencePizza } from "./referencePizza";
import { createEmptyPizza } from "../state/pizzaState";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import {
  fullyObservedSignatureFor,
  phase2CollisionFreeByProfile,
  phase2DiscoveryTargets,
  phase2Targets,
  type Phase2Profile,
} from "../logic/discovery/testSupport/phase2Matrix";

function signatureKey(t: { items: readonly string[]; identityDimensions: unknown }): string {
  return JSON.stringify([[...t.items].sort(), t.identityDimensions]);
}

describe("RECIPE_DISCOVERY_CATALOG (P3-1 runtime catalog)", () => {
  it("has exactly one target per production recipe, in RECIPES order", () => {
    expect(RECIPE_DISCOVERY_CATALOG.map((t) => t.recipeId)).toEqual(RECIPES.map((r) => r.id));
    expect(new Set(RECIPE_DISCOVERY_CATALOG.map((t) => t.targetId)).size).toBe(RECIPES.length);
  });

  it("every target is identical to its Phase-2 SHIPPED_KEEP target (items, capabilities, dimensions)", () => {
    const phase2 = new Map(phase2Targets("SHIPPED_KEEP").map((t) => [t.targetId, t]));
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      const expected = phase2.get(RECIPE_DISCOVERY_TARGET_IDS[t.recipeId]);
      expect(expected, t.recipeId).toBeDefined();
      expect(t.items).toEqual([...expected!.items].sort());
      expect(t.capabilities).toEqual(expected!.capabilities);
      expect(t.identityDimensions).toEqual(expected!.identityDimensions);
      expect(t.eligibility).toEqual({ status: "ELIGIBLE" });
    }
  });

  it("covers every Phase-2 shipped:* target, and tonno-e-cipolla via its corroborating row", () => {
    const shipped = phase2Targets("SHIPPED_KEEP").filter((t) => t.source === "shipped-src").map((t) => t.targetId);
    const mapped = Object.values(RECIPE_DISCOVERY_TARGET_IDS);
    expect(shipped).toHaveLength(14);
    for (const id of shipped) expect(mapped).toContain(id);
    const tonno = phase2Targets("SHIPPED_KEEP").find((t) => t.targetId === RECIPE_DISCOVERY_TARGET_IDS["tonno-e-cipolla"]);
    expect(tonno?.productDecisionStatus).toBe("ALREADY_SHIPPED_CORROBORATED");
  });

  it("all runtime signatures are unique", () => {
    const keys = RECIPE_DISCOVERY_CATALOG.map(signatureKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("12. every shipped recipe's own reference pizza is discovered as that recipe, and only it", () => {
    for (const recipe of RECIPES) {
      const reference = getReferencePizza(recipe.id)!;
      const pizza = {
        ...createEmptyPizza(),
        sauceIds: [reference.sauce.ingredientId],
        toppings: reference.pieceGroups.flatMap((g, gi) =>
          g.positions.map((p, i) => ({ id: `${gi}-${i}`, ingredientId: g.ingredientId, ...p })),
        ),
      };
      expect(evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, [])).toEqual({
        kind: "NEW_DISCOVERY",
        recipeId: recipe.id,
        targetId: RECIPE_DISCOVERY_TARGET_IDS[recipe.id],
      });
    }
  });
});

describe.each<Phase2Profile>(["SHIPPED_KEEP", "EVIDENCE_STRICT"])("Phase-2 %s parity in TypeScript", (profile) => {
  const targets = phase2DiscoveryTargets(profile);

  it("has the Phase-2 target count and 0 signature collisions (as the Phase-2 validator reports)", () => {
    expect(targets).toHaveLength(profile === "SHIPPED_KEEP" ? 101 : 87);
    expect(phase2CollisionFreeByProfile(profile)).toEqual([]);
    const keys = targets.map(signatureKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("with every dimension observed and every capability supported, each target matches only itself", () => {
    const allCapabilities = [...new Set(targets.flatMap((t) => t.capabilities))];
    for (const t of targets) {
      const result = matchDiscovery(fullyObservedSignatureFor(t), targets, { supportedCapabilities: allCapabilities });
      expect(result.kind === "UNIQUE_MATCH" && result.target.targetId, t.targetId).toBe(t.targetId);
    }
  });
});
