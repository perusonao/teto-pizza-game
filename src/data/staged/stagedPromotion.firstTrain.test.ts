import { describe, expect, it, vi } from "vitest";

/**
 * First-train dossier (Issue #780, Owner D-7 2026-11-08): taco-pizza + okonomiyaki-style-pizza in their promotion shape
 * (stagedPromotionCandidates.ts), checked with the REAL production authorities on "shipped + these two only" (module mocks; no shipped file
 * changes): late-catalog structure, ingredient references, quantities, icons (G18), cooking steps, duplicate gate, Research letters
 * (canonical = stop condition, non-canonical = per-ID approval), Hint 5.0, and save safety (a promoted id survives a load; an existing save
 * loads unchanged).
 */
vi.mock("../ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ingredients")>();
  const { CANDIDATE_INGREDIENTS } = await import("./stagedPromotionCandidates");
  const all = [...actual.INGREDIENTS, ...CANDIDATE_INGREDIENTS] as typeof actual.INGREDIENTS;
  return { ...actual, INGREDIENTS: all, getIngredient: (id: string) => all.find((i) => i.id === id) };
});
vi.mock("../ingredientTaxonomy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ingredientTaxonomy")>();
  const { CANDIDATE_TAXONOMY_ROWS } = await import("./stagedPromotionCandidates");
  const extra = new Map<string, string>(CANDIDATE_TAXONOMY_ROWS as unknown as [string, string][]);
  return { ...actual, ingredientAttributeFamily: (id: unknown) => actual.ingredientAttributeFamily(id) ?? (typeof id === "string" ? (extra.get(id) ?? null) : null) };
});
vi.mock("../recipes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../recipes")>();
  const { CANDIDATE_RECIPES } = await import("./stagedPromotionCandidates");
  return { ...actual, RECIPES: [...actual.RECIPES, ...CANDIDATE_RECIPES] as unknown as typeof actual.RECIPES };
});

import { researchCohortLetters } from "../../logic/discovery/researchEntry";
import { buildHint5Ladder } from "../../logic/discovery/hint5Ladder";
import { researchLetterChangesAcrossOrders } from "../../logic/catalog/testSupport/researchLabelAudit";
import { createDefaultSave, loadSave, SAVE_STORAGE_KEY, type StorageLike } from "../../state/persistence";
import { DISCOVERY_LADDER } from "../discoveryLadder";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../ingredients";
import { LATE_DISCOVERY_TARGET_IDS, LATE_INGREDIENTS, LATE_LADDER_STEPS, LATE_RECIPES, validateLateCatalog } from "../lateCatalog";
import { RECIPES } from "../recipes";
import { stagedDuplicateGate } from "./stagedCatalog";
import {
  CANDIDATE_DISCOVERY_TARGET_IDS,
  CANDIDATE_HINT_ROLES,
  CANDIDATE_INGREDIENTS,
  CANDIDATE_LADDER_STEPS,
  CANDIDATE_RECIPES,
  CANDIDATE_TAXONOMY_ROWS,
  CANDIDATE_TOPPING_SIZE_CLASS,
} from "./stagedPromotionCandidates";
import type { StagedRecipe } from "./stagedTypes";

const NEW_IDS = CANDIDATE_RECIPES.map((r) => r.id);
const SHIPPED = RECIPES.filter((r) => !NEW_IDS.includes(r.id));
const NEW_ING = CANDIDATE_INGREDIENTS.map((i) => i.id);
const SHIPPED_ING = INGREDIENTS.filter((i) => !NEW_ING.includes(i.id));

