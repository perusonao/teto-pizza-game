import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { countsTowardLadder, participatesInLunchRush, RECIPES } from "../../data/recipes";
import { isCutEligible } from "../../data/cookingProfiles";
import { RECIPE_HINT_ROLES } from "../../data/recipeHintRoles";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../../state/dex";
import { researchEntryViews } from "../../state/discoveryHint";
import { recipeChapter, recipeKeyStep } from "../../state/recipeChapters";
import type { ScoreBreakdown } from "../scoring";

/**
 * Batch 8a (Owner-approved 2026-10-18): chilean-napolitana (key step 20, fresh-tomato), spanish-chorizo-pizza (28, bell-pepper) and frango-catupiry
 * (44, catupiry) are non-credit, zero-material branching Research entries. This pins every visible classification / label change they cause, and that
 * the 57 earlier recipes keep their ladder credit, chapter, key step, Lunch Rush and Hint declarations. Production data only; nothing is saved.
 */
const BATCH = ["chilean-napolitana", "spanish-chorizo-pizza", "frango-catupiry"] as const;
const SCORE: ScoreBreakdown = { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 };
const discover = (...ids: string[]): DexState => ids.reduce((dex, id) => registerScoreToDex(dex, id, SCORE).dex, EMPTY_DEX);
const ladderOwned = (step: number): string[] => [...STARTER_INGREDIENT_IDS, ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds)];
const keysBefore = (step: number): string[] => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
/** Every earlier non-credit recipe found, so only the cohort under test is open. */
const labelsAt = (step: number, found: readonly string[] = []): Record<string, string> =>
  Object.fromEntries(researchEntryViews({ dex: discover(...keysBefore(step), ...found), ownedIngredientIds: ladderOwned(step) }).map((v) => [v.recipeId, v.label]));
const EARLIER_NON_CREDIT = ["brazilian-calabresa", "aussie"];

describe("Batch 8a: classification of the three recipes", () => {
  it("are the tail (No.58-60), non-credit (frango-catupiry credited since #561), Lunch Rush opt-out, key-free, no CUT", () => {
    expect(RECIPES.slice(57, 60).map((r) => r.id)).toEqual([...BATCH]);
    for (const id of BATCH) {
      expect(countsTowardLadder(id), id).toBe(id === "frango-catupiry"); // #561: the one credited member
      expect(participatesInLunchRush(id), id).toBe(false);
      expect(isCutEligible(id), id).toBe(false);
      expect(RECIPE_HINT_ROLES[id], id).toEqual({ keyFree: true });
    }
  });

  it("add no ingredient and no ladder step (zero new materials)", () => {
    const stepIngredients = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds);
    for (const id of BATCH) {
      const recipe = RECIPES.find((r) => r.id === id)!;
      expect(DISCOVERY_LADDER.steps.some((s) => s.keyRecipeId === id), id).toBe(false);
      for (const q of recipe.requiredIngredients) {
        expect(STARTER_INGREDIENT_IDS.includes(q.ingredientId) || stepIngredients.includes(q.ingredientId), `${id} ${q.ingredientId}`).toBe(true);
      }
    }
  });

  it("key steps / chapters: chilean 20 / Ch.3, chorizo 28 / Ch.3, frango 44 / Ch.4", () => {
    const at = (id: string) => RECIPES.find((r) => r.id === id)!;
    expect([recipeKeyStep(at("chilean-napolitana")), recipeChapter(at("chilean-napolitana"))]).toEqual([20, 3]);
    expect([recipeKeyStep(at("spanish-chorizo-pizza")), recipeChapter(at("spanish-chorizo-pizza"))]).toEqual([28, 3]);
    expect([recipeKeyStep(at("frango-catupiry")), recipeChapter(at("frango-catupiry"))]).toEqual([44, 4]);
  });
});

