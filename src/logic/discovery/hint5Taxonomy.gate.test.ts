import { describe, expect, it } from "vitest";
import matrix172 from "../../../docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json";
import { HINT_CLASS_DISPLAY } from "../../data/hintClassDisplay";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { ATTRIBUTE_FAMILIES, ingredientAttributeFamily, TAXONOMY_INGREDIENT_IDS } from "../../data/ingredientTaxonomy";
import { RECIPE_HINT_ROLES, type RecipeHintRoles } from "../../data/recipeHintRoles";
import { RECIPES, type Recipe } from "../../data/recipes";
import { buildHint5Ladder, hint5RolesValid, requestHint5Rung, subToppingClass } from "./hint5Ladder";
import { authoredRoles, KEYED_RECIPES } from "../testSupport/hintRoles";

/**
 * Discovery Hint 5.0 (Issue #292), H5-1: the data / taxonomy gates of the Final Design
 * (docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md §11, §13). OD-H5-T-COV: every
 * hint-eligible topping resolves to exactly one valid family, and a missing classification is never
 * silently coarsened. The invariant names are PR #293's (INV-T1..T7).
 */

const distinct = (r: Recipe) => [...new Set(r.requiredIngredients.map((x) => x.ingredientId))];
const toppingsOf = (r: Recipe) => distinct(r).filter((id) => getIngredient(id)?.category === "topping");

/** OD-H5-C1a / C1b / C1-P: the approved key toppings for the 25 runtime recipes (Final Design §6.1). */
const APPROVED_KEY_TOPPINGS: Record<string, string | null> = {
  margherita: "basil",
  marinara: "garlic",
  "quattro-formaggi": null,
  genovese: "cherry-tomato",
  bismarck: "egg",
  funghi: "mushroom",
  fugazza: "onion",
  salsiccia: "sausage",
  pepperoni: "pepperoni",
  napoletana: "anchovy",
  "tonno-e-cipolla": "tuna",
  "pizza-bianca": "rosemary",
  "breakfast-pizza": "bacon",
  capricciosa: "mushroom",
  "meat-lovers": "ham",
  "melanzane-pizza": "eggplant",
  "parmigiana-pizza": "eggplant",
  bambino: "corn",
  hawaiian: "pineapple",
  "pizza-portuguesa": "ham",
  "pesto-tonno": "tuna",
  "new-haven-apizza": "clam",
  "pesto-caprese": "fresh-tomato",
  "pesto-patate": "potato",
  "puttanesca-pizza": "anchovy",
};

