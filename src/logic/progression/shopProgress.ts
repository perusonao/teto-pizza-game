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
 * Merge rules (Q1: the reputation never goes down): `reputation` = max, `grantedMenuRecipeIds` = union. Phase 3b adds two
 * unions (`awaitingMenuRecipeIds`, `menuEntryPaidRecipeIds`), stored only while non-empty. Phase 3c adds the research points
 * earned (`researchPointsEarned`, a cumulative total: max, like the reputation), stored only while above 0. Phase 3d adds the
 * research points spent on hints (`researchPointsSpent`, cumulative too: max) and what those hints revealed
 * (`hintRevealsByRecipe`, recipe -> item ids: a union per recipe), each stored only while non-default.
 */
import { SAVE_ID_PATTERN } from "../../state/saveIdGrammar";

export interface ShopProgressState {
  /** The reputation (cumulative, never lowered: Q1). Phase 1b reads it and never raises it. */
  reputation: number;
  /** Recipes on the menu by a route other than menu development (the first menu, a chapter grant). A union only. */
  grantedMenuRecipeIds: readonly string[];
  /**
   * Phase 3b (Owner 2026-11-27): adopted recipes the player identified (an exact match) before their stage opened. They are in
   * the Dex (判明) but wait off the menu; the moment the stage opens they join it and the menu-development bonus is paid.
   * A union only. Optional so every state literal written before Phase 3b still type-checks; absent = empty.
   */
  awaitingMenuRecipeIds?: readonly string[];
  /**
   * Phase 3b: the awaiting recipes whose menu entry (and bonus) has been paid. A union only, so the payment happens exactly once
   * whatever a reload or a merge does: a recipe is still waiting exactly while it is in `awaitingMenuRecipeIds` and not here.
   */
  menuEntryPaidRecipeIds?: readonly string[];
  /**
   * Phase 3c (Owner 2026-11-27): the research points earned so far, in one pool shared by every recipe. A CUMULATIVE total that
   * never goes down, so a reload, a second tab or a rollback build merges it by max exactly like the reputation. The balance the
   * player sees is `researchPointBalanceOf` (Phase 3d spends points through a separate, equally monotonic total; 3c spends none).
   * Optional so every state literal written before Phase 3c still type-checks; absent = 0.
   */
  researchPointsEarned?: number;
  /**
   * Phase 3d: the research points spent on hints so far -- a CUMULATIVE total like `researchPointsEarned` (never goes down, max
   * merge). The balance is earned - spent (`researchPointBalanceOf`). A purchase is refused unless the balance covers it, so in any
   * one tab spent <= earned, and the max of both totals keeps that across tabs: the balance never goes below 0.
   * Optional; absent = 0.
   */
  researchPointsSpent?: number;
  /**
   * Phase 3d: what the research point hints revealed, per recipe (`recipeId -> item ids`, ../progression/shopHints.ts: `sauce`,
   * `shape`, `method`, `count`, `ing:<ingredientId>`). A union only (a reveal is never taken back). Hints bought with Pitz before
   * the shop model are NOT copied here: they are read from the legacy ledgers as they are (`discoveryHintFacts`).
   * Optional; absent = empty.
   */
  hintRevealsByRecipe?: Readonly<Record<string, readonly string[]>>;
}

export const EMPTY_SHOP_PROGRESS: ShopProgressState = Object.freeze({
  reputation: 0,
  grantedMenuRecipeIds: Object.freeze([]) as readonly string[],
});

const NO_IDS: readonly string[] = Object.freeze([]);

/** Phase 3b: the awaiting / paid ledgers, absent read as empty. */
export function awaitingMenuRecipeIdsOf(state: ShopProgressState): readonly string[] {
  return state.awaitingMenuRecipeIds ?? NO_IDS;
}
export function menuEntryPaidRecipeIdsOf(state: ShopProgressState): readonly string[] {
  return state.menuEntryPaidRecipeIds ?? NO_IDS;
}

/** Phase 3c: the research points earned so far (absent = 0). */
export function researchPointsEarnedOf(state: ShopProgressState): number {
  return state.researchPointsEarned ?? 0;
}

/** Phase 3d: the research points spent on hints so far (absent = 0). */
export function researchPointsSpentOf(state: ShopProgressState): number {
  return state.researchPointsSpent ?? 0;
}

const NO_REVEALS: Readonly<Record<string, readonly string[]>> = Object.freeze({});

/** Phase 3d: the research point hint reveals, absent read as empty. */
export function hintRevealsByRecipeOf(state: ShopProgressState): Readonly<Record<string, readonly string[]>> {
  return state.hintRevealsByRecipe ?? NO_REVEALS;
}

