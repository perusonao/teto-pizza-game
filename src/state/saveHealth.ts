/**
 * Save Protection PR-2 (Issue #560): what the player is told about the state of their save.
 *
 * Four situations are kept apart, because each one asks the player for something different and promises something
 * different about their data:
 * - `future-version`   the save is a NEWER build's. It is intact and untouched; this build does not save over it.
 * - `corrupt`          the stored text cannot be read at all. The game runs from a fresh start; the damaged text is copied
 *                      into the quarantine before anything replaces it (`backedUp`: that copy already exists).
 * - `backup-failed`    the damaged text could not be copied (storage error / too large), so nothing is replaced and the
 *                      session is not saved.
 * - `storage-unavailable` the stored text could not even be read, so the session is not saved.
 * - `backup-kept`      informational: a quarantined copy exists that the player has not acknowledged yet.
 *
 * Pure over a storage and the last write block; reads only, never writes.
 */

import { classifyStoredSave } from "./saveRootClassification";
import { isRawQuarantined, summarizeQuarantine, type QuarantineKind } from "./saveQuarantine";
import { SAVE_STORAGE_KEY, type SaveWriteBlock, type StorageLike } from "./persistence";

export type SaveNotice =
  | { kind: "future-version"; schemaVersion: number }
  | { kind: "corrupt"; backedUp: boolean }
  | { kind: "backup-failed"; reason: "quarantine-failed" | "quarantine-too-large" }
  | { kind: "storage-unavailable" }
  | { kind: "backup-kept"; entryKind: QuarantineKind };

export interface SaveHealth {
  notice: SaveNotice | null;
  /** Quarantine slots holding something: > 0 means Settings offers the explicit "delete backup" action. */
  quarantineCount: number;
}

/** Notices that mean "this session is not being saved" (or the save is at risk): never dismissible. */
export function isBlockingNotice(notice: SaveNotice | null): boolean {
  return notice !== null && notice.kind !== "backup-kept";
}

export function inspectSaveHealth(storage: StorageLike | null, lastBlock: SaveWriteBlock | null): SaveHealth {
  if (!storage) return { notice: null, quarantineCount: 0 };
  const held = summarizeQuarantine(storage, SAVE_STORAGE_KEY);
  const quarantineCount = held.count;

  if (lastBlock === "storage-error") return { notice: { kind: "storage-unavailable" }, quarantineCount };
  if (lastBlock === "quarantine-failed" || lastBlock === "quarantine-too-large") {
    return { notice: { kind: "backup-failed", reason: lastBlock }, quarantineCount };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return { notice: { kind: "storage-unavailable" }, quarantineCount };
  }
  const stored = classifyStoredSave(raw);
  if (stored.kind === "unknown-schema") {
    return { notice: { kind: "future-version", schemaVersion: stored.schemaVersion }, quarantineCount };
  }
  if (stored.kind === "corrupt") {
    return {
      notice: { kind: "corrupt", backedUp: isRawQuarantined(storage, raw as string, SAVE_STORAGE_KEY) },
      quarantineCount,
    };
  }
  if (held.unacknowledgedKind !== null) {
    return { notice: { kind: "backup-kept", entryKind: held.unacknowledgedKind }, quarantineCount };
  }
  return { notice: null, quarantineCount };
}
