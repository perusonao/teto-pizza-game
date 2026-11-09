/**
 * Expansion Batch 22 (Issue #780): iPhone Safari Human Verification seeds. PREVIEW ONLY (same pattern as ./b18HvSeeds.ts and ./b21HvSeeds.ts).
 *
 * `?hv=b22-<recipe>` writes ONE ready-made save per target recipe (speck-e-brie, buffalo-chicken, finocchi, cavolo, radicchio, truffle): every ladder material
 * is owned EXCEPT the materials of the target's own step (the target's new materials), and every recipe those materials can make is discovered, EXCEPT the target
 * (so the credited count is past every B22 entitlement floor and the load-time entitlement grants the target's new materials: the Shop offers them as NEW).
 * Unlike B21 the B22 materials are not one ladder suffix (two ordinary steps 72 / 73 and four late steps 83-86), so the owned set is "all ladder materials minus
 * the target step's", not a prefix. Saves are internally consistent (a discovered recipe has every finite material owned, the target is never discovered, owned
 * materials are stocked, no labels are stored). The seed goes through the ordinary `resetSave` / `persistProgress` / `loadSave`, so it lands in the Preview key
 * only and never touches a production save or Firebase. ./hvSeeds.ts calls `applyB22HvSeed` only for a fresh navigation (never a reload), behind
 * `VITE_PREVIEW_MODE`; a production build drops this module (./previewIsolation.gate.test.ts scans for every id and label below). No recipe, Research, score,
 * entitlement or save rule changes.
 */
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import type { DexEntry } from "../state/dex";
import { loadSave, persistProgress, resetSave, type ProgressionSnapshot, type StorageLike } from "../state/persistence";
import { PREVIEW_HELPER_MARK } from "./hint5PreviewOptIn";

export type B22HvScenarioId = "b22-speck-e-brie" | "b22-buffalo-chicken" | "b22-finocchi" | "b22-cavolo" | "b22-radicchio" | "b22-truffle";

export interface B22HvScenario {
  id: B22HvScenarioId;
  /** The recipe the Owner plays / checks (undiscovered in the seeded save). */
  recipeId: string;
  labelJa: string;
  pitz: number;
}

export const B22_RECIPE_IDS: readonly string[] = ["speck-e-brie", "buffalo-chicken", "pizza-finocchi-salad", "pizza-cavolo-carote", "pizza-radicchio-noci", "black-truffle-pizza"];
const B22_PITZ = 2000;
const B22_STOCK = 10;

export const B22_HV_SCENARIOS: readonly B22HvScenario[] = [
  { id: "b22-speck-e-brie", recipeId: "speck-e-brie", labelJa: "B22-1: スペックエブリー (ブリーチーズ購入から)", pitz: B22_PITZ },
  { id: "b22-buffalo-chicken", recipeId: "buffalo-chicken", labelJa: "B22-2: バッファローチキン (バッファローソース購入から)", pitz: B22_PITZ },
  { id: "b22-finocchi", recipeId: "pizza-finocchi-salad", labelJa: "B22-3: フィノッキのサラダピザ (フェンネル・オレンジ購入から)", pitz: B22_PITZ },
  { id: "b22-cavolo", recipeId: "pizza-cavolo-carote", labelJa: "B22-4: 紫キャベツとにんじんのピザ (にんじん・紫キャベツ・ひまわりの種購入から)", pitz: B22_PITZ },
  { id: "b22-radicchio", recipeId: "pizza-radicchio-noci", labelJa: "B22-5: ラディッキオとくるみのピザ (ラディッキオ・バルサミコ酢購入から)", pitz: B22_PITZ },
  { id: "b22-truffle", recipeId: "black-truffle-pizza", labelJa: "B22-6: 黒トリュフピザ (トリュフ購入から)", pitz: B22_PITZ },
];

export function findB22HvScenario(id: unknown): B22HvScenario | null {
  return typeof id === "string" ? (B22_HV_SCENARIOS.find((s) => s.id === id) ?? null) : null;
}

/** `?hv=<b22 id>` (any other value is ignored). */
export function parseB22HvParam(search: unknown): B22HvScenarioId | null {
  if (typeof search !== "string") return null;
  return findB22HvScenario(new URLSearchParams(search).get("hv"))?.id ?? null;
}

/** The materials unlocked by the ladder step whose key recipe is `recipeId` (the target's own new materials). */
export function b22TargetMaterials(recipeId: string): string[] {
  const step = DISCOVERY_LADDER.steps.find((s) => s.keyRecipeId === recipeId);
  if (!step) throw new Error(`${PREVIEW_HELPER_MARK}: ${recipeId} is not the key recipe of a ladder step`);
  return [...step.ingredientIds];
}

/** Every ladder material except the target step's, in ladder order. */
export function b22OwnedMaterials(scenario: B22HvScenario): string[] {
  const target = new Set(b22TargetMaterials(scenario.recipeId));
  return DISCOVERY_LADDER.steps.flatMap((step) => step.ingredientIds).filter((id) => !target.has(id));
}

function makeableWith(recipe: Recipe, owned: ReadonlySet<string>): boolean {
  return recipe.requiredIngredients.every(({ ingredientId }) => {
    const ingredient = getIngredient(ingredientId);
    return !!ingredient && (!ingredient.unlockCondition || owned.has(ingredientId));
  });
}

/** The save a scenario stands for, as the ordinary progression snapshot. */
export function buildB22HvSnapshot(scenario: B22HvScenario): ProgressionSnapshot {
  const materials = b22OwnedMaterials(scenario);
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
    inventory: Object.fromEntries(materials.map((id) => [id, B22_STOCK])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: {},
  };
}

/** Replaces the save in `storage` with the scenario's. Returns false when the stored result is not the seed. */
export function applyB22HvSeed(id: B22HvScenarioId, storage: StorageLike): boolean {
  const scenario = findB22HvScenario(id);
  if (!scenario) return false;
  if (!resetSave(storage)) return false;
  const snapshot = buildB22HvSnapshot(scenario);
  persistProgress(snapshot, storage);
  const stored = loadSave(storage);
  return stored.pitzBalance === scenario.pitz && stored.dex.length === snapshot.dex.length && !stored.dex.some((entry) => entry.recipeId === scenario.recipeId);
}
