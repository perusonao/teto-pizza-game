/**
 * Large Catalog UX LC-R5-c (pure): direct pin editing from the pantry (Model D, OD-R5-2) over the R2 `HandSession`.
 *
 * - A pantry tile tap edits the ACTIVE category's pins at once: no pending picks, no confirm step.
 * - OWNED only and in the active category only (the R2 `addToHand` rule). Another category's pins are never
 *   touched by an edit of this one.
 * - OD-R5-6: an ingredient with no stock cannot be NEWLY pinned; an existing pin stays (R2: an explicit choice is
 *   kept at zero stock) and can always be removed.
 * - Existing invalid pins (no longer owned, another category, garbage) are dropped by reading through
 *   `pinsInCategory` (= the R2 prune rule) and by every write (`addToHand` / `replaceHand` re-filter the list).
 * - Deterministic; reads only ids, the catalog descriptor's category and the player's stock. No recipe, discovery,
 *   hint, selection or save input exists here.
 *
 * Dormant in production during R5-c (OD-R5c-1): the pantry only offers pin editing when `handEditing` is true, and
 * GameScreen passes `HAND_ENFORCEMENT_ENABLED` (false until R6). Pins never change the Builder tray in R5-c, so the
 * #197 selection rule is never triggered by an edit here.
 */
import { hasStock, type StockValue } from "./catalogTypes";
import { addToHand, pruneHand, replaceHand, type HandContext, type HandSession } from "./handSession";

export type PinEditOutcome = "pinned" | "unpinned" | "rejected-no-stock" | "rejected-not-owned";

export interface PinEditResult {
  session: HandSession;
  outcome: PinEditOutcome;
}

/** The active category's valid pins, in the order chosen (invalid entries pruned; the session is not mutated). */
export function pinsInCategory(session: HandSession, ctx: HandContext): string[] {
  return [...pruneHand(session, ctx)[ctx.category]];
}

function acceptable(id: string, ctx: HandContext): boolean {
  return ctx.ownership.ownedIds.includes(id) && ctx.catalog.some((item) => item.id === id && item.category === ctx.category);
}

/** One tile tap. A rejected tap returns the SAME session object (nothing to write). */
export function togglePin(session: HandSession, id: string, ctx: HandContext): PinEditResult {
  const pins = pinsInCategory(session, ctx);
  if (pins.includes(id)) {
    return { session: replaceHand(session, pins.filter((pin) => pin !== id), ctx), outcome: "unpinned" };
  }
  if (!acceptable(id, ctx)) return { session, outcome: "rejected-not-owned" };
  if (!hasStock(ctx.ownership.stock(id))) return { session, outcome: "rejected-no-stock" };
  return { session: addToHand(session, [id], ctx), outcome: "pinned" };
}

/** 「おまかせに戻す」: the active category's pins only (other categories untouched). */
export function clearPins(session: HandSession, ctx: HandContext): HandSession {
  return replaceHand(session, [], ctx);
}

export interface PinTileState {
  pinned: boolean;
  /** A tap would be refused (not pinned and no stock): `aria-disabled`. Unpinning is never disabled. */
  disabled: boolean;
}

export function pinTileState(id: string, pins: readonly string[], stock: StockValue): PinTileState {
  const pinned = pins.includes(id);
  return { pinned, disabled: !pinned && !hasStock(stock) };
}

/**
 * Selected strip (方式 D, OD-R5c-2 / -3): rendered only while pin editing is on and at least one pin exists.
 * While the soft keyboard is up (the sheet carries `pantry-sheet--fit`) CSS hides it; the tile badge,
 * `aria-pressed` and re-tap unpin stay, so the pin state itself is never out of reach.
 */
export function selectedStripRendered(input: { handEditing: boolean; pinCount: number }): boolean {
  return input.handEditing && input.pinCount > 0;
}
