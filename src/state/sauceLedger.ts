import {
  SAUCE_CAP_EPSILON,
  SAUCE_MAX_QUANTITY,
  SAUCE_TOTAL_MAX_QUANTITY,
} from "../logic/sauceQuantity";
import { sanitizeSauceDeposits, sanitizeStringArray, type SafeSauceDeposit } from "../logic/scoringV2/boundary";
import type { PizzaState, SauceDeposit } from "./pizzaState";

/**
 * Sauce B1 (Issue #489 line): the per-kind sauce ledger -- pure, total functions over `sauceIds` + `sauceDeposits`.
 *
 * The model: `sauceDeposits` is the pizza's whole sauce history (a switch no longer replaces it), `sauceIds` lists the
 * sauce kinds that were actually committed, in first-use order. A pizza with ONE sauce kind keeps the historical shape
 * (its deposits carry no `ingredientId`); the moment a second kind is committed every deposit is stamped with its kind
 * (earlier ones back-filled with the only sauce used so far), so a log is either all-without or all-with.
 *
 * Single-source compatibility is the contract of this module: for a pizza with at most one kind, `sauceOwnDeposits`
 * returns EVERY deposit (the pooled view the game has always used, wrong sauce included), `sauceUsedByKind` is the plain
 * in-order sum, and `sauceHeadroom` is numerically `max(0, 1 - total)` -- exactly the old dispense cap.
 *
 * Inputs are `unknown`-tolerant on purpose (same fail-closed boundary as Scoring 2.0 / the Completion Gate).
 */
export type SauceLedgerPizza = { readonly sauceIds?: unknown; readonly sauceDeposits?: unknown } | null | undefined;

function partsOf(pizza: SauceLedgerPizza): { ids: string[]; deposits: SafeSauceDeposit[] } {
  return { ids: sanitizeStringArray(pizza?.sauceIds), deposits: sanitizeSauceDeposits(pizza?.sauceDeposits) };
}

/** Who laid a deposit: its own stamp, else (history written before a second kind) the only sauce used so far. */
function ownerOf(deposit: SafeSauceDeposit, ids: readonly string[]): string {
  return deposit.ingredientId ?? ids[0] ?? "";
}

/** Kinds from already-sanitized parts: the recorded `sauceIds` first-use order, then any deposit owner not recorded there. */
function kindsFrom(ids: readonly string[], deposits: readonly SafeSauceDeposit[]): string[] {
  const kinds = [...new Set(ids)];
  for (const d of deposits) {
    const owner = ownerOf(d, ids);
    if (owner !== "" && !kinds.includes(owner)) kinds.push(owner);
  }
  return kinds;
}

/** The sauce kinds on this pizza, in first-use order (the layer order B2 paints in). A kind is on the pizza when it is in
 *  `sauceIds` (committed -- or applied by the one-shot `APPLY_SAUCE`, which leaves no deposits) or owns a deposit. */
export function sauceKindsOf(pizza: SauceLedgerPizza): string[] {
  const { ids, deposits } = partsOf(pizza);
  return kindsFrom(ids, deposits);
}

/** Committed amount per sauce kind, summed in log order (so a single kind equals the plain in-order total). */
export function sauceUsedByKind(pizza: SauceLedgerPizza): Record<string, number> {
  const { ids, deposits } = partsOf(pizza);
  const used: Record<string, number> = {};
  for (const d of deposits) {
    const owner = ownerOf(d, ids);
    used[owner] = (used[owner] ?? 0) + d.amount;
  }
  return used;
}

/** Committed amount over every kind, summed in log order. */
export function sauceUsedTotal(pizza: SauceLedgerPizza): number {
  return partsOf(pizza).deposits.reduce((sum, d) => sum + d.amount, 0);
}

/** True when two or more different sauce kinds are on the pizza. Judged by the KINDS, not only by who owns a deposit: a
 *  one-shot (`APPLY_SAUCE`) sauce has no deposits, so counting deposit owners alone would call "one-shot tomato, then a
 *  painted pesto" a one-sauce pizza and let pesto's deposits stand in for tomato's. */
export function isMultiSauce(pizza: SauceLedgerPizza): boolean {
  const { ids, deposits } = partsOf(pizza);
  return kindsFrom(ids, deposits).length >= 2;
}

/**
 * The deposits that count as "this sauce's own" (Completion Gate, Scoring 2.0, live 「ソースのでき」). With one kind on
 * the pizza that is EVERY deposit -- the pooled view, exactly as before, including a wrong single sauce. With several
 * kinds it is only the deposits that kind laid; a kind that laid none (a one-shot sauce, or one never used) gets `[]`.
 */
export function sauceOwnDeposits(pizza: SauceLedgerPizza, ingredientId: string): SafeSauceDeposit[] {
  const { ids, deposits } = partsOf(pizza);
  if (kindsFrom(ids, deposits).length < 2) return deposits;
  return deposits.filter((d) => ownerOf(d, ids) === ingredientId);
}

