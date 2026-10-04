/**
 * Ingredient Category Tabs 1.0, Phase 1 (docs/reports/TETO_INGREDIENT-CATEGORY-TABS_1.0_Fresh-Audit-Design.md):
 * the pure "shelf" authority / helper shared by the future Shop, Ingredients and Pizza Builder
 * filter chips. Pure display data; UNWIRED (no screen imports it yet).
 *
 * A shelf is NOT a new taxonomy. It is a composed view of two existing authorities:
 * - a topping's shelf is its DH4-1 family (./ingredientTaxonomy.ts), the same ids Hint 5.0 reads;
 * - a sauce / cheese has no family, so its category (./ingredients.ts) is its shelf.
 * One ingredient has exactly one shelf. Nothing here stores an ingredient -> shelf table, so it
 * cannot drift from the two sources.
 *
 * Fail-closed (OD-CT-7): an id that is not in the production catalog, or a topping without a
 * family row, has NO shelf (`null`). It is never guessed. Such an ingredient is only reachable
 * through the "all" filter. `auditShelfAuthority` reports every such case so a catalog expansion
 * (62 / 172) that ships an unclassified topping fails a gate instead of silently disappearing
 * from every shelf tab.
 *
 * Labels: a sauce / cheese shelf reads `CATEGORY_LABEL`; a family shelf reads `FAMILY_DISPLAY`
 * (./familyDisplay.ts), the one player-facing family label authority that Hint 5.0 re-publishes
 * (Pantry / Category Tabs OD-2 / OD-A: the shelf label and the Hint label are the same string, so they
 * cannot drift). This module still never imports Hint 5.0's display module (./hintClassDisplay.ts):
 * the shared part is the leaf `familyDisplay`, not Hint.
 *
 * Two-tier tabs (OD-1 / OD-8): a *major* tab (すべて / ソース / チーズ / 具材) selects a ROLE group and, only for
 * 具材, an optional family. The selection helpers below turn a selection into a set of shelf ids (an OR over
 * shelves); they classify nothing and add no taxonomy.
 *
 * Nothing here reads or writes game state, save, inventory, unlock, purchase, selection or
 * scoring; every function returns fresh arrays and never mutates its input.
 */
import { FAMILY_DISPLAY } from "./familyDisplay";
import { CATEGORY_LABEL, getIngredient, INGREDIENTS, type Ingredient } from "./ingredients";
import {
  ATTRIBUTE_FAMILIES,
  ingredientAttributeFamily,
  TAXONOMY_INGREDIENT_IDS,
  type AttributeFamilyId,
} from "./ingredientTaxonomy";

export type ShelfCategoryId = "sauce" | "cheese";
export type IngredientShelfId = ShelfCategoryId | AttributeFamilyId;
/** What a filter chip can select: one shelf, or everything (including unclassified ids). */
export type ShelfFilter = "all" | IngredientShelfId;

export interface IngredientShelf {
  readonly id: IngredientShelfId;
  readonly kind: "category" | "family";
  /** UI shelf label (context: filter chip). A family reads the same string as Hint 5.0 (./familyDisplay.ts). */
  readonly labelJa: string;
}

export const SHELF_ALL_LABEL_JA = "すべて";

/**
 * Deterministic order: sauce, cheese, then the DH4-1 families in `ATTRIBUTE_FAMILIES` order
 * (meat, seafood, vegetable, fruit, herb, spice, other), which is also Hint 5.0's family order.
 */
export const INGREDIENT_SHELVES: readonly IngredientShelf[] = Object.freeze(
  (
    [
      { id: "sauce", kind: "category", labelJa: CATEGORY_LABEL.sauce },
      { id: "cheese", kind: "category", labelJa: CATEGORY_LABEL.cheese },
      ...ATTRIBUTE_FAMILIES.map((f): IngredientShelf => ({ id: f.id, kind: "family", labelJa: FAMILY_DISPLAY[f.id].labelJa })),
    ] satisfies IngredientShelf[]
  ).map((shelf) => Object.freeze(shelf)),
);

export const INGREDIENT_SHELF_ORDER: readonly IngredientShelfId[] = Object.freeze(
  INGREDIENT_SHELVES.map((s) => s.id),
);

const SHELF_BY_ID = new Map<string, IngredientShelf>(INGREDIENT_SHELVES.map((s) => [s.id, s]));

export function isIngredientShelfId(value: unknown): value is IngredientShelfId {
  return typeof value === "string" && SHELF_BY_ID.has(value);
}

