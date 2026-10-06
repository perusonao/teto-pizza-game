import { describe, expect, it } from "vitest";
import { getIngredient, INGREDIENTS } from "./ingredients";
import { getCookingProfile, isCutEligible } from "./cookingProfiles";
import { DISCOVERY_LADDER, W1_25_DISCOVERY_LADDER } from "./discoveryLadder";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { findOrderForRecipe } from "./orders";
import { getPlayerReferencePizza } from "./playerReference";
import { getReferencePizza } from "./referencePizza";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { countsTowardLadder, getRecipe, participatesInLunchRush, RECIPES, type Recipe } from "./recipes";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { buildHint5Ladder, isKeyFreeHintRoles } from "../logic/discovery/hint5Ladder";
import { createDefaultSave } from "../state/persistence";

/**
 * Discovery 3.0 PR-4b-B: authoring pins for the 26th production recipe, `brazilian-calabresa`.
 * Counts / bake window are Owner-approved GAMEPLAY CALIBRATION (D-6), not source authority.
 */
const ID = "brazilian-calabresa";
const recipe = getRecipe(ID as Recipe["id"])!;
const nonSauce = recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)!.category !== "sauce");

describe("brazilian-calabresa authoring (PR-4b-B)", () => {
  it("is production recipe No.26, right after the existing 25 (their order / No. unchanged; No.27 pesto-pollo and Expansion's pesto-gamberi follow)", () => {
    expect(RECIPES).toHaveLength(33);
    expect(RECIPES[25].id).toBe(ID);
    expect(RECIPES.slice(0, 25).filter((r) => r.id === ID)).toEqual([]);
    expect(recipe.nameJa).toBe("ブラジリアン・カラブレーザ");
    expect(RECIPES.map((r) => r.id)).not.toContain("calabrese"); // distinct from the master-catalog `calabrese`
  });

  it("uses the Owner-approved counts and bake window (D-6 calibration)", () => {
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "sausage", minCount: 3 },
      { ingredientId: "onion", minCount: 2 },
      { ingredientId: "black-olive", minCount: 2 },
      { ingredientId: "oregano", minCount: 1 },
    ]);
    expect(nonSauce.reduce((n, q) => n + q.minCount, 0)).toBe(8);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.baseRewardPitz).toBe(100);
  });

  it("has no cheese, and only existing ingredients (no new ingredient; olive is the black-olive alias)", () => {
    for (const q of recipe.requiredIngredients) {
      expect(getIngredient(q.ingredientId), q.ingredientId).toBeDefined();
      expect(getIngredient(q.ingredientId)!.category, q.ingredientId).not.toBe("cheese");
    }
    expect(recipe.requiredIngredients.map((q) => q.ingredientId)).toContain("black-olive");
    expect(INGREDIENTS).toHaveLength(35); // + Expansion Wave 2's 3 materials; + No.27's chicken and Expansion Slice 1's shrimp; calabresa itself still adds none
  });

  it("is non-credit and out of Lunch Rush; the other 25 originals are unchanged on both", () => {
    expect(recipe.ladderCredit).toBe(false);
    expect(recipe.lunchRush).toBe(false);
    expect(countsTowardLadder(ID)).toBe(false);
    expect(participatesInLunchRush(ID)).toBe(false);
    const others = RECIPES.slice(0, 25) as readonly Recipe[];
    expect(others).toHaveLength(25);
    for (const r of others) {
      expect(r.ladderCredit, r.id).toBeUndefined();
      expect(r.lunchRush, r.id).toBeUndefined();
    }
  });

  it("does not move the ladder: the 24 frozen steps are untouched (No.27 appends step 25, Expansion Slice 1 step 26), calabresa is nobody's key recipe", () => {
    expect(DISCOVERY_LADDER.steps.slice(0, 24)).toEqual(W1_25_DISCOVERY_LADDER.steps);
    expect(DISCOVERY_LADDER.steps).toHaveLength(29); // + Expansion Wave 2 steps 27 / 28
    expect(DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)).not.toContain(ID);
  });

  it("every production table has its row: sauce profile, ORDERS entry, discovery target, Reference", () => {
    expect(getRecipeSauceProfile(ID as Recipe["id"])).toMatchObject({ ingredientId: "tomato-sauce", interaction: "PAINT" });
    expect(findOrderForRecipe(ID as Recipe["id"])?.id).toBe("order-brazilian-calabresa");
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.items).toEqual(["black-olive", "onion", "oregano", "sausage", "tomato-sauce"]);
    expect(target.sauceBase).toEqual(["tomato-sauce"]);
    expect(getReferencePizza(ID)?.recipeId).toBe(ID);
  });

  it("has no CUT / thin-crust mechanic: not CUT-eligible, the profile has no POST_BAKE step (D-5)", () => {
    expect(isCutEligible(ID as Recipe["id"])).toBe(false);
    expect(getCookingProfile(ID as Recipe["id"]).steps).not.toContain("CUT");
  });

  it("keeps the save schema at v2", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
  });
});

