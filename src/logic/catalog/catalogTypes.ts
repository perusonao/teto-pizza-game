/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the shared vocabulary of the catalog model.
 *
 * Authority: docs/reports/TETO_LARGE-CATALOG-UX_Fresh-Rebase-Revision-Gate.md (§3, §17) -- the Owner
 * Authority in docs/PROJECT_HANDOFF.md ("Large Catalog UX — current SSOT"). Ported from PR #272
 * (frozen at f5b0ab5) in LC-R0. Membership (which shelf an ingredient is on) is NOT decided here:
 * `src/data/ingredientShelf.ts` is the only membership authority. LC-R1 adds `shelf`, a value copied
 * from `ingredientShelf()` by `catalogSource.ts` (nothing in this model classifies).
 *
 * A `CatalogIngredient` describes how an ingredient is *shown* (name, making-step category, a stable
 * order). It deliberately carries nothing about recipes: which recipe uses an ingredient, whether a
 * recipe is discovered, the hint target and the matcher all stay outside this model (privacy
 * boundary B-1 / B-2, pinned by catalogBoundary.test.ts).
 */
import type { IngredientShelfId } from "../../data/ingredientShelf";

export type CatalogCategory = "sauce" | "cheese" | "topping";

export interface CatalogIngredient {
  id: string;
  category: CatalogCategory;
  nameJa: string;
  /** The ingredient's shelf, copied from `ingredientShelf()`; `null` = unclassified (fail-closed: matches
   *  no shelf filter, appears only when no shelf filter is applied). Never derived here. */
  shelf: IngredientShelfId | null;
  /** Search reading (hiragana) for names that contain kanji (LC-OD-15). Optional. */
  readingJa?: string;
  /** The only ordering key for ties: catalog declaration order. */
  catalogIndex: number;
}

/** Remaining stock of an owned ingredient: a count, or unlimited for onboarding starters. */
export type StockValue = number | "UNLIMITED";

/** What the player owns and how much is left. Read from existing authority by the caller. */
export interface OwnershipView {
  ownedIds: readonly string[];
  stock: (ingredientId: string) => StockValue;
}

export function hasStock(value: StockValue): boolean {
  return value === "UNLIMITED" || (Number.isFinite(value) && value > 0);
}

/** Catalog order, then id: a total order, so every result is independent of input order. */
export function compareCatalogOrder(a: CatalogIngredient, b: CatalogIngredient): number {
  if (a.catalogIndex !== b.catalogIndex) return a.catalogIndex - b.catalogIndex;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** First descriptor per id (a duplicated id in the input never produces two entries). */
export function indexCatalog(catalog: readonly CatalogIngredient[]): Map<string, CatalogIngredient> {
  const byId = new Map<string, CatalogIngredient>();
  for (const item of catalog) {
    if (typeof item?.id === "string" && !byId.has(item.id)) byId.set(item.id, item);
  }
  return byId;
}

/** Only string ids, de-duplicated, first occurrence kept. Untrusted input never throws. */
export function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