export function ingredientShelfLabel(filter: ShelfFilter): string | null {
  if (filter === "all") return SHELF_ALL_LABEL_JA;
  return SHELF_BY_ID.get(filter)?.labelJa ?? null;
}

/** The shelf of a production ingredient, or `null` when it has none (unknown id, unclassified topping). */
function shelfOfIngredient(ingredient: Ingredient | undefined): IngredientShelfId | null {
  if (!ingredient) return null;
  if (ingredient.category === "sauce" || ingredient.category === "cheese") return ingredient.category;
  return ingredientAttributeFamily(ingredient.id);
}

/**
 * The shelf of `ingredientOrId` (an id string, or any object with a string `id`), looked up in the
 * production catalog by id. The caller's own `category` is never trusted. `null` = fail-closed.
 */
export function ingredientShelf(ingredientOrId: unknown): IngredientShelfId | null {
  const id =
    typeof ingredientOrId === "string"
      ? ingredientOrId
      : typeof ingredientOrId === "object" && ingredientOrId !== null && "id" in ingredientOrId
        ? (ingredientOrId as { id: unknown }).id
        : null;
  return typeof id === "string" ? shelfOfIngredient(getIngredient(id)) : null;
}

/**
 * Display filter. `"all"` returns every item (also the ones with no shelf); a shelf returns only
 * the items whose shelf it is; an unknown filter returns nothing. Input order is kept, the input
 * array and its items are never mutated, and the result is always a new array.
 */
export function filterByShelf<T extends { id: string }>(items: readonly T[], filter: unknown): T[] {
  if (filter === "all") return [...items];
  if (!isIngredientShelfId(filter)) return [];
  return items.filter((item) => ingredientShelf(item.id) === filter);
}

/** The shelves that hold at least one of `items`, in `INGREDIENT_SHELF_ORDER`. No counts. */
export function shelvesPresent(items: readonly { id: string }[]): IngredientShelfId[] {
  const present = new Set<IngredientShelfId>();
  for (const item of items) {
    const shelf = ingredientShelf(item.id);
    if (shelf) present.add(shelf);
  }
  return INGREDIENT_SHELF_ORDER.filter((id) => present.has(id));
}

/** The family shelf ids, in authority order (meat, seafood, vegetable, fruit, herb, spice, other). */
export const FAMILY_SHELF_IDS: readonly AttributeFamilyId[] = Object.freeze(ATTRIBUTE_FAMILIES.map((f) => f.id));

/** The ROLE groups a major tab can select. `topping` is the internal id; players read 「具材」. */
export type MajorShelfId = "sauce" | "cheese" | "topping";
export type MajorFilter = "all" | MajorShelfId;
export const MAJOR_SHELF_ORDER: readonly MajorShelfId[] = Object.freeze(["sauce", "cheese", "topping"] as const);
export type FamilyFilter = "all" | AttributeFamilyId;

/** Two-tier tab selection. `family` is only meaningful while `major === "topping"` (otherwise it is "all"). */
export interface ShelfSelection {
  major: MajorFilter;
  family: FamilyFilter;
}

export const SELECTION_ALL: ShelfSelection = Object.freeze({ major: "all", family: "all" });

export function majorLabel(major: MajorFilter): string {
  return major === "all" ? SHELF_ALL_LABEL_JA : CATEGORY_LABEL[major];
}

function majorOfShelf(shelf: IngredientShelfId): MajorShelfId {
  return shelf === "sauce" || shelf === "cheese" ? shelf : "topping";
}

/** The major tabs that hold at least one of `items`, in `MAJOR_SHELF_ORDER`. */
export function majorsPresent(items: readonly { id: string }[]): MajorShelfId[] {
  const present = new Set(shelvesPresent(items).map(majorOfShelf));
  return MAJOR_SHELF_ORDER.filter((m) => present.has(m));
}

/** The family shelves that hold at least one of `items`, in authority order. */
export function familiesPresent(items: readonly { id: string }[]): AttributeFamilyId[] {
  const present = new Set<string>(shelvesPresent(items));
  return FAMILY_SHELF_IDS.filter((f) => present.has(f));
}

/**
 * The shelf ids a selection matches (an OR over shelves), or `null` for no restriction (「すべて」, which also
 * includes unclassified ids). 「具材」 with no family is all 7 family shelves: a topping without a family row is
 * reachable only through 「すべて」 (fail-closed, OD-CT-7; `auditShelfAuthority` is the gate).
 */
