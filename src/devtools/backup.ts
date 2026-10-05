import { SAVE_STORAGE_KEY, type StorageLike } from "../state/persistence";
import { DEV_BACKUP_KEY_SUFFIX } from "./marks";

/**
 * DEV State Editor (Issue #403) S2: the backup of the stored save (Owner Contract 4 / 5).
 *
 * - The backup keeps the RAW stored string, byte for byte (it never parses, sanitizes or re-serializes), so an
 *   unknown key, a broken Dinner record, a corrupt or a newer-schema save all restore exactly.
 * - It lives under its OWN storage keys (`<save key>.dev-backup-v1.<slot>`), never inside the save: it cannot
 *   conflict with the save schema, a save never carries a DEV marker, and Full Game Reset (which removes the
 *   save key only) does not touch it. A Preview build's backup sits beside the Preview save, never beside the
 *   production one.
 * - Two slots: `original` is written once (by the first apply) and kept until it is restored or discarded, so
 *   applying several states in a row never loses the player's real save; `previous` is overwritten by every
 *   apply (one step back).
 * - A write is only believed after it is READ BACK equal. A failure is reported, and the caller must not apply.
 */

export type BackupSlot = "original" | "previous";
export const BACKUP_SLOTS: readonly BackupSlot[] = ["original", "previous"];

export interface BackupEntry {
  v: 1;
  slot: BackupSlot;
  createdAt: string;
  /** The save key the raw string came from (so a restore can refuse a mismatching build). */
  sourceKey: string;
  /** False = there was no save at all; restoring removes the key. */
  hadSave: boolean;
  raw: string | null;
}

export function backupKey(slot: BackupSlot, saveKey: string = SAVE_STORAGE_KEY): string {
  return `${saveKey}${DEV_BACKUP_KEY_SUFFIX}.${slot}`;
}

export type BackupRead = { kind: "none" } | { kind: "ok"; entry: BackupEntry } | { kind: "corrupt" } | { kind: "error" };

function isEntry(value: unknown, slot: BackupSlot, saveKey: string): value is BackupEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    e.v === 1 &&
    e.slot === slot &&
    typeof e.createdAt === "string" &&
    e.sourceKey === saveKey &&
    typeof e.hadSave === "boolean" &&
    (e.hadSave ? typeof e.raw === "string" : e.raw === null)
  );
}

export function readBackup(storage: StorageLike, slot: BackupSlot, saveKey: string = SAVE_STORAGE_KEY): BackupRead {
  let text: string | null;
  try {
    text = storage.getItem(backupKey(slot, saveKey));
  } catch {
    return { kind: "error" };
  }
  if (text === null) return { kind: "none" };
  try {
    const parsed: unknown = JSON.parse(text);
    return isEntry(parsed, slot, saveKey) ? { kind: "ok", entry: parsed } : { kind: "corrupt" };
  } catch {
    return { kind: "corrupt" };
  }
}

/** Reads the stored save as the raw string (`null` = no save). `ok: false` = storage could not be read. */
export function readRawSave(storage: StorageLike, saveKey: string = SAVE_STORAGE_KEY): { ok: true; raw: string | null } | { ok: false } {
  try {
    return { ok: true, raw: storage.getItem(saveKey) };
  } catch {
    return { ok: false };
  }
}

/** Writes one slot and reads it back; true only when the slot reads back as exactly `entry`. */
export function writeBackup(storage: StorageLike, entry: BackupEntry, saveKey: string = SAVE_STORAGE_KEY): boolean {
  const key = backupKey(entry.slot, saveKey);
  const text = JSON.stringify(entry);
  try {
    storage.setItem(key, text);
    return storage.getItem(key) === text;
  } catch {
    return false;
  }
}

export function makeBackupEntry(slot: BackupSlot, raw: string | null, createdAt: string, saveKey: string = SAVE_STORAGE_KEY): BackupEntry {
  return { v: 1, slot, createdAt, sourceKey: saveKey, hadSave: raw !== null, raw };
}

export function discardBackup(storage: StorageLike, slot: BackupSlot, saveKey: string = SAVE_STORAGE_KEY): boolean {
  try {
    storage.removeItem(backupKey(slot, saveKey));
    return storage.getItem(backupKey(slot, saveKey)) === null;
  } catch {
    return false;
  }
}

export type RestoreResult =
  | { ok: true; slot: BackupSlot; hadSave: boolean }
  | { ok: false; reason: "no-backup" | "backup-unreadable" | "storage-error" | "verify-failed" };

/**
 * Puts the backed-up raw string back (or removes the save key when there was none) and verifies it. The
 * `original` slot is discarded after a successful restore, so the next apply captures the then-current save as
 * the new original; `previous` is kept. The backup is left in place on any failure.
 */
export function restoreBackup(storage: StorageLike, slot: BackupSlot, saveKey: string = SAVE_STORAGE_KEY): RestoreResult {
  const read = readBackup(storage, slot, saveKey);
  if (read.kind === "none") return { ok: false, reason: "no-backup" };
  if (read.kind !== "ok") return { ok: false, reason: "backup-unreadable" };
  const { entry } = read;
  try {
    if (entry.raw === null) storage.removeItem(saveKey);
    else storage.setItem(saveKey, entry.raw);
    if (storage.getItem(saveKey) !== entry.raw) return { ok: false, reason: "verify-failed" };
  } catch {
    return { ok: false, reason: "storage-error" };
  }
  if (slot === "original") discardBackup(storage, "original", saveKey);
  return { ok: true, slot, hadSave: entry.hadSave };
}
