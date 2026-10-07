import { getIngredient } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import { isDiscovered, type DexState } from "../../state/dex";

/**
 * Discovery 3.0 Research Recipe (Issue #346), S1: the pure domain foundation of the Research Entry.
 * Wired: the Dex, Hint sheet, RESULT, Notebook and Research Board read it (`researchEntryLabel` is the one label authority).
 *
 * A Research Entry is a recipe the player has a clue for but has not discovered yet. It is derived
 * only from state the save already carries -- the Dex, `ownedIngredientIds` and (read-only) the
 * stored `discoveryHintFacts`. Nothing is persisted and no persistent research enum exists
 * (Issue #346 §6, AC14).
 *
 * - **Registrable** (OWNERSHIP, never stock): undiscovered, the recipe has at least one finite
 *   ingredient (one with `unlockCondition`), and EVERY finite ingredient is in `ownedIngredientIds`.
 *   `ownedIngredientIds` never shrinks, so cooking a material down to stock 0 keeps the entry.
 *   `RecipeDiscoveryState` (availability) is NOT replaced: this is an orthogonal axis.
 * - **Unlock fact**: the finite ingredient acquired last. It is a recipe ingredient whatever the
 *   acquisition order is (no false positive), so an untrusted order can only pick a different true
 *   fact. Starters are never a fact (they are in every recipe and tell nothing).
 * - **Knowledge**: the unlock fact is the only exact fact S1 knows. An attempt never creates
 *   knowledge (OD-RX-3). Bought Hint facts are read only to tell whether STRUCTURE was bought.
 * - **STRUCTURE privacy**: the distinct ingredient total is projected only after the player bought
 *   it (`meta:ingredient-total`); otherwise `null`. A legacy count grant is not read, which fails
 *   closed (a total is withheld, never leaked). No remaining count, no unknown-slot list.
 * - **Anonymity**: the projection carries the recipe id as an opaque key for later wiring, never a
 *   name, No.xx, catalog position or ingredient count. The order is registration order (index of
 *   the unlock fact in `ownedIngredientIds`), then a hash of the id that is unrelated to the
 *   recipe's structure; it is NOT `compareHintCandidates` (that sorts by ingredient count).
 * - The projection has no count of entries or of unregistered recipes: an array only.
 * - **Stable public label (Research 2.0 Phase 1, D+ Cohort Letter, OD-R2-1..5)**: the label is derived from the
 *   catalog and ownership only -- never from the live entry array -- so a sibling's discovery cannot move it.
 *   See `researchCohortLetters` / `researchEntryLabel`. Nothing about it is saved.
 */

/**
 * The stored STRUCTURE fact id. A local copy of `INGREDIENT_TOTAL_FACT_ID` (./deductionHint.ts):
 * the Deduction Hint layer has pinned importer boundaries (deductionHint/deductionGuard wiring
 * tests), and this unwired module must not widen them. `researchEntry.test.ts` pins the two equal.
 */
const STRUCTURE_TOTAL_FACT_ID = "meta:ingredient-total";

/** Research axis of one recipe, orthogonal to `RecipeDiscoveryState`. Derived, never stored. */
export type RecipeResearchState = "NONE" | "PROVISIONAL" | "RESEARCHING" | "DISCOVERED";

export interface ResearchInputs {
  dex: DexState;
  /** `ownedIngredientIds` (append-only; acquisition order). Stock is deliberately not an input. */
  ownedIngredientIds: readonly string[];
  /** The stored hint ledger (`discoveryHintFacts`), read-only. Optional: absent = no facts. */
  discoveryHintFacts?: Readonly<Record<string, readonly string[]>>;
}

/** Session-only context (never persisted). */
export interface ResearchSession {
  /** The Research Target the player picked this session, if any. */
  targetRecipeId?: string | null;
}

export interface ResearchEntry {
  /** Opaque key for wiring (target, hint). NEVER rendered, hashed into a label or sorted by. */
  recipeId: string;
  /** `PROVISIONAL` or `RESEARCHING`; the only difference is a CTA word, never behaviour. */
  state: "PROVISIONAL" | "RESEARCHING";
  /** The unlock exact fact: the finite ingredient the player acquired last. */
  unlockIngredientId: string;
  /** Exact ingredient facts known. S1: the unlock fact only. */
  knownExactIngredientIds: readonly string[];
  /** The distinct ingredient total once STRUCTURE was bought, else `null` (never a guess). */
  totalIngredientCount: number | null;
  /**
   * D+ Cohort Letter: `A`, `B`, ... only when this entry has registrable siblings (a discovered sibling still holds
   * its slot); `null` for a single cohort. Display only: never a key, never saved, never a count.
   */
  cohortLetter: string | null;
}