/** Phase 3d: one recipe's reveals (absent = none). Own keys only: an untrusted id never reads a prototype member. */
export function hintRevealsOf(state: ShopProgressState, recipeId: string): readonly string[] {
  const all = hintRevealsByRecipeOf(state);
  return Object.prototype.hasOwnProperty.call(all, recipeId) ? all[recipeId] : NO_IDS;
}

/**
 * Phase 3c / 3d: the research point balance -- what the player has to spend: earned - spent, never below 0 (a hand-edited save
 * whose spent total is above its earned one reads as 0, never as a debt). Every reader of the balance goes through here.
 */
export function researchPointBalanceOf(state: ShopProgressState): number {
  return Math.max(0, researchPointsEarnedOf(state) - researchPointsSpentOf(state));
}

/** True for the state a save without `shopProgress` reads as (such a state is never written). */
export function isDefaultShopProgress(state: ShopProgressState): boolean {
  return (
    state.reputation === 0 &&
    state.grantedMenuRecipeIds.length === 0 &&
    awaitingMenuRecipeIdsOf(state).length === 0 &&
    menuEntryPaidRecipeIdsOf(state).length === 0 &&
    researchPointsEarnedOf(state) === 0 &&
    researchPointsSpentOf(state) === 0 &&
    Object.keys(hintRevealsByRecipeOf(state)).length === 0
  );
}

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => b[i] === id);

function unionIds(base: readonly string[], more: readonly string[]): string[] {
  return [...base, ...more.filter((id) => !base.includes(id))];
}

/** The Phase 3b ledgers as a partial state: only the non-empty ones, so a pre-3b state keeps its exact shape. */
function ledgerFields(awaiting: readonly string[], paid: readonly string[]): Pick<ShopProgressState, "awaitingMenuRecipeIds" | "menuEntryPaidRecipeIds"> {
  return {
    ...(awaiting.length > 0 ? { awaitingMenuRecipeIds: awaiting } : {}),
    ...(paid.length > 0 ? { menuEntryPaidRecipeIds: paid } : {}),
  };
}

/** Phase 3c: the research points as a partial state, present only above 0 (a pre-3c state keeps its exact shape). */
function researchPointsField(earned: number): Pick<ShopProgressState, "researchPointsEarned"> {
  return earned > 0 ? { researchPointsEarned: earned } : {};
}

/** Phase 3d: the spent total as a partial state, present only above 0. */
function researchPointsSpentField(spent: number): Pick<ShopProgressState, "researchPointsSpent"> {
  return spent > 0 ? { researchPointsSpent: spent } : {};
}

/** Phase 3d: the reveals as a partial state, present only with at least one recipe holding at least one item. */
function hintRevealsField(reveals: Readonly<Record<string, readonly string[]>>): Pick<ShopProgressState, "hintRevealsByRecipe"> {
  return Object.keys(reveals).length > 0 ? { hintRevealsByRecipe: reveals } : {};
}

/** Phase 3d: a stored reveal item id (`sauce`, `ing:mozzarella`, ...; a newer build's well-formed kind is kept as it is). */
export const HINT_REVEAL_ITEM_PATTERN = /^[a-z][a-z0-9-]{0,31}(:[a-z0-9][a-z0-9-]{0,63})?$/;

/**
 * Phase 3d: the stored reveal ledger, fail-soft: only plain-object entries whose key passes `keepRecipe` and whose value is an
 * array; within it only well-formed item ids, once each, in stored order. A recipe left with no item is dropped.
 */
function revealsIn(raw: unknown, keepRecipe: (id: string) => boolean): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = Object.create(null) as Record<string, readonly string[]>;
  if (!isPlainObject(raw)) return out;
  for (const [recipeId, items] of Object.entries(raw)) {
    if (!keepRecipe(recipeId)) continue;
    const ids = idsIn(items, (id) => HINT_REVEAL_ITEM_PATTERN.test(id));
    if (ids.length > 0) out[recipeId] = ids;
  }
  return out;
}

/** Phase 3d: the per-recipe union of two reveal ledgers (`base` first, its recipe and item order kept). */
function unionReveals(
  base: Readonly<Record<string, readonly string[]>>,
  more: Readonly<Record<string, readonly string[]>>,
): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = Object.create(null) as Record<string, readonly string[]>;
  for (const [id, items] of Object.entries(base)) out[id] = [...items];
  for (const [id, items] of Object.entries(more)) {
    out[id] = Object.prototype.hasOwnProperty.call(out, id) ? unionIds(out[id], items) : [...items];
  }
  return out;
}

