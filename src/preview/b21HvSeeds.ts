/**
 * Expansion Batch 21 (Issue #780): iPhone Safari Human Verification seeds. PREVIEW ONLY (same pattern as ./b18HvSeeds.ts).
 *
 * `?hv=b21-taco` and `?hv=b21-okonomiyaki` write ONE ready-made save (the scenario only names which recipe to play): every ladder material before the
 * taco step (79) is owned, every recipe those materials can make is discovered (so the credited count is past the late floors 79 / 80 and the load-time
 * entitlement grants the six new materials), and none of the six B21 materials is owned, so the Shop offers them as NEW. Both new recipes are undiscovered.
 * Saves are internally consistent (a discovered recipe has every finite material owned, a new recipe is never discovered, owned materials are stocked, no
 * labels are stored). The seed goes through the ordinary `resetSave` / `persistProgress` / `loadSave`, so it lands in the Preview key only and never touches
 * a production save or Firebase. ./hvSeeds.ts calls `applyB21HvSeed` only for a fresh navigation (never a reload), behind `VITE_PREVIEW_MODE`; a production
 * build drops this module (./previewIsolation.gate.test.ts scans for every id and label below). No recipe, Research, score, entitlement or save rule changes.
 */
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import type { DexEntry } from "../state/dex";
import { loadSave, persistProgress, resetSave, type ProgressionSnapshot, type StorageLike } from "../state/persistence";
import { PREVIEW_HELPER_MARK } from "./hint5PreviewOptIn";

export type B21HvScenarioId = "b21-taco" | "b21-okonomiyaki";

export interface B21HvScenario {
  id: B21HvScenarioId;
  /** The recipe the Owner plays / checks (undiscovered in the seeded save). */
  recipeId: string;
  labelJa: string;
  pitz: number;
}

export const B21_MATERIAL_IDS: readonly string[] = ["cheddar", "lettuce", "tortilla-chips", "okonomiyaki-sauce", "cabbage", "bonito-flakes"];
export const B21_NEW_RECIPE_IDS: readonly string[] = ["taco-pizza", "okonomiyaki-style-pizza"];
const B21_PITZ = 2000;
const B21_STOCK = 10;

export const B21_HV_SCENARIOS: readonly B21HvScenario[] = [
  { id: "b21-taco", recipeId: "taco-pizza", labelJa: "B21-1: タコピザ (チェダー・レタス・トルティーヤチップス購入から)", pitz: B21_PITZ },
  { id: "b21-okonomiyaki", recipeId: "okonomiyaki-style-pizza", labelJa: "B21-2: お好み焼き風ピザ (お好み焼きソース・キャベツ・かつお節購入から)", pitz: B21_PITZ },
];

export function findB21HvScenario(id: unknown): B21HvScenario | null {
  return typeof id === "string" ? (B21_HV_SCENARIOS.find((s) => s.id === id) ?? null) : null;
}

/** `?hv=<b21 id>` (any other value is ignored). */
export function parseB21HvParam(search: unknown): B21HvScenarioId | null {
  if (typeof search !== "string") return null;
  return findB21HvScenario(new URLSearchParams(search).get("hv"))?.id ?? null;
}

/** Every ladder material except the six B21 materials, in ladder order (the B21 steps are the last two late steps). */
export function b21LadderPrefixMaterials(): string[] {
  const first = DISCOVERY_LADDER.steps.findIndex((step) => step.ingredientIds.some((id) => B21_MATERIAL_IDS.includes(id)));
  if (first < 0) throw new Error(`${PREVIEW_HELPER_MARK}: the B21 materials are not on the ladder`);
  return DISCOVERY_LADDER.steps.slice(0, first).flatMap((step) => step.ingredientIds);
}

function makeableWith(recipe: Recipe, owned: ReadonlySet<string>): boolean {
  return recipe.requiredIngredients.every(({ ingredientId }) => {
    const ingredient = getIngredient(ingredientId);
    return !!ingredient && (!ingredient.unlockCondition || owned.has(ingredientId));
  });
}

/** The save a scenario stands for, as the ordinary progression snapshot. */
export function buildB21HvSnapshot(scenario: B21HvScenario): ProgressionSnapshot {
  const materials = b21LadderPrefixMaterials();
  const ownedSet = new Set<string>([...STARTER_INGREDIENT_IDS, ...materials]);
  const dex: DexEntry[] = RECIPES.filter((recipe) => !B21_NEW_RECIPE_IDS.includes(recipe.id) && makeableWith(recipe, ownedSet)).map((recipe) => ({
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
    inventory: Object.fromEntries(materials.map((id) => [id, B21_STOCK])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: {},
  };
}

/** Replaces the save in `storage` with the scenario's. Returns false when the stored result is not the seed. */
export function applyB21HvSeed(id: B21HvScenarioId, storage: StorageLike): boolean {
  const scenario = findB21HvScenario(id);
  if (!scenario) return false;
  if (!resetSave(storage)) return false;
  const snapshot = buildB21HvSnapshot(scenario);
  persistProgress(snapshot, storage);
  const stored = loadSave(storage);
  return (
    stored.pitzBalance === scenario.pitz &&
    stored.dex.length === snapshot.dex.length &&
    !stored.dex.some((entry) => B21_NEW_RECIPE_IDS.includes(entry.recipeId))
  );
}
