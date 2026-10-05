import { createDefaultSave, MAX_TECHNIQUE_LEDGER_SIZE } from "../state/persistence";
import { SAVE_ID_PATTERN } from "../state/saveIdGrammar";
import type { EditorCatalog } from "./editorCatalog";

/**
 * DEV State Editor (Issue #403) S2: the pure merge of an edited save with the stored one (Owner Contract 3).
 *
 * "Keep what the editor does not edit; replace only the known fields it does":
 * - the KNOWN editable fields come from `canonical` (./stateModel.ts `canonicalSaveObject`: the authority's own
 *   writer output), never from this module, so this module is not a second save-schema authority;
 * - everything else in the STORED save is carried over verbatim: unknown top-level keys, `missionBest` and
 *   `dinnerMissionRecords` (Owner Decision OD-3: kept by default), and, inside the known fields, ids this build
 *   does not know (an unknown recipe id in the Dex / hint ledgers / claimed list, an unknown ingredient id in the
 *   owned list / stock / Shop ledger, an unknown technique id), which a newer build may have written.
 * - an id the catalog KNOWS that the edit removed stays removed: only UNKNOWN ids are preserved.
 *
 * No I/O, no storage, no catalog beyond the argument: a plain function of its inputs.
 */

export interface MergeOptions {
  preserveMissionBest: boolean;
  preserveDinnerRecords: boolean;
  /** Unknown top-level keys and unknown ids inside the known fields. */
  preserveUnknown: boolean;
}

export const DEFAULT_MERGE_OPTIONS: MergeOptions = { preserveMissionBest: true, preserveDinnerRecords: true, preserveUnknown: true };

export type RawSaveClass =
  | { kind: "empty" }
  /** Present but not JSON. Nothing in it can be read; the backup keeps it byte for byte. */
  | { kind: "corrupt" }
  /** JSON, but not a root the game recognizes (a newer `schemaVersion`, a non-object, `dex` not a list). */
  | { kind: "unknown-schema"; schemaVersion: unknown }
  | { kind: "readable"; value: Record<string, unknown> };

/** The same root gate the game's loader applies (`extractForwardCompatExtras` / `sanitizeSave`). */
export function classifyRawSave(raw: string | null): RawSaveClass {
  if (raw === null) return { kind: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "corrupt" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { kind: "unknown-schema", schemaVersion: undefined };
  const value = parsed as Record<string, unknown>;
  if ((value.schemaVersion !== 1 && value.schemaVersion !== 2) || !Array.isArray(value.dex)) {
    return { kind: "unknown-schema", schemaVersion: value.schemaVersion };
  }
  return { kind: "readable", value };
}

/** Every top-level key the editor owns or deliberately handles itself; any other key is an unknown one. */
const HANDLED_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "dex",
  "pitzBalance",
  "ownedIngredientIds",
  "inventory",
  "starterGrantClaimedRecipeIds",
  "unlockedForShopIngredientIds",
  "discoveryHintPurchases",
  "discoveryHintFacts",
  "discoveredTechniqueIds",
  "missionBest",
  "dinnerMissionRecords",
  "dinnerMissionRecordsState",
]);

export interface PreservedReport {
  topLevelKeys: string[];
  unknownIds: number;
  missionBest: boolean;
  dinnerRecords: boolean;
}

export interface MergeResult {
  /** The save object to store, or `null` = store nothing (a brand-new save has no key). */
  value: Record<string, unknown> | null;
  preserved: PreservedReport;
}

const isWellFormedId = (v: unknown): v is string => typeof v === "string" && SAVE_ID_PATTERN.test(v);
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function unknownIdList(raw: unknown, known: ReadonlySet<string>): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => isWellFormedId(id) && !known.has(id)))];
}

