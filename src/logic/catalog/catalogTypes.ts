/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the shared vocabulary of the catalog model.
 *
 * Authority: docs/reports/TETO_LARGE-CATALOG-UX_Owner-Decision-Gate.md (§17 Owner Authority) and
 * docs/reports/TETO_LARGE-CATALOG-UX_LC-1_Implementation-Gate.md.
 *
 * A `CatalogIngredient` describes how an ingredient is *shown* (name, category, family, a stable
 * order). It deliberately carries nothing about recipes: which recipe uses an ingredient, whether a
 * recipe is discovered, the hint target and the matcher all stay outside this model (privacy
 * boundary B-1 / B-2, pinned by catalogBoundary.test.ts).
 */
/** A family id from the DH4-1 taxonomy (`meat`, `seafood`, ...). The taxonomy itself is injected by
 *  the caller: DH4-1 is still unwired (its guard test forbids production imports of the taxonomy),
 *  so this model never imports it. */
export type CatalogFamilyId = string;

/** The part of the DH4-1 taxonomy the model needs: each family and its group. */
export interface CatalogFamilyTable {
  families: readonly { id: CatalogFamilyId; group: string }[];
}

export type CatalogCategory = "sauce" | "cheese" | "topping";

export interface CatalogIngredient {
  id: string;
  category: CatalogCategory;
  nameJa: string;
  /** Search reading (hiragana) for names that contain kanji (LC-OD-15). Optional. */
  readingJa?: string;
  /** DH4-1 L2 family (toppings only, OD-TAX-2/3); `null` when the ingredient has none. */
  family: CatalogFamilyId | null;
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