describe("Hint 5.0 authority data (OD-H5-C1 / C1a / C1b)", () => {
  it("RECIPE_HINT_ROLES covers all 27 production recipes: the 25 keyed ones with the Owner-approved key toppings, calabresa and No.27 pesto-pollo key-free", () => {
    expect(Object.keys(RECIPE_HINT_ROLES).sort()).toEqual(RECIPES.map((r) => r.id).sort());
    expect(RECIPES).toHaveLength(27);
    expect(KEYED_RECIPES).toHaveLength(25);
    expect(KEYED_RECIPES.map((r) => r.id)).not.toContain("brazilian-calabresa");
    expect(KEYED_RECIPES.map((r) => r.id)).not.toContain("pesto-pollo");
    for (const r of KEYED_RECIPES) expect(authoredRoles(r.id).hintKeyToppingId, r.id).toBe(APPROVED_KEY_TOPPINGS[r.id]);
  });

  it("G17: the key is a topping of the recipe (null only without toppings); the sub order is exactly the other toppings, once each", () => {
    for (const r of KEYED_RECIPES) {
      const roles = authoredRoles(r.id);
      const toppings = toppingsOf(r);
      if (roles.hintKeyToppingId === null) expect(toppings, r.id).toEqual([]);
      else expect(toppings, r.id).toContain(roles.hintKeyToppingId);
      expect([...roles.hintSubToppingOrder].sort(), r.id).toEqual(toppings.filter((t) => t !== roles.hintKeyToppingId).sort());
      expect(new Set(roles.hintSubToppingOrder).size, r.id).toBe(roles.hintSubToppingOrder.length);
      expect(hint5RolesValid(r, roles), r.id).toBe(true);
    }
  });

  it("C1-P: no key topping duplicates sauce / cheese information (every key is a topping, never a sauce or cheese)", () => {
    for (const r of KEYED_RECIPES) {
      const key = authoredRoles(r.id).hintKeyToppingId;
      if (key !== null) expect(getIngredient(key)?.category, r.id).toBe("topping");
    }
  });

  it("the order authority is the authored field, not requiredIngredients order: reordering a recipe's ingredients changes nothing", () => {
    for (const r of RECIPES) {
      const reversed: Recipe = { ...r, requiredIngredients: [...r.requiredIngredients].reverse() };
      const a = buildHint5Ladder(r.id)!;
      const b = buildHint5Ladder(r.id, [reversed])!;
      expect(b.rungs, r.id).toEqual(a.rungs);
    }
  });

  it("G17 negative: inconsistent roles make the recipe not a target (fail closed)", () => {
    const hawaiian = RECIPES.find((r) => r.id === "hawaiian")!;
    const bad: RecipeHintRoles[] = [
      { hintKeyToppingId: "mozzarella", hintSubToppingOrder: ["ham", "pineapple"] }, // a cheese as key
      { hintKeyToppingId: "tuna", hintSubToppingOrder: ["ham"] }, // not in the recipe
      { hintKeyToppingId: "pineapple", hintSubToppingOrder: [] }, // a missing sub
      { hintKeyToppingId: "pineapple", hintSubToppingOrder: ["ham", "ham"] }, // a duplicate
      { hintKeyToppingId: "pineapple", hintSubToppingOrder: ["ham", "tomato-sauce"] }, // a sauce as sub
      { hintKeyToppingId: null, hintSubToppingOrder: ["ham", "pineapple"] }, // null key with toppings
    ];
    for (const roles of bad) {
      expect(hint5RolesValid(hawaiian, roles)).toBe(false);
      expect(buildHint5Ladder("hawaiian", RECIPES, { hawaiian: roles })).toBeNull();
    }
    expect(buildHint5Ladder("hawaiian", RECIPES, {})).toBeNull();
  });
});

