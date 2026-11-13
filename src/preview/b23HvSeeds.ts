/**
 * Expansion Batch 23 (Issue #780): iPhone Safari Human Verification seeds. PREVIEW ONLY (same pattern as ./b18HvSeeds.ts and ./b21HvSeeds.ts).
 *
 * `?hv=b23-<recipe>` writes ONE ready-made save per target recipe (apple-cinnamon): every ladder material
 * is owned EXCEPT the materials of the target's own step (the target's new materials), and every recipe those materials can make is discovered, EXCEPT the target
 * (so the credited count is past every B23 entitlement floor and the load-time entitlement grants the target's new materials: the Shop offers them as NEW).
 * Unlike B21 the B23 materials are not one ladder suffix (the ordinary step 74), so the owned set is "all ladder materials minus
 * the target step's", not a prefix. Saves are internally consistent (a discovered recipe has every finite material owned, the target is never discovered, owned
 * materials are stocked, no labels are stored). The seed goes through the ordinary `resetSave` / `persistProgress` / `loadSave`, so it lands in the Preview key
 * only and never touches a production save or Firebase. ./hvSeeds.ts calls `applyB23HvSeed` only for a fresh navigation (never a reload), behind
 * `VITE_PREVIEW_MODE`; a production build drops this module (./previewIsolation.gate.test.ts scans for every id and label below). No recipe, Research, score,
 * entitlement or save rule changes.
 */
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import type { DexEntry } from "../state/dex";
import { loadSave, persistProgress, resetSave, type ProgressionSnapshot, type StorageLike } from "../state/persistence";
import { PREVIEW_HELPER_MARK } from "./hint5PreviewOptIn";

export type B23HvScenarioId = "b23-apple-cinnamon";

export interface B23HvScenario {
  id: B23HvScenarioId;
  /** The recipe the Owner plays / checks (undiscovered in the seeded save). */
  recipeId: string;
  labelJa: string;
  pitz: number;
}

export const B23_RECIPE_IDS: readonly string[] = ["apple-cinnamon-dessert"];
const B23_PITZ = 2000;
const B23_STOCK = 10;

export const B23_HV_SCENARIOS: readonly B23HvScenario[] = [
  { id: "b23-apple-cinnamon", recipeId: "apple-cinnamon-dessert", labelJa: "B23-1: アップルシナモンデザート (りんご購入から)", pitz: B23_PITZ },
];

export function findB23HvScenario(id: unknown): B23HvScenario | null {
  return typeof id === "string" ? (B23_HV_SCENARIOS.find((s) => s.id === id) ?? null) : null;
}

/** `?hv=<b23 id>` (any other value is ignored). */
export function parseB23HvParam(search: unknown): B23HvScenarioId | null {
  if (typeof search !== "string") return null;
  return findB23HvScenario(new URLSearchParams(search).get("hv"))?.id ?? null;
}

/** The materials unlocked by the ladder step whose key recipe is `recipeId` (the target's own new materials). */
export function b23TargetMaterials(recipeId: string): string[] {
  const step = DISCOVERY_LADDER.steps.find((s) => s.keyRecipeId === recipeId);
  if (!step) throw new Error(`${PREVIEW_HELPER_MARK}: ${recipeId} is not the key recipe of a ladder step`);
  return [...step.ingredientIds];
}

/** Every ladder material except the target step's, in ladder order. */
export function b23OwnedMaterials(scenario: B23HvScenario): string[] {
  const target = new Set(b23TargetMaterials(scenario.recipeId));
  return DISCOVERY_LADDER.steps.flatMap((step) => step.ingredientIds).filter((id) => !target.has(id));
}

function makeableWith(recipe: Recipe, owned: ReadonlySet<string>): boolean {
  return recipe.requiredIngredients.every(({ ingredientId }) => {
    const ingredient = getIngredient(ingredientId);
    return !!ingredient && (!ingredient.unlockCondition || owned.has(ingredientId));
  });
}

/** The save a scenario stands for, as the ordinary progression snapshot. */
export function buildB23HvSnapshot(scenario: B23HvScenario): ProgressionSnapshot {
  const materials = b23OwnedMaterials(scenario);
  const ownedSet = new Set<string>([...STARTER_INGREDIENT_IDS, ...materials]);
  const dex: DexEntry[] = RECIPES.filter((recipe) => recipe.id !== scenario.recipeId && makeableWith(recipe, ownedSet)).map((recipe) => ({
    recipeId: recipe.id,
    discovered: true,
    bestScore: 70,
    bestStars: 3,
    timesMade: 1,
  }));
  return {
    dex,
    pitzBalance: scenario.pitz,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...materials],
    inventory: Object.fromEntries(materials.map((id) => [id, B23_STOCK])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: {},
  };
}

/** Replaces the save in `storage` with the scenario's. Returns false when the stored result is not the seed. */
export function applyB23HvSeed(id: B23HvScenarioId, storage: StorageLike): boolean {
  const scenario = findB23HvScenario(id);
  if (!scenario) return false;
  if (!resetSave(storage)) return false;
  const snapshot = buildB23HvSnapshot(scenario);
  persistProgress(snapshot, storage);
  const stored = loadSave(storage);
  return stored.pitzBalance === scenario.pitz && stored.dex.length === snapshot.dex.length && !stored.dex.some((entry) => entry.recipeId === scenario.recipeId);
}