export function shelvesForSelection(selection: ShelfSelection): readonly IngredientShelfId[] | null {
  if (selection.major === "all") return null;
  if (selection.major === "topping") return selection.family === "all" ? FAMILY_SHELF_IDS : [selection.family];
  return [selection.major];
}

/** Display filter for a selection; input order kept, always a new array. */
export function filterBySelection<T extends { id: string }>(items: readonly T[], selection: ShelfSelection): T[] {
  const shelves = shelvesForSelection(selection);
  if (shelves === null) return [...items];
  const wanted = new Set<string>(shelves);
  return items.filter((item) => {
    const shelf = ingredientShelf(item.id);
    return shelf !== null && wanted.has(shelf);
  });
}

/**
 * A stored selection read against the rows now listed: a major tab or a family that no row holds reads as
 * 「すべて」 (derived while rendering, like the other shelf screens), and a family never outlives its major.
 */
export function resolveSelection(selection: ShelfSelection, items: readonly { id: string }[]): ShelfSelection {
  if (selection.major === "all" || !majorsPresent(items).includes(selection.major)) return SELECTION_ALL;
  if (selection.major !== "topping" || !familiesPresent(items).includes(selection.family as AttributeFamilyId)) {
    return selection.family === "all" ? selection : { major: selection.major, family: "all" };
  }
  return selection;
}

/** OD-5 / OD-D: another major resets the family to 「すべて」; re-tapping the active major changes nothing. */
export function selectMajor(selection: ShelfSelection, major: MajorFilter): ShelfSelection {
  return selection.major === major ? selection : { major, family: "all" };
}

/** A family can only be chosen under 「具材」. */
export function selectFamily(selection: ShelfSelection, family: FamilyFilter): ShelfSelection {
  return selection.major === "topping" ? { major: "topping", family } : selection;
}

export interface ShelfAuditInput {
  ingredients: readonly { id: string; category: string }[];
  /** The taxonomy row ids in table order, duplicates preserved (`TAXONOMY_INGREDIENT_IDS`). */
  familyRowIds: readonly string[];
  familyOf: (ingredientId: string) => string | null;
}

export interface ShelfAuditResult {
  ok: boolean;
  /** Ingredients with no shelf: a topping without a family (sauce / cheese always have one). */
  unclassified: string[];
  /** Taxonomy row ids that appear more than once (a Map would silently keep the last). */
  duplicateRows: string[];
  /** Taxonomy rows whose id is not an ingredient of the audited catalog. */
  orphanRows: string[];
  /** Taxonomy rows on a sauce / cheese (they must use their category as shelf, never a family). */
  nonToppingRows: string[];
  /** Ingredients whose category is not sauce / cheese / topping. */
  unknownCategory: string[];
}

/**
 * Coverage validation over an explicit catalog + taxonomy (defaults: production). `ok` is true
 * only when every ingredient has exactly one shelf and the taxonomy table is clean. Injectable so
 * a future catalog (62 / 172) can be audited by a test without touching production data.
 */
export function auditShelfAuthority(
  input: ShelfAuditInput = {
    ingredients: INGREDIENTS,
    familyRowIds: TAXONOMY_INGREDIENT_IDS,
    familyOf: ingredientAttributeFamily,
  },
): ShelfAuditResult {
  const validFamilies = new Set<string>(ATTRIBUTE_FAMILIES.map((f) => f.id));
  const byId = new Map(input.ingredients.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const duplicateRows: string[] = [];
  for (const id of input.familyRowIds) {
    if (seen.has(id) && !duplicateRows.includes(id)) duplicateRows.push(id);
    seen.add(id);
  }
  const unclassified: string[] = [];
  const unknownCategory: string[] = [];
  for (const i of input.ingredients) {
    if (i.category === "sauce" || i.category === "cheese") continue;
    if (i.category !== "topping") unknownCategory.push(i.id);
    else {
      const family = input.familyOf(i.id);
      if (family === null || !validFamilies.has(family)) unclassified.push(i.id);
    }
  }
  const orphanRows = [...seen].filter((id) => !byId.has(id));
  const nonToppingRows = [...seen].filter((id) => {
    const c = byId.get(id)?.category;
    return c !== undefined && c !== "topping";
  });
  return {
    ok:
      unclassified.length === 0 &&
      duplicateRows.length === 0 &&
      orphanRows.length === 0 &&
      nonToppingRows.length === 0 &&
      unknownCategory.length === 0,
    unclassified,
    duplicateRows,
    orphanRows,
    nonToppingRows,
    unknownCategory,
  };
}