describe("brazilian-calabresa Reference placement (Human Review candidate, getReferenceSlots(8))", () => {
  const reference = getReferencePizza(ID)!;

  it("takes the 8-piece ring consecutively in requiredIngredients order, equal to the player's reference", () => {
    const slots = getReferenceSlots(8);
    const flat = reference.pieceGroups.flatMap((g) => g.positions);
    expect(reference.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([
      ["sausage", 3],
      ["onion", 2],
      ["black-olive", 2],
      ["oregano", 1],
    ]);
    expect(flat).toEqual(slots);
    const player = getPlayerReferencePizza(recipe);
    expect(player.pieceGroups.map((g) => [g.ingredientId, g.positions])).toEqual(
      reference.pieceGroups.map((g) => [g.ingredientId, g.positions]),
    );
  });

  it("uses the shared tolerance (8 / 22) and the oregano leaf landing, like marinara / fugazza", () => {
    for (const g of reference.pieceGroups) {
      expect(g.matching).toEqual({ fullCreditRadius: 8, zeroCreditRadius: 22 });
      expect(g.interaction.landingStyle).toBe(g.ingredientId === "oregano" ? "LIGHT_LEAF" : "HEAVY_SQUASH");
    }
  });
});

describe("brazilian-calabresa Hint: key-free, structure-derived rungs only", () => {
  it("is key-free in the roles table (the 25 originals keep their keyed roles)", () => {
    expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES[ID as Recipe["id"]])).toBe(true);
    expect(RECIPE_HINT_ROLES[ID as Recipe["id"]]).toEqual({ keyFree: true });
    expect(Object.values(RECIPE_HINT_ROLES).filter(isKeyFreeHintRoles)).toHaveLength(8); // calabresa + No.27 pesto-pollo + Expansion pesto-gamberi + Wave 2's 3 + TQ-1D's aussie
  });

  it("has SAUCE, STRUCTURE, then one SUB_CLASS per topping: no KEY_TOPPING, no CHEESE, no empty rung", () => {
    const rungs = buildHint5Ladder(ID)!.rungs;
    expect(rungs.map((r) => r.kind)).toEqual(["SAUCE", "STRUCTURE", "SUB_CLASS", "SUB_CLASS", "SUB_CLASS", "SUB_CLASS"]);
    expect(rungs.map((r) => r.kind)).not.toContain("KEY_TOPPING");
    expect(rungs.map((r) => r.kind)).not.toContain("CHEESE");
    expect(rungs[0].subjectIds).toEqual(["tomato-sauce"]);
    expect(rungs.filter((r) => r.kind === "SUB_CLASS").map((r) => r.subjectIds[0]).sort()).toEqual(
      ["black-olive", "onion", "oregano", "sausage"],
    );
    for (const r of rungs) if (r.kind !== "STRUCTURE") expect(r.subjectIds.length).toBeGreaterThan(0);
  });
});
