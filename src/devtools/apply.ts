import { loadSave, SAVE_STORAGE_KEY, type StorageLike } from "../state/persistence";
import { discardBackup, makeBackupEntry, readBackup, readRawSave, writeBackup } from "./backup";
import { productionCatalog, type EditorCatalog } from "./editorCatalog";
import { classifyRawSave, DEFAULT_MERGE_OPTIONS, mergeEditedSave, type MergeOptions, type PreservedReport, type RawSaveClass } from "./saveMerge";
import { canonicalSaveObject, editableFromSave, hasErrors, loadCanonical, validateEditableState, type EditableState, type ValidationIssue } from "./stateModel";

/**
 * DEV State Editor (Issue #403) S2: apply an `EditableState` to the stored save.
 *
 * Order, each step fail-closed (Owner Contract 5: a failed backup means NOTHING is applied):
 *   1. read the stored raw string;  2. validate the state;  3. refuse an unreadable stored save unless the
 *   caller acknowledged it;  4. BACK UP the raw string (slot `original` once, slot `previous` every time, each
 *   written and read back);  5. build the new save (the authority's writer + the pure merge);  6. write it;
 *   7. verify by reading it back and loading it with the game's own loader; on a mismatch the raw string is put
 *   back.
 * The only function here that writes the save key. It never changes `persistence.ts`, a reducer or any data.
 */

export type ApplyFailureReason =
  | "storage-unavailable"
  | "invalid-state"
  | "unreadable-save"
  | "backup-failed"
  | "write-failed"
  | "verify-failed";

export interface ApplyOptions extends Partial<MergeOptions> {
  /** The stored save is corrupt or of a schema this build cannot read: apply anyway (the backup holds it). */
  acknowledgeUnreadable?: boolean;
  catalog?: EditorCatalog;
  now?: () => Date;
}

export type ApplyResult =
  | { ok: true; preserved: PreservedReport; stored: RawSaveClass["kind"]; backedUpOriginal: boolean }
  | { ok: false; reason: ApplyFailureReason; issues?: ValidationIssue[]; stored?: RawSaveClass["kind"]; rolledBack?: boolean };

/** Makes the stored save `raw` again (no-op when it already is). True only when it reads back as `raw`. */
function putRawBack(storage: StorageLike, raw: string | null): boolean {
  try {
    if (storage.getItem(SAVE_STORAGE_KEY) === raw) return true;
    if (raw === null) storage.removeItem(SAVE_STORAGE_KEY);
    else storage.setItem(SAVE_STORAGE_KEY, raw);
    return storage.getItem(SAVE_STORAGE_KEY) === raw;
  } catch {
    return false;
  }
}

export function applyEditableState(state: EditableState, storage: StorageLike | null, options: ApplyOptions = {}): ApplyResult {
  if (!storage) return { ok: false, reason: "storage-unavailable" };
  const catalog = options.catalog ?? productionCatalog();
  const merge: MergeOptions = {
    preserveMissionBest: options.preserveMissionBest ?? DEFAULT_MERGE_OPTIONS.preserveMissionBest,
    preserveDinnerRecords: options.preserveDinnerRecords ?? DEFAULT_MERGE_OPTIONS.preserveDinnerRecords,
    preserveUnknown: options.preserveUnknown ?? DEFAULT_MERGE_OPTIONS.preserveUnknown,
  };

  const stored = readRawSave(storage);
  if (!stored.ok) return { ok: false, reason: "storage-unavailable" };
  const original = classifyRawSave(stored.raw);

  const issues = validateEditableState(state, catalog);
  if (hasErrors(issues)) return { ok: false, reason: "invalid-state", issues, stored: original.kind };

  if ((original.kind === "corrupt" || original.kind === "unknown-schema") && !options.acknowledgeUnreadable) {
    return { ok: false, reason: "unreadable-save", stored: original.kind };
  }

  // 4. backup first. Nothing below runs unless every backup write read back equal.
  const createdAt = (options.now?.() ?? new Date()).toISOString();
  const originalSlot = readBackup(storage, "original");
  if (originalSlot.kind === "corrupt" || originalSlot.kind === "error") return { ok: false, reason: "backup-failed", stored: original.kind };
  const needsOriginal = originalSlot.kind === "none";
  if (needsOriginal && !writeBackup(storage, makeBackupEntry("original", stored.raw, createdAt))) {
    return { ok: false, reason: "backup-failed", stored: original.kind };
  }
  if (!writeBackup(storage, makeBackupEntry("previous", stored.raw, createdAt))) {
    // The original slot written just above (if any) is an exact copy of what is still stored: nothing is lost.
    if (needsOriginal) discardBackup(storage, "original");
    return { ok: false, reason: "backup-failed", stored: original.kind };
  }

  // 5. build
  let merged: ReturnType<typeof mergeEditedSave>;
  try {
    merged = mergeEditedSave(canonicalSaveObject(state), original, catalog, merge);
  } catch {
    return { ok: false, reason: "write-failed", stored: original.kind, rolledBack: true };
  }

  // 6. write
  try {
    if (merged.value === null) storage.removeItem(SAVE_STORAGE_KEY);
    else storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(merged.value));
  } catch {
    return { ok: false, reason: "write-failed", stored: original.kind, rolledBack: putRawBack(storage, stored.raw) };
  }

  // 7. verify: the stored text is what was written, and the game's own loader reads the intended state.
  const expectedText = merged.value === null ? null : JSON.stringify(merged.value);
  let verified = false;
  try {
    verified =
      storage.getItem(SAVE_STORAGE_KEY) === expectedText &&
      JSON.stringify(editableFromSave(loadSave(storage))) === JSON.stringify(loadCanonical(state));
  } catch {
    verified = false;
  }
  if (!verified) return { ok: false, reason: "verify-failed", stored: original.kind, rolledBack: putRawBack(storage, stored.raw) };

  return { ok: true, preserved: merged.preserved, stored: original.kind, backedUpOriginal: needsOriginal };
}

/** The editor's read-only view of the stored save: what it is, and the state the game reads from it. */
export type SaveInspection =
  | { kind: "empty"; state: EditableState }
  | { kind: "readable"; state: EditableState; schemaVersion: unknown }
  | { kind: "corrupt" | "unknown-schema" | "storage-error" };

export function inspectStoredSave(storage: StorageLike | null): SaveInspection {
  if (!storage) return { kind: "storage-error" };
  const stored = readRawSave(storage);
  if (!stored.ok) return { kind: "storage-error" };
  const cls = classifyRawSave(stored.raw);
  if (cls.kind === "corrupt" || cls.kind === "unknown-schema") return { kind: cls.kind };
  const state = editableFromSave(loadSave(storage));
  return cls.kind === "empty" ? { kind: "empty", state } : { kind: "readable", state, schemaVersion: cls.value.schemaVersion };
}