describe("Batch 8a: the existing 57 recipes keep their progression declarations", () => {
  it("credit / Lunch Rush opt-out / ladder keys of the earlier recipes are unchanged (credited 56 -- Issue #561 promoted frango-catupiry --, non-credit only calabresa, aussie, chilean, chorizo)", () => {
    expect(RECIPES.filter((r) => !countsTowardLadder(r.id)).map((r) => r.id)).toEqual(["brazilian-calabresa", "aussie", ...BATCH.filter((id) => id !== "frango-catupiry")]);
    expect(RECIPES.filter((r) => countsTowardLadder(r.id))).toHaveLength(57); // 56 after Batch 8a; Batch 8b's shirasu-pizza is credited (+1)
    expect(RECIPES.filter((r) => participatesInLunchRush(r.id))).toHaveLength(25);
    expect(DISCOVERY_LADDER.steps).toHaveLength(54); // Batch 8a appended none (53); Batch 8b appended step 54
    expect(DISCOVERY_LADDER.steps.slice(0, 53).some((s) => (BATCH as readonly string[]).includes(s.keyRecipeId))).toBe(false);
    expect(RECIPES).toHaveLength(61); // 60 after Batch 8a; + Batch 8b's shirasu-pizza
  });
});

describe("Batch 8a: Research labels (anonymous; the letter only)", () => {
  it("step 20: chilean joins pesto-caprese's tomato cohort -> two entries A / B (before Batch 8a: one bare entry)", () => {
    const l = labelsAt(20, EARLIER_NON_CREDIT);
    expect(Object.keys(l).sort()).toEqual(["chilean-napolitana", "pesto-caprese"]);
    expect(Object.values(l).sort()).toEqual(["？？？ピザ A（トマト）", "？？？ピザ B（トマト）"]);
  });

  it("step 28: spanish-chorizo is its own bell-pepper cohort (bare label); the zucchini pair keeps A / B", () => {
    const l = labelsAt(28, [...EARLIER_NON_CREDIT, "chilean-napolitana"]);
    expect(l["spanish-chorizo-pizza"]).toBe("？？？ピザ（パプリカ）");
    expect(l["ratatouille-pizza"]).toBe("？？？ピザ A（ズッキーニ）");
    expect(l["pesto-vegetariana"]).toBe("？？？ピザ B（ズッキーニ）");
  });

  it("step 44: frango joins brazilian-catupiry-corn-pizza's cohort -> A / B", () => {
    const found = [...keysBefore(44), "ratatouille-pizza", ...EARLIER_NON_CREDIT, ...BATCH.filter((id) => id !== "frango-catupiry")]; // ratatouille: the credited step-28 sibling (not a ladder key)
    const l = Object.fromEntries(researchEntryViews({ dex: discover(...found), ownedIngredientIds: ladderOwned(44) }).map((v) => [v.recipeId, v.label]));
    expect(Object.keys(l).sort()).toEqual(["brazilian-catupiry-corn-pizza", "frango-catupiry"]);
    expect(Object.values(l).sort()).toEqual(["？？？ピザ A（カトゥピリ）", "？？？ピザ B（カトゥピリ）"]);
  });

  it("a sibling's discovery never moves the other letter (stable identity)", () => {
    const both = labelsAt(20, EARLIER_NON_CREDIT);
    expect(labelsAt(20, [...EARLIER_NON_CREDIT, "chilean-napolitana"])["pesto-caprese"]).toBe(both["pesto-caprese"]);
    const caprese = labelsAt(20, [...EARLIER_NON_CREDIT, "pesto-caprese"]);
    expect(caprese["chilean-napolitana"]).toBe(both["chilean-napolitana"]);
  });

  it("no label names a recipe, ingredient list or No.", () => {
    for (const label of Object.values({ ...labelsAt(20, EARLIER_NON_CREDIT), ...labelsAt(28, EARLIER_NON_CREDIT) })) {
      expect(label).toMatch(/^？？？ピザ( [A-Z]+)?（[^（）]+）$/);
      for (const r of RECIPES) expect(label).not.toContain(r.nameJa);
    }
  });
});
