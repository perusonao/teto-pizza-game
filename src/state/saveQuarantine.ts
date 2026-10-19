/**
 * Save Compatibility Phase B PR-1 (Issue #560): the quarantine -- a verified copy of stored save text that must not be
 * lost, kept under its OWN storage keys.
 *
 * - Keys: `<save key>.quarantine-v1.first` and `<save key>.quarantine-v1.latest` (a Preview build's sit beside the Preview
 *   save). They never live inside the save, so they cannot touch its schema or collide with any other key.
 * - At most TWO keys ever exist. `first` is written once and never changed by anything but `discardQuarantine`; `latest`
 *   is the only slot a later quarantine may replace. A later, smaller breakage therefore cannot push out the first
 *   (usually the largest) record of the player's progress.
 * - The entry keeps the raw text byte for byte (never parsed, sanitized or re-serialized) and records which kind of
 *   unreadable save it came from, so a recovery can tell a damaged save from a newer build's save.
 * - A write is believed only after it is READ BACK: the stored text must equal what was written, parse as a well-formed
 *   entry and carry exactly the original `raw`. Any failure is reported and nothing downstream may overwrite the save.
 * - Quarantining the text that is already in a slot is a no-op, so repeated launches never multiply backups.
 * - Nothing here is called from the UI in PR-1; `discardQuarantine` is the one, separate operation that deletes entries.
 */
import type { StorageLike } from "./persistence";

export type QuarantineSlot = "first" | "latest";
export const QUARANTINE_SLOTS: readonly QuarantineSlot[] = ["first", "latest"];

/** Which unreadable save the text was: damaged, or written by a newer build. */
export type QuarantineKind = "corrupt" | "unknown-schema";

export const QUARANTINE_KEY_SUFFIX = ".quarantine-v1";

/** The largest raw text (UTF-16 code units, i.e. `string.length`) that is quarantined. A real save is ~15 KB; anything above
 *  this is neither copied nor overwritten (never truncated). */
export const MAX_QUARANTINE_RAW_LENGTH = 256 * 1024;

export interface QuarantineEntry {
  v: 1;
  slot: QuarantineSlot;
  /** ISO timestamp of the quarantine. */
  createdAt: string;
  /** The save key the raw text came from (a restore must refuse a mismatching build). */
  sourceKey: string;
  kind: QuarantineKind;
  rawLength: number;
  /** The stored text, exactly. */
  raw: string;
  /** Reserved for the player-facing notice (PR-2); false when written. */
  acknowledged: boolean;
}

export function quarantineKey(slot: QuarantineSlot, saveKey: string): string {
  return `${saveKey}${QUARANTINE_KEY_SUFFIX}.${slot}`;
}

function isEntry(value: unknown, slot: QuarantineSlot, saveKey: string): value is QuarantineEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    e.v === 1 &&
    e.slot === slot &&
    typeof e.createdAt === "string" &&
    e.sourceKey === saveKey &&
    (e.kind === "corrupt" || e.kind === "unknown-schema") &&
    typeof e.raw === "string" &&
    e.rawLength === e.raw.length &&
    typeof e.acknowledged === "boolean"
  );
}

export type QuarantineRead =
  | { kind: "none" }
  | { kind: "ok"; entry: QuarantineEntry; text: string }
  | { kind: "corrupt"; text: string }
  | { kind: "error" };

export function readQuarantine(storage: StorageLike, slot: QuarantineSlot, saveKey: string): QuarantineRead {
  let text: string | null;
  try {
    text = storage.getItem(quarantineKey(slot, saveKey));
  } catch {
    return { kind: "error" };
  }
  if (text === null) return { kind: "none" };
  try {
    const parsed: unknown = JSON.parse(text);
    return isEntry(parsed, slot, saveKey) ? { kind: "ok", entry: parsed, text } : { kind: "corrupt", text };
  } catch {
    return { kind: "corrupt", text };
  }
}

export type QuarantineFailure = "too-large" | "storage-error" | "write-failed" | "verify-failed";

export type QuarantineResult =
  /** `written`: a new entry in `slot`. `duplicate`: the same text was already quarantined in `slot`; nothing was written. */
  | { ok: true; outcome: "written" | "duplicate"; slot: QuarantineSlot }
  | { ok: false; reason: QuarantineFailure };

/** Puts a slot back as it was (best effort) after a failed write. */
function restoreSlot(storage: StorageLike, key: string, previous: string | null): void {
  try {
    if (previous === null) storage.removeItem(key);
    else storage.setItem(key, previous);
  } catch {
    // Nothing more can be done; the caller reports the failure and the save is not overwritten.
  }
}

/**
 * Copies `raw` into the quarantine and verifies the copy. Returns `ok: true` only when `raw` is safely held in a slot
 * (written now, or already there); the caller may then replace the stored save. On any `ok: false` it must not.
 */