/** The sauce laid last (the one the player is "on"): the last deposit's kind, else the last committed kind. */
export function currentSauceId(pizza: SauceLedgerPizza): string | null {
  const { ids, deposits } = partsOf(pizza);
  if (deposits.length > 0) return ownerOf(deposits[deposits.length - 1], ids) || null;
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

/**
 * How much more `ingredientId` can be dispensed right now: the smaller of the kind's own headroom (100% per kind) and
 * the pizza's total headroom (provisional 200%). `pendingForKind` is the in-progress stroke's amount (it belongs to the
 * stroke's kind and counts toward both). With one kind this is `max(0, SAUCE_MAX_QUANTITY - (used + pending))`, the old cap.
 */
export function sauceHeadroom(pizza: SauceLedgerPizza, ingredientId: string, pendingForKind = 0): number {
  const kindLeft = SAUCE_MAX_QUANTITY - ((sauceUsedByKind(pizza)[ingredientId] ?? 0) + pendingForKind);
  const totalLeft = SAUCE_TOTAL_MAX_QUANTITY - (sauceUsedTotal(pizza) + pendingForKind);
  return Math.max(0, Math.min(kindLeft, totalLeft));
}

/** True when a log of deposits breaks a per-kind or total cap (used by the reducer; see `planSauceCommit`). */
export function exceedsSauceCaps(pizza: SauceLedgerPizza): boolean {
  const used = sauceUsedByKind(pizza);
  if (Object.values(used).some((amount) => amount > SAUCE_MAX_QUANTITY + SAUCE_CAP_EPSILON)) return true;
  return sauceUsedTotal(pizza) > SAUCE_TOTAL_MAX_QUANTITY + SAUCE_CAP_EPSILON;
}

export interface SauceCommitPlan {
  /** Sauce kinds after the commit (first-use order). */
  sauceIds: string[];
  /** The whole deposit history after the commit. */
  sauceDeposits: SauceDeposit[];
  /** The committed kind was not on the pizza before (it can consume one stock at the bake). */
  isNewKind: boolean;
  /** The active sauce changed (first sauce, a switch, or a switch back): the spread animation replays from the new origin. */
  changedActive: boolean;
  /** The pizza now carries two or more kinds. */
  multi: boolean;
}

/** The deposit without an `ingredientId` stamp (the same object when it has none, so unstamped batches are stored as-is). */
function withoutOwner(deposit: SauceDeposit): SauceDeposit {
  if (!("ingredientId" in deposit)) return deposit;
  const { ingredientId: _owner, ...rest } = deposit;
  return rest;
}

/**
 * The pure core of COMMIT_SAUCE_DISPENSE: appends one stroke's deposits, keeping the history. For one kind the result is
 * exactly what the old reducer produced (the history plus the batch, no `ingredientId`); when a second kind appears the
 * earlier deposits are stamped with the only sauce used so far and the batch with `ingredientId`.
 */
export function planSauceCommit(pizza: PizzaState, ingredientId: string, batch: readonly SauceDeposit[]): SauceCommitPlan {
  const kinds = sanitizeStringArray(pizza.sauceIds);
  const isNewKind = !kinds.includes(ingredientId);
  const sauceIds = isNewKind ? [...kinds, ingredientId] : kinds;
  const multi = sauceIds.length >= 2;
  const history = multi
    ? pizza.sauceDeposits.map((d) => (d.ingredientId === undefined ? { ...d, ingredientId: kinds[0] } : d))
    : pizza.sauceDeposits;
  // The action's `ingredientId` is the only authority on who laid the batch. Several kinds: every deposit is stamped with it
  // (a caller's own stamps are overwritten). One kind: the historical unstamped shape -- a caller's stamps are removed, so a
  // pre-stamped batch (e.g. ledger output reused by a caller) can never invent a second kind or misattribute the quantity.
  const added = multi ? batch.map((d) => ({ ...d, ingredientId })) : batch.map(withoutOwner);
  return {
    sauceIds,
    sauceDeposits: [...history, ...added],
    isNewKind,
    changedActive: currentSauceId(pizza) !== ingredientId,
    multi,
  };
}

/**
 * The deposits behind the live 「ソースのでき」 numbers: the reference (recipe-required) sauce's OWN deposits, including
 * the stroke in progress when it is that sauce's. With one sauce kind in play (committed + in-progress) this is the whole
 * pooled log exactly as before -- committed deposits first, then the in-progress ones.
 */
export function liveSauceDeposits(
  pizza: PizzaState,
  pending: readonly SauceDeposit[],
  pendingIngredientId: string | null,
  referenceIngredientId: string,
): readonly SauceDeposit[] {
  const { ids, deposits } = partsOf(pizza);
  const kinds = new Set(kindsFrom(ids, deposits));
  if (pending.length > 0 && pendingIngredientId) kinds.add(pendingIngredientId);
  if (kinds.size < 2) return [...pizza.sauceDeposits, ...pending];
  // Several kinds counting the stroke in progress: filter the COMMITTED deposits under that combined context. Re-asking
  // `sauceOwnDeposits(pizza, ...)` here would judge the committed pizza alone (possibly still one kind) and hand back every
  // committed deposit, inflating the live numbers until the stroke is released.
  const own = deposits.filter((d) => ownerOf(d, ids) === referenceIngredientId);
  return pendingIngredientId === referenceIngredientId ? [...own, ...pending] : own;
}
