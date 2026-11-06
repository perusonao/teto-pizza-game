/**
 * Expansion Batch 18 (Issue #748, PR #759): iPhone Safari Human Verification seeds. PREVIEW ONLY.
 * Owner decision (Issue #748 comment 6656496881, approach A): a narrow, Preview-only B18 seed beside the
 * Hint 5.0 seeds of ./hvSeeds.ts, which stay exactly as they were (their W1_25 builder is not reused here).
 *
 * `?hv=b18-baingan`, `?hv=b18-reina` and `?hv=b18-bbq` write a ready-made save so the Owner can check
 * the two new recipes and the Owner-approved BBQ Research label (OD-B18-1) without playing to step 69:
 * - **b18-baingan / b18-reina** (the same save; the scenario only names which recipe to play): every
 *   ordinary ladder material before cilantro's step is owned, every recipe those materials can make is
 *   discovered, and cilantro is NOT owned, so the Shop offers it as NEW (load-time entitlement grants it:
 *   the credited count is past `LATE_ENTITLEMENT_FLOORS.cilantro`). Both new recipes are undiscovered.
 *   After buying cilantro both become Research Entries (cohort letters from the ordinary label rule).
 * - **b18-bbq**: the same materials plus `bbq-sauce` THEN `cilantro` (the entitlement-floor order), every
 *   recipe they make discovered except `bbq-chicken-pizza`, so its Research label is the Owner-approved
 *   "？？？ピザ B（パクチー）". (The other order is covered by tests, not by a scenario.)
 *
 * Saves are internally consistent: a discovered recipe has every finite material owned, a new recipe is
 * never discovered, owned materials are stocked, nothing is stored about labels (labels are derived).
 * The seed goes through the ordinary `resetSave` / `persistProgress` / `loadSave`, so it lands in the
 * Preview key only (`teto-pizza-preview-save-v1` in a Preview build) and never touches a production save
 * or Firebase. ./hvSeeds.ts calls `applyB18HvSeed` only for a fresh navigation (never a reload), and only
 * from `applyPreviewHvSeed`, which ../main.tsx calls behind `import.meta.env.VITE_PREVIEW_MODE`; a production
 * build drops this module (./previewIsolation.gate.test.ts scans for every id and label below).
 *
 * No recipe, Research, score, entitlement or save rule is changed: this module only writes a save.
 */
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import type { DexEntry } from "../state/dex";
import { loadSave, persistProgress, resetSave, type ProgressionSnapshot, type StorageLike } from "../state/persistence";
import { PREVIEW_HELPER_MARK } from "./hint5PreviewOptIn";

export type B18HvScenarioId = "b18-baingan" | "b18-reina" | "b18-bbq";

export interface B18HvScenario {
  id: B18HvScenarioId;
  /** The recipe the Owner plays / checks (undiscovered in the seeded save). */
  recipeId: string;
  labelJa: string;
  /** Materials owned after the ordinary ladder prefix, in acquisition order. */
  extraOwned: readonly string[];
  pitz: number;
}

/** The B18 material: the seeded saves stand right before (or, for BBQ, right after) its ladder step. */
export const B18_MATERIAL_ID = "cilantro";
export const B18_NEW_RECIPE_IDS: readonly string[] = ["baingan-bharta-pizza", "reina-pepiada-pizza"];
const B18_PITZ = 500;
const B18_STOCK = 10;

export const B18_HV_SCENARIOS: readonly B18HvScenario[] = [
  { id: "b18-baingan", recipeId: "baingan-bharta-pizza", labelJa: "B18-1: バインガンバルタピザ (パクチー購入から)", extraOwned: [], pitz: B18_PITZ },
  { id: "b18-reina", recipeId: "reina-pepiada-pizza", labelJa: "B18-2: ベネズエラレイナペピアーダピザ (パクチー購入から)", extraOwned: [], pitz: B18_PITZ },
  { id: "b18-bbq", recipeId: "bbq-chicken-pizza", labelJa: "B18-3: BBQ チキンの研究ラベル (バーベキューソース→パクチーの順)", extraOwned: ["bbq-sauce", B18_MATERIAL_ID], pitz: B18_PITZ },
];

export function findB18HvScenario(id: unknown): B18HvScenario | null {
  return typeof id === "string" ? (B18_HV_SCENARIOS.find((s) => s.id === id) ?? null) : null;
}

/** `?hv=<b18 id>` (any other value is ignored). */
export function parseB18HvParam(search: unknown): B18HvScenarioId | null {
  if (typeof search !== "string") return null;
  return findB18HvScenario(new URLSearchParams(search).get("hv"))?.id ?? null;
}

/** The ordinary ladder materials before the B18 material's step, in ladder order. */
export function b18LadderPrefixMaterials(): string[] {
  const index = DISCOVERY_LADDER.steps.findIndex((step) => step.ingredientIds.includes(B18_MATERIAL_ID));
  if (index < 0) throw new Error(`${PREVIEW_HELPER_MARK}: ${B18_MATERIAL_ID} is not on the ladder`);
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
export function buildB18HvSnapshot(scenario: B18HvScenario): ProgressionSnapshot {
  const prefix = b18LadderPrefixMaterials();
  const materials = [...prefix, ...scenario.extraOwned.filter((id) => !prefix.includes(id))];
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
    inventory: Object.fromEntries(materials.map((id) => [id, B18_STOCK])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: {},
  };
}

/** Replaces the save in `storage` with the scenario's. Returns false when the stored result is not the seed. */
export function applyB18HvSeed(id: B18HvScenarioId, storage: StorageLike): boolean {
  const scenario = findB18HvScenario(id);
  if (!scenario) return false;
  if (!resetSave(storage)) return false;
  const snapshot = buildB18HvSnapshot(scenario);
  persistProgress(snapshot, storage);
  const stored = loadSave(storage);
  return (
    stored.pitzBalance === scenario.pitz &&
    stored.dex.length === snapshot.dex.length &&
    !stored.dex.some((entry) => entry.recipeId === scenario.recipeId)
  );
}
