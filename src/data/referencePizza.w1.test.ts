import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { buildIdealSauceFixture, computeMechanicalSauceReference, getReferencePizza, type ReferencePizza } from "./referencePizza";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { getIngredient } from "./ingredients";
import { RECIPES, getRecipe, type Recipe, type RecipeId } from "./recipes";
import { getPlayerReferencePizza } from "./playerReference";
import {
  REFERENCE_SLOT_MAX_RADIUS,
  REFERENCE_SLOT_MIN_GAP,
  assignReferenceSlots,
  getReferenceSlots,
  minimumSlotGap,
} from "../logic/pizzaReferenceLayout";
import { computeScoringV2 } from "../logic/scoringV2";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { PizzaThumbnail } from "../components/PizzaThumbnail";
import { W1_RECIPE_REQUIREMENTS_FIXTURE } from "../logic/testSupport/discoveryLadderRule";

/**
 * Progression 2.0 W1 I5b-3 (Fresh Audit §7-§8, MD-01 + RT-01c): the 10 W1 Reference Truth
 * fixtures, authored unwired in I5b-2 and now registered in `REFERENCE_PIZZAS` -- re-verified
 * through the production lookup (`getReferencePizza`, `computeScoringV2`, `getPlayerReferencePizza`).
 */

afterEach(cleanup);

const W1_IDS = W1_RECIPE_REQUIREMENTS_FIXTURE.map((r) => r.id as RecipeId);

function recipe(id: RecipeId): Recipe {
  return getRecipe(id)!;
}

function reference(id: RecipeId): ReferencePizza {
  return getReferencePizza(id)!;
}

function nonSauce(id: RecipeId) {
  return recipe(id).requiredIngredients.filter((q) => getIngredient(q.ingredientId)!.category !== "sauce");
}

function allPositions(r: ReferencePizza) {
  return r.pieceGroups.flatMap((g) => g.positions);
}

function radius(p: { x: number; y: number }) {
  return Math.hypot(p.x - 50, p.y - 50);
}

