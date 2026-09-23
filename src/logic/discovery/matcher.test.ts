import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import {
  evaluateDiscovery,
  matchDiscovery,
  type DiscoveryTarget,
  type RecipeDiscoveryTarget,
} from "./matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza } from "./signature";
import {
  fullyObservedSignatureFor,
  phase2DiscoveryTargets,
  phase2RowClassification,
  phase2Targets,
} from "./testSupport/phase2Matrix";

function pizzaOf(sauceIds: string[], pieces: string[]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds,
    toppings: pieces.map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 4, y: 50 })),
    bakeResult: 70,
  };
}

const MARGHERITA = pizzaOf(["tomato-sauce"], ["mozzarella", "mozzarella", "mozzarella", "basil", "basil"]);

function target(
  targetId: string,
  items: string[],
  extra: Partial<DiscoveryTarget> = {},
): DiscoveryTarget {
  return {
    targetId,
    items: [...items].sort(),
    capabilities: [],
    identityDimensions: DEFAULT_IDENTITY_DIMENSIONS,
    eligibility: { status: "ELIGIBLE" },
    ...extra,
  };
}

const ALL_101 = phase2DiscoveryTargets("SHIPPED_KEEP");

describe("matchDiscovery -- Issue #192 deterministic proof", () => {
  it("1. exact single match: a Margherita pizza matches shipped:margherita only", () => {
    const result = matchDiscovery(signatureOfPizza(MARGHERITA), RECIPE_DISCOVERY_CATALOG);
    expect(result.kind).toBe("UNIQUE_MATCH");
    if (result.kind !== "UNIQUE_MATCH") return;
    expect(result.target.recipeId).toBe("margherita");
    expect(result.target.targetId).toBe("shipped:margherita");
    // Observation rule: the two axes the runtime cannot classify were assumed, and reported.
    expect(result.assumedDimensions).toEqual(["zones", "shape"]);
  });

  it("2. ingredient order invariance: every placement order gives the same result", () => {
    const orders = [
      ["mozzarella", "basil", "mozzarella", "basil", "mozzarella"],
      ["basil", "basil", "mozzarella", "mozzarella", "mozzarella"],
      ["mozzarella", "mozzarella", "mozzarella", "basil", "basil"],
    ];
    const results = orders.map((pieces) =>
      matchDiscovery(signatureOfPizza(pizzaOf(["tomato-sauce"], pieces)), RECIPE_DISCOVERY_CATALOG),
    );
    for (const r of results) expect(r).toEqual(results[0]);
    // Catalog order never matters either.
    const reversed = matchDiscovery(signatureOfPizza(MARGHERITA), [...RECIPE_DISCOVERY_CATALOG].reverse());
    expect(reversed).toEqual(results[0]);
  });

  it("3. sauce/base distinction: the same toppings on another base, or no base, do not match", () => {
    const genovese = matchDiscovery(
      signatureOfPizza(pizzaOf(["pesto"], ["mozzarella", "cherry-tomato"])),
      RECIPE_DISCOVERY_CATALOG,
    );
    expect(genovese.kind === "UNIQUE_MATCH" && genovese.target.recipeId).toBe("genovese");

    for (const sauceIds of [["tomato-sauce"], ["olive-oil"], []]) {
      const result = matchDiscovery(
        signatureOfPizza(pizzaOf(sauceIds, ["mozzarella", "cherry-tomato"])),
        RECIPE_DISCOVERY_CATALOG,
      );
      expect(result.kind).toBe("NO_MATCH");
    }
    // Margherita's toppings on pesto are an original pizza, not Margherita.
    const pestoMargherita = matchDiscovery(
      signatureOfPizza(pizzaOf(["pesto"], ["mozzarella", "basil"])),
      RECIPE_DISCOVERY_CATALOG,
    );
    expect(pestoMargherita.kind).toBe("NO_MATCH");
  });

  it("3b. the right ingredients in the wrong roles (wrong base) do not match", () => {
    // Bismarck's set {egg, mozzarella, tomato-sauce}, but egg as the base and tomato sauce as a piece.
    const swapped = pizzaOf(["egg"], ["mozzarella", "tomato-sauce"]);
    expect(signatureOfPizza(swapped).ingredientSet.value).toEqual(["egg", "mozzarella", "tomato-sauce"]);
    expect(matchDiscovery(signatureOfPizza(swapped), RECIPE_DISCOVERY_CATALOG).kind).toBe("NO_MATCH");
    // Two bases where one is expected is also not a match.
    const twoBases = pizzaOf(["tomato-sauce", "egg"], ["mozzarella"]);
    expect(matchDiscovery(signatureOfPizza(twoBases), RECIPE_DISCOVERY_CATALOG).kind).toBe("NO_MATCH");
    // The correct roles still match.
    const bismarck = matchDiscovery(signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella", "egg"])), RECIPE_DISCOVERY_CATALOG);
    expect(bismarck.kind === "UNIQUE_MATCH" && bismarck.target.recipeId).toBe("bismarck");
  });

  describe("4. known same-ingredient-set collision groups (Phase-2 §2.3) never merge", () => {
    const groups: { pizza: PizzaState; expected: string | null; others: string[] }[] = [
      {
        pizza: MARGHERITA,
        expected: "shipped:margherita",
        others: ["cauliflower-crust-pizza-pizzadb-p2", "pizza-al-taglio-romana-pizzadb-p9"],
      },
      {
        pizza: pizzaOf(["tomato-sauce"], ["mozzarella", "sausage"]),
        expected: "shipped:salsiccia",
        others: ["chicago-stuffed-pizza-pizzadb-p3"],
      },
      {
        pizza: pizzaOf(["tomato-sauce"], ["mozzarella", "pepperoni"]),
        expected: "shipped:pepperoni",
        others: ["fathead-pizza-keto-pizzadb-p9", "new-england-bar-pizza-pizzadb-p6"],
      },
      {
        pizza: pizzaOf(["tomato-sauce"], ["mozzarella", "prosciutto-crudo", "arugula"]),
        expected: "jamon-serrano-pizza-pizzadb-p7",
        others: ["pinsa-romana-pizzadb-p9"],
      },
      {
        // Both members need a capability the runtime lacks, so this is an original pizza.
        pizza: pizzaOf(["tomato-sauce"], ["mozzarella"]),
        expected: null,
        others: ["ny-style-pizzadb", "trenton-tomato-pie-pizzadb"],
      },
    ];

    it("the ingredient-only view really does collide (so the test is meaningful)", () => {
      const byItems = new Map<string, string[]>();
      for (const t of phase2Targets("SHIPPED_KEEP")) {
        const key = t.items.filter((i) => !i.startsWith("dough:") && !i.startsWith("pan:")).sort().join("|");
        byItems.set(key, [...(byItems.get(key) ?? []), t.targetId]);
      }
      for (const g of groups) {
        const key = signatureOfPizza(g.pizza).ingredientSet.value.join("|");
        const members = byItems.get(key) ?? [];
        expect(members).toEqual(expect.arrayContaining([...(g.expected ? [g.expected] : []), ...g.others]));
      }
    });

    for (const g of groups) {
      it(`runtime pizza {${signatureOfPizza(g.pizza).ingredientSet.value.join(", ")}} -> ${g.expected ?? "original"}`, () => {
        const result = matchDiscovery(signatureOfPizza(g.pizza), ALL_101);
        if (g.expected === null) {
          expect(result).toEqual({ kind: "NO_MATCH", blockedTargetIds: [] });
        } else {
          expect(result.kind === "UNIQUE_MATCH" && result.target.targetId).toBe(g.expected);
        }
      });
    }

    it("with every dimension observed, each member of every group is matched as itself", () => {
      const allCapabilities = [...new Set(ALL_101.flatMap((t) => t.capabilities))];
      for (const g of groups) {
        for (const id of [...(g.expected ? [g.expected] : []), ...g.others]) {
          const t = ALL_101.find((x) => x.targetId === id)!;
          const result = matchDiscovery(fullyObservedSignatureFor(t), ALL_101, {
            supportedCapabilities: allCapabilities,
          });
          expect(result.kind === "UNIQUE_MATCH" && result.target.targetId).toBe(id);
        }
      }
    });
  });

  describe("5. an unavailable mechanic/axis blocks a false discovery", () => {
    it("a target that requires an unsupported capability never matches, even with default dimensions", () => {
      const zoned = target("zoned-lookalike", ["basil", "mozzarella", "tomato-sauce"], {
        capabilities: ["ZONED_PLACEMENT"],
      });
      expect(matchDiscovery(signatureOfPizza(MARGHERITA), [zoned]).kind).toBe("NO_MATCH");
    });

    it("a target needing a non-default value on an UNAVAILABLE axis never matches, even if its capability is claimed", () => {
      const square = target("square-lookalike", ["basil", "mozzarella", "tomato-sauce"], {
        capabilities: ["DOUGH_SHAPE_TARGET"],
        identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, shape: "rectangle" },
      });
      const result = matchDiscovery(signatureOfPizza(MARGHERITA), [square], {
        supportedCapabilities: ["DOUGH_SHAPE_TARGET"],
      });
      expect(result.kind).toBe("NO_MATCH");
    });

    it("a target needing a non-default value on a FIXED_BY_FLOW axis never matches", () => {
      const thick = target("thick-lookalike", ["basil", "mozzarella", "tomato-sauce"], {
        identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, dough: "thick" },
      });
      expect(matchDiscovery(signatureOfPizza(MARGHERITA), [thick]).kind).toBe("NO_MATCH");
    });

    it("no Phase-2 target that requires a capability is matchable by any runtime pizza today", () => {
      for (const t of phase2Targets("SHIPPED_KEEP").filter((x) => x.capabilities.length > 0)) {
        const realItems = t.items.filter((i) => !i.startsWith("dough:") && !i.startsWith("pan:"));
        const sauce = realItems.filter((i) => i.endsWith("-sauce") || i === "pesto" || i === "olive-oil");
        const pieces = realItems.filter((i) => !sauce.includes(i));
        const result = matchDiscovery(signatureOfPizza(pizzaOf(sauce, pieces)), ALL_101);
        if (result.kind === "UNIQUE_MATCH") expect(result.target.capabilities).toEqual([]);
        expect(result.kind === "UNIQUE_MATCH" && result.target.targetId).not.toBe(t.targetId);
      }
    });
  });

  describe("6. ambiguous / evidence-blocked rows are never auto-discovered", () => {
    it("a blocked row alone with the exact signature is reported, not discovered", () => {
      const blocked = target("blocked-row", ["basil", "mozzarella", "tomato-sauce"], {
        eligibility: { status: "BLOCKED", reason: "BASE_SAUCE_UNSPECIFIED" },
      });
      expect(matchDiscovery(signatureOfPizza(MARGHERITA), [blocked])).toEqual({
        kind: "NO_MATCH",
        blockedTargetIds: ["blocked-row"],
      });
    });

    it("a blocked row sharing an eligible target's signature makes the result AMBIGUOUS", () => {
      const blocked = target("blocked-row", ["basil", "mozzarella", "tomato-sauce"], {
        eligibility: { status: "BLOCKED", reason: "DISCOVERY_COLLISION" },
      });
      const result = matchDiscovery(signatureOfPizza(MARGHERITA), [...RECIPE_DISCOVERY_CATALOG, blocked]);
      expect(result).toEqual({ kind: "AMBIGUOUS", targetIds: ["blocked-row", "shipped:margherita"] });
    });

    it("no blocked Phase-2 row (incl. fugazza / fugazzetta) is a target or a runtime catalog entry", () => {
      const blockedIds = phase2RowClassification()
        .filter((r) => r.phase2Class !== "EVIDENCE_READY_TARGET")
        .map((r) => r.evidenceId);
      expect(blockedIds).toHaveLength(85);
      const targetIds = new Set([
        ...phase2Targets("SHIPPED_KEEP").map((t) => t.targetId),
        ...RECIPE_DISCOVERY_CATALOG.map((t) => t.targetId),
      ]);
      for (const id of blockedIds) expect(targetIds.has(id)).toBe(false);
      const discoveryRuleBlocked = phase2RowClassification().filter((r) => r.phase2Class === "BLOCKED_DISCOVERY_RULE");
      expect(discoveryRuleBlocked.map((r) => r.evidenceId).sort()).toEqual(
        expect.arrayContaining([expect.stringContaining("fugazza"), expect.stringContaining("fugazzetta")]),
      );
    });
  });

  it("7. no match => original pizza (superset, subset, empty)", () => {
    const cases = [
      pizzaOf(["tomato-sauce"], ["mozzarella", "basil", "mushroom"]), // superset of Margherita
      pizzaOf(["tomato-sauce"], ["basil"]), // subset
      createEmptyPizza(),
    ];
    for (const pizza of cases) {
      expect(matchDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG)).toEqual({
        kind: "NO_MATCH",
        blockedTargetIds: [],
      });
      expect(evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, [])).toEqual({
        kind: "ORIGINAL",
        blockedTargetIds: [],
      });
    }
  });

  it("8. multiple eligible matches => explicit AMBIGUOUS, sorted, never a discovery", () => {
    const twinA: RecipeDiscoveryTarget = { ...RECIPE_DISCOVERY_CATALOG[0], targetId: "z-twin", recipeId: "funghi" };
    const catalog = [twinA, ...RECIPE_DISCOVERY_CATALOG];
    const expected = { kind: "AMBIGUOUS", targetIds: ["shipped:margherita", "z-twin"] };
    expect(matchDiscovery(signatureOfPizza(MARGHERITA), catalog)).toEqual(expected);
    expect(matchDiscovery(signatureOfPizza(MARGHERITA), [...catalog].reverse())).toEqual(expected);
    expect(evaluateDiscovery(signatureOfPizza(MARGHERITA), catalog, [])).toEqual(expected);
  });

  it("9. already discovered => ALREADY_DISCOVERED (evaluation is pure and repeatable)", () => {
    const sig = signatureOfPizza(MARGHERITA);
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [])).toEqual({
      kind: "NEW_DISCOVERY",
      recipeId: "margherita",
      targetId: "shipped:margherita",
    });
    const already = { kind: "ALREADY_DISCOVERED", recipeId: "margherita", targetId: "shipped:margherita" };
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, ["margherita"])).toEqual(already);
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, ["margherita"])).toEqual(already);
  });
});
