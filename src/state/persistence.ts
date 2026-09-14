import { RECIPES } from "../data/recipes";
import { INGREDIENTS } from "../data/ingredients";
import type { DexEntry, DexState } from "./dex";
import type { QualityStars } from "../logic/scoring";

/**
 * Minimal cross-reload persistence (Phase 3C-2, see
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 14-15). Only progression survives a
 * reload -- the round in progress (ORDER/PREPARE/BAKE/RESULT) never does, so `GameState`
 * itself is never serialized here. `PersistentSaveV1` is its own independent shape so the
 * save schema can evolve without being coupled to runtime state types.
 *
 * Scope for this phase: only `dex` (BEST quality + timesMade per recipe) is ever written or
 * read back into gameplay. `pitzBalance` / `ownedIngredientIds` / `missionBest` exist on the
 * schema now (per SSOT section 14's future fields) purely so later phases don't need another
 * migration to add them, but nothing in this phase writes non-default values for them or
 * exposes them in the UI.
 */

export const SAVE_STORAGE_KEY = "teto-pizza-save-v1";
const CURRENT_SCHEMA_VERSION = 1;

export interface PersistentSaveV1 {
  schemaVersion: 1;
  dex: DexEntry[];
  /** Reserved for Phase 3C-4+ (Pitz). Always 0 in this phase -- nothing writes to it yet. */
  pitzBalance: number;
  /** Reserved for Phase 3C-4+ (Shop). Defaults to the full starter set (SSOT section 5: all
   *  13 existing ingredients are OWNED unconditionally), matching current actual gameplay. */
  ownedIngredientIds: string[];
  /** Reserved for Phase 3C-5+ (Mission). Always empty in this phase. */
  missionBest: Record<string, unknown>;
}

const KNOWN_RECIPE_IDS: readonly string[] = RECIPES.map((r) => r.id);
const KNOWN_INGREDIENT_IDS: readonly string[] = INGREDIENTS.map((i) => i.id);

function isKnownRecipeId(value: unknown): value is string {
  return typeof value === "string" && KNOWN_RECIPE_IDS.includes(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isValidBestScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isValidBestStars(value: unknown): value is QualityStars {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Validates one raw Dex entry from storage. Returns null (skip) instead of throwing, so a
 * single corrupt entry never takes down the rest of an otherwise-valid save -- the
 * alternative (rejecting the whole save on any bad entry) would erase every other recipe's
 * BEST just because of one bad record.
 */
function sanitizeDexEntry(raw: unknown): DexEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isKnownRecipeId(r.recipeId)) return null;
  if (typeof r.discovered !== "boolean") return null;
  if (!isValidBestScore(r.bestScore)) return null;
  if (!isValidBestStars(r.bestStars)) return null;
  if (!isNonNegativeInteger(r.timesMade)) return null;
  return {
    recipeId: r.recipeId,
    discovered: r.discovered,
    bestScore: r.bestScore,
    bestStars: r.bestStars,
    timesMade: r.timesMade,
  };
}

function sanitizeDex(raw: unknown): DexEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: DexEntry[] = [];
  for (const item of raw) {
    const entry = sanitizeDexEntry(item);
    if (!entry || seen.has(entry.recipeId)) continue;
    seen.add(entry.recipeId);
    result.push(entry);
  }
  return result;
}

function sanitizePitzBalance(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function sanitizeOwnedIngredientIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...KNOWN_INGREDIENT_IDS];
  const owned = raw.filter(
    (id): id is string => typeof id === "string" && KNOWN_INGREDIENT_IDS.includes(id),
  );
  return Array.from(new Set(owned));
}

function sanitizeMissionBest(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}

export function createDefaultSave(): PersistentSaveV1 {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: [...KNOWN_INGREDIENT_IDS],
    missionBest: {},
  };
}