function unknownKeys(raw: unknown, known: ReadonlySet<string>, accept: (value: unknown) => boolean): [string, unknown][] {
  if (!isPlainObject(raw)) return [];
  return Object.entries(raw).filter(([id, value]) => isWellFormedId(id) && !known.has(id) && accept(value));
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The acquisition order is history (the Research unlock fact and the Deduction guard read it), and the game's own
 * writer keeps the stored positions of ids it does not know (`mergeOwnedOrder`). So an unknown id is NOT appended
 * behind the edited known ids: it goes back right after the closest earlier stored id that is still in the result
 * (a known id the edit kept, or an unknown id already placed); with none, it keeps the front. An edit that does not
 * touch the order therefore leaves the stored order exactly as it was.
 */
function mergeUnknownOwnedAtStoredPositions(edited: readonly string[], storedOrder: readonly unknown[], unknown: ReadonlySet<string>): string[] {
  const result = [...edited];
  const stored = storedOrder.filter((id): id is string => typeof id === "string");
  const placed = new Set<string>();
  stored.forEach((id, i) => {
    if (!unknown.has(id) || placed.has(id)) return;
    placed.add(id);
    let anchor = -1;
    for (let j = i - 1; j >= 0 && anchor < 0; j -= 1) anchor = result.indexOf(stored[j]);
    result.splice(anchor + 1, 0, id);
  });
  return result;
}

function defaultSaveObject(): Record<string, unknown> {
  const { dinnerMissionRecordsState: _derived, ...stored } = createDefaultSave();
  return { ...stored };
}

export function mergeEditedSave(
  canonical: Record<string, unknown> | null,
  original: RawSaveClass,
  catalog: EditorCatalog,
  options: MergeOptions = DEFAULT_MERGE_OPTIONS,
): MergeResult {
  const preserved: PreservedReport = { topLevelKeys: [], unknownIds: 0, missionBest: false, dinnerRecords: false };
  if (original.kind !== "readable") return { value: canonical, preserved };
  const stored = original.value;
  const out: Record<string, unknown> = {};
  const preservedExtras: Record<string, unknown> = {};

  if (options.preserveUnknown) {
    for (const [key, value] of Object.entries(stored)) {
      if (HANDLED_TOP_LEVEL_KEYS.has(key) || key === "__proto__") continue;
      preservedExtras[key] = value;
      preserved.topLevelKeys.push(key);
    }
  }

  const unknownIdsOnly: Record<string, unknown> = {};
  if (options.preserveUnknown) {
    const recipeIds = new Set(catalog.recipes.map((r) => r.id));
    const ingredientIds = new Set(catalog.ingredients.map((i) => i.id));
    const techniqueIds = new Set(catalog.techniqueIds);
    const seenDex = new Set<string>();
    const dex = asList(stored.dex).filter((e): e is Record<string, unknown> => {
      if (!isPlainObject(e) || !isWellFormedId(e.recipeId) || recipeIds.has(e.recipeId) || seenDex.has(e.recipeId)) return false;
      seenDex.add(e.recipeId);
      return true;
    });
    unknownIdsOnly.dex = dex;
    unknownIdsOnly.ownedIngredientIds = unknownIdList(stored.ownedIngredientIds, ingredientIds);
    unknownIdsOnly.inventory = unknownKeys(stored.inventory, ingredientIds, (v) => typeof v === "number" && Number.isInteger(v) && v >= 0);
    unknownIdsOnly.starterGrantClaimedRecipeIds = unknownIdList(stored.starterGrantClaimedRecipeIds, recipeIds);
    unknownIdsOnly.unlockedForShopIngredientIds = unknownIdList(stored.unlockedForShopIngredientIds, ingredientIds);
    unknownIdsOnly.discoveryHintPurchases = unknownKeys(stored.discoveryHintPurchases, recipeIds, (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 1);
    unknownIdsOnly.discoveryHintFacts = unknownKeys(stored.discoveryHintFacts, recipeIds, (v) => Array.isArray(v));
    unknownIdsOnly.discoveredTechniqueIds = unknownIdList(stored.discoveredTechniqueIds, techniqueIds);
  }

  const keepMissionBest = options.preserveMissionBest && isPlainObject(stored.missionBest) && Object.keys(stored.missionBest).length > 0;
  const keepDinner = options.preserveDinnerRecords && stored.dinnerMissionRecords !== undefined;
  preserved.missionBest = keepMissionBest;
  preserved.dinnerRecords = keepDinner;
  const countUnknown = () =>
    Object.values(unknownIdsOnly).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  preserved.unknownIds = countUnknown();

  const nothingToKeep = preserved.topLevelKeys.length === 0 && preserved.unknownIds === 0 && !keepMissionBest && !keepDinner;
  if (nothingToKeep) return { value: canonical, preserved };

  const base = canonical ?? defaultSaveObject();
  Object.assign(out, preservedExtras, base);
  const append = <T,>(field: string, extra: readonly T[]) => {
    if (extra.length > 0) out[field] = [...asList(out[field]), ...extra];
  };
  append("dex", asList(unknownIdsOnly.dex));
  if (asList(unknownIdsOnly.ownedIngredientIds).length > 0) {
    out.ownedIngredientIds = mergeUnknownOwnedAtStoredPositions(asList(out.ownedIngredientIds) as string[], asList(stored.ownedIngredientIds), new Set(asList(unknownIdsOnly.ownedIngredientIds) as string[]));
  }
  append("starterGrantClaimedRecipeIds", asList(unknownIdsOnly.starterGrantClaimedRecipeIds));
  append("unlockedForShopIngredientIds", asList(unknownIdsOnly.unlockedForShopIngredientIds));
  if (asList(unknownIdsOnly.discoveredTechniqueIds).length > 0) {
    out.discoveredTechniqueIds = [...asList(out.discoveredTechniqueIds), ...asList(unknownIdsOnly.discoveredTechniqueIds)].slice(0, MAX_TECHNIQUE_LEDGER_SIZE);
  }
  for (const field of ["inventory", "discoveryHintPurchases", "discoveryHintFacts"] as const) {
    const extra = asList(unknownIdsOnly[field]) as [string, unknown][];
    if (extra.length > 0) out[field] = { ...(isPlainObject(out[field]) ? out[field] : {}), ...Object.fromEntries(extra) };
  }
  if (keepMissionBest) out.missionBest = stored.missionBest;
  if (keepDinner) out.dinnerMissionRecords = stored.dinnerMissionRecords;
  return { value: out, preserved };
}
