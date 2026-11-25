/**
 * B案再構成 Phase 1b (Issue #901): the shop model's own progression state. Design:
 * docs/design/TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md §3.2.3 / §3.3.
 *
 * - `GameState.shop` holds it in memory (always present: `EMPTY_SHOP_PROGRESS` for every save without one).
 * - The save stores it under the top-level key `shopProgress` (save v2, no schema bump). The key is written only once the
 *   state differs from the default, so a legacy (flag OFF) session never creates it (../../state/persistence.ts).
 * - Phase 1b only reads it: nothing in the reducer raises the reputation or grants a menu recipe yet (Phase 2a).
 * - No reputation seed from older saves (Owner decision 2026-11-26, overriding design §6 Q3: pre-release, old saves are
 *   not carried over). A save without `shopProgress` simply starts from the default.
 *
 * Merge rules (Q1: the reputation never goes down): `reputation` = max, `grantedMenuRecipeIds` = union.
 */
import { SAVE_ID_PATTERN } from "../../state/saveIdGrammar";

export interface ShopProgressState {
  /** The reputation (cumulative, never lowered: Q1). Phase 1b reads it and never raises it. */
  reputation: number;
  /** Recipes on the menu by a route other than menu development (the first menu, a chapter grant). A union only. */
  grantedMenuRecipeIds: readonly string[];
}

export const EMPTY_SHOP_PROGRESS: ShopProgressState = Object.freeze({
  reputation: 0,
  grantedMenuRecipeIds: Object.freeze([]) as readonly string[],
});

/** True for the state a save without `shopProgress` reads as (such a state is never written). */
export function isDefaultShopProgress(state: ShopProgressState): boolean {
  return state.reputation === 0 && state.grantedMenuRecipeIds.length === 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A reputation value as stored: a finite non-negative number, anything else (negative, NaN, a string) reads as 0. */
export function sanitizeReputation(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** The ids of `raw` that pass `keep`, once each, in stored order. */
function idsIn(raw: unknown, keep: (id: string) => boolean): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id === "string" && keep(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * The stored `shopProgress` value as this build reads it (fail-soft, like every other save field): `undefined` when it
 * is not a plain object (absent, or a shape this build cannot read), else a state holding only `isKnownRecipeId` ids.
 */
export function sanitizeShopProgress(
  raw: unknown,
  isKnownRecipeId: (id: string) => boolean,
): ShopProgressState | undefined {
  if (!isPlainObject(raw)) return undefined;
  return {
    reputation: sanitizeReputation(raw.reputation),
    grantedMenuRecipeIds: idsIn(raw.grantedMenuRecipeIds, isKnownRecipeId),
  };
}

/** Max / union. `base` is the one already stored (its id order comes first). */
export function mergeShopProgress(base: ShopProgressState, more: ShopProgressState): ShopProgressState {
  return {
    reputation: Math.max(base.reputation, more.reputation),
    grantedMenuRecipeIds: [...base.grantedMenuRecipeIds, ...more.grantedMenuRecipeIds.filter((id) => !base.grantedMenuRecipeIds.includes(id))],
  };
}

export function sameShopProgress(a: ShopProgressState | undefined, b: ShopProgressState | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.reputation === b.reputation &&
    a.grantedMenuRecipeIds.length === b.grantedMenuRecipeIds.length &&
    a.grantedMenuRecipeIds.every((id, i) => b.grantedMenuRecipeIds[i] === id)
  );
}

/**
 * What a write stores under `shopProgress`, given this build's state and what storage holds now (forward compatibility,
 * the same promise as every other ledger): `undefined` = write no key.
 *
 * - Our state is the default: storage keeps what it holds, verbatim (nothing, an opaque value, a newer build's object).
 * - Storage holds a plain object: it is merged into, never replaced -- unknown sub-keys stay, the reputation is the max of
 *   both, and a well-formed recipe id this build does not know stays in `grantedMenuRecipeIds`.
 * - Otherwise (nothing stored, or a non-object): our state is written.
 */
export function shopProgressForWrite(next: ShopProgressState | undefined, stored: unknown): unknown {
  if (next === undefined || isDefaultShopProgress(next)) return stored;
  const ours = {
    reputation: next.reputation,
    grantedMenuRecipeIds: [...next.grantedMenuRecipeIds],
  };
  if (!isPlainObject(stored)) return ours;
  const storedIds = idsIn(stored.grantedMenuRecipeIds, (id) => SAVE_ID_PATTERN.test(id));
  return {
    ...stored,
    reputation: Math.max(sanitizeReputation(stored.reputation), ours.reputation),
    grantedMenuRecipeIds: [...storedIds, ...ours.grantedMenuRecipeIds.filter((id) => !storedIds.includes(id))],
  };
}
