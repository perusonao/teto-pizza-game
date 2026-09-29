/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the query shared by the ingredient library, Inventory and
 * Shop (Owner Decision Gate §10). It filters and orders descriptors the caller already built from
 * existing authority; it never computes a price, a stock change or an unlock.
 *
 * - Only OWNED ingredients are ever returned (LOCKED / not-yet-bought never appear). Shop's NEW + OWNED
 *   universe is NOT this model's scope and must never be added here.
 * - Membership: one `shelves` input compared with the descriptor's `shelf` (copied from
 *   `src/data/ingredientShelf.ts` by catalogSource). This module imports no shelf VALUE and classifies nothing;
 *   there is no category / family axis and no counts before Phase 5. 「すべて」 is "no `shelves`" (not a shelf id).
 * - Every sort is a total order ending in catalog order, so results never depend on input order.
 */
import type { IngredientShelfId } from "../../data/ingredientShelf";
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
  /** Undefined / empty = no shelf filter (「すべて」, includes unclassified). Otherwise only items whose
   *  `shelf` is one of these (a `null` shelf never matches). ANDed with every other input. */
  shelves?: readonly IngredientShelfId[];
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
  const shelves = query.shelves && query.shelves.length > 0 ? new Set<string>(query.shelves) : null;
  const favorites = new Set(usage.favorites);
  const recentRank = new Map(usage.recent.map((id, i) => [id, i]));
  let rows = ownedCatalog(catalog, ownership).filter(
    (item) =>
      (shelves === null || (item.shelf !== null && shelves.has(item.shelf))) &&
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