export interface ResearchProjection {
  /** Registered entries in the stable anonymous order. Deliberately no `count` field. */
  entries: readonly ResearchEntry[];
}

function isFiniteMaterial(ingredientId: string): boolean {
  return !!getIngredient(ingredientId)?.unlockCondition;
}

function distinctIngredientIds(recipe: Recipe): string[] {
  return [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
}

/** FNV-1a over the id: deterministic, and unrelated to the recipe's ingredients or catalog slot. */
function opaqueHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * The unlock ingredient of `recipe`, or `null` when the recipe is not registrable: it has no finite
 * ingredient, an ingredient is not in the catalog, or a finite ingredient is not owned yet.
 */
function unlockIngredientOf(recipe: Recipe, owned: readonly string[]): { id: string; index: number } | null {
  const ownedSet = new Set(owned);
  let last: { id: string; index: number } | null = null;
  for (const id of distinctIngredientIds(recipe)) {
    if (!getIngredient(id)) return null;
    if (!isFiniteMaterial(id)) continue;
    if (!ownedSet.has(id)) return null;
    const index = owned.indexOf(id);
    if (last === null || index > last.index) last = { id, index };
  }
  return last;
}

/** Whether `recipe` is registered as a Research Entry: undiscovered and every finite material owned. */
export function isResearchRegistrable(recipe: Recipe, inputs: Pick<ResearchInputs, "dex" | "ownedIngredientIds">): boolean {
  return !isDiscovered(inputs.dex, recipe.id) && unlockIngredientOf(recipe, inputs.ownedIngredientIds) !== null;
}

function structureTotal(recipe: Recipe, facts: ResearchInputs["discoveryHintFacts"]): number | null {
  const stored = facts && Object.prototype.hasOwnProperty.call(facts, recipe.id) ? facts[recipe.id] : undefined;
  return Array.isArray(stored) && stored.includes(STRUCTURE_TOTAL_FACT_ID) ? distinctIngredientIds(recipe).length : null;
}

function hasBoughtFacts(recipe: Recipe, facts: ResearchInputs["discoveryHintFacts"]): boolean {
  if (!facts || !Object.prototype.hasOwnProperty.call(facts, recipe.id)) return false;
  const stored = facts[recipe.id];
  return Array.isArray(stored) && stored.length > 0;
}

/** The research axis of one recipe. Never moves backwards: ownership and the Dex only grow. */
export function researchStateOf(
  recipe: Recipe,
  inputs: ResearchInputs,
  session: ResearchSession = {},
): RecipeResearchState {
  if (isDiscovered(inputs.dex, recipe.id)) return "DISCOVERED";
  if (unlockIngredientOf(recipe, inputs.ownedIngredientIds) === null) return "NONE";
  return session.targetRecipeId === recipe.id || hasBoughtFacts(recipe, inputs.discoveryHintFacts)
    ? "RESEARCHING"
    : "PROVISIONAL";
}

/**
 * The spreadsheet-style letter of the zero-based `index`: 0 -> A ... 25 -> Z, 26 -> AA, 27 -> AB ... (Research 2.0
 * OD-R2-4: a cohort of more than 26 siblings stays labelled without a new alphabet).
 */
export function researchLetter(index: number): string {
  let n = Math.max(0, Math.floor(index)) + 1;
  let letters = "";
  while (n > 0) {
    n -= 1;
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26);
  }
  return letters;
}

