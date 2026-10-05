import type { DexEntry, DexState } from "../state/dex";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import {
  createDefaultSave,
  loadSave,
  persistProgress,
  SAVE_STORAGE_KEY,
  type PersistentSaveV2,
  type ProgressionSnapshot,
} from "../state/persistence";
import { finiteIngredientIds, type EditorCatalog } from "./editorCatalog";
import { createMemoryStorage } from "./memoryStorage";

/**
 * DEV State Editor (Issue #403) S1: the editor's view of a save.
 *
 * `EditableState` is exactly the progression fields the editor may replace. It is NOT a save schema and not
 * a second authority: it is read from `loadSave`'s result, turned into the authority's own
 * `ProgressionSnapshot`, and written by the authority's own writer (`canonicalSaveObject`). Fields the editor
 * must not touch (`schemaVersion`, `missionBest`, `dinnerMissionRecords`, unknown keys / ids) are not here;
 * ./saveMerge.ts carries them over from the stored save.
 */
export interface EditableState {
  dex: DexEntry[];
  pitzBalance: number;
  /** The acquisition order: the starters first, then every later acquisition in the order it happened. */
  ownedIngredientIds: string[];
  inventory: Record<string, number>;
  starterGrantClaimedRecipeIds: string[];
  unlockedForShopIngredientIds: string[];
  discoveryHintPurchases: Record<string, number>;
  discoveryHintFacts: Record<string, string[]>;
  discoveredTechniqueIds: string[];
}

export const EDITABLE_STATE_KEYS = [
  "dex",
  "pitzBalance",
  "ownedIngredientIds",
  "inventory",
  "starterGrantClaimedRecipeIds",
  "unlockedForShopIngredientIds",
  "discoveryHintPurchases",
  "discoveryHintFacts",
  "discoveredTechniqueIds",
] as const satisfies readonly (keyof EditableState)[];

export function editableFromSave(save: PersistentSaveV2): EditableState {
  return {
    dex: save.dex.map((e) => ({ ...e })),
    pitzBalance: save.pitzBalance,
    ownedIngredientIds: [...save.ownedIngredientIds],
    inventory: { ...save.inventory },
    starterGrantClaimedRecipeIds: [...save.starterGrantClaimedRecipeIds],
    unlockedForShopIngredientIds: [...save.unlockedForShopIngredientIds],
    discoveryHintPurchases: { ...save.discoveryHintPurchases },
    discoveryHintFacts: Object.fromEntries(Object.entries(save.discoveryHintFacts).map(([id, facts]) => [id, [...facts]])),
    discoveredTechniqueIds: [...save.discoveredTechniqueIds],
  };
}

/** The state of a brand-new save, as the authority defines it. */
export function freshEditableState(): EditableState {
  return editableFromSave(createDefaultSave());
}

export function toSnapshot(state: EditableState): ProgressionSnapshot {
  return {
    dex: state.dex,
    pitzBalance: state.pitzBalance,
    ownedIngredientIds: state.ownedIngredientIds,
    inventory: state.inventory,
    starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
    unlockedForShopIngredientIds: state.unlockedForShopIngredientIds,
    discoveryHintPurchases: state.discoveryHintPurchases,
    discoveryHintFacts: state.discoveryHintFacts,
    discoveredTechniqueIds: state.discoveredTechniqueIds,
  };
}

/**
 * The canonical save object for `state`: the authority's own writer (`persistProgress`) run on an EMPTY
 * scratch storage, so every field is sanitized exactly as the game would. `null` means the writer stored
 * nothing, i.e. `state` is the default save (a brand-new save has no key at all).
 */
export function canonicalSaveObject(state: EditableState): Record<string, unknown> | null {
  const scratch = createMemoryStorage();
  persistProgress(toSnapshot(state), scratch);
  const raw = scratch.getItem(SAVE_STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
}

/**
 * Brings the DERIVED parts of `state` in line with what the game derives on load, so an edit never produces
 * a state the game would silently rewrite:
 * - the Shop entitlement ledger (`resolveShopEntitlement`: the Dex-reached ladder materials + every owned
 *   finite material + the ledger itself, never shrinking),
 * - the technique ledger (a discovered recipe's technique is known: INV-TQ-1).
 */
export function normalizeEditableState(state: EditableState, catalog: EditorCatalog): EditableState {
  const dex: DexState = state.dex;
  const entitlement = resolveShopEntitlement(dex, state.ownedIngredientIds, state.unlockedForShopIngredientIds, catalog.ladder, catalog.countsTowardLadder);
  return {
    ...state,
    unlockedForShopIngredientIds: [...entitlement.unlockedForShopIngredientIds],
    discoveredTechniqueIds: catalog.techniqueLedgerFor(state.discoveredTechniqueIds, dex),
  };
}

/** What the game reads back from the canonical save of `state` (the authority's own load + sanitize). */
export function loadCanonical(state: EditableState): EditableState {
  const canonical = canonicalSaveObject(state);
  if (canonical === null) return freshEditableState();
  return editableFromSave(loadSave(createMemoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(canonical) })));
}

/**
 * The fields whose value the authority changes on a write + load (an id it does not know, a stock it
 * rejects, an order it normalizes...). Empty = the state survives the real save path unchanged. This is the
 * final judge behind `validateEditableState`'s readable messages, and what a preset test pins.
 */
