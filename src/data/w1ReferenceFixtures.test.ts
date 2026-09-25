import { describe, expect, it } from "vitest";
import {
  W1_RECIPE_IDS,
  W1_REFERENCE_FIXTURES,
  W1_REFERENCE_RECIPE_META,
  type W1ReferencePizza,
} from "./w1ReferenceFixtures";
import { computeMechanicalSauceReference, getReferencePizza } from "./referencePizza";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { getIngredient } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { getPlayerReferencePizza } from "./playerReference";
import {
  REFERENCE_SLOT_MAX_RADIUS,
  REFERENCE_SLOT_MIN_GAP,
  assignReferenceSlots,
  minimumSlotGap,
} from "../logic/pizzaReferenceLayout";
import { W1_RECIPE_REQUIREMENTS_FIXTURE } from "../logic/testSupport/discoveryLadderRule";

/**
 * Progression 2.0 W1 I5b-2 (Fresh Audit §7-§8): the 10 unwired W1 Scoring 2.0 fixtures (MD-01)
 * and the RT-01c literal freeze for the three 9/10-piece recipes.
 */

const REQUIREMENTS = new Map(W1_RECIPE_REQUIREMENTS_FIXTURE.map((r) => [r.id, r.requiredIngredients]));
const BY_ID = new Map(W1_REFERENCE_FIXTURES.map((f) => [f.recipeId, f]));

function nonSauce(id: string) {
  return REQUIREMENTS.get(id)!.filter((q) => getIngredient(q.ingredientId)!.category !== "sauce");
}

function allPositions(f: W1ReferencePizza) {
  return f.pieceGroups.flatMap((g) => g.positions);
}

function radius(p: { x: number; y: number }) {
  return Math.hypot(p.x - 50, p.y - 50);
}

/** A `Recipe`-shaped W1 recipe for the (typed) layout helpers; never registered anywhere. */
function w1Recipe(id: string): Recipe {
  return {
    id,
    nameJa: id,
    description: "",
    requiredIngredients: REQUIREMENTS.get(id)!,
    bakeTarget: W1_REFERENCE_RECIPE_META[id as keyof typeof W1_REFERENCE_RECIPE_META].bakeTarget,
    baseRewardPitz: 100,
  } as unknown as Recipe;
}