/**
 * Validates a raw parsed JSON value against the PersistentSaveV1 root shape. A malformed
 * root (not an object, wrong/missing `schemaVersion`, `dex` not an array) discards the whole
 * save and falls back to fresh -- there's no way to trust anything else in it. Problems
 * *inside* an otherwise-valid root (a bad Dex entry, an unknown ingredient id) are instead
 * repaired field-by-field so they don't need to cost the rest of the save.
 */
function sanitizeSave(raw: unknown): PersistentSaveV1 | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== CURRENT_SCHEMA_VERSION) return null;
  if (!Array.isArray(r.dex)) return null;

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    dex: sanitizeDex(r.dex),
    pitzBalance: sanitizePitzBalance(r.pitzBalance),
    ownedIngredientIds: sanitizeOwnedIngredientIds(r.ownedIngredientIds),
    missionBest: sanitizeMissionBest(r.missionBest),
  };
}

/** Minimal storage interface -- matches `Storage` (localStorage/sessionStorage) but lets
 *  tests inject an in-memory fake instead of depending on a DOM/jsdom environment. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Accessing localStorage itself can throw (privacy mode, disabled storage, some
    // embedded webviews) -- treat that exactly like "no storage available".
    return null;
  }
}

/**
 * Loads and validates the save from storage. Never throws: no storage, a storage read
 * error, malformed JSON, an invalid root shape, or an unknown schema version all fall back
 * to a fresh default save so the game is always playable.
 */
export function loadSave(storage: StorageLike | null = getDefaultStorage()): PersistentSaveV1 {
  if (!storage) return createDefaultSave();
  try {
    const raw = storage.getItem(SAVE_STORAGE_KEY);
    if (raw === null) return createDefaultSave();
    const parsed: unknown = JSON.parse(raw);
    return sanitizeSave(parsed) ?? createDefaultSave();
  } catch {
    return createDefaultSave();
  }
}

function dexEntriesEqual(a: DexEntry, b: DexEntry): boolean {
  return (
    a.recipeId === b.recipeId &&
    a.discovered === b.discovered &&
    a.bestScore === b.bestScore &&
    a.bestStars === b.bestStars &&
    a.timesMade === b.timesMade
  );
}

function dexEquals(a: DexState, b: readonly DexEntry[]): boolean {
  return a.length === b.length && a.every((entry, i) => dexEntriesEqual(entry, b[i]));
}

/**
 * Persists just the Dex slice of progression. Reads the current save first and only
 * replaces its `dex` field, so any other saved field is preserved rather than reset to
 * default on every write. Swallows storage failures (quota exceeded, storage disabled) --
 * the round already happened in memory, so a failed save must never break gameplay.
 *
 * Skips the write entirely when `dex` already matches what `loadSave` reads back. This is
 * more than an optimization: App.tsx's persistence effect also fires once on mount with
 * whatever Dex hydration produced, and if storage holds a save this client doesn't
 * recognize (e.g. a newer `schemaVersion`), hydration falls back to an empty Dex -- without
 * this check, that mount-time call would immediately overwrite the unrecognized save with a
 * fresh empty one, destroying real progression before the player did anything. Since a
 * genuinely unrecognized save's Dex ([]) is never equal to a *real* Dex the player has
 * actually earned, skipping no-op writes here also means "don't touch a save you can't
 * make sense of" for free.
 */
export function persistDex(
  dex: DexState,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    const current = loadSave(storage);
    if (dexEquals(dex, current.dex)) return;
    const next: PersistentSaveV1 = { ...current, dex: [...dex] };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full, disabled, or otherwise unavailable -- gameplay continues unaffected.
  }
}

/**
 * Clears any saved progression. A small, pure-ish API kept for tests and future dev/reset
 * use -- Phase 3C-2 does not add a user-facing Reset UI (out of scope).
 */
export function clearSave(storage: StorageLike | null = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // ignore -- nothing to clean up if storage itself is unavailable.
  }
}
