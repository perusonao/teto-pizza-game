/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the query shared by the ingredient library, Inventory and
 * Shop (Owner Decision Gate §10). It filters and orders descriptors the caller already built from
 * existing authority; it never computes a price, a stock change or an unlock.
 *
 * - Only OWNED ingredients are ever returned (LOCKED / not-yet-bought never appear).
 * - Counts are always over the player's own owned rows (never over a recipe-derived set, H-H).
 * - Every sort is a total order ending in catalog order, so results never depend on input order.
 */
import { compareReading, matchesSearch } from "./catalogText";
import {
  compareCatalogOrder,
  hasStock,
  indexCatalog,
  type CatalogCategory,
  type CatalogFamilyId,
  type CatalogIngredient,
  type OwnershipView,
} from "./catalogTypes";
import type { UsageSession } from "./usageSignals";

export type CatalogSort = "catalog" | "recent" | "reading" | "stock";

export interface CatalogQuery {
  category?: CatalogCategory;
  families?: readonly CatalogFamilyId[];
  text?: string;
  only?: { favorites?: boolean; recent?: boolean; inStock?: boolean };
  sort?: CatalogSort;
  /** LC-OD-17: zero-stock rows go last (default true). */
  zeroStockLast?: boolean;
}

export function ownedCatalog(catalog: readonly CatalogIngredient[], ownership: OwnershipView): CatalogIngredient[] {
  const owned = new Set(ownership.ownedIds);
  return [...indexCatalog(catalog).values()].filter((item) => owned.has(item.id)).sort(compareCatalogOrder);
}

function stockRank(value: ReturnType<OwnershipView["stock"]>): number {
  return value === "UNLIMITED" ? Number.POSITIVE_INFINITY : Number.isFinite(value) ? value : 0;
}

export function queryCatalog(
  catalog: readonly CatalogIngredient[],
  ownership: OwnershipView,
  usage: UsageSession,
  query: CatalogQuery = {},
): CatalogIngredient[] {
  const families = query.families ? new Set<string>(query.families) : null;
  const favorites = new Set(usage.favorites);
  const recentRank = new Map(usage.recent.map((id, i) => [id, i]));
  let rows = ownedCatalog(catalog, ownership).filter(
    (item) =>
      (query.category === undefined || item.category === query.category) &&
      (families === null || (item.family !== null && families.has(item.family))) &&
      (query.text === undefined || matchesSearch(item, query.text)) &&
      (!query.only?.favorites || favorites.has(item.id)) &&
      (!query.only?.recent || recentRank.has(item.id)) &&
      (!query.only?.inStock || hasStock(ownership.stock(item.id))),
  );
  const sort = query.sort ?? "catalog";
  if (sort === "reading") rows = rows.sort(compareReading);
  if (sort === "recent") {
    rows = rows.sort((a, b) => {
      const ra = recentRank.get(a.id) ?? Number.POSITIVE_INFINITY;
      const rb = recentRank.get(b.id) ?? Number.POSITIVE_INFINITY;
      return ra !== rb ? (ra < rb ? -1 : 1) : compareCatalogOrder(a, b);
    });
  }
  if (sort === "stock") {
    rows = rows.sort((a, b) => {
      const sa = stockRank(ownership.stock(a.id));
      const sb = stockRank(ownership.stock(b.id));
      return sa !== sb ? (sa > sb ? -1 : 1) : compareCatalogOrder(a, b);
    });
  }
  if (query.zeroStockLast ?? true) {
    const inStock = rows.filter((item) => hasStock(ownership.stock(item.id)));
    const empty = rows.filter((item) => !hasStock(ownership.stock(item.id)));
    rows = [...inStock, ...empty];
  }
  return rows;
}

/** Owned ingredients per family (optionally within one category). Only the player's own rows. */
export function familyCounts(
  catalog: readonly CatalogIngredient[],
  ownership: OwnershipView,
  category?: CatalogCategory,
): Map<CatalogFamilyId, number> {
  const counts = new Map<CatalogFamilyId, number>();
  for (const item of ownedCatalog(catalog, ownership)) {
    if (item.family === null || (category !== undefined && item.category !== category)) continue;
    counts.set(item.family, (counts.get(item.family) ?? 0) + 1);
  }
  return counts;
}