/**
 * D+ Cohort Letter (Research 2.0 Phase 1, OD-R2-1..4). A **cohort** is the set of recipes whose unlock fact is the
 * same ingredient: they became registrable at the same moment (the acquisition of that ingredient), so a player
 * can already see every member -- as a Research Entry or in the Dex. The cohort is computed from OWNERSHIP only and
 * deliberately ignores the Dex: a discovered sibling keeps its slot, so the letters of the others never move and a
 * slot is never reused (OD-R2-3). Members are ordered by the same anonymous key as the entry order (a hash of the id
 * that is unrelated to the recipe's structure, then the id) and lettered A, B, C ...
 *
 * - Only recipes that are registrable (every finite material owned) are counted, so an unregistered recipe is never
 *   represented: no hidden recipe, count or cohort size can be read from a letter (INV-B7).
 * - A single-member cohort has no letter. Nothing here is persisted (OD-R2-2).
 * - The letter is stable within one catalog authority only: a catalog revision that adds a recipe to an existing
 *   cohort may change that cohort's letters. That is accepted (Owner contract); it is re-audited before 53 / 172.
 *
 * Returns `recipeId -> letter` for lettered cohorts only.
 */
export function researchCohortLetters(
  ownedIngredientIds: readonly string[],
  recipes: readonly Recipe[] = RECIPES,
): ReadonlyMap<string, string> {
  const cohorts = new Map<string, { recipeId: string; hash: number }[]>();
  for (const recipe of recipes) {
    const unlock = unlockIngredientOf(recipe, ownedIngredientIds);
    if (unlock === null) continue;
    const members = cohorts.get(unlock.id) ?? [];
    members.push({ recipeId: recipe.id, hash: opaqueHash(recipe.id) });
    cohorts.set(unlock.id, members);
  }
  const letters = new Map<string, string>();
  for (const members of cohorts.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.hash - b.hash || (a.recipeId < b.recipeId ? -1 : 1));
    members.forEach((m, i) => letters.set(m.recipeId, researchLetter(i)));
  }
  return letters;
}

/**
 * Every registered Research Entry, in the stable anonymous order. Discovered recipes are excluded;
 * unregistered recipes are not represented in any form.
 */
export function deriveResearchEntries(
  inputs: ResearchInputs,
  session: ResearchSession = {},
  recipes: readonly Recipe[] = RECIPES,
): ResearchProjection {
  const ranked: { entry: ResearchEntry; index: number; hash: number }[] = [];
  const cohortLetters = researchCohortLetters(inputs.ownedIngredientIds, recipes);
  for (const recipe of recipes) {
    if (isDiscovered(inputs.dex, recipe.id)) continue;
    const unlock = unlockIngredientOf(recipe, inputs.ownedIngredientIds);
    if (unlock === null) continue;
    const state = researchStateOf(recipe, inputs, session);
    if (state !== "PROVISIONAL" && state !== "RESEARCHING") continue;
    ranked.push({
      entry: {
        recipeId: recipe.id,
        state,
        unlockIngredientId: unlock.id,
        knownExactIngredientIds: [unlock.id],
        totalIngredientCount: structureTotal(recipe, inputs.discoveryHintFacts),
        cohortLetter: cohortLetters.get(recipe.id) ?? null,
      },
      index: unlock.index,
      hash: opaqueHash(recipe.id),
    });
  }
  ranked.sort((a, b) => a.index - b.index || a.hash - b.hash || (a.entry.recipeId < b.entry.recipeId ? -1 : 1));
  return { entries: ranked.map((r) => r.entry) };
}

/**
 * The player-facing anonymous label of an entry (Research 2.0 Phase 1, OD-R2-4): the one authority shared by the Dex,
 * PREPARE, RESULT, the Hint sheet and the Trial Notebook.
 *
 * - Cohort siblings: 「？？？ピザ B（たまねぎ）」; a single cohort: 「？？？ピザ（チキン）」.
 * - It carries only the unlock ingredient (already shown as the card's first known fact) and the cohort letter. It never
 *   carries a recipe name / id, No.xx, a count, a cohort size or a hash value (INV-B7).
 * - The ① ② ③ marks are retired: they came from the live array index and moved when a sibling was discovered.
 *
 * Fails closed to the bare 「？？？ピザ」 when the unlock ingredient is not in the catalog.
 */
export function researchEntryLabel(entry: Pick<ResearchEntry, "unlockIngredientId" | "cohortLetter">): string {
  const unlockName = getIngredient(entry.unlockIngredientId)?.nameJa;
  const head = entry.cohortLetter ? `？？？ピザ ${entry.cohortLetter}` : "？？？ピザ";
  return unlockName ? `${head}（${unlockName}）` : head;
}
