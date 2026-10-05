import { SAVE_ID_PATTERN } from "./saveIdGrammar";

/**
 * Research 2.0 Phase 2 (OD-R1-2, INV-B1 / B2 / B9): the pure helpers of the persisted negative ledger
 * `researchExclusions: { [recipeId]: string[] }`.
 *
 * - A value is a list of BARE ingredient ids (never `ing:<id>`): the player was shown "this ingredient is not in that
 *   pizza" (an actually disclosed NEGATIVE row) and nothing else. It is NOT a Hint fact and never enters
 *   `discoveryHintFacts` (INV-B9).
 * - It is an additive ledger: merged per recipe as a set union, never lowered, never removed. Only a Full Game Reset
 *   (the whole save key) clears it.
 * - The caps are its own and are NOT `MAX_STORED_HINT_FACTS_PER_RECIPE`: a fact count is bounded by one recipe's
 *   ingredient list, while an exclusion is any tried non-member ingredient, so it is bounded by the whole catalog (the
 *   172-recipe matrix uses 168 ingredients).
 * - This module reads no catalog, recipe, Hint, Technique or Notebook data.
 */

/** Per recipe: at least the whole ingredient catalog of the 172-recipe population (168) with headroom. */
export const MAX_RESEARCH_EXCLUSIONS_PER_RECIPE = 256;

/** Recipes per ledger, known and unknown together: the 172-recipe population with headroom for a newer build. */
export const MAX_RESEARCH_EXCLUSION_RECIPES = 512;

export type ResearchExclusions = Readonly<Record<string, readonly string[]>>;

/** A record with no prototype, so no recipe id (`__proto__`, `constructor`...) can reach `Object.prototype`. */
export function emptyResearchExclusions(): Record<string, string[]> {
  return Object.create(null) as Record<string, string[]>;
}

/** The well-formed ingredient ids in `raw`: first occurrence order, deduplicated, capped. */
export function sanitizeExclusionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string" || !SAVE_ID_PATTERN.test(value)) continue;
    seen.add(value);
    if (seen.size >= MAX_RESEARCH_EXCLUSIONS_PER_RECIPE) break;
  }
  return [...seen];
}

/** The ledger for the recipe ids `accept` allows. Empty / malformed entries are dropped per recipe, never the ledger. */
export function sanitizeResearchExclusions(raw: unknown, accept: (recipeId: string) => boolean): Record<string, string[]> {
  const result = emptyResearchExclusions();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return result;
  let recipes = 0;
  for (const [recipeId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (recipeId === "__proto__" || !SAVE_ID_PATTERN.test(recipeId) || !accept(recipeId)) continue;
    const ids = sanitizeExclusionIds(value);
    if (ids.length === 0) continue;
    result[recipeId] = ids;
    recipes += 1;
    if (recipes >= MAX_RESEARCH_EXCLUSION_RECIPES) break;
  }
  return result;
}

/** Per-recipe set union of ledgers, earlier ledgers' order first. Never removes an id. */
export function unionResearchExclusions(...ledgers: readonly ResearchExclusions[]): Record<string, string[]> {
  const result = emptyResearchExclusions();
  let recipes = 0;
  for (const ledger of ledgers) {
    for (const [recipeId, ids] of Object.entries(ledger)) {
      const isNew = !(recipeId in result);
      if (isNew && recipes >= MAX_RESEARCH_EXCLUSION_RECIPES) continue;
      const merged = sanitizeExclusionIds([...(result[recipeId] ?? []), ...ids]);
      if (merged.length === 0) continue;
      if (isNew) recipes += 1;
      result[recipeId] = merged;
    }
  }
  return result;
}

export function isEmptyResearchExclusions(ledger: ResearchExclusions): boolean {
  return Object.keys(ledger).length === 0;
}

export function sameResearchExclusions(a: ResearchExclusions, b: ResearchExclusions): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const x = a[id] ?? [];
    const y = b[id] ?? [];
    if (x.length !== y.length) return false;
    const set = new Set(y);
    if (!x.every((v) => set.has(v))) return false;
  }
  return true;
}

/**
 * INV-B1 / B2: `ledger` plus the exclusions of ONE attempt, as the exact ids the RESULT disclosed as NEGATIVE rows
 * (`researchResultRows(...).persistExclusionIds`). Returns `ledger` itself (same reference) when nothing is new, so the
 * caller's persistence effect does not re-run for nothing.
 */
export function addResearchExclusions(ledger: ResearchExclusions, recipeId: string, disclosedNegativeIds: readonly string[]): ResearchExclusions {
  if (disclosedNegativeIds.length === 0) return ledger;
  const own = Object.prototype.hasOwnProperty.call(ledger, recipeId) ? ledger[recipeId] : [];
  const merged = sanitizeExclusionIds([...own, ...disclosedNegativeIds]);
  if (merged.length === own.length) return ledger;
  const next = emptyResearchExclusions();
  for (const [id, ids] of Object.entries(ledger)) next[id] = [...ids];
  next[recipeId] = merged;
  return next;
}
