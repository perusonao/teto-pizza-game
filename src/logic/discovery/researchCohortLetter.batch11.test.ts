import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { ordinaryLadderSteps, ordinaryRecipes } from "../catalog/testSupport/lateIds";
import { researchCohortLetters, researchEntryLabel } from "./researchEntry";

/**
 * B11 S1 (PROVISIONAL SPEC, original NOT confirmed): Research identifier compatibility, measured with the PRODUCTION `researchCohortLetters`.
 * Unlike Batch 10 (single-member cohorts only), boscaiola and the non-credit porcini-pizza share the unlock material porcini, so that pair is a NEW lettered cohort (porcini-pizza A, boscaiola B);
 * pescatore (mussel) is a single, unlettered cohort. No PRE-EXISTING recipe may change its letter, at any prefix or purchase order, and (INV-B7) every label carries only the unlock material and a letter.
 */
const NEW_RECIPES: readonly string[] = ["boscaiola", "porcini-pizza", "pescatore"];
const NEW_MATERIALS: readonly string[] = ["porcini", "mussel"];
const ORDINARY = ordinaryRecipes(RECIPES);
const BEFORE = ORDINARY.filter((r) => !NEW_RECIPES.includes(r.id));
const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

describe("Research cohort letters with the three B11 S1 recipes", () => {
  it("ladder order: every pre-existing recipe keeps its letter at every prefix; only the porcini pair is newly lettered (A / B), pescatore stays unlettered", () => {
    for (let n = 0; n <= ladderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, n)];
      const now = researchCohortLetters(owned, ORDINARY);
      const before = researchCohortLetters(
        owned.filter((m) => !NEW_MATERIALS.includes(m)),
        BEFORE,
      );
      const existing = new Map([...now].filter(([id]) => !NEW_RECIPES.includes(id)));
      expect([...existing].sort()).toEqual([...before].sort());
      expect(now.has("pescatore"), `pescatore at ${n}`).toBe(false);
      const porciniOwned = owned.includes("porcini");
      expect(now.has("boscaiola"), `boscaiola at ${n}`).toBe(porciniOwned);
      expect(now.has("porcini-pizza"), `porcini-pizza at ${n}`).toBe(porciniOwned);
      if (porciniOwned) expect([now.get("porcini-pizza"), now.get("boscaiola")].sort()).toEqual(["A", "B"]);
    }
  });

  it("random purchase orders: a letter, once given, never changes", () => {
    const random = rng(20261028);
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
      expect(label.replace(getIngredient(unlock)!.nameJa, "")).not.toContain(recipe.nameJa);
      expect(label.replace(getIngredient(unlock)!.nameJa, "")).not.toContain(recipe.id);
    }
  });

  it("the unlock materials: boscaiola and porcini-pizza on porcini, pescatore on mussel (the last material of each step, the cohort key)", () => {
    const keyOf = (id: string) => DISCOVERY_LADDER.steps.find((s) => s.keyRecipeId === id)!.ingredientIds.at(-1);
    expect(["boscaiola", "pescatore"].map(keyOf)).toEqual(["porcini", "mussel"]);
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    const letters = researchCohortLetters(owned, ORDINARY);
    expect(researchEntryLabel({ unlockIngredientId: "porcini", cohortLetter: letters.get("porcini-pizza") ?? null })).toBe("？？？ピザ A（ポルチーニ）");
    expect(researchEntryLabel({ unlockIngredientId: "porcini", cohortLetter: letters.get("boscaiola") ?? null })).toBe("？？？ピザ B（ポルチーニ）");
    expect(researchEntryLabel({ unlockIngredientId: "mussel", cohortLetter: letters.get("pescatore") ?? null })).toBe("？？？ピザ（ムール貝）");
  });
});
