/**
 * Expansion Batch 23-b (Issue #780): iPhone Safari Human Verification seeds. PREVIEW ONLY (same pattern as ./b23HvSeeds.ts, ./b18HvSeeds.ts and ./b21HvSeeds.ts).
 *
 * `?hv=b23b-<recipe>` writes ONE ready-made save per target recipe (nutella, smore): every ladder material
 * is owned EXCEPT the materials of the target's own step (the target's new materials), and every recipe those materials can make is discovered, EXCEPT the target
 * (so the credited count is past every B23B entitlement floor and the load-time entitlement grants the target's new materials: the Shop offers them as NEW).
 * The B23-b materials are two late steps (88 nutella: banana / chocolate / powdered-sugar; 89 smore: graham-cracker / marshmallow), so the owned set is "all ladder materials minus the target step's" (the smore seed owns the nutella step's materials and nutella is discovered there).
 * Saves are internally consistent (a discovered recipe has every finite material owned, the target is never discovered, owned
 * materials are stocked, no labels are stored). The seed goes through the ordinary `resetSave` / `persistProgress` / `loadSave`, so it lands in the Preview key
 * only and never touches a production save or Firebase. ./hvSeeds.ts calls `applyB23BHvSeed` only for a fresh navigation (never a reload), behind
 * `VITE_PREVIEW_MODE`; a production build drops this module (./previewIsolation.gate.test.ts scans for every id and label below). No recipe, Research, score,
 * entitlement or save rule changes.
 */
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import type { DexEntry } from "../state/dex";
import { loadSave, persistProgress, resetSave, type ProgressionSnapshot, type StorageLike } from "../state/persistence";
import { PREVIEW_HELPER_MARK } from "./hint5PreviewOptIn";

export type B23BHvScenarioId = "b23b-nutella" | "b23b-smore";

export interface B23BHvScenario {
  id: B23BHvScenarioId;
  /** The recipe the Owner plays / checks (undiscovered in the seeded save). */
  recipeId: string;
  labelJa: string;
  pitz: number;
}

export const B23B_RECIPE_IDS: readonly string[] = ["nutella-dessert-pizza", "smore-dessert-pizza"];
const B23B_PITZ = 2000;
const B23B_STOCK = 10;

export const B23B_HV_SCENARIOS: readonly B23BHvScenario[] = [
  { id: "b23b-nutella", recipeId: "nutella-dessert-pizza", labelJa: "B23b-1: ヌテラデザートピザ (バナナ・チョコ・粉砂糖の購入から)", pitz: B23B_PITZ },
  { id: "b23b-smore", recipeId: "smore-dessert-pizza", labelJa: "B23b-2: スモアデザートピザ (グラハム・マシュマロの購入から)", pitz: B23B_PITZ },
];

export function findB23BHvScenario(id: unknown): B23BHvScenario | null {
  return typeof id === "string" ? (B23B_HV_SCENARIOS.find((s) => s.id === id) ?? null) : null;
}

/** `?hv=<b23b id>` (any other value is ignored). */
export function parseB23BHvParam(search: unknown): B23BHvScenarioId | null {
  if (typeof search !== "string") return null;
  return findB23BHvScenario(new URLSearchParams(search).get("hv"))?.id ?? null;
}

/** The materials unlocked by the ladder step whose key recipe is `recipeId` (the target's own new materials). */
export function b23bTargetMaterials(recipeId: string): string[] {
  const step = DISCOVERY_LADDER.steps.find((s) => s.keyRecipeId === recipeId);
  if (!step) throw new Error(`${PREVIEW_HELPER_MARK}: ${recipeId} is not the key recipe of a ladder step`);
  return [...step.ingredientIds];
}

/** Every ladder material except the target step's, in ladder order. */
export function b23bOwnedMaterials(scenario: B23BHvScenario): string[] {
  const target = new Set(b23bTargetMaterials(scenario.recipeId));
  return DISCOVERY_LADDER.steps.flatMap((step) => step.ingredientIds).filter((id) => !target.has(id));
}

function makeableWith(recipe: Recipe, owned: ReadonlySet<string>): boolean {
  return recipe.requiredIngredients.every(({ ingredientId }) => {
    const ingredient = getIngredient(ingredientId);
    return !!ingredient && (!ingredient.unlockCondition || owned.has(ingredientId));
  });
}

/** The save a scenario stands for, as the ordinary progression snapshot. */
export function buildB23BHvSnapshot(scenario: B23BHvScenario): ProgressionSnapshot {
  const materials = b23bOwnedMaterials(scenario);
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
    inventory: Object.fromEntries(materials.map((id) => [id, B23B_STOCK])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: {},
  };
}

/** Replaces the save in `storage` with the scenario's. Returns false when the stored result is not the seed. */
export function applyB23BHvSeed(id: B23BHvScenarioId, storage: StorageLike): boolean {
  const scenario = findB23BHvScenario(id);
  if (!scenario) return false;
  if (!resetSave(storage)) return false;
  const snapshot = buildB23BHvSnapshot(scenario);
  persistProgress(snapshot, storage);
  const stored = loadSave(storage);
  return stored.pitzBalance === scenario.pitz && stored.dex.length === snapshot.dex.length && !stored.dex.some((entry) => entry.recipeId === scenario.recipeId);
}
