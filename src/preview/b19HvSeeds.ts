/**
 * Expansion Batch 19 (Issue #774, PR #783): iPhone Safari Human Verification seeds. PREVIEW ONLY.
 * Same pattern as ./b18HvSeeds.ts (Owner-requested for the Batch 19 device check): `?hv=b19-pesto-burrata` and
 * `?hv=b19-crudaiola` write a ready-made save so the Owner can play the two new recipes without reaching ladder step 70.
 *
 * Both scenarios use the SAME save (the id only names which recipe to play): every ordinary ladder material before
 * burrata's step is owned and stocked, every recipe those materials can make is discovered, `burrata` is NOT owned (the
 * Shop offers it as NEW; load-time entitlement grants it), and BOTH new recipes are undiscovered.
 *
 * The save goes through the ordinary `resetSave` / `persistProgress` / `loadSave`, so it lands in the Preview key only
 * (`teto-pizza-preview-save-v1` in a Preview build) and never touches a production save or Firebase. ./hvSeeds.ts calls
 * `applyB19HvSeed` only for a fresh navigation (never a reload) and only from `applyPreviewHvSeed`, which ../main.tsx
 * calls behind `import.meta.env.VITE_PREVIEW_MODE`; a production build drops this module (./previewIsolation.gate.test.ts
 * scans for every id and label below). No recipe, Research, score, entitlement or save rule is changed.
 */
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import type { DexEntry } from "../state/dex";
import { loadSave, persistProgress, resetSave, type ProgressionSnapshot, type StorageLike } from "../state/persistence";
import { PREVIEW_HELPER_MARK } from "./hint5PreviewOptIn";

export type B19HvScenarioId = "b19-pesto-burrata" | "b19-crudaiola";

export interface B19HvScenario {
  id: B19HvScenarioId;
  /** The recipe the Owner plays / checks (undiscovered in the seeded save). */
  recipeId: string;
  labelJa: string;
  pitz: number;
}

/** The B19 material and both new recipes (all undiscovered in the seeded save). */
export const B19_MATERIAL_ID = "burrata";
export const B19_NEW_RECIPE_IDS: readonly string[] = ["pesto-burrata-pizza", "pizza-alla-crudaiola"];
const B19_PITZ = 999;
const B19_STOCK = 10;

export const B19_HV_SCENARIOS: readonly B19HvScenario[] = [
  { id: "b19-pesto-burrata", recipeId: "pesto-burrata-pizza", labelJa: "B19-1: ペスト・ブッラータピザ (ブッラータ購入から)", pitz: B19_PITZ },
  { id: "b19-crudaiola", recipeId: "pizza-alla-crudaiola", labelJa: "B19-2: ピッツァ・アッラ・クルダイオーラ (ブッラータ購入から)", pitz: B19_PITZ },
];

export function findB19HvScenario(id: unknown): B19HvScenario | null {
  return typeof id === "string" ? (B19_HV_SCENARIOS.find((s) => s.id === id) ?? null) : null;
}

/** `?hv=<b19 id>` (any other value is ignored). */
export function parseB19HvParam(search: unknown): B19HvScenarioId | null {
  if (typeof search !== "string") return null;
  return findB19HvScenario(new URLSearchParams(search).get("hv"))?.id ?? null;
}

/** The ordinary ladder materials before the B19 material's step, in ladder order. */
export function b19LadderPrefixMaterials(): string[] {
  const index = DISCOVERY_LADDER.steps.findIndex((step) => step.ingredientIds.includes(B19_MATERIAL_ID));
  if (index < 0) throw new Error(`${PREVIEW_HELPER_MARK}: ${B19_MATERIAL_ID} is not on the ladder`);
  return DISCOVERY_LADDER.steps.slice(0, index).flatMap((step) => step.ingredientIds);
}

/** Whether every finite (unlockable) material of `recipe` is in `owned` (starters are always available). */
function makeableWith(recipe: Recipe, owned: ReadonlySet<string>): boolean {
  return recipe.requiredIngredients.every(({ ingredientId }) => {
    const ingredient = getIngredient(ingredientId);
    return !!ingredient && (!ingredient.unlockCondition || owned.has(ingredientId));
  });
}

/** The save a scenario stands for, as the ordinary progression snapshot. */
export function buildB19HvSnapshot(scenario: B19HvScenario): ProgressionSnapshot {
  const materials = b19LadderPrefixMaterials();
  const ownedSet = new Set<string>([...STARTER_INGREDIENT_IDS, ...materials]);
  const dex: DexEntry[] = RECIPES.filter((recipe) => !B19_NEW_RECIPE_IDS.includes(recipe.id) && makeableWith(recipe, ownedSet)).map((recipe) => ({
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
    inventory: Object.fromEntries(materials.map((id) => [id, B19_STOCK])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: {},
  };
}

/** Replaces the save in `storage` with the scenario's. Returns false when the stored result is not the seed. */
export function applyB19HvSeed(id: B19HvScenarioId, storage: StorageLike): boolean {
  const scenario = findB19HvScenario(id);
  if (!scenario) return false;
  if (!resetSave(storage)) return false;
  const snapshot = buildB19HvSnapshot(scenario);
  persistProgress(snapshot, storage);
  const stored = loadSave(storage);
  return (
    stored.pitzBalance === scenario.pitz &&
    stored.dex.length === snapshot.dex.length &&
    !stored.dex.some((entry) => B19_NEW_RECIPE_IDS.includes(entry.recipeId))
  );
}
