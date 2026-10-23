import { describe, expect, it } from "vitest";
import { validateLateCatalog, type LateCatalogInput } from "./lateCatalog";

/**
 * P3-a2 (#577, Owner D1): `validateLateCatalog` exempts a `ladderCredit: false` late recipe from being the key of a late ladder step (a step needs a NEW
 * material; Pinsa adds none), and pays for it with strict checks. Everything here is SYNTHETIC (injected arrays): the real late arrays hold no such
 * recipe until P3-b (HOLD). The negative tests are the point: the exemption must not become a way around any other rule.
 */

const BASE = { recipeIds: ["margherita", "jamon-like"], ingredientIds: ["tomato-sauce", "mozzarella", "prosciutto-crudo", "arugula", "salmon"] };

const lateIngredient = { id: "late-herb", unlockCondition: { minTotalStars: 0 } } as const;
const creditedLate = {
  id: "credited-late",
  requiredIngredients: [
    { ingredientId: "salmon", minCount: 1 },
    { ingredientId: "late-herb", minCount: 1, applicationPhase: "POST_BAKE" as const },
  ],
  lunchRush: false,
};
const creditedStep = { ingredientIds: ["late-herb"], keyRecipeId: "credited-late" };
const uncreditedLate = {
  id: "uncredited-late",
  ladderCredit: false as const,
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "mozzarella", minCount: 2 },
    { ingredientId: "prosciutto-crudo", minCount: 3 },
    { ingredientId: "arugula", minCount: 2, applicationPhase: "POST_BAKE" as const },
  ],
  lunchRush: false,
};

function input(over: Partial<LateCatalogInput> = {}): LateCatalogInput {
  return {
    recipes: [creditedLate, uncreditedLate],
    ingredients: [lateIngredient],
    ladderSteps: [creditedStep],
    discoveryTargetIds: { "credited-late": "credited-late-target", "uncredited-late": "uncredited-late-target" },
    ...over,
  };
}
const problems = (i: LateCatalogInput): string[] => validateLateCatalog(BASE, i);

describe("the ladderCredit:false exemption (accepted)", () => {
  it("a ladderCredit:false late recipe with no late ladder step is valid, beside a credited one that has its step", () => {
    expect(problems(input())).toEqual([]);
  });

  it("it is valid on its own (no late ingredient, no late step at all)", () => {
    expect(problems(input({ recipes: [uncreditedLate], ingredients: [], ladderSteps: [], discoveryTargetIds: { "uncredited-late": "t" } }))).toEqual([]);
  });

  it("a doughKind the registry knows is accepted (the Pinsa kind and standard)", () => {
    for (const doughKind of ["material-multigrain-long-ferment", "standard"]) {
      expect(problems(input({ recipes: [creditedLate, { ...uncreditedLate, doughKind }] }))).toEqual([]);
    }
  });
});

describe("the exemption is narrow (negative tests)", () => {
  it("a late recipe WITHOUT ladderCredit:false still needs to be the key of a late ladder step", () => {
    const out = problems(input({ ladderSteps: [] }));
    expect(out).toContain("late recipe is the key of no late ladder step (unreachable): credited-late");
    expect(out.some((p) => p.includes("uncredited-late"))).toBe(false);
  });

  it("ladderCredit values other than false are rejected, not treated as an exemption (true, 'false', 0, null)", () => {
    for (const bad of [true, "false", 0, null]) {
      const out = problems(input({ recipes: [creditedLate, { ...uncreditedLate, ladderCredit: bad as never }] }));
      expect(out).toContain("late recipe ladderCredit must be false when present: uncredited-late");
      // ...and being rejected it is also not exempt from the key-step rule
      expect(out).toContain("late recipe is the key of no late ladder step (unreachable): uncredited-late");
    }
  });

  it("a ladderCredit:false recipe that needs a late-only ingredient is rejected (reachability must come from the ordinary ladder)", () => {
    const needsLate = { ...uncreditedLate, requiredIngredients: [...uncreditedLate.requiredIngredients, { ingredientId: "late-herb", minCount: 1 }] };
    expect(problems(input({ recipes: [creditedLate, needsLate] }))).toContain("late recipe uncredited-late is ladderCredit:false but requires a late-only ingredient: late-herb");
  });

  it("a ladderCredit:false recipe cannot be the key of a late ladder step", () => {
    const out = problems(input({ ladderSteps: [creditedStep, { ingredientIds: ["arugula"], keyRecipeId: "uncredited-late" }] }));
    expect(out).toContain("a ladderCredit:false late recipe cannot be the key of a late ladder step: uncredited-late");
  });

  it("the exemption does not excuse any other rule", () => {
    // no POST_BAKE requirement
    const noPost = { ...uncreditedLate, requiredIngredients: uncreditedLate.requiredIngredients.map((r) => ({ ingredientId: r.ingredientId, minCount: r.minCount })) };
    expect(problems(input({ recipes: [creditedLate, noPost] }))).toContain("late recipe has no POST_BAKE requirement: uncredited-late");
    // lunchRush not false
    expect(problems(input({ recipes: [creditedLate, { ...uncreditedLate, lunchRush: true as never }] }))).toContain(
      "late recipe must be lunchRush:false (Lunch Rush and Dinner exclude FINISH): uncredited-late",
    );
    // id already in the base
    expect(problems(input({ recipes: [creditedLate, { ...uncreditedLate, id: "margherita" }], discoveryTargetIds: { "credited-late": "a", margherita: "b" } }))).toContain(
      "recipe id is not unique: margherita",
    );
    // unknown ingredient
    const unknown = { ...uncreditedLate, requiredIngredients: [...uncreditedLate.requiredIngredients, { ingredientId: "no-such-thing", minCount: 1 }] };
    expect(problems(input({ recipes: [creditedLate, unknown] }))).toContain("late recipe uncredited-late requires an unknown ingredient: no-such-thing");
    // no discovery target id / a duplicated one / one for an unknown recipe
    expect(problems(input({ discoveryTargetIds: { "credited-late": "a" } }))).toContain("late recipe has no discovery target id: uncredited-late");
    expect(problems(input({ discoveryTargetIds: { "credited-late": "same", "uncredited-late": "same" } }))).toContain("discovery target id is not unique: same");
    expect(problems(input({ discoveryTargetIds: { "credited-late": "a", "uncredited-late": "b", ghost: "c" } }))).toContain("discovery target id for an unknown late recipe: ghost");
  });

  it("an unknown doughKind is rejected", () => {
    for (const doughKind of ["pinsa", "", 7, null]) {
      expect(problems(input({ recipes: [creditedLate, { ...uncreditedLate, doughKind: doughKind as never }] }))).toContain("late recipe has an unknown doughKind: uncredited-late");
    }
  });

  it("a late ingredient still must be named by a late ladder step, with or without an uncredited recipe in the catalog", () => {
    expect(problems(input({ ladderSteps: [{ ingredientIds: ["arugula"], keyRecipeId: "credited-late" }] }))).toContain(
      "late ingredient is named by no late ladder step (unobtainable): late-herb",
    );
  });
});

describe("existing behaviour is unchanged for a catalog with no ladderCredit field", () => {
  it("the original single credited recipe is valid, and loses validity exactly as before", () => {
    const only = input({ recipes: [creditedLate], discoveryTargetIds: { "credited-late": "t" } });
    expect(problems(only)).toEqual([]);
    expect(problems({ ...only, ladderSteps: [] })).toEqual([
      "late recipe is the key of no late ladder step (unreachable): credited-late",
      "late ingredient is named by no late ladder step (unobtainable): late-herb",
    ]);
  });
});
