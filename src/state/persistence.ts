import { RECIPES } from "../data/recipes";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { DexEntry, DexState } from "./dex";
import type { QualityStars } from "../logic/scoring";
import { isNewMissionBest } from "../logic/missionScoring";

/**
 * Minimal cross-reload persistence (Phase 3C-2, see
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 14-15). Only progression survives a
 * reload -- the round in progress (ORDER/PREPARE/BAKE/RESULT) never does, so `GameState`
 * itself is never serialized here. `PersistentSaveV1` is its own independent shape so the
 * save schema can evolve without being coupled to runtime state types.
 *
 * Scope through Phase 3C-2: only `dex` (BEST quality + timesMade per recipe) was ever
 * written or read back into gameplay. `pitzBalance` / `ownedIngredientIds` / `missionBest`
 * existed on the schema (per SSOT section 14's future fields) purely so later phases
 * wouldn't need another migration to add them.
 *
 * Phase 3C-3 starts actually *reading* `ownedIngredientIds` into gameplay (see
 * src/state/progression.ts and gameReducer.ts's `nextOrderState`) to derive ingredient
 * state and recipe availability. Nothing here writes non-default values for it yet though
 * -- there is no purchase flow in this phase, so every save's `ownedIngredientIds` is still
 * always exactly the Starter Set (this schema doesn't need a version bump for that: the
 * shape hasn't changed, only how a downstream consumer uses one already-reserved field).
 *
 * Phase 3C-4 (Lunch Rush) is the first phase to actually read/write `missionBest`: one
 * entry per mission id (currently just `LUNCH_RUSH_MISSION_ID`, see
 * src/mission/lunchRush.ts), each a monotonic (never-decreasing) Mission Score BEST -- same
 * "BEST never goes down" rule Dex BEST already follows. No schema/version bump needed here
 * either: the field's shape (a record keyed by mission id) was already reserved, this phase
 * just starts actually validating and using its contents.
 *
 * Phase 3C-5 (Pitz + Shop) is the first phase to actually read/write `pitzBalance`, and the
 * first to write non-default `ownedIngredientIds` (via a purchase). Both live on `GameState`
 * now (see src/state/gameReducer.ts) alongside `dex`, so `persistProgress` below is the one
 * canonical write path for all three of GameState's own persisted fields together -- it reads
 * the current save once and patches `dex`/`pitzBalance`/`ownedIngredientIds` in a single
 * merge, so a Pitz-balance or ingredient-ownership change can never accidentally clobber
 * `missionBest` (owned separately by `persistMissionBest`/`loadMissionBest`, Mission run state
 * living outside GameState entirely) or vice versa. `persistDex` is kept as its own function
 * (and still fully tested) for any caller that only ever touches Dex, but App.tsx itself calls
 * `persistProgress` for every GameState-driven save since Phase 3C-5.
 */

/**
 * Preview deployments (perusonao/teto-pizza-game-preview) share the production app's
 * `perusonao.github.io` origin -- only the path differs -- and `localStorage` is scoped by
 * origin, not path, so a preview build reading/writing the production key would silently
 * mix a reviewer's real save with whatever a preview round leaves behind. `VITE_PREVIEW_MODE`
 * is set only by the preview build pipeline (never by the production `vite build`, which
 * leaves it unset), so this never changes production's key and needs no schema/version bump
 * -- `PersistentSaveV1`'s shape is identical either way, just stored under a different key.
 */
export const SAVE_STORAGE_KEY = import.meta.env.VITE_PREVIEW_MODE
  ? "teto-pizza-preview-save-v1"
  : "teto-pizza-save-v1";
const CURRENT_SCHEMA_VERSION = 1;

export interface PersistentSaveV1 {
  schemaVersion: 1;
  dex: DexEntry[];
  /** Pitz balance (Phase 3C-5, SSOT section 3). Earned via `CLAIM_MISSION_REWARD` (a
   *  completed Lunch Rush run), spent via `PURCHASE_INGREDIENT`. Free play never changes
   *  this. Always a non-negative number -- see `sanitizePitzBalance` below. */
  pitzBalance: number;
  /** Canonical OWNED ingredient ids (Phase 3C-3+, SSOT section 6). Always a superset of the
   *  Starter Set (SSOT section 5: all 13 existing ingredients are OWNED unconditionally --
   *  see `sanitizeOwnedIngredientIds` below, which backfills them unconditionally on every
   *  load). Grows only via a successful purchase (Phase 3C-5, `PURCHASE_INGREDIENT`) -- an
   *  ingredient is never removed once added (SSOT section 9: purchases are permanent). */
  ownedIngredientIds: string[];
  /** Mission Score BEST per mission id (Phase 3C-4, SSOT section 11). Keyed by mission id
   *  (e.g. `{ "lunch-rush": 742 }`, see `LUNCH_RUSH_MISSION_ID` in src/mission/lunchRush.ts)
   *  rather than a single flat number so future missions never collide with each other's
   *  BEST. Absent keys read back as 0 BEST (`loadMissionBest`) -- never negative, never
   *  written except through `persistMissionBest`'s monotonic ("never goes down") write. */
  missionBest: Record<string, number>;
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

/**
 * Sanitizes the saved owned-ingredient list and unconditionally backfills the Starter Set
 * into it (SSOT section 5: all 13 existing ingredients are OWNED, no exceptions). This
 * covers every way a save could otherwise end up missing one: the field absent entirely (a
 * pre-3C-3 save, or any non-array value), or -- defensively, since nothing in this phase
 * ever writes a save missing them, but a future phase's purchase flow could get this wrong
 * -- an array that's present but simply doesn't list every starter id. Either way, the
 * starter ingredients must never read back as anything other than OWNED.
 */
function sanitizeOwnedIngredientIds(raw: unknown): string[] {
  const validKnownIds = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string" && KNOWN_INGREDIENT_IDS.includes(id))
    : [];
  return Array.from(new Set([...STARTER_INGREDIENT_IDS, ...validKnownIds]));
}

function isValidMissionBestValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/**
 * Sanitizes the saved Mission BEST record. Phase 3C-2 reserved this field's *shape*
 * (a plain record keyed by mission id) without validating or reading its contents; Phase
 * 3C-4 is the first phase to actually use it, so this is the first real validation of what's
 * inside. Per-key, not all-or-nothing (matches `sanitizeDex`'s per-entry tolerance below): an
 * invalid value under one mission id is simply dropped rather than discarding every other
 * mission's BEST.
 */
function sanitizeMissionBest(raw: unknown): Record<string, number> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isValidMissionBestValue(value)) result[key] = value;
  }
  return result;
}