function sameReveals(a: Readonly<Record<string, readonly string[]>>, b: Readonly<Record<string, readonly string[]>>): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((id) => Object.prototype.hasOwnProperty.call(b, id) && sameIds(a[id], b[id]))
  );
}

/** A stored research point total: a finite non-negative whole number; anything else reads as 0, a fraction is floored. */
export function sanitizeResearchPoints(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
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
    ...ledgerFields(idsIn(raw.awaitingMenuRecipeIds, isKnownRecipeId), idsIn(raw.menuEntryPaidRecipeIds, isKnownRecipeId)),
    ...researchPointsField(sanitizeResearchPoints(raw.researchPointsEarned)),
    ...researchPointsSpentField(sanitizeResearchPoints(raw.researchPointsSpent)),
    ...hintRevealsField(revealsIn(raw.hintRevealsByRecipe, isKnownRecipeId)),
  };
}

/** Max / union. `base` is the one already stored (its id order comes first). */
export function mergeShopProgress(base: ShopProgressState, more: ShopProgressState): ShopProgressState {
  return {
    reputation: Math.max(base.reputation, more.reputation),
    grantedMenuRecipeIds: unionIds(base.grantedMenuRecipeIds, more.grantedMenuRecipeIds),
    ...ledgerFields(
      unionIds(awaitingMenuRecipeIdsOf(base), awaitingMenuRecipeIdsOf(more)),
      unionIds(menuEntryPaidRecipeIdsOf(base), menuEntryPaidRecipeIdsOf(more)),
    ),
    ...researchPointsField(Math.max(researchPointsEarnedOf(base), researchPointsEarnedOf(more))),
    ...researchPointsSpentField(Math.max(researchPointsSpentOf(base), researchPointsSpentOf(more))),
    ...hintRevealsField(unionReveals(hintRevealsByRecipeOf(base), hintRevealsByRecipeOf(more))),
  };
}

export function sameShopProgress(a: ShopProgressState | undefined, b: ShopProgressState | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.reputation === b.reputation &&
    sameIds(a.grantedMenuRecipeIds, b.grantedMenuRecipeIds) &&
    sameIds(awaitingMenuRecipeIdsOf(a), awaitingMenuRecipeIdsOf(b)) &&
    sameIds(menuEntryPaidRecipeIdsOf(a), menuEntryPaidRecipeIdsOf(b)) &&
    researchPointsEarnedOf(a) === researchPointsEarnedOf(b) &&
    researchPointsSpentOf(a) === researchPointsSpentOf(b) &&
    sameReveals(hintRevealsByRecipeOf(a), hintRevealsByRecipeOf(b))
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
    ...ledgerFields([...awaitingMenuRecipeIdsOf(next)], [...menuEntryPaidRecipeIdsOf(next)]),
    ...researchPointsField(researchPointsEarnedOf(next)),
    ...researchPointsSpentField(researchPointsSpentOf(next)),
    ...hintRevealsField(unionReveals({}, hintRevealsByRecipeOf(next))),
  };
  if (!isPlainObject(stored)) return ours;
  const wellFormed = (id: string) => SAVE_ID_PATTERN.test(id);
  const storedIds = idsIn(stored.grantedMenuRecipeIds, wellFormed);
  // Phase 3b ledgers: unions with what storage holds (a newer build's ids stay), written only when non-empty.
  const awaiting = unionIds(idsIn(stored.awaitingMenuRecipeIds, wellFormed), awaitingMenuRecipeIdsOf(next));
  const paid = unionIds(idsIn(stored.menuEntryPaidRecipeIds, wellFormed), menuEntryPaidRecipeIdsOf(next));
  return {
    ...stored,
    reputation: Math.max(sanitizeReputation(stored.reputation), ours.reputation),
    grantedMenuRecipeIds: [...storedIds, ...ours.grantedMenuRecipeIds.filter((id) => !storedIds.includes(id))],
    ...ledgerFields(awaiting, paid),
    // Phase 3c: the max of both (a cumulative total). Written only above 0; a stored value this build cannot read stays as it is.
    ...researchPointsField(Math.max(sanitizeResearchPoints(stored.researchPointsEarned), researchPointsEarnedOf(next))),
    // Phase 3d: the spent total is the max of both (cumulative); the reveals are a per-recipe union with what storage holds (a
    // newer build's recipe id or item kind stays). Each written only when non-default; a stored value this build cannot read stays.
    ...researchPointsSpentField(Math.max(sanitizeResearchPoints(stored.researchPointsSpent), researchPointsSpentOf(next))),
    ...hintRevealsField(unionReveals(revealsIn(stored.hintRevealsByRecipe, wellFormed), hintRevealsByRecipeOf(next))),
  };
}
