/**
 * B案再構成 Phase 1b (Issue #901): the shop model's own progression state. Design:
 * docs/design/TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md §3.2.3 / §3.3.
 *
 * - `GameState.shop` holds it in memory (always present: `EMPTY_SHOP_PROGRESS` for every save without one).
 * - The save stores it under the top-level key `shopProgress` (save v2, no schema bump). The key is written only once the
 *   state differs from the default, so a legacy (flag OFF) session never creates it (../../state/persistence.ts).
 * - Phase 1b only reads it: nothing in the reducer raises the reputation or grants a menu recipe yet (Phase 2a). The one
 *   writer is the one-time reputation seed (./reputationSeed.ts), which records nothing while the reputation table is null.
 *
 * Merge rules (Q1: the reputation never goes down): `reputation` = max, `grantedMenuRecipeIds` = union,
 * `reputationSeed` = the first one recorded wins (it is never recomputed, R9).
 */
import { SAVE_ID_PATTERN } from "../../state/saveIdGrammar";

/** Where a reputation seed came from. Only the legacy Dex today (design §3.3). */
export type ReputationSeedSource = "legacy-dex";

export interface ReputationSeed {
  source: ReputationSeedSource;
  value: number;
}

export interface ShopProgressState {
  /** The reputation (cumulative, never lowered: Q1). Phase 1b reads it and never raises it. */
  reputation: number;
  /** Recipes on the menu by a route other than menu development (the first menu, a chapter grant). A union only. */
  grantedMenuRecipeIds: readonly string[];
  /** The one-time seed from an older save (§3.3). `null` = not done yet. Once recorded it is never recomputed. */
  reputationSeed: ReputationSeed | null;
}

export const EMPTY_SHOP_PROGRESS: ShopProgressState = Object.freeze({
  reputation: 0,
  grantedMenuRecipeIds: Object.freeze([]) as readonly string[],
  reputationSeed: null,
});

/** True for the state a save without `shopProgress` reads as (such a state is never written). */
export function isDefaultShopProgress(state: ShopProgressState): boolean {
  return state.reputation === 0 && state.grantedMenuRecipeIds.length === 0 && state.reputationSeed === null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A reputation value as stored: a finite non-negative number, anything else (negative, NaN, a string) reads as 0. */
export function sanitizeReputation(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** A stored seed this build can read, else `null` (a newer build's shape is kept in storage by the write merge). */
export function sanitizeReputationSeed(value: unknown): ReputationSeed | null {
  if (!isPlainObject(value)) return null;
  if (value.source !== "legacy-dex") return null;
  const seedValue = value.value;
  if (typeof seedValue !== "number" || !Number.isFinite(seedValue) || seedValue < 0) return null;
  return { source: "legacy-dex", value: seedValue };
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
    reputationSeed: sanitizeReputationSeed(raw.reputationSeed),
  };
}

/** Max / union / first-seed-wins. `base` is the one already stored (its seed and its id order come first). */
export function mergeShopProgress(base: ShopProgressState, more: ShopProgressState): ShopProgressState {
  return {
    reputation: Math.max(base.reputation, more.reputation),
    grantedMenuRecipeIds: [...base.grantedMenuRecipeIds, ...more.grantedMenuRecipeIds.filter((id) => !base.grantedMenuRecipeIds.includes(id))],
    reputationSeed: base.reputationSeed ?? more.reputationSeed,
  };
}

export function sameShopProgress(a: ShopProgressState | undefined, b: ShopProgressState | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.reputation === b.reputation &&
    a.grantedMenuRecipeIds.length === b.grantedMenuRecipeIds.length &&
    a.grantedMenuRecipeIds.every((id, i) => b.grantedMenuRecipeIds[i] === id) &&
    (a.reputationSeed === null
      ? b.reputationSeed === null
      : b.reputationSeed !== null && a.reputationSeed.source === b.reputationSeed.source && a.reputationSeed.value === b.reputationSeed.value)
  );
}

/**
 * What a write stores under `shopProgress`, given this build's state and what storage holds now (forward compatibility,
 * the same promise as every other ledger): `undefined` = write no key.
 *
 * - Our state is the default: storage keeps what it holds, verbatim (nothing, an opaque value, a newer build's object).
 * - Storage holds a plain object: it is merged into, never replaced -- unknown sub-keys stay, the reputation is the max of
 *   both, a well-formed recipe id this build does not know stays in `grantedMenuRecipeIds`, and a stored seed (even one
 *   this build cannot read) is never replaced.
 * - Otherwise (nothing stored, or a non-object): our state is written.
 */
export function shopProgressForWrite(next: ShopProgressState | undefined, stored: unknown): unknown {
  if (next === undefined || isDefaultShopProgress(next)) return stored;
  const ours = {
    reputation: next.reputation,
    grantedMenuRecipeIds: [...next.grantedMenuRecipeIds],
    reputationSeed: next.reputationSeed === null ? null : { ...next.reputationSeed },
  };
  if (!isPlainObject(stored)) return ours;
  const storedIds = idsIn(stored.grantedMenuRecipeIds, (id) => SAVE_ID_PATTERN.test(id));
  const storedSeed = stored.reputationSeed;
  return {
    ...stored,
    reputation: Math.max(sanitizeReputation(stored.reputation), ours.reputation),
    grantedMenuRecipeIds: [...storedIds, ...ours.grantedMenuRecipeIds.filter((id) => !storedIds.includes(id))],
    reputationSeed: storedSeed !== undefined && storedSeed !== null ? storedSeed : ours.reputationSeed,
  };
}
