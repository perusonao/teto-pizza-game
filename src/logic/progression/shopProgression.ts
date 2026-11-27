/**
 * B案再構成 Phase 2a (Issue #901): the shop model's rules, as pure functions. Design §3.2.3 / §3.2.4 / §6 (Q1, Q2, Q4, R2, R3).
 * `SHOP_PROGRESSION` (./progressionModel.ts) is these functions bound to the production table and catalog.
 *
 * - **Chapters come from the reputation.** The open chapter is the highest one whose floor the reputation has reached
 *   (`REPUTATION_TABLE.chapterFloors`, five chapters, Q12). The reputation never goes down (Q1), so a chapter never closes.
 * - **Materials come from the chapters.** A material's chapter is the lowest chapter of an adopted recipe that requires it
 *   (`MATERIAL_CHAPTER_OVERRIDES` first). Every ladder material whose chapter is open is entitled; like the legacy resolver
 *   the result is a union with the ledger (and the finite materials already owned), so nothing is ever re-locked. The
 *   ladder stays the source of the price and the order the Shop lists them in (R1); its discovered-count steps, its star
 *   gates (R2) and the late floors (R3) are not read here.
 * - **The menu** = (the first menu ∪ `shop.grantedMenuRecipeIds` ∪ the Dex's discovered recipes) ∩ the adopted recipes.
 *   The first menu is margherita (Q2), derived rather than written, so a new save needs no grant step and a legacy save
 *   gains no `shopProgress` key just by being opened.
 *
 * **The catalog.** Phase 2a ran on an interim catalog (every recipe at its legacy chapter: the ladder price tier of its key
 * material, chapters 1-4, chapter 5 empty) because the curated 60 (`MENU_CATALOG`) were not selected yet. **Phase 3a**
 * fills `MENU_CATALOG` with the Owner's 60 (5 stages x 12), so the recipes' stages, the menu and everything read through
 * it (orders, Lunch Rush, the Dex) now follow the curated list.
 *
 * **Phase 3b: the materials come from the curated list too.** A material's stage is the stage of the first adopted recipe
 * that uses it (77 materials: 17 / 9 / 13 / 23 / 15, the three starters in stage 1), with one split inside stage 4: twelve
 * of its materials arrive at reputation 275 (`MATERIAL_MID_STAGE_ARRIVALS`). No override (`MATERIAL_CHAPTER_OVERRIDES` is
 * empty). The interim catalog still stands in whole if `MENU_CATALOG` is ever empty.
 */
