import { getIngredient } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import { isDiscovered, type DexState } from "../../state/dex";

/**
 * Discovery 3.0 Research Recipe (Issue #346), S1: the pure domain foundation of the Research Entry.
 * UNWIRED: no reducer, save, Dex, Hint, Notebook, Shop or copy reads this module (S2/S3 wire it).
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
 * Every registered Research Entry, in the stable anonymous order. Discovered recipes are excluded;
 * unregistered recipes are not represented in any form.
 */
export function deriveResearchEntries(
  inputs: ResearchInputs,
  session: ResearchSession = {},
  recipes: readonly Recipe[] = RECIPES,
): ResearchProjection {
  const ranked: { entry: ResearchEntry; index: number; hash: number }[] = [];
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
      },
      index: unlock.index,
      hash: opaqueHash(recipe.id),
    });
  }
  ranked.sort((a, b) => a.index - b.index || a.hash - b.hash || (a.entry.recipeId < b.entry.recipeId ? -1 : 1));
  return { entries: ranked.map((r) => r.entry) };
}