describe("MD-01: every production recipe has a Reference (25 / 25)", () => {
  it("RECIPES 25, REFERENCE_PIZZAS 25", () => {
    expect(RECIPES).toHaveLength(25);
    for (const r of RECIPES) expect(getReferencePizza(r.id)?.recipeId).toBe(r.id);
  });

  it("the 10 W1 recipes are exactly the Fresh Audit's, with the authored counts", () => {
    expect(W1_IDS).toHaveLength(10);
    for (const id of W1_IDS) {
      const authored = W1_RECIPE_REQUIREMENTS_FIXTURE.find((r) => r.id === id)!.requiredIngredients;
      expect(recipe(id).requiredIngredients).toEqual(authored);
    }
  });

  it.each(W1_IDS)("%s: one group per non-sauce requirement, in order, positions = minCount", (id) => {
    expect(reference(id).pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual(
      nonSauce(id).map((q) => [q.ingredientId, q.minCount]),
    );
    for (const g of reference(id).pieceGroups) {
      expect(g.interaction).toMatchObject({ family: "TAP_PLACE", primaryInput: "DRAG_FROM_TRAY", fallbackInput: "TAP_ON_PIZZA" });
    }
  });

  it("piece totals: 7 for seven recipes, Parmigiana 9 / Portuguesa 10 / Puttanesca 9 (35bc937 Q2)", () => {
    expect(Object.fromEntries(W1_IDS.map((id) => [id, allPositions(reference(id)).length]))).toEqual({
      "melanzane-pizza": 7,
      "parmigiana-pizza": 9,
      bambino: 7,
      hawaiian: 7,
      "pizza-portuguesa": 10,
      "pesto-tonno": 7,
      "new-haven-apizza": 7,
      "pesto-caprese": 7,
      "pesto-patate": 7,
      "puttanesca-pizza": 9,
    });
  });
});

describe("sauce: the mechanical derivation for each recipe's own sauce profile", () => {
  const PRECEDENT = { "tomato-sauce": "margherita", pesto: "genovese", "olive-oil": "fugazza" } as const;

  it.each(W1_IDS)("%s: sauce ingredient = its profile's; target and interaction = the shipped precedent's", (id) => {
    const profile = getRecipeSauceProfile(id);
    const sauceReq = recipe(id).requiredIngredients.find((q) => getIngredient(q.ingredientId)!.category === "sauce")!;
    expect(profile.ingredientId).toBe(sauceReq.ingredientId);
    expect(reference(id).sauce).toEqual(computeMechanicalSauceReference(id));
    const precedent = PRECEDENT[profile.ingredientId];
    expect(reference(id).sauce).toEqual(computeMechanicalSauceReference(precedent));
    expect(profile.interaction).toBe(getRecipeSauceProfile(precedent).interaction);
  });

  it("New Haven's olive-oil keeps PAINT_TEMPORARY; the tomato and pesto recipes PAINT", () => {
    expect(getRecipeSauceProfile("new-haven-apizza")).toEqual({
      recipeId: "new-haven-apizza",
      ingredientId: "olive-oil",
      interaction: "PAINT_TEMPORARY",
    });
    for (const id of W1_IDS.filter((i) => i !== "new-haven-apizza")) {
      expect(getRecipeSauceProfile(id).interaction).toBe("PAINT");
    }
  });
});

describe("landing style / tolerance: production precedent", () => {
  it("across all 25 fixtures, LIGHT_LEAF is exactly the leafy herbs (bakeRoastResistant)", () => {
    for (const r of RECIPES) {
      for (const g of reference(r.id).pieceGroups) {
        const leafy = getIngredient(g.ingredientId)!.bakeRoastResistant === true;
        expect(g.interaction.landingStyle, `${r.id}/${g.ingredientId}`).toBe(leafy ? "LIGHT_LEAF" : "HEAVY_SQUASH");
      }
    }
  });

  it("the 7 new materials all land HEAVY_SQUASH; basil stays LIGHT_LEAF", () => {
    const styles = new Map<string, string>();
    for (const id of W1_IDS) for (const g of reference(id).pieceGroups) styles.set(g.ingredientId, g.interaction.landingStyle);
    for (const id of ["clam", "capers", "fresh-tomato", "eggplant", "corn", "pineapple", "potato"]) {
      expect(styles.get(id), id).toBe("HEAVY_SQUASH");
    }
    expect(styles.get("basil")).toBe("LIGHT_LEAF");
  });

  // OD-I5B-3 (owner, 2026-09-25): Pizza Portuguesa's egg keeps 14/30 like Bismarck / Breakfast
  // Pizza. RT-01's "standard 8/22" means the multi-ring layout changes no tolerance; it does not
  // override egg's own precedent.
  it("8/22 everywhere except egg, which keeps the shipped egg groups' 14/30 (OD-I5B-3)", () => {
    for (const r of RECIPES) {
      for (const g of reference(r.id).pieceGroups) {
        expect(g.matching, `${r.id}/${g.ingredientId}`).toEqual(
          g.ingredientId === "egg" ? { fullCreditRadius: 14, zeroCreditRadius: 30 } : { fullCreditRadius: 8, zeroCreditRadius: 22 },
        );
      }
    }
    expect(reference("pizza-portuguesa").pieceGroups.find((g) => g.ingredientId === "egg")!.matching).toEqual({
      fullCreditRadius: 14,
      zeroCreditRadius: 30,
    });
  });
});

describe("RT-01c: literal Reference Truth == the RT-01 generator == what the player sees", () => {
  it.each(W1_IDS)("%s: fixture positions equal assignReferenceSlots (deterministic)", (id) => {
    const groups = nonSauce(id).map((q) => ({ ingredientId: q.ingredientId, count: q.minCount }));
    const generated = assignReferenceSlots(groups);
    expect(reference(id).pieceGroups.map((g) => ({ ingredientId: g.ingredientId, positions: g.positions }))).toEqual(generated);
    expect(assignReferenceSlots(groups)).toEqual(generated);
  });

  it.each(W1_IDS)("%s: the player reference (mini 見本 / popover source) is the same layout", (id) => {
    const player = getPlayerReferencePizza(recipe(id));
    expect(player.sauceIngredientId).toBe(reference(id).sauce.ingredientId);
    expect(player.pieceGroups).toEqual(reference(id).pieceGroups.map((g) => ({ ingredientId: g.ingredientId, positions: g.positions })));
  });

  it.each([
    ["parmigiana-pizza", 9, 21.43],
    ["pizza-portuguesa", 10, 19.15],
    ["puttanesca-pizza", 9, 21.43],
  ] as const)("%s: %i pieces, Candidate B, min gap %f >= 18.2, max radius 28 <= 34, no collision", (id, count, gap) => {
    const positions = allPositions(reference(id));
    expect(positions).toHaveLength(count);
    expect(new Set(positions.map((p) => `${p.x},${p.y}`)).size).toBe(count);
    expect(minimumSlotGap(positions)).toBeCloseTo(gap, 2);
    expect(minimumSlotGap(positions)).toBeGreaterThanOrEqual(REFERENCE_SLOT_MIN_GAP);
    expect(Math.max(...positions.map(radius))).toBeCloseTo(28, 2); // 2-decimal literals
    expect(Math.max(...positions.map(radius))).toBeLessThanOrEqual(REFERENCE_SLOT_MAX_RADIUS);
  });

  it("the seven 7-piece recipes use the legacy ring (min gap 20, radius <= 34, no collision)", () => {
    for (const id of W1_IDS) {
      const positions = allPositions(reference(id));
      if (positions.length > 8) continue;
      expect(new Set(positions.map((p) => `${p.x},${p.y}`)).size).toBe(positions.length);
      expect(positions).toEqual(getReferenceSlots(positions.length));
      expect(minimumSlotGap(positions)).toBeGreaterThanOrEqual(REFERENCE_SLOT_MIN_GAP);
      expect(Math.max(...positions.map(radius))).toBeLessThanOrEqual(REFERENCE_SLOT_MAX_RADIUS);
    }
  });

  it.each(["parmigiana-pizza", "pizza-portuguesa", "puttanesca-pizza"] as const)(
    "%s: the Pizza Select thumbnail draws one piece per topping type, all at distinct positions",
    (id) => {
      const { container } = render(createElement(PizzaThumbnail, { recipe: recipe(id) }));
      const pieces = Array.from(container.querySelectorAll<HTMLElement>(".pizza-thumbnail__piece-emoji"));
      const types = new Set(nonSauce(id).filter((q) => getIngredient(q.ingredientId)!.category !== "cheese").map((q) => q.ingredientId));
      expect(pieces).toHaveLength(types.size);
      const spots = pieces.map((e) => {
        const host = e.closest<HTMLElement>("[style]") ?? e;
        return `${host.style.left},${host.style.top}`;
      });
      expect(new Set(spots).size).toBe(pieces.length);
    },
  );
});

describe("perfect-score regression through the production computeScoringV2", () => {
  function referenceExact(id: RecipeId, tag: string): PizzaState {
    const ref = reference(id);
    const r = recipe(id);
    return {
      ...createEmptyPizza(),
      sauceIds: [ref.sauce.ingredientId],
      sauceDeposits: buildIdealSauceFixture(),
      toppings: ref.pieceGroups.flatMap((g, gi) =>
        g.positions.map((p, i) => ({ id: `${tag}-${gi}-${i}`, ingredientId: g.ingredientId, ...p })),
      ),
      bakeResult: (r.bakeTarget.start + r.bakeTarget.end) / 2,
    };
  }

  const margheritaPerfect = computeScoringV2(recipe("margherita"), referenceExact("margherita", "m"));

  it.each(W1_IDS)("%s: available; Pieces / Recipe / Bake 100; quantity factor 1; total = Margherita's perfect total", (id) => {
    const result = computeScoringV2(recipe(id), referenceExact(id, "w1"));
    expect(result.available).toBe(true);
    const { sauce, pieces, recipe: recipeComponent, bake, quantity } = result.components;
    if (!sauce.available || !pieces.available || !recipeComponent.available || !bake.available || !quantity.available) {
      throw new Error("every component must be available");
    }
    expect(pieces.score).toBe(100);
    expect(recipeComponent.score).toBe(100);
    expect(bake.score).toBe(100);
    expect(quantity.factor).toBe(1);
    if (!margheritaPerfect.components.sauce.available) throw new Error("baseline");
    expect(sauce.score).toBe(margheritaPerfect.components.sauce.score);
    expect(result.totalScore).toBe(margheritaPerfect.totalScore);
  });

  it.each(W1_IDS)("%s: perfect > displaced > empty", (id) => {
    const perfect = computeScoringV2(recipe(id), referenceExact(id, "w1")).totalScore as number;
    const exact = referenceExact(id, "w1");
    const displaced = computeScoringV2(recipe(id), {
      ...exact,
      toppings: exact.toppings.map((t, i) => ({ ...t, x: t.x + (i % 2 === 0 ? 12 : -12) })),
    }).totalScore as number;
    const empty = computeScoringV2(recipe(id), createEmptyPizza()).totalScore as number;
    expect(perfect).toBeGreaterThan(displaced);
    expect(displaced).toBeGreaterThan(empty);
  });
});
