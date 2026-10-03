/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the cooking tray's working set ("手元").
 *
 * Authority: Owner Decision Gate §5 / §17 (LC-OD-1, -4, -7, -16b, -17).
 *
 * - `capacity` is an argument (LC-OD-4, closed by OD-5: the production capacity is 12).
 * - Inactive when the category's owned count fits the capacity: the result is then exactly today's
 *   tray (every owned ingredient of the category in catalog order, zero stock included), so small
 *   catalogs see no change.
 * - Active otherwise: placed > pinned > hint > favorite > recent > new > fill. Placed / pinned are
 *   the player's explicit choices and are kept even at zero stock; placed are kept even beyond capacity (LC-R5-d); every automatic source skips
 *   zero stock (LC-OD-17). Fill is catalog order. Duplicates keep their highest source.
 *
 * Privacy boundary (B-1 / B-2): the input has no recipe, target, matcher, near-miss, reserve or
 * Dinner-target field, and this module imports no module that knows them. Hints arrive only as
 * `DisclosedHints` (./hintDisclosure.ts). The function reads the declared fields by name, so an
 * extra property on the input object can never change the result.
 */
import {
  cleanIds,
  compareCatalogOrder,
  hasStock,
  indexCatalog,
  type CatalogCategory,
  type CatalogIngredient,
  type OwnershipView,
} from "./catalogTypes";
import type { DisclosedHints } from "./hintDisclosure";
import type { UsageSession } from "./usageSignals";

export type WorkingSetSource = "placed" | "pinned" | "hint" | "favorite" | "recent" | "new" | "fill";

export const WORKING_SET_SOURCE_ORDER: readonly WorkingSetSource[] = [
  "placed",
  "pinned",
  "hint",
  "favorite",
  "recent",
  "new",
  "fill",
];

export interface WorkingSetInput {
  category: CatalogCategory;
  /** Maximum items when active. A positive integer. */
  capacity: number;
  catalog: readonly CatalogIngredient[];
  ownership: OwnershipView;
  /** Ingredients on the pizza now, in placement order. */
  placedIds: readonly string[];
  /** Ingredients the player put on the counter from the library, in the order chosen. */
  pinnedIds: readonly string[];
  /** Hints the sheet has shown (./hintDisclosure.ts) -- nothing else about hints. */
  disclosedHints: DisclosedHints;
  usage: UsageSession;
}

export interface WorkingSetItem {
  id: string;
  source: WorkingSetSource;
}

export interface WorkingSet {
  active: boolean;
  items: readonly WorkingSetItem[];
  /** Pinned ids that did not fit the capacity (placed ids never overflow, LC-R5-d). */
  overflowIds: readonly string[];
}

export function selectWorkingSet(input: WorkingSetInput): WorkingSet {
  const { category, capacity, catalog, ownership, placedIds, pinnedIds, disclosedHints, usage } = input;
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError(`capacity must be a positive integer: ${capacity}`);

  const byId = indexCatalog(catalog);
  const owned = new Set(ownership.ownedIds);
  const inCategory = (id: string) => byId.get(id)?.category === category && owned.has(id);
  const ownedInCategory = [...byId.values()].filter((item) => inCategory(item.id)).sort(compareCatalogOrder);

  if (ownedInCategory.length <= capacity) {
    return { active: false, items: ownedInCategory.map((item) => ({ id: item.id, source: "fill" })), overflowIds: [] };
  }

  const byCatalog = (ids: readonly string[]) =>
    ids.map((id) => byId.get(id)!).sort(compareCatalogOrder).map((item) => item.id);
  const stocked = (id: string) => hasStock(ownership.stock(id));
  const sources: Record<WorkingSetSource, string[]> = {
    placed: cleanIds(placedIds).filter(inCategory),
    pinned: cleanIds(pinnedIds).filter(inCategory),
    hint: byCatalog(cleanIds(disclosedHints.namedIngredientIds).filter(inCategory)).filter(stocked),
    favorite: cleanIds(usage.favorites).filter(inCategory).filter(stocked),
    recent: cleanIds(usage.recent).filter(inCategory).filter(stocked),
    new: cleanIds(usage.newlyOwned).filter(inCategory).filter(stocked),
    fill: ownedInCategory.map((item) => item.id).filter(stocked),
  };

  const items: WorkingSetItem[] = [];
  const seen = new Set<string>();
  const overflowIds: string[] = [];
  for (const source of WORKING_SET_SOURCE_ORDER) {
    for (const id of sources[source]) {
      if (seen.has(id)) continue;
      seen.add(id);
      // LC-R5-d (OD-R5d-2): a placed ingredient is on the pizza already, so it is NEVER dropped for capacity
      // (a safety contract: an ingredient the player used must not become unreachable). Pins take the rest.
      if (source === "placed" || items.length < capacity) items.push({ id, source });
      else if (source === "pinned") overflowIds.push(id);
    }
  }
  return { active: true, items, overflowIds };
}