import { getIngredient } from "../../data/ingredients";
import {
  MATERIAL_CHAPTER_OVERRIDES,
  MATERIAL_MID_STAGE_ARRIVALS,
  MENU_CATALOG,
  type MaterialMidStageArrival,
  type MenuCatalogEntry,
} from "../../data/menuCatalog";
import { RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { isDiscovered, type DexState } from "../../state/dex";
import { ingredientUnlockStep, obtainableIngredientIds, type ShopEntitlementResult } from "../../state/materialEntitlement";
import { legacyRecipeChapter } from "../../state/recipeChapters";
import type { CompleteReputationTable } from "./reputationTable";
import { awaitingMenuRecipeIdsOf, menuEntryPaidRecipeIdsOf, type ShopProgressState } from "./shopProgress";

/** Q2: a new player's first menu. */
export const SHOP_FIRST_MENU_RECIPE_IDS: readonly RecipeId[] = Object.freeze(["margherita"]) as readonly RecipeId[];

export interface ShopCatalog {
  /** The adopted recipes and their stages (the menu, the orders, the Dex). */
  entries: readonly MenuCatalogEntry[];
  /**
   * The entries a material's stage is derived from (the lowest stage of an entry requiring it). Defaults to `entries`.
   * Phase 3a: the interim catalog, so the material stages do not move before Phase 3b.
   */
  materialEntries?: readonly MenuCatalogEntry[];
  /** Ingredient id -> chapter, overriding the derived chapter. */
  materialOverrides: Readonly<Record<string, number>>;
  /**
   * Phase 3b: materials that arrive later than their stage's floor (stage 4's second half at 275). A material listed here
   * opens once its stage is open **and** the reputation reaches the arrival's reputation.
   */
  midStageArrivals?: readonly MaterialMidStageArrival[];
  /** `true` while the interim catalog stands in for an empty curated one (recipes included). */
  interim: boolean;
}

let interimEntries: readonly MenuCatalogEntry[] | null = null;

/** Phase 2a's interim catalog: every recipe at its legacy chapter (see the header). */
export function interimMenuCatalog(recipes: readonly Recipe[] = RECIPES): readonly MenuCatalogEntry[] {
  if (recipes !== RECIPES) return recipes.map((r) => ({ recipeId: r.id, chapter: legacyRecipeChapter(r) }));
  interimEntries ??= Object.freeze(RECIPES.map((r) => ({ recipeId: r.id, chapter: legacyRecipeChapter(r) })));
  return interimEntries;
}

let curatedCatalog: ShopCatalog | null = null;
let interimCatalog: ShopCatalog | null = null;

/**
 * The catalog the shop model reads: the curated one (Phase 3a recipes; Phase 3b: the materials derived from it too, with
 * stage 4's mid-stage arrivals), or the interim one whole while `MENU_CATALOG` is empty. Memoised: one object per page load.
 */
export function activeShopCatalog(): ShopCatalog {
  if (MENU_CATALOG.length > 0) {
    curatedCatalog ??= Object.freeze({
      entries: MENU_CATALOG,
      materialOverrides: MATERIAL_CHAPTER_OVERRIDES,
      midStageArrivals: MATERIAL_MID_STAGE_ARRIVALS,
      interim: false,
    });
    return curatedCatalog;
  }
  interimCatalog ??= Object.freeze({ entries: interimMenuCatalog(), materialOverrides: {}, interim: true });
  return interimCatalog;
}

/** The adopted recipes, in `RECIPES` order (the shop model's Dex / Pizza Select / Home counts read this). */
export function catalogRecipes(catalog: ShopCatalog, recipes: readonly Recipe[] = RECIPES): readonly Recipe[] {
  const adopted = new Set(catalog.entries.map((e) => e.recipeId as string));
  return recipes.filter((r) => adopted.has(r.id));
}

/** The open chapter for a reputation: the highest chapter whose floor it has reached (at least chapter 1). */
export function chapterForReputation(reputation: number, floors: CompleteReputationTable["chapterFloors"]): number {
  let chapter = 1;
  for (let i = 0; i < floors.length; i++) {
    if (reputation >= floors[i]) chapter = i + 1;
  }
  return chapter;
}

/** The next chapter's floor, or `null` when the last chapter is already open. */
export function nextChapterFloor(reputation: number, floors: CompleteReputationTable["chapterFloors"]): number | null {
  const open = chapterForReputation(reputation, floors);
  return open < floors.length ? floors[open] : null;
}

/** An adopted recipe's chapter, or `null` when the catalog does not adopt it. */
export function catalogChapterOf(recipeId: string, catalog: ShopCatalog): number | null {
  return catalog.entries.find((e) => e.recipeId === recipeId)?.chapter ?? null;
}

/**
 * A material's chapter: 0 for an onboarding starter (always usable), the override when one exists, else the lowest chapter
 * of an adopted recipe that requires it; `null` when no adopted recipe needs it (the shop model never sells it).
 */
export function materialChapterOf(
  ingredientId: string,
  catalog: ShopCatalog,
  recipes: readonly Recipe[] = RECIPES,
): number | null {
  const ingredient = getIngredient(ingredientId);
  if (!ingredient) return null;
  if (!ingredient.unlockCondition) return 0;
  const override = catalog.materialOverrides[ingredientId];
  if (override !== undefined) return override;
  return lowestRequiringChapters(catalog.materialEntries ?? catalog.entries, recipes).get(ingredientId) ?? null;
}

const lowestChapterCache = new WeakMap<readonly MenuCatalogEntry[], ReadonlyMap<string, number>>();

/** Ingredient id -> the lowest chapter of an adopted recipe requiring it (cached per production catalog). */
function lowestRequiringChapters(entries: readonly MenuCatalogEntry[], recipes: readonly Recipe[]): ReadonlyMap<string, number> {
  const cacheable = recipes === RECIPES;
  const cached = cacheable ? lowestChapterCache.get(entries) : undefined;
  if (cached) return cached;
  const byId = new Map(recipes.map((r) => [r.id as string, r]));
  const lowest = new Map<string, number>();
  for (const entry of entries) {
    for (const { ingredientId } of byId.get(entry.recipeId)?.requiredIngredients ?? []) {
      const current = lowest.get(ingredientId);
      if (current === undefined || entry.chapter < current) lowest.set(ingredientId, entry.chapter);
    }
  }
  if (cacheable) lowestChapterCache.set(entries, lowest);
  return lowest;
}

/**
 * The reputation a material opens at: 0 for a starter, its stage's floor, or (Phase 3b) its mid-stage arrival when later;
 * `null` when the shop model never sells it.
 */
export function materialOpenReputationOf(
  ingredientId: string,
  table: CompleteReputationTable,
  catalog: ShopCatalog,
): number | null {
  const chapter = materialChapterOf(ingredientId, catalog);
  if (chapter === null) return null;
  if (chapter === 0) return 0;
  const floor = table.chapterFloors[chapter - 1] ?? Number.POSITIVE_INFINITY;
  const arrival = catalog.midStageArrivals?.find((a) => a.chapter === chapter && a.ingredientIds.includes(ingredientId));
  return arrival ? Math.max(floor, arrival.reputation) : floor;
}

/** Whether a material can be used at this reputation: a starter, or its chapter is open (and its mid-stage arrival reached). */
export function isMaterialOpenAt(
  ingredientId: string,
  reputation: number,
  table: CompleteReputationTable,
  catalog: ShopCatalog,
): boolean {
  const chapter = materialChapterOf(ingredientId, catalog);
  if (chapter === null || chapter > chapterForReputation(reputation, table.chapterFloors)) return false;
  const opensAt = materialOpenReputationOf(ingredientId, table, catalog);
  return opensAt !== null && reputation >= opensAt;
}

export interface ShopEntitlementInputs {
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
  shop: ShopProgressState;
}

/**
 * The shop model's material entitlement (see the header): the ledger ∪ the finite materials owned ∪ every ladder material
 * whose chapter is open. Same result shape and the same "a no-op returns the input ledger by reference" rule as
 * `resolveShopEntitlement`; `newlyUnlockedMaterialIds` is in ladder order.
 */
export function resolveShopModelEntitlement(
  inputs: ShopEntitlementInputs,
  table: CompleteReputationTable,
  catalog: ShopCatalog,
): ShopEntitlementResult {
  const isFinite = (id: string) => !!getIngredient(id)?.unlockCondition;
  const unlocked: string[] = [...inputs.unlockedForShopIngredientIds];
  const seen = new Set(unlocked);
  for (const id of inputs.ownedIngredientIds) {
    if (isFinite(id) && !seen.has(id)) {
      unlocked.push(id);
      seen.add(id);
    }
  }
  const newly: string[] = [];
  // The ladder's materials in ladder order, read through the one runtime bridge to the ladder (../../state/materialEntitlement.ts).
  for (const id of ladderMaterialsInOrder()) {
    if (seen.has(id) || !isMaterialOpenAt(id, inputs.shop.reputation, table, catalog)) continue;
    unlocked.push(id);
    newly.push(id);
    seen.add(id);
  }
  const unchanged =
    unlocked.length === inputs.unlockedForShopIngredientIds.length &&
    unlocked.every((id, i) => id === inputs.unlockedForShopIngredientIds[i]);
  return { unlockedForShopIngredientIds: unchanged ? inputs.unlockedForShopIngredientIds : unlocked, newlyUnlockedMaterialIds: newly };
}

let ladderOrder: readonly string[] | null = null;

/** The finite materials the ladder sells, in ladder-step order (ties keep the catalog order). */
function ladderMaterialsInOrder(): readonly string[] {
  ladderOrder ??= obtainableIngredientIds()
    .map((id, index) => ({ id, index, step: ingredientUnlockStep(id) }))
    .filter((m): m is { id: string; index: number; step: number } => m.step !== null && m.step > 0)
    .sort((a, b) => a.step - b.step || a.index - b.index)
    .map((m) => m.id);
  return ladderOrder;
}

export interface ShopMenuInputs {
  dex: DexState;
  shop: ShopProgressState;
}

/**
 * Phase 3b (Owner 2026-11-27): whether an adopted recipe's stage is open at this reputation. A recipe the catalog does not
 * adopt has no stage and reads as open (the stage rule never hides it; its own treatment is Phase 3e).
 */
export function isRecipeStageOpenAt(
  recipeId: string,
  reputation: number,
  floors: CompleteReputationTable["chapterFloors"],
  catalog: ShopCatalog,
): boolean {
  const chapter = catalogChapterOf(recipeId, catalog);
  return chapter === null || chapter <= chapterForReputation(reputation, floors);
}

/**
 * The menu (see the header), in `RECIPES` order. Phase 3b: with `floors`, a recipe is on the menu only once its stage is open
 * (a recipe identified earlier waits in the Dex as 判明 and joins the menu the moment its stage opens).
 */
export function shopMenuRecipeIds(
  inputs: ShopMenuInputs,
  catalog: ShopCatalog,
  recipes: readonly Recipe[] = RECIPES,
  floors?: CompleteReputationTable["chapterFloors"],
): RecipeId[] {
  const adopted = new Set(catalog.entries.map((e) => e.recipeId as string));
  const granted = new Set<string>([...SHOP_FIRST_MENU_RECIPE_IDS, ...inputs.shop.grantedMenuRecipeIds]);
  return recipes
    .filter(
      (r) =>
        adopted.has(r.id) &&
        (granted.has(r.id) || isDiscovered(inputs.dex, r.id)) &&
        (!floors || isRecipeStageOpenAt(r.id, inputs.shop.reputation, floors, catalog)),
    )
    .map((r) => r.id);
}

/** One recipe's menu membership (the same rule as `shopMenuRecipeIds`, without building the list). */
export function isOnShopMenu(
  recipeId: string,
  inputs: ShopMenuInputs,
  catalog: ShopCatalog,
  floors?: CompleteReputationTable["chapterFloors"],
): boolean {
  if (catalogChapterOf(recipeId, catalog) === null) return false;
  if (floors && !isRecipeStageOpenAt(recipeId, inputs.shop.reputation, floors, catalog)) return false;
  return (
    SHOP_FIRST_MENU_RECIPE_IDS.includes(recipeId as RecipeId) ||
    inputs.shop.grantedMenuRecipeIds.includes(recipeId) ||
    isDiscovered(inputs.dex, recipeId)
  );
}

/**
 * Phase 3b: an adopted recipe that is in the Dex but whose stage is not open yet -- 判明 (identified), waiting for its stage.
 * The Dex shows it as identified with the shop's stage it joins the menu at.
 */
export function isIdentifiedAwaitingStage(
  recipeId: string,
  inputs: ShopMenuInputs,
  floors: CompleteReputationTable["chapterFloors"],
  catalog: ShopCatalog,
): boolean {
  return (
    catalogChapterOf(recipeId, catalog) !== null &&
    isDiscovered(inputs.dex, recipeId) &&
    !isRecipeStageOpenAt(recipeId, inputs.shop.reputation, floors, catalog)
  );
}

/** Adds an identified-before-its-stage recipe to the awaiting ledger (idempotent: the same object when already there). */
export function markAwaitingMenu(shop: ShopProgressState, recipeId: string): ShopProgressState {
  const awaiting = awaitingMenuRecipeIdsOf(shop);
  return awaiting.includes(recipeId) ? shop : { ...shop, awaitingMenuRecipeIds: [...awaiting, recipeId] };
}

/** What the menu entries of awaiting recipes did in one settlement (RESULT shows it once; never saved). */
export interface MenuEntrySettlement {
  shop: ShopProgressState;
  /** The recipes that joined the menu now, in the order they were identified. Empty = nothing happened (`shop` unchanged). */
  enteredRecipeIds: readonly RecipeId[];
  /** The reputation the entries added (the menu-development bonus each). */
  reputationGained: number;
}

/**
 * Phase 3b: every awaiting recipe whose stage is open joins the menu now and earns the menu-development bonus, exactly once (it is
 * written to `menuEntryPaidRecipeIds` in the same step). The bonus reputation can open the next stage, whose awaiting recipes
 * then join too (repeated until nothing changes). The Pitz half of the bonus is the caller's (`PITZ_FIRST_DISCOVERY_BONUS` each).
 */
export function settleAwaitingMenu(
  shop: ShopProgressState,
  table: CompleteReputationTable,
  catalog: ShopCatalog,
): MenuEntrySettlement {
  let current = shop;
  const entered: RecipeId[] = [];
  let reputationGained = 0;
  for (;;) {
    const paid = new Set(menuEntryPaidRecipeIdsOf(current));
    const due = awaitingMenuRecipeIdsOf(current).filter(
      (id) => !paid.has(id) && catalogChapterOf(id, catalog) !== null && isRecipeStageOpenAt(id, current.reputation, table.chapterFloors, catalog),
    );
    if (due.length === 0) break;
    const bonus = table.menuDevelopmentBonus * due.length;
    current = {
      ...current,
      reputation: current.reputation + bonus,
      menuEntryPaidRecipeIds: [...menuEntryPaidRecipeIdsOf(current), ...due],
    };
    entered.push(...(due as RecipeId[]));
    reputationGained += bonus;
  }
  return { shop: current, enteredRecipeIds: entered, reputationGained };
}

/** The adopted recipes of one stage, in `RECIPES` order (the stage-opening banner counts them). */
export function stageRecipeIds(chapter: number, catalog: ShopCatalog, recipes: readonly Recipe[] = RECIPES): RecipeId[] {
  const inStage = new Set(catalog.entries.filter((e) => e.chapter === chapter).map((e) => e.recipeId as string));
  return recipes.filter((r) => inStage.has(r.id)).map((r) => r.id);
}

/** What one round's reputation gain did (RESULT shows it once; never saved). */
export interface ReputationGain {
  gained: number;
  before: number;
  after: number;
  chapterBefore: number;
  chapterAfter: number;
  /** The floor of the chapter after `chapterAfter`, or `null` once the last chapter is open. */
  nextFloor: number | null;
}

/** Adds `gained` to the reputation (cumulative, Q1). A zero gain returns `shop` itself. */
export function addReputation(
  shop: ShopProgressState,
  gained: number,
  table: CompleteReputationTable,
): { shop: ShopProgressState; gain: ReputationGain } {
  const before = shop.reputation;
  const safe = Number.isFinite(gained) && gained > 0 ? gained : 0;
  const after = before + safe;
  return {
    shop: safe === 0 ? shop : { ...shop, reputation: after },
    gain: {
      gained: safe,
      before,
      after,
      chapterBefore: chapterForReputation(before, table.chapterFloors),
      chapterAfter: chapterForReputation(after, table.chapterFloors),
      nextFloor: nextChapterFloor(after, table.chapterFloors),
    },
  };
}