export function roundTripIssues(state: EditableState): (keyof EditableState)[] {
  const back = loadCanonical(state);
  return EDITABLE_STATE_KEYS.filter((key) => JSON.stringify(back[key]) !== JSON.stringify(state[key]));
}

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  field: keyof EditableState;
  message: string;
}

const isNonNegativeInteger = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

/**
 * Validates `state` against `catalog`. Errors make `applyEditableState` refuse; warnings are shown only.
 * It is a pre-check for a readable message: the authority round-trip (`roundTripIssues`) is the final judge.
 */
export function validateEditableState(state: EditableState, catalog: EditorCatalog): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (severity: IssueSeverity, code: string, field: keyof EditableState, message: string) => issues.push({ severity, code, field, message });
  const recipeIds = new Set(catalog.recipes.map((r) => r.id));
  const ingredientIds = new Set(catalog.ingredients.map((i) => i.id));
  const finiteIds = new Set(finiteIngredientIds(catalog));
  const starterIds = new Set(catalog.starterIds);

  for (const e of state.dex) {
    if (!recipeIds.has(e.recipeId)) add("error", "dex-unknown-recipe", "dex", `unknown recipe id: ${e.recipeId}`);
    if (typeof e.discovered !== "boolean") add("error", "dex-discovered", "dex", `discovered must be a boolean: ${e.recipeId}`);
    if (!Number.isInteger(e.bestStars) || e.bestStars < 1 || e.bestStars > 5) add("error", "dex-stars", "dex", `bestStars must be 1..5: ${e.recipeId}`);
    if (!Number.isFinite(e.bestScore) || e.bestScore < 0 || e.bestScore > 100) add("error", "dex-score", "dex", `bestScore must be 0..100: ${e.recipeId}`);
    if (!isNonNegativeInteger(e.timesMade)) add("error", "dex-times-made", "dex", `timesMade must be a non-negative integer: ${e.recipeId}`);
  }
  for (const id of duplicates(state.dex.map((e) => e.recipeId))) add("error", "dex-duplicate", "dex", `duplicate dex entry: ${id}`);

  if (!(typeof state.pitzBalance === "number" && Number.isFinite(state.pitzBalance) && state.pitzBalance >= 0)) {
    add("error", "pitz-invalid", "pitzBalance", "pitzBalance must be a finite non-negative number");
  }

  for (const id of state.ownedIngredientIds) if (!ingredientIds.has(id)) add("error", "owned-unknown", "ownedIngredientIds", `unknown ingredient id: ${id}`);
  for (const id of duplicates(state.ownedIngredientIds)) add("error", "owned-duplicate", "ownedIngredientIds", `duplicate owned ingredient: ${id}`);
  const lead = new Set(state.ownedIngredientIds.slice(0, catalog.starterIds.length));
  if (catalog.starterIds.some((id) => !lead.has(id))) add("error", "owned-starters-first", "ownedIngredientIds", "the starters must lead the acquisition order");

  for (const [id, qty] of Object.entries(state.inventory)) {
    if (starterIds.has(id)) add("error", "inventory-starter", "inventory", `a starter has no finite stock: ${id}`);
    else if (!finiteIds.has(id)) add("error", "inventory-unknown", "inventory", `unknown finite ingredient id: ${id}`);
    if (!isNonNegativeInteger(qty)) add("error", "inventory-qty", "inventory", `stock must be a non-negative integer: ${id}`);
    else if (qty > 0 && finiteIds.has(id) && !state.ownedIngredientIds.includes(id)) add("warning", "inventory-not-owned", "inventory", `stock of an ingredient that is not OWNED: ${id}`);
  }

  for (const id of state.unlockedForShopIngredientIds) if (!finiteIds.has(id)) add("error", "unlocked-unknown", "unlockedForShopIngredientIds", `not a finite ingredient: ${id}`);
  for (const id of state.starterGrantClaimedRecipeIds) if (!recipeIds.has(id)) add("error", "claimed-unknown", "starterGrantClaimedRecipeIds", `unknown recipe id: ${id}`);

  for (const [id, level] of Object.entries(state.discoveryHintPurchases)) {
    if (!recipeIds.has(id)) add("error", "purchases-unknown", "discoveryHintPurchases", `unknown recipe id: ${id}`);
    if (!(Number.isSafeInteger(level) && level >= 1)) add("error", "purchases-level", "discoveryHintPurchases", `a purchased level is a positive integer: ${id}`);
  }
  for (const [id, facts] of Object.entries(state.discoveryHintFacts)) {
    if (!recipeIds.has(id)) add("error", "facts-unknown", "discoveryHintFacts", `unknown recipe id: ${id}`);
    if (!Array.isArray(facts) || facts.some((f) => typeof f !== "string")) add("error", "facts-shape", "discoveryHintFacts", `facts must be a string list: ${id}`);
  }

  const techniqueIds = new Set(catalog.techniqueIds);
  for (const id of state.discoveredTechniqueIds) if (!techniqueIds.has(id)) add("error", "technique-unknown", "discoveredTechniqueIds", `unknown technique id: ${id}`);
  for (const id of duplicates(state.discoveredTechniqueIds)) add("error", "technique-duplicate", "discoveredTechniqueIds", `duplicate technique: ${id}`);
  const derivedTechniques = catalog.techniqueLedgerFor(state.discoveredTechniqueIds, state.dex);
  for (const id of derivedTechniques) {
    if (!state.discoveredTechniqueIds.includes(id)) add("warning", "technique-derived-lock", "discoveredTechniqueIds", `the game adds this technique on load (its recipe is discovered): ${id}`);
  }
  return issues;
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
