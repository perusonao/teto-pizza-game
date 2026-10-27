import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { ordinaryLadderSteps, ordinaryRecipes } from "../catalog/testSupport/lateIds";
import { researchCohortLetters, researchEntryLabel } from "./researchEntry";

/**
 * Expansion Batch 10 PR-1 (docs/decisions/TETO_EXPANSION-BATCH-10_PR1_OWNER-DECISIONS.md; B10 audit §2.2): Research identifier compatibility, measured with the PRODUCTION `researchCohortLetters`.
 * The five new recipes must not letter anything in the ladder order, change no existing recipe's letter, and (INV-B7) every label across every cohort carries only the unlock material and a letter.
 */
const NEW_RECIPES: readonly string[] = ["curry-pizza-japan", "rendang-pizza", "tandoori-paneer-pizza", "currywurst", "cuban-pizza"];
const NEW_MATERIALS: readonly string[] = ["curry-ketchup", "beef", "paneer", "paprika-powder", "wurstel", "mustard", "pickles", "swiss-cheese"];
const ORDINARY = ordinaryRecipes(RECIPES);
const BEFORE = ORDINARY.filter((r) => !NEW_RECIPES.includes(r.id));
const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

describe("Research cohort letters with the five Batch 10 PR-1 recipes", () => {
  it("ladder order: no new lettered cohort, every new recipe is unlettered, and every existing recipe keeps its letter at every prefix", () => {
    for (let n = 0; n <= ladderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, n)];
      const now = researchCohortLetters(owned, ORDINARY);
      const before = researchCohortLetters(
        owned.filter((m) => !NEW_MATERIALS.includes(m)),
        BEFORE,
      );
      for (const id of NEW_RECIPES) expect(now.has(id), `${id} at ${n}`).toBe(false);
      expect([...now].sort()).toEqual([...before].sort());
    }
  });

  it("random purchase orders: a letter, once given, never changes (and the new recipes join no existing cohort silently)", () => {
    const random = rng(20261027);
    const materials = [...ladderMaterials];
    for (let o = 0; o < 40; o += 1) {
      const perm = [...materials];
      for (let i = perm.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      const seen = new Map<string, string>();
      for (let n = 0; n <= perm.length; n += 1) {
        const letters = researchCohortLetters([...STARTER_INGREDIENT_IDS, ...perm.slice(0, n)], ORDINARY);
        for (const [id, letter] of letters) {
          const prev = seen.get(id);
          if (prev !== undefined) expect(letter, `${id} order ${o} prefix ${n}`).toBe(prev);
          seen.set(id, letter);
        }
      }
    }
  });

  it("INV-B7: every label over every cohort is the unlock material and a letter only (no recipe name / id / count)", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    const letters = researchCohortLetters(owned, ORDINARY);
    for (const recipe of ORDINARY) {
      const finite = recipe.requiredIngredients.map((q) => q.ingredientId).filter((id) => getIngredient(id)?.unlockCondition);
      if (finite.length === 0) continue;
      const unlock = finite.reduce((a, b) => (owned.indexOf(b) > owned.indexOf(a) ? b : a));
      const label = researchEntryLabel({ unlockIngredientId: unlock, cohortLetter: letters.get(recipe.id) ?? null });
      const rest = label.replace("？？？ピザ", "").replace(getIngredient(unlock)!.nameJa, "").replace(/[（）()\s]/g, "");
      expect(rest, `${recipe.id}: ${label}`).toMatch(/^[A-Z]*$/);
      expect(label.replace(getIngredient(unlock)!.nameJa, "")).not.toContain(recipe.nameJa); // (a recipe may share its name with its unlock material, e.g. pepperoni)
      expect(label.replace(getIngredient(unlock)!.nameJa, "")).not.toContain(recipe.id);
    }
  });

  it("the new recipes' own unlock materials are the last material of their step (the Research cohort key)", () => {
    const keyOf = (id: string) => DISCOVERY_LADDER.steps.find((s) => s.keyRecipeId === id)!.ingredientIds.at(-1);
    expect(NEW_RECIPES.map(keyOf)).toEqual(["curry-ketchup", "beef", "paneer", "wurstel", "swiss-cheese"]);
  });
});