export function createDefaultSave(): PersistentSaveV1 {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
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

/** True when both id lists contain exactly the same set of ids, ignoring order/duplicates.
 *  Used by `persistProgress` to decide whether `ownedIngredientIds` actually changed (a fresh
 *  purchase appends an id; comparing as sets means a save whose list happens to be in a
 *  different order, e.g. after `sanitizeOwnedIngredientIds`'s dedupe, is still treated as
 *  unchanged rather than triggering a spurious write). */
function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/** The progression fields `GameState` itself owns (src/state/gameReducer.ts) -- everything
 *  `persistProgress` patches in one merge. Deliberately excludes `missionBest`, which lives
 *  outside GameState (Mission run state, src/mission/lunchRush.ts) and is only ever written
 *  through `persistMissionBest`. */
export interface ProgressionSnapshot {
  dex: DexState;
  pitzBalance: number;
  ownedIngredientIds: readonly string[];
}

/**
 * Canonical write path (Phase 3C-5) for every progression field `GameState` itself tracks --
 * `dex`, `pitzBalance`, `ownedIngredientIds` -- patched together in one read-modify-write
 * against the current save. Supersedes calling `persistDex` alone from App.tsx: a Pitz-balance
 * change (Mission reward) or an ownership change (a purchase) needs saving exactly as much as
 * a Dex change does, and merging all three in one write here means they can never race each
 * other into clobbering one another (each call reads the *current* save fresh, so a `dex`-only
 * change never has stale pre-purchase `pitzBalance` sitting in its `snapshot`, since callers
 * always pass the full current `GameState` slice, not a partial one).
 *
 * `missionBest` is never touched here -- it's read fresh from the current save and carried
 * through unchanged (`...current`), exactly like `persistDex`'s own pattern. Skips the write
 * entirely when nothing in the snapshot actually differs from what's stored (same reasoning as
 * `persistDex`'s no-op skip: avoids clobbering a save this client doesn't fully recognize with
 * a redundant, no-op write on mount). Swallows storage failures like every other write in this
 * module -- a failed save must never break gameplay.
 */
export function persistProgress(
  snapshot: ProgressionSnapshot,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    const current = loadSave(storage);
    const nextDex = [...snapshot.dex];
    const nextPitzBalance = sanitizePitzBalance(snapshot.pitzBalance);
    const nextOwnedIngredientIds = sanitizeOwnedIngredientIds([...snapshot.ownedIngredientIds]);

    const dexUnchanged = dexEquals(nextDex, current.dex);
    const pitzUnchanged = nextPitzBalance === current.pitzBalance;
    const ownedUnchanged = sameStringSet(nextOwnedIngredientIds, current.ownedIngredientIds);
    if (dexUnchanged && pitzUnchanged && ownedUnchanged) return;

    const next: PersistentSaveV1 = {
      ...current,
      dex: nextDex,
      pitzBalance: nextPitzBalance,
      ownedIngredientIds: nextOwnedIngredientIds,
    };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full, disabled, or otherwise unavailable -- gameplay continues unaffected.
  }
}

/** Reads one mission's persisted BEST score. Never throws (delegates to `loadSave`'s own
 *  safe fallback): no storage, a read error, or a corrupt/absent entry all read back as 0. */
export function loadMissionBest(
  missionId: string,
  storage: StorageLike | null = getDefaultStorage(),
): number {
  const save = loadSave(storage);
  return save.missionBest[missionId] ?? 0;
}

/**
 * Persists a Mission's BEST score, monotonically -- same "never goes down" rule Dex BEST
 * follows (src/state/dex.ts). A write that isn't actually a new BEST is skipped entirely
 * (no-op), the same reasoning as `persistDex`'s no-op skip: it avoids ever downgrading a
 * BEST, and avoids clobbering a save this client doesn't otherwise recognize with a
 * redundant write. Swallows storage failures like every other write in this module -- a
 * failed save must never break gameplay.
 */
export function persistMissionBest(
  missionId: string,
  score: number,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    const current = loadSave(storage);
    const existingBest = current.missionBest[missionId] ?? 0;
    if (!isNewMissionBest(score, existingBest)) return;
    const next: PersistentSaveV1 = {
      ...current,
      missionBest: { ...current.missionBest, [missionId]: score },
    };
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
