/**
 * B案再構成 Phase 1b (Issue #901): the one-time reputation seed for a save that reaches the shop model. Design §3.3 /
 * §6 Q3 / R9.
 *
 * Q3: the seed is the lower bound of the highest chapter whose materials are all unlocked already -- judged ONLY on the
 * materials the adopted (curated) recipes use. A material unlocked through a recipe that is not adopted never counts
 * toward a chapter (Q10's "stays on the menu" is a separate matter).
 *
 * The frame is in place; the computation is NOT enabled: it needs a complete reputation table (./reputationTable.ts,
 * all `null` in Phase 1b) and a non-empty curated catalog (../../data/menuCatalog.ts, empty in Phase 1b). Until both
 * exist, `legacyReputationSeed` returns `null` and `applyReputationSeed` records nothing, so a save is never seeded with
 * a provisional number. Everything here takes the table and the catalog as parameters, so the rule is tested on
 * synthetic data (./reputationSeed.test.ts).
 */
import { getIngredient } from "../../data/ingredients";
import {
  MATERIAL_CHAPTER_OVERRIDES,
  MENU_CATALOG,
  type MenuCatalogEntry,
} from "../../data/menuCatalog";
import { RECIPES, type Recipe } from "../../data/recipes";
import type { ProgressionModelId } from "./progressionModelId";
import {
  REPUTATION_TABLE,
  SHOP_CHAPTER_COUNT,
  isReputationTableComplete,
  type ReputationTable,
} from "./reputationTable";
import type { ShopProgressState } from "./shopProgress";

/** What the seed reads from a save: the unlocked / owned materials (both are kept by union, so neither re-locks). */
export interface ReputationSeedInputs {
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
}

export interface ReputationSeedData {
  table: ReputationTable;
  catalog: readonly MenuCatalogEntry[];
  materialChapterOverrides?: Readonly<Record<string, number>>;
  /** The recipe list the catalog ids resolve against (default `RECIPES`). */
  recipes?: readonly Recipe[];
}

const PRODUCTION_SEED_DATA: ReputationSeedData = {
  table: REPUTATION_TABLE,
  catalog: MENU_CATALOG,
  materialChapterOverrides: MATERIAL_CHAPTER_OVERRIDES,
};

/** A material that has to be unlocked (a starter never does): the same "finite material" test as the legacy chapters. */
function isFiniteMaterial(ingredientId: string): boolean {
  return Boolean(getIngredient(ingredientId)?.unlockCondition);
}

/**
 * Each finite material an adopted recipe uses -> its chapter: the lowest chapter of an adopted recipe using it, unless
 * an override names one. A catalog id with no recipe in `recipes` contributes nothing (the catalog test rejects it).
 */
export function materialChaptersOf(
  catalog: readonly MenuCatalogEntry[],
  overrides: Readonly<Record<string, number>> = {},
  recipes: readonly Recipe[] = RECIPES,
): Map<string, number> {
  const chapters = new Map<string, number>();
  for (const entry of catalog) {
    const recipe = recipes.find((r) => r.id === entry.recipeId);
    if (!recipe) continue;
    for (const { ingredientId } of recipe.requiredIngredients) {
      if (!isFiniteMaterial(ingredientId)) continue;
      const known = chapters.get(ingredientId);
      if (known === undefined || entry.chapter < known) chapters.set(ingredientId, entry.chapter);
    }
  }
  for (const [ingredientId, chapter] of Object.entries(overrides)) {
    if (chapters.has(ingredientId)) chapters.set(ingredientId, chapter);
  }
  return chapters;
}

/** True when the shop model has what it needs to run: a complete reputation table and a non-empty curated catalog. */
export function canEnableShopProgression(data: Pick<ReputationSeedData, "table" | "catalog"> = PRODUCTION_SEED_DATA): boolean {
  return isReputationTableComplete(data.table) && data.catalog.length > 0;
}

/**
 * The highest chapter (1..5) whose adopted-recipe materials are all unlocked, together with every lower chapter's.
 * Chapter 1 is where every save starts, so the answer is never below 1.
 */
export function reachedChapterOf(inputs: ReputationSeedInputs, materialChapters: ReadonlyMap<string, number>): number {
  const unlocked = new Set([...inputs.unlockedForShopIngredientIds, ...inputs.ownedIngredientIds]);
  let reached = 1;
  for (let chapter = 1; chapter <= SHOP_CHAPTER_COUNT; chapter++) {
    for (const [ingredientId, materialChapter] of materialChapters) {
      if (materialChapter <= chapter && !unlocked.has(ingredientId)) return reached;
    }
    reached = chapter;
  }
  return reached;
}

/** Q3's seed for this save, or `null` while the table / catalog are not set (Phase 1b: always `null` in production). */
export function legacyReputationSeed(inputs: ReputationSeedInputs, data: ReputationSeedData = PRODUCTION_SEED_DATA): number | null {
  if (!canEnableShopProgression(data) || !isReputationTableComplete(data.table)) return null;
  const chapter = reachedChapterOf(inputs, materialChaptersOf(data.catalog, data.materialChapterOverrides, data.recipes));
  return data.table.chapterFloors[chapter - 1];
}

/**
 * Records the seed once (R9): a state that already has one is returned unchanged (the same object), and so is any
 * state while the seed cannot be computed. Otherwise the seed is recorded and the reputation becomes at least it (never
 * lowered, Q1).
 */
export function applyReputationSeed(
  shop: ShopProgressState,
  inputs: ReputationSeedInputs,
  data: ReputationSeedData = PRODUCTION_SEED_DATA,
): ShopProgressState {
  if (shop.reputationSeed !== null) return shop;
  const value = legacyReputationSeed(inputs, data);
  if (value === null) return shop;
  return { ...shop, reputation: Math.max(shop.reputation, value), reputationSeed: { source: "legacy-dex", value } };
}

/**
 * The shop state a page starts with (../../state/startup.ts). The seed is a shop-model step: under the legacy model the
 * stored state is returned unchanged (the same object), so a legacy build never records one.
 */
export function startupShopProgress(
  modelId: ProgressionModelId,
  shop: ShopProgressState,
  inputs: ReputationSeedInputs,
  data: ReputationSeedData = PRODUCTION_SEED_DATA,
): ShopProgressState {
  return modelId === "shop" ? applyReputationSeed(shop, inputs, data) : shop;
}
