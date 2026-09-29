/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the query shared by the ingredient library, Inventory and
 * Shop (Owner Decision Gate §10). It filters and orders descriptors the caller already built from
 * existing authority; it never computes a price, a stock change or an unlock.
 *
 * - Only OWNED ingredients are ever returned (LOCKED / not-yet-bought never appear). Shop's NEW + OWNED
 *   universe is NOT this model's scope and must never be added here.
 * - LC-R0 foundation: no membership filter. LC-R1 adds a single `shelves` input backed by
 *   `src/data/ingredientShelf.ts`; there is no category / family axis and no counts before Phase 5.
 * - Every sort is a total order ending in catalog order, so results never depend on input order.
 */
import { compareReading, matchesSearch } from "./catalogText";
import {
  compareCatalogOrder,
  hasStock,
  indexCatalog,
  type CatalogIngredient,
  type OwnershipView,
} from "./catalogTypes";
import type { UsageSession } from "./usageSignals";

export type CatalogSort = "catalog" | "recent" | "reading" | "stock";

export interface CatalogQuery {
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
  const favorites = new Set(usage.favorites);
  const recentRank = new Map(usage.recent.map((id, i) => [id, i]));
  let rows = ownedCatalog(catalog, ownership).filter(
    (item) =>
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