describe("First train dossier: taco-pizza + okonomiyaki-style-pizza (D-7)", () => {
  it("the mocks are in effect and touch nothing else", () => {
    expect(RECIPES.length - SHIPPED.length).toBe(2);
    expect(INGREDIENTS.length - SHIPPED_ING.length).toBe(6);
  });

  it("is a valid LATE catalog entry together with the shipped late catalog (real validateLateCatalog)", () => {
    const lateIds = new Set(LATE_RECIPES.map((r) => r.id as string));
    const lateIng = new Set(LATE_INGREDIENTS.map((i) => i.id));
    const problems = validateLateCatalog(
      { recipeIds: SHIPPED.map((r) => r.id as string).filter((id) => !lateIds.has(id)), ingredientIds: SHIPPED_ING.map((i) => i.id).filter((id) => !lateIng.has(id)) },
      {
        recipes: [...LATE_RECIPES, ...CANDIDATE_RECIPES] as never,
        ingredients: [...LATE_INGREDIENTS, ...CANDIDATE_INGREDIENTS] as never,
        ladderSteps: [...LATE_LADDER_STEPS, ...CANDIDATE_LADDER_STEPS] as never,
        discoveryTargetIds: { ...LATE_DISCOVERY_TARGET_IDS, ...CANDIDATE_DISCOVERY_TARGET_IDS },
      },
    );
    expect(problems).toEqual([]);
  });

  it("every ingredient exists; POST_BAKE only on toppings; quantities within the shipped range; each new material is used", () => {
    const shippedCounts = SHIPPED.flatMap((r) => r.requiredIngredients.map((q) => q.minCount));
    const [lo, hi] = [Math.min(...shippedCounts), Math.max(...shippedCounts)];
    for (const r of CANDIDATE_RECIPES) {
      for (const q of r.requiredIngredients) {
        const ing = INGREDIENTS.find((i) => i.id === q.ingredientId);
        expect(ing, `${r.id}/${q.ingredientId}`).toBeDefined();
        if (q.applicationPhase === "POST_BAKE") expect(ing!.category, q.ingredientId).toBe("topping");
        expect(q.minCount).toBeGreaterThanOrEqual(lo);
        expect(q.minCount).toBeLessThanOrEqual(hi);
      }
      expect(r.requiredIngredients.filter((q) => INGREDIENTS.find((i) => i.id === q.ingredientId)!.category === "sauce")).toHaveLength(1);
    }
    for (const id of NEW_ING) expect(CANDIDATE_RECIPES.some((r) => r.requiredIngredients.some((q) => q.ingredientId === id)), id).toBe(true);
    for (const [id] of CANDIDATE_TAXONOMY_ROWS) expect(INGREDIENTS.find((i) => i.id === id)!.category).toBe("topping");
    expect(Object.keys(CANDIDATE_TOPPING_SIZE_CLASS).sort()).toEqual(CANDIDATE_TAXONOMY_ROWS.map(([id]) => id).sort());
  });

  it("icons: every new text fallback is unique across the catalog (G18); no dedicated SVG yet (emoji fallback, #417 lane)", () => {
    for (const c of CANDIDATE_INGREDIENTS) expect(INGREDIENTS.filter((i) => i.emoji === c.emoji).map((i) => i.id), c.id).toEqual([c.id]);
  });

  it("duplicate gate: no identical / subset / superset / one-ingredient-diff / Jaccard>0.4 hit against the shipped catalog or each other", () => {
    const asStaged = CANDIDATE_RECIPES.map((r) => ({ ...r, requiredIngredients: r.requiredIngredients }) as unknown as StagedRecipe);
    const hits = stagedDuplicateGate({ recipes: SHIPPED, ingredientIds: SHIPPED_ING.map((i) => i.id) }, asStaged);
    expect(hits).toEqual({ "taco-pizza": [], "okonomiyaki-style-pizza": [] });
  });

  it("Research: no shipped letter changes in the canonical order (ladder + the two new late steps); non-canonical changes recorded", async () => {
    const ladder = [...DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]), ...CANDIDATE_LADDER_STEPS.flatMap((s) => s.ingredientIds)];
    const canonical: string[] = [];
    for (let k = 0; k <= ladder.length; k += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...ladder.slice(0, k)];
      const before = researchCohortLetters(owned, SHIPPED);
      const after = researchCohortLetters(owned, RECIPES);
      for (const r of SHIPPED) if (before.get(r.id) !== after.get(r.id)) canonical.push(`${r.id}@${k}: ${before.get(r.id) ?? "-"}->${after.get(r.id) ?? "-"}`);
    }
    expect(canonical).toEqual([]);
    const nonCanonical = [...researchLetterChangesAcrossOrders(NEW_IDS, RECIPES as never, 10).entries()].map(([id, l]) => `${id}: ${[...new Set(l.map((c) => c.change))].join(" ")}`).sort();
    await expect(JSON.stringify({ canonicalChanges: canonical.length, nonCanonicalChanges: nonCanonical }, null, 1) + "\n").toMatchFileSnapshot("./__golden__/firstTrain.research.json");
  }, 300_000);

  it("Hint 5.0: both are key-free targets with a SAUCE / CHEESE / STRUCTURE / SUB_CLASS ladder; shipped ladders unaffected", () => {
    const shapes = Object.fromEntries(NEW_IDS.map((id) => [id, buildHint5Ladder(id, RECIPES, CANDIDATE_HINT_ROLES as never)?.rungs.map((r) => r.kind).join(",") ?? null]));
    expect(shapes).toEqual({
      "taco-pizza": "SAUCE,CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS,SUB_CLASS",
      "okonomiyaki-style-pizza": "SAUCE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS,SUB_CLASS,SUB_CLASS",
    });
  });

  it("save safety: after promotion a Dex entry / owned material / stock of the new ids survives a load, and an existing save loads unchanged", () => {
    const mem = (raw: string): StorageLike & { writes: number } => {
      const data: Record<string, string> = { [SAVE_STORAGE_KEY]: raw };
      const s = { writes: 0, getItem: (k: string) => data[k] ?? null, setItem: () => { s.writes += 1; }, removeItem: () => { s.writes += 1; } };
      return s;
    };
    const base = createDefaultSave();
    const existing = { ...base, pitzBalance: 500, dex: [{ recipeId: "margherita", discovered: true, bestScore: 80, bestStars: 3, timesMade: 2 }] };
    const loadedExisting = loadSave(mem(JSON.stringify(existing)));
    expect(loadedExisting.dex).toEqual(existing.dex);
    expect(loadedExisting.pitzBalance).toBe(500);
    const promoted = {
      ...existing,
      dex: [...existing.dex, { recipeId: "taco-pizza", discovered: true, bestScore: 90, bestStars: 3, timesMade: 1 }],
      ownedIngredientIds: [...base.ownedIngredientIds, "lettuce", "bonito-flakes"],
      inventory: { ...base.inventory, lettuce: 2 },
    };
    const s = mem(JSON.stringify(promoted));
    const loaded = loadSave(s);
    expect(loaded.dex.map((d) => d.recipeId)).toEqual(["margherita", "taco-pizza"]);
    expect(loaded.ownedIngredientIds).toEqual(expect.arrayContaining(["lettuce", "bonito-flakes"]));
    expect(loaded.inventory.lettuce).toBe(2);
    expect(s.writes).toBe(0);
  });
});