describe("Hint 5.0 taxonomy gates (OD-H5-T-COV, H5-INV-7)", () => {
  it("G1 / INV-T1: every runtime topping resolves to exactly one valid family", () => {
    const families = new Set(ATTRIBUTE_FAMILIES.map((f) => f.id));
    const missing = INGREDIENTS.filter((i) => i.category === "topping" && subToppingClass(i.id) === null).map((i) => i.id);
    expect(missing, "a topping without a family row cannot ship (add its row after the HCG, OD-TAX-7)").toEqual([]);
    for (const i of INGREDIENTS.filter((x) => x.category === "topping")) expect(families.has(subToppingClass(i.id)!), i.id).toBe(true);
  });

  it("G24 / INV-T2: the family rows are unique, every row is a catalog ingredient, and every row is a topping", () => {
    expect(new Set(TAXONOMY_INGREDIENT_IDS).size).toBe(TAXONOMY_INGREDIENT_IDS.length);
    for (const id of TAXONOMY_INGREDIENT_IDS) {
      expect(getIngredient(id), id).toBeDefined();
      expect(getIngredient(id)!.category, id).toBe("topping");
    }
    expect(TAXONOMY_INGREDIENT_IDS.length).toBe(INGREDIENTS.filter((i) => i.category === "topping").length);
  });

  it("G22 / INV-T3 (G-REC-1): every ingredient id of every production recipe exists in INGREDIENTS", () => {
    const unknown = RECIPES.flatMap((r) => r.requiredIngredients.filter((q) => !getIngredient(q.ingredientId)).map((q) => `${r.id}:${q.ingredientId}`));
    expect(unknown).toEqual([]);
  });

  it("G2: every sub-topping of every production recipe resolves to its one family, and every recipe is a Hint 5.0 target", () => {
    for (const r of RECIPES) {
      expect(buildHint5Ladder(r.id), r.id).not.toBeNull();
      const subs = buildHint5Ladder(r.id)!.rungs.filter((x) => x.kind === "SUB_CLASS").map((x) => x.subjectIds[0]);
      for (const id of subs) expect(subToppingClass(id), `${r.id}:${id}`).toBe(ingredientAttributeFamily(id));
    }
  });

  it("G23 / INV-T6: a missing classification is NOT_A_TARGET (0 Pitz, no fact), never existence / group / category", () => {
    for (const id of ["future-truffle", "__proto__", "constructor", "", "tomato-sauce", "mozzarella", null, 42, ["ham"]]) expect(subToppingClass(id)).toBeNull();
    // A synthetic recipe whose sub-topping has no family row: not a target, whatever is asked.
    const fixture: Recipe = { ...RECIPES.find((r) => r.id === "hawaiian")!, id: "future-pizza" as never, requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 1 },
      { ingredientId: "ham", minCount: 1 },
      { ingredientId: "future-truffle", minCount: 1 },
    ] };
    const roles = { "future-pizza": { hintKeyToppingId: "ham", hintSubToppingOrder: ["future-truffle"] } };
    expect(buildHint5Ladder("future-pizza", [fixture], roles)).toBeNull();
    for (const expectedRungIndex of [1, 5]) {
      const r = requestHint5Rung({ recipeId: "future-pizza", discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, expectedRungIndex, pitzBalance: 999 }, [fixture]);
      expect(r).toEqual({ outcome: "REJECTED", reason: "NOT_A_TARGET" });
      expect(JSON.stringify(r)).not.toMatch(/existence|group|category|attr:/);
    }
  });

  it("G18 / H5-INV-2: no classification emoji equals any ingredient emoji, and no label contains an ingredient name or id", () => {
    expect(Object.keys(HINT_CLASS_DISPLAY).sort()).toEqual(ATTRIBUTE_FAMILIES.map((f) => f.id).sort());
    const glyphs = new Set(INGREDIENTS.map((i) => i.emoji));
    const emojis = Object.values(HINT_CLASS_DISPLAY).map((d) => d.symbol);
    expect(new Set(emojis).size).toBe(emojis.length);
    for (const d of Object.values(HINT_CLASS_DISPLAY)) {
      expect(glyphs.has(d.symbol), d.symbol).toBe(false);
      for (const i of INGREDIENTS) {
        expect(d.labelJa.includes(i.nameJa), `${d.labelJa} / ${i.nameJa}`).toBe(false);
        expect(d.labelJa.includes(i.id), `${d.labelJa} / ${i.id}`).toBe(false);
      }
      expect(d.labelJa).not.toBe("その他"); // OD-TAX-8
    }
  });

  it("G16: the 172-recipe matrix cannot ship an unclassified topping: rows with a non-catalog id fail closed, never guessed", () => {
    const matrix = matrix172 as unknown as {
      rows: { evidenceId: string; ingredients: { complete: boolean; identityIngredientSet: string[] } }[];
    };
    let targets = 0;
    let failedClosed = 0;
    for (const row of matrix.rows.filter((x) => x.ingredients.complete)) {
      const ids = row.ingredients.identityIngredientSet;
      const fixture = { ...RECIPES[0], id: row.evidenceId, requiredIngredients: ids.map((ingredientId) => ({ ingredientId, minCount: 1 })) } as unknown as Recipe;
      const toppings = ids.filter((id) => getIngredient(id)?.category === "topping");
      const roles = { [row.evidenceId]: { hintKeyToppingId: toppings[0] ?? null, hintSubToppingOrder: toppings.slice(1) } };
      const ladder = buildHint5Ladder(row.evidenceId, [fixture], roles);
      const allCatalog = ids.every((id) => getIngredient(id));
      if (ladder) {
        targets += 1;
        expect(allCatalog, row.evidenceId).toBe(true);
        for (const rung of ladder.rungs.filter((x) => x.kind === "SUB_CLASS")) expect(subToppingClass(rung.subjectIds[0]), row.evidenceId).not.toBeNull();
      } else {
        failedClosed += 1;
        expect(allCatalog, `${row.evidenceId} is all-catalog but was refused`).toBe(false);
      }
    }
    expect(targets + failedClosed).toBe(120);
    expect(targets).toBeGreaterThan(0);
    expect(failedClosed).toBeGreaterThan(0);
  });
});
