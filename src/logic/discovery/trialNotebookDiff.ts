/**
 * Discovery 3.0 Notebook N2: "what did I change since my previous try?".
 *
 * Pure. Its only inputs are two of the *player's own* combinations (`TrialCombination`, as carried by the
 * notebook view). It never receives, and so cannot read, a recipe, candidate pool, Hint target or any distance
 * to an answer; the result says what changed, never whether that was closer or further.
 *
 * ## What "previous" means (stable by construction)
 *
 * The notebook view is ordered by activity, newest first. A row's previous try is the row displayed directly
 * beneath it: the distinct combination the player was working on just before this row's latest activity.
 * - A retry moves its row to the top, so it is diffed against the try that came right before the retry
 *   (A, B, A -> A is compared with B), never with itself: the same combination can never produce a diff.
 * - The oldest displayed row has nothing beneath it and so has no diff.
 * The model, its numbering, duplicate handling and storage are untouched.
 */
import type { TrialCombination } from "./trialNotebook";

export interface TrialDiff {
  /** Topping ids present now and absent before (stable sorted order of the model). */
  added: readonly string[];
  /** Topping ids present before and absent now. */
  removed: readonly string[];
  /** Sauce ids before / after, only when the sauce set changed. */
  sauce: { before: readonly string[]; after: readonly string[] } | null;
}

function toppingsOf(c: TrialCombination): string[] {
  return c.ingredientSet.filter((id) => !c.sauceBase.includes(id));
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** The change from `previous` to `current`, or `null` when nothing changed. */
export function diffCombination(previous: TrialCombination, current: TrialCombination): TrialDiff | null {
  const before = toppingsOf(previous);
  const after = toppingsOf(current);
  const added = after.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  const sauce = sameList(previous.sauceBase, current.sauceBase)
    ? null
    : { before: [...previous.sauceBase], after: [...current.sauceBase] };
  if (added.length === 0 && removed.length === 0 && !sauce) return null;
  return { added, removed, sauce };
}

/** Diffs for a newest-first list of rows: index i is compared with row i + 1. The last row is `null`. */
export function diffsForView(rows: readonly { combination: TrialCombination }[]): (TrialDiff | null)[] {
  return rows.map((row, i) => (i + 1 < rows.length ? diffCombination(rows[i + 1].combination, row.combination) : null));
}