export function quarantineRaw(
  storage: StorageLike,
  raw: string,
  kind: QuarantineKind,
  createdAt: string,
  saveKey: string,
): QuarantineResult {
  if (raw.length > MAX_QUARANTINE_RAW_LENGTH) return { ok: false, reason: "too-large" };

  const first = readQuarantine(storage, "first", saveKey);
  const latest = readQuarantine(storage, "latest", saveKey);
  if (first.kind === "error" || latest.kind === "error") return { ok: false, reason: "storage-error" };
  // Idempotence: the same text is already held.
  if (first.kind === "ok" && first.entry.raw === raw) return { ok: true, outcome: "duplicate", slot: "first" };
  if (latest.kind === "ok" && latest.entry.raw === raw) return { ok: true, outcome: "duplicate", slot: "latest" };

  // `first` is written once; every later quarantine replaces `latest` only.
  const slot: QuarantineSlot = first.kind === "none" ? "first" : "latest";
  const key = quarantineKey(slot, saveKey);
  const previous = slot === "first" ? null : latest.kind === "none" ? null : latest.text;
  const entry: QuarantineEntry = { v: 1, slot, createdAt, sourceKey: saveKey, kind, rawLength: raw.length, raw, acknowledged: false };
  const text = JSON.stringify(entry);

  try {
    storage.setItem(key, text);
  } catch {
    restoreSlot(storage, key, previous);
    return { ok: false, reason: "write-failed" };
  }
  const back = readQuarantine(storage, slot, saveKey);
  if (back.kind !== "ok" || back.text !== text || back.entry.raw !== raw) {
    restoreSlot(storage, key, previous);
    return { ok: false, reason: "verify-failed" };
  }
  return { ok: true, outcome: "written", slot };
}

/**
 * The one operation that deletes quarantined data. Deliberately separate from every save write and from
 * `resetSave`; PR-1 wires it to nothing in the UI. Returns true only when both slots are verified gone.
 */
export function discardQuarantine(storage: StorageLike | null, saveKey: string): boolean {
  if (!storage) return true;
  try {
    for (const slot of QUARANTINE_SLOTS) storage.removeItem(quarantineKey(slot, saveKey));
    return QUARANTINE_SLOTS.every((slot) => storage.getItem(quarantineKey(slot, saveKey)) === null);
  } catch {
    return false;
  }
}

/** What is held, without the text itself (the notice and the Settings row need only this). */
export interface QuarantineSummary {
  /** Slots that hold something (a readable entry, or text this build cannot read as an entry). */
  count: number;
  /** The newest readable, still-unacknowledged entry's kind (`latest` wins over `first`); null when there is none. */
  unacknowledgedKind: QuarantineKind | null;
  /** A slot could not be read at all. */
  unreadable: boolean;
}

export function summarizeQuarantine(storage: StorageLike | null, saveKey: string): QuarantineSummary {
  const summary: QuarantineSummary = { count: 0, unacknowledgedKind: null, unreadable: false };
  if (!storage) return summary;
  // `latest` first: the newest unacknowledged entry decides the kind shown.
  for (const slot of ["latest", "first"] as const) {
    const read = readQuarantine(storage, slot, saveKey);
    if (read.kind === "none") continue;
    summary.count += 1;
    if (read.kind === "error") summary.unreadable = true;
    if (read.kind === "ok" && !read.entry.acknowledged && summary.unacknowledgedKind === null) {
      summary.unacknowledgedKind = read.entry.kind;
    }
  }
  return summary;
}

/** True when `raw` is held verbatim in a readable slot. */
export function isRawQuarantined(storage: StorageLike | null, raw: string, saveKey: string): boolean {
  if (!storage) return false;
  return QUARANTINE_SLOTS.some((slot) => {
    const read = readQuarantine(storage, slot, saveKey);
    return read.kind === "ok" && read.entry.raw === raw;
  });
}

/**
 * The player has seen the "a backup is kept" notice: marks every readable entry acknowledged (the `raw` text, `slot` and
 * `createdAt` are untouched, and each rewrite is read back). Never deletes anything. Returns true when no readable entry is
 * left unacknowledged; on any failure the slot is put back as it was.
 */
export function acknowledgeQuarantine(storage: StorageLike | null, saveKey: string): boolean {
  if (!storage) return true;
  let ok = true;
  for (const slot of QUARANTINE_SLOTS) {
    const read = readQuarantine(storage, slot, saveKey);
    if (read.kind === "error") {
      ok = false;
      continue;
    }
    if (read.kind !== "ok" || read.entry.acknowledged) continue;
    const key = quarantineKey(slot, saveKey);
    const next = JSON.stringify({ ...read.entry, acknowledged: true });
    try {
      storage.setItem(key, next);
    } catch {
      restoreSlot(storage, key, read.text);
      ok = false;
      continue;
    }
    const back = readQuarantine(storage, slot, saveKey);
    if (back.kind !== "ok" || back.entry.raw !== read.entry.raw || !back.entry.acknowledged) {
      restoreSlot(storage, key, read.text);
      ok = false;
    }
  }
  return ok;
}
