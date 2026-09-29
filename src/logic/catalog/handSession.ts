/**
 * Large Catalog UX LC-R2 (pure, UNWIRED): the hand's own state and operations.
 *
 * - `HandSession` = the ingredients the player put on the hand ("pinned" in `selectWorkingSet`), per making-step
 *   category, in the order chosen. Session-only (LC-OD-5): nothing here reads or writes the save.
 * - Operations only rearrange ids. They never classify (no shelf, no taxonomy), never search, never read Hint
 *   data, never change ownership or stock. An id is accepted only if it is OWNED and belongs to the category.
 *   Zero stock is accepted: an explicit choice stays on the hand (LC-OD-17 only bars AUTOMATIC sources).
 * - The hand's pins are NOT the pantry's pending picks (OD-2) and NOT `selectedIngredientId`; the selection
 *   helper below only mirrors PR #197 for the latter.
 */
import { isLargeCatalogEligible, type LargeCatalogRoundGate } from "./freeEligibility";
import { cleanIds, indexCatalog, type CatalogCategory, type CatalogIngredient, type OwnershipView } from "./catalogTypes";
import { handCapacityFor, type HandCapacityCandidate } from "./handPolicy";
import { NO_DISCLOSED_HINTS } from "./hintDisclosure";
import { DEFAULT_NEWLY_OWNED_CAP, type UsageSession } from "./usageSignals";
import { selectWorkingSet, type WorkingSet } from "./workingSet";

export type HandSession = Readonly<Record<CatalogCategory, readonly string[]>>;

const CATEGORIES: readonly CatalogCategory[] = ["sauce", "cheese", "topping"];

export function emptyHandSession(): HandSession {
  return { sauce: [], cheese: [], topping: [] };
}

/** Untrusted -> well-formed. Own properties only; unknown shapes become empty lists. */
export function sanitizeHandSession(raw: unknown): HandSession {
  const own = (key: CatalogCategory) =>
    raw !== null && typeof raw === "object" && Object.hasOwn(raw, key) ? (raw as Record<string, unknown>)[key] : undefined;
  return { sauce: cleanIds(own("sauce")), cheese: cleanIds(own("cheese")), topping: cleanIds(own("topping")) };
}

export interface HandContext {
  category: CatalogCategory;
  catalog: readonly CatalogIngredient[];
  ownership: OwnershipView;
}

function acceptable(ids: unknown, ctx: HandContext): string[] {
  const byId = indexCatalog(ctx.catalog);
  const owned = new Set(ctx.ownership.ownedIds);
  return cleanIds(ids).filter((id) => byId.get(id)?.category === ctx.category && owned.has(id));
}

function withCategory(session: HandSession, category: CatalogCategory, ids: readonly string[]): HandSession {
  return { ...emptyHandSession(), ...session, [category]: ids };
}

/** Appends the acceptable, not-yet-present ids in the order given; the existing order is kept. */
export function addToHand(session: HandSession, ids: readonly string[], ctx: HandContext): HandSession {
  const current = acceptable(session[ctx.category], ctx);
  const add = acceptable(ids, ctx).filter((id) => !current.includes(id));
  return withCategory(session, ctx.category, [...current, ...add]);
}

export function removeFromHand(session: HandSession, id: string, category: CatalogCategory): HandSession {
  if (!CATEGORIES.includes(category)) return session;
  return withCategory(session, category, session[category].filter((existing) => existing !== id));
}

/** Replaces the whole category's pins with the acceptable ids, in the order given. */
export function replaceHand(session: HandSession, ids: readonly string[], ctx: HandContext): HandSession {
  return withCategory(session, ctx.category, acceptable(ids, ctx));
}

/** Drops pins that are no longer owned / no longer in the catalog (e.g. after a reset). */
export function pruneHand(session: HandSession, ctx: HandContext): HandSession {
  return withCategory(session, ctx.category, acceptable(session[ctx.category], ctx));
}

export interface ResolveHandInput {
  round: LargeCatalogRoundGate;
  category: CatalogCategory;
  catalog: readonly CatalogIngredient[];
  ownership: OwnershipView;
  session: HandSession;
  usage: UsageSession;
  /** Ingredients on the pizza now (empty at round start). */
  placedIds?: readonly string[];
  /** Capacity candidate under comparison; enforcement itself is governed by `handPolicy`. */
  candidateCapacity: HandCapacityCandidate;
}

/**
 * The hand for a round, or `null` = the feature is OFF and the CURRENT paged tray must be used untouched
 * (every non-FREE round, and Dinner in particular). Deterministic; OWNED only; hints contribute nothing yet.
 */
export function resolveHand(input: ResolveHandInput): WorkingSet | null {
  if (!isLargeCatalogEligible(input.round)) return null;
  const owned = new Set(input.ownership.ownedIds);
  const ownedInCategory = input.catalog.filter((i) => i.category === input.category && owned.has(i.id)).length;
  return selectWorkingSet({
    category: input.category,
    capacity: handCapacityFor(ownedInCategory, input.candidateCapacity),
    catalog: input.catalog,
    ownership: input.ownership,
    placedIds: input.placedIds ?? [],
    pinnedIds: input.session[input.category],
    disclosedHints: NO_DISCLOSED_HINTS,
    usage: input.usage,
  });
}

export function handVisibleIds(hand: WorkingSet): string[] {
  return hand.items.map((item) => item.id);
}

/**
 * PR #197 (the tray's `goToPage`), stated as a pure rule for `selectedIngredientId`: when a change of the
 * visible set removes the selected ingredient from what the player could see, the selection is cleared.
 * A selection that was never in the previous visible set (another step's category) is left alone.
 */
export function selectionAfterVisibleChange(
  selectedIngredientId: string | null,
  visibleBefore: readonly string[],
  visibleAfter: readonly string[],
): string | null {
  if (selectedIngredientId === null) return null;
  return visibleBefore.includes(selectedIngredientId) && !visibleAfter.includes(selectedIngredientId)
    ? null
    : selectedIngredientId;
}

/**
 * "Newly acquired" derived from the EXISTING save field: `ownedIngredientIds` is in acquisition order (a
 * purchase appends; load keeps the saved order after the starters). Newest first, starters excluded. It says
 * "acquired recently", not "never used" (that needs a new field: Owner decision OD-R2-3).
 */
export function recentlyAcquiredIds(
  ownedIdsInAcquisitionOrder: readonly string[],
  starterIds: readonly string[],
  cap = DEFAULT_NEWLY_OWNED_CAP,
): string[] {
  const starters = new Set(starterIds);
  return cleanIds([...ownedIdsInAcquisitionOrder].reverse()).filter((id) => !starters.has(id)).slice(0, Math.max(0, Math.floor(cap)));
}
