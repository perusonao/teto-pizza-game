/**
 * Large Catalog UX LC-R5-d (pure, DORMANT): the hand as the Builder tray shows it, and the #197 page-level transition.
 *
 * - Priority (`selectWorkingSet`: placed > pinned > hint > favorite > recent > new > fill) decides which ingredients
 *   are IN the hand. The tray shows them in CATALOG ORDER (OD-R5d-1): a change of priority alone (same ingredients,
 *   same catalog order) is not a visible hand change, so a placement or a harmless pin never resets the page.
 * - `resolveTrayHandIds` is `null` unless enforcement is on, the round is FREE Cooking (never Dinner / guided / Lunch
 *   Rush), a tray step is showing and the hand is actually active. `null` = today's tray code path, untouched.
 * - `handTrayTransition`: an actual change of the tray list => page 0; the selection survives only if it is on the NEW
 *   page 0 (page-level, never "somewhere in the whole hand"), otherwise it is cleared (OD-R5d-1, #197).
 * - `pinFitsHand` (OD-R5d-3, Model C): a pin is accepted only if it lands in the visible hand.
 *
 * Reads ids, the catalog descriptor and stock only: no recipe, discovery, hint, matcher or save input exists here.
 */
import { MAX_INGREDIENT_PALETTE_SLOTS } from "../../data/ingredients";
import { indexCatalog, compareCatalogOrder, type CatalogCategory, type CatalogIngredient, type OwnershipView } from "./catalogTypes";
import type { LargeCatalogRoundGate } from "./freeEligibility";
import { HAND_ENFORCEMENT_ENABLED, type HandCapacityCandidate } from "./handPolicy";
import { resolveHand, recentlyAcquiredIds, type HandSession } from "./handSession";
import { emptyUsageSession } from "./usageSignals";

export interface TrayHandInput {
  round: LargeCatalogRoundGate;
  /** The tray step's category, or `null` when no tray is showing (DOUGH, not PREPARE, ...). */
  category: CatalogCategory | null;
  catalog: readonly CatalogIngredient[];
  ownership: OwnershipView;
  session: HandSession;
  /** Ingredients on the pizza now. */
  placedIds: readonly string[];
  /** Starter ingredient ids (excluded from the "recently acquired" tier). */
  starterIds: readonly string[];
  candidateCapacity: HandCapacityCandidate;
}

/** The tray's ingredient ids in catalog order, or `null` = use today's tray. */
export function resolveTrayHandIds(input: TrayHandInput): string[] | null {
  if (!HAND_ENFORCEMENT_ENABLED || input.category === null) return null;
  const hand = resolveHand({
    round: input.round,
    category: input.category,
    catalog: input.catalog,
    ownership: input.ownership,
    session: input.session,
    usage: { ...emptyUsageSession(), newlyOwned: recentlyAcquiredIds(input.ownership.ownedIds, input.starterIds) },
    placedIds: input.placedIds,
    candidateCapacity: input.candidateCapacity,
  });
  if (hand === null || !hand.active) return null;
  const byId = indexCatalog(input.catalog);
  return hand.items
    .map((item) => byId.get(item.id)!)
    .sort(compareCatalogOrder)
    .map((item) => item.id);
}

/** Model C (OD-R5d-3): with `id` newly pinned in `candidate`, is `id` on the visible hand? (Nothing hidden = fits.) */
export function pinFitsHand(input: TrayHandInput, candidate: HandSession, id: string): boolean {
  const ids = resolveTrayHandIds({ ...input, session: candidate });
  return ids === null || ids.includes(id);
}

export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function trayPageIds(list: readonly string[], page: number): string[] {
  return list.slice(page * MAX_INGREDIENT_PALETTE_SLOTS, (page + 1) * MAX_INGREDIENT_PALETTE_SLOTS);
}

export interface HandTrayTransition {
  /** The tray list actually changed (membership or catalog order). */
  changed: boolean;
  /** The page to show: 0 after a change; unchanged lists say 0 too and the caller keeps its own page. */
  page: 0;
  selectedIngredientId: string | null;
}

export function handTrayTransition(input: {
  before: readonly string[];
  after: readonly string[];
  selectedIngredientId: string | null;
}): HandTrayTransition {
  const { before, after, selectedIngredientId } = input;
  if (sameIds(before, after)) return { changed: false, page: 0, selectedIngredientId };
  const keep = selectedIngredientId !== null && trayPageIds(after, 0).includes(selectedIngredientId);
  return { changed: true, page: 0, selectedIngredientId: keep ? selectedIngredientId : null };
}