describe("10 W1 fixtures: structure (MD-01)", () => {
  it("exactly the 10 W1 recipes, one fixture each, none of them a shipped recipe", () => {
    expect(W1_REFERENCE_FIXTURES.map((f) => f.recipeId)).toEqual([...W1_RECIPE_IDS]);
    expect([...W1_RECIPE_IDS].sort()).toEqual([...REQUIREMENTS.keys()].sort());
    const shipped = new Set<string>(RECIPES.map((r) => r.id));
    for (const id of W1_RECIPE_IDS) expect(shipped.has(id)).toBe(false);
  });

  it.each(W1_REFERENCE_FIXTURES.map((f) => [f.recipeId, f] as const))(
    "%s: one group per non-sauce requirement, in order, positions = minCount",
    (id, fixture) => {
      expect(fixture.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual(
        nonSauce(id).map((q) => [q.ingredientId, q.minCount]),
      );
      for (const g of fixture.pieceGroups) {
        expect(g.interaction).toMatchObject({ family: "TAP_PLACE", primaryInput: "DRAG_FROM_TRAY", fallbackInput: "TAP_ON_PIZZA" });
      }
    },
  );

  it("piece totals: 7 for seven recipes, Parmigiana 9 / Portuguesa 10 / Puttanesca 9 (35bc937 Q2)", () => {
    expect(Object.fromEntries(W1_REFERENCE_FIXTURES.map((f) => [f.recipeId, allPositions(f).length]))).toEqual({
      "new-haven-apizza": 7,
      hawaiian: 7,
      "parmigiana-pizza": 9,
      bambino: 7,
      "pizza-portuguesa": 10,
      "puttanesca-pizza": 9,
      "pesto-caprese": 7,
      "pesto-tonno": 7,
      "pesto-patate": 7,
      "melanzane-pizza": 7,
    });
  });

  it("bake targets are the Fresh Audit §1 authority (Hawaiian 60-80), all 20 wide", () => {
    expect(Object.fromEntries(W1_RECIPE_IDS.map((id) => [id, W1_REFERENCE_RECIPE_META[id].bakeTarget]))).toEqual({
      "new-haven-apizza": { start: 62, end: 82 },
      hawaiian: { start: 60, end: 80 },
      "parmigiana-pizza": { start: 58, end: 78 },
      bambino: { start: 56, end: 76 },
      "pizza-portuguesa": { start: 58, end: 78 },
      "puttanesca-pizza": { start: 50, end: 70 },
      "pesto-caprese": { start: 50, end: 70 },
      "pesto-tonno": { start: 50, end: 70 },
      "pesto-patate": { start: 58, end: 78 },
      "melanzane-pizza": { start: 58, end: 78 },
    });
  });
});

describe("sauce reference: the existing mechanical derivation, no new numbers", () => {
  // A shipped recipe using the same sauce ingredient, whose production target is the precedent.
  const PRECEDENT = { "tomato-sauce": "margherita", pesto: "genovese", "olive-oil": "fugazza" } as const;

  it.each(W1_REFERENCE_FIXTURES.map((f) => [f.recipeId, f] as const))(
    "%s: sauce = the recipe's own sauce ingredient, equal to the shipped precedent's mechanical target",
    (id, fixture) => {
      const sauceReq = REQUIREMENTS.get(id)!.find((q) => getIngredient(q.ingredientId)!.category === "sauce")!;
      expect(fixture.sauce.ingredientId).toBe(sauceReq.ingredientId);
      expect(W1_REFERENCE_RECIPE_META[id].sauceIngredientId).toBe(sauceReq.ingredientId);
      const precedent = PRECEDENT[sauceReq.ingredientId as keyof typeof PRECEDENT];
      expect(fixture.sauce).toEqual(computeMechanicalSauceReference(precedent));
    },
  );

  it("sauce interaction follows the shipped profile for that sauce (olive-oil PAINT_TEMPORARY, others PAINT)", () => {
    for (const id of W1_RECIPE_IDS) {
      const meta = W1_REFERENCE_RECIPE_META[id];
      const precedent = { "tomato-sauce": "margherita", pesto: "genovese", "olive-oil": "fugazza" } as const;
      expect(meta.sauceInteraction).toBe(getRecipeSauceProfile(precedent[meta.sauceIngredientId]).interaction);
    }
    expect(W1_REFERENCE_RECIPE_META["new-haven-apizza"].sauceInteraction).toBe("PAINT_TEMPORARY");
  });
});

describe("landing style / tolerance: production precedent", () => {
  it("across the shipped 15 fixtures, LIGHT_LEAF is exactly the leafy herbs (bakeRoastResistant)", () => {
    for (const recipe of RECIPES) {
      for (const g of getReferencePizza(recipe.id)!.pieceGroups) {
        const leafy = getIngredient(g.ingredientId)!.bakeRoastResistant === true;
        expect(g.interaction.landingStyle).toBe(leafy ? "LIGHT_LEAF" : "HEAVY_SQUASH");
      }
    }
  });

  it("the W1 fixtures follow the same rule", () => {
    for (const f of W1_REFERENCE_FIXTURES) {
      for (const g of f.pieceGroups) {
        const leafy = getIngredient(g.ingredientId)!.bakeRoastResistant === true;
        expect(g.interaction.landingStyle).toBe(leafy ? "LIGHT_LEAF" : "HEAVY_SQUASH");
      }
    }
  });

  it("the 7 new materials all land HEAVY_SQUASH; basil stays LIGHT_LEAF", () => {
    const styles = new Map<string, string>();
    for (const f of W1_REFERENCE_FIXTURES) for (const g of f.pieceGroups) styles.set(g.ingredientId, g.interaction.landingStyle);
    for (const id of ["clam", "capers", "fresh-tomato", "eggplant", "corn", "pineapple", "potato"]) {
      expect(styles.get(id), id).toBe("HEAVY_SQUASH");
    }
    expect(styles.get("basil")).toBe("LIGHT_LEAF");
  });

  // OD-I5B-3 (owner, 2026-09-25): Pizza Portuguesa's egg keeps 14/30 like Bismarck / Breakfast
  // Pizza. RT-01's "standard 8/22" means the multi-ring layout changes no tolerance; it does not
  // override egg's own precedent.
  it("8/22 everywhere except egg, which keeps the shipped egg groups' 14/30", () => {
    const shippedEgg = [getReferencePizza("bismarck")!, getReferencePizza("breakfast-pizza")!]
      .flatMap((r) => r.pieceGroups)
      .filter((g) => g.ingredientId === "egg")
      .map((g) => g.matching);
    expect(shippedEgg).toEqual([
      { fullCreditRadius: 14, zeroCreditRadius: 30 },
      { fullCreditRadius: 14, zeroCreditRadius: 30 },
    ]);
    for (const f of W1_REFERENCE_FIXTURES) {
      for (const g of f.pieceGroups) {
        expect(g.matching).toEqual(
          g.ingredientId === "egg" ? { fullCreditRadius: 14, zeroCreditRadius: 30 } : { fullCreditRadius: 8, zeroCreditRadius: 22 },
        );
      }
    }
  });
});

describe("RT-01c: literal Reference Truth == the RT-01 layout generator", () => {
  it.each(W1_REFERENCE_FIXTURES.map((f) => [f.recipeId, f] as const))(
    "%s: pieceGroups positions equal assignReferenceSlots for its requirements",
    (id, fixture) => {
      const generated = assignReferenceSlots(nonSauce(id).map((q) => ({ ingredientId: q.ingredientId, count: q.minCount })));
      expect(fixture.pieceGroups.map((g) => ({ ingredientId: g.ingredientId, positions: g.positions }))).toEqual(generated);
      // Deterministic: a second generation is identical.
      expect(assignReferenceSlots(nonSauce(id).map((q) => ({ ingredientId: q.ingredientId, count: q.minCount })))).toEqual(generated);
    },
  );

  it.each([
    ["parmigiana-pizza", 9, 21.43],
    ["pizza-portuguesa", 10, 19.15],
    ["puttanesca-pizza", 9, 21.43],
  ] as const)("%s: %i pieces, min gap %f >= 18.2, max radius 28 <= 34, no collision", (id, count, gap) => {
    const positions = allPositions(BY_ID.get(id)!);
    expect(positions).toHaveLength(count);
    expect(new Set(positions.map((p) => `${p.x},${p.y}`)).size).toBe(count);
    expect(minimumSlotGap(positions)).toBeCloseTo(gap, 2);
    expect(minimumSlotGap(positions)).toBeGreaterThanOrEqual(REFERENCE_SLOT_MIN_GAP);
    expect(Math.max(...positions.map(radius))).toBeCloseTo(28, 2); // 2-decimal literals
    expect(Math.max(...positions.map(radius))).toBeLessThanOrEqual(REFERENCE_SLOT_MAX_RADIUS);
  });

  it("the seven 7-piece recipes use the legacy ring (min gap 20, within radius 34, no collision)", () => {
    for (const f of W1_REFERENCE_FIXTURES) {
      const positions = allPositions(f);
      if (positions.length > 8) continue;
      expect(new Set(positions.map((p) => `${p.x},${p.y}`)).size).toBe(positions.length);
      expect(minimumSlotGap(positions)).toBeGreaterThanOrEqual(REFERENCE_SLOT_MIN_GAP);
      expect(Math.max(...positions.map(radius))).toBeLessThanOrEqual(REFERENCE_SLOT_MAX_RADIUS);
    }
  });

  it.each(W1_REFERENCE_FIXTURES.map((f) => [f.recipeId, f] as const))(
    "%s: the player reference the mini 見本 would draw is the same layout (Reference Truth #167)",
    (id, fixture) => {
      const player = getPlayerReferencePizza(w1Recipe(id));
      expect(player.sauceIngredientId).toBe(fixture.sauce.ingredientId);
      expect(player.pieceGroups).toEqual(fixture.pieceGroups.map((g) => ({ ingredientId: g.ingredientId, positions: g.positions })));
    },
  );
});
