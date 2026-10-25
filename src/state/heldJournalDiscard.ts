/**
 * Save P1-1 (Issue #664, Refs #560 / #617): getting rid of a HELD `pendingRound` -- on the player's explicit confirmation, after a
 * verified copy of the whole save was made.
 *
 * A journal this build cannot act on (`unknown-version` / `corrupt` / `unresolvable` / `oversize`) is kept byte for byte (R8), and
 * while it is kept it occupies the journal slot: every bake that needs a journal (all Free Cooking with FINISH, Guided CUT / FINISH)
 * is refused as `occupied`. This module is the only way out that is not a Full Game Reset:
 *
 *   1. read the stored text R and check that it is the save this page may write (PR-3 session: no `stale-save` / `load-failed`),
 *      that it is a readable save, and that its journal is still the HELD one the player was shown;
 *   2. copy R (the whole save text, verbatim) into the held-journal quarantine -- its own key pair, apart from the save's own
 *      quarantine -- and read the copy back;
 *   3. read the save again; if it is no longer R (another tab wrote), stop;
 *   4. write R without its `pendingRound` key (parse, delete that one key, serialize: no sanitizer, no migration, no merge), read it
 *      back, and tell the session what it wrote.
 *
 * Nothing is removed unless step 2 verified the copy. A failure in step 4 leaves the copy in place (harmless; a retry finds it as a
 * duplicate) and never "repairs" the save by writing R back: that could overwrite what another tab saved in between.
 *
 * localStorage has no compare-and-swap. Steps 3 and 4 are two calls, so a write by another tab in the instant between them is not
 * caught by this operation (the next write of that tab, or of this one, sees the difference and is refused by the PR-3 guard). This
 * narrows the race; it does not make the operation atomic.
 *
 * Not touched here: `writeSave`, `commitProgress`, the journal rules (`journalMayChange`), `schemaVersion`.
 */
import { SAVE_STORAGE_KEY, type StorageLike } from "./persistence";
import { PENDING_ROUND_KEY, canonicalJson, readStoredPendingRound, type HeldPendingRoundReason } from "./pendingRound";
import { MAX_QUARANTINE_RAW_LENGTH, quarantineRaw, readQuarantine } from "./saveQuarantine";
import { classifyStoredSave } from "./saveRootClassification";
import { checkSaveSession, noteSaveWritten } from "./saveSession";

/** The `saveKey` the held-journal quarantine is filed under: `<save key>.held-journal.quarantine-v1.first|latest`. */
export function heldJournalQuarantineKey(saveKey: string = SAVE_STORAGE_KEY): string {
  return `${saveKey}.held-journal`;
}

/** What the confirmation dialog shows. `journalJson` identifies the journal that was shown: the discard refuses any other. */
export interface HeldJournalInspection {
  reason: HeldPendingRoundReason;
  journalJson: string;
  /** UTF-16 length of the whole save text that would be copied. */
  saveLength: number;
  /** The copy would replace the existing `latest` held-journal backup (the `first` one is kept either way). */
  replacesLatest: boolean;
  /** Best effort, only for a journal this build can still read some fields of; never trusted. */
  recipeId: string | null;
  createdAt: number | null;
}

export type HeldJournalInspectFailure =
  | "no-storage"
  | "storage-error"
  | "load-failed"
  | "stale-save"
  | "not-readable"
  | "not-held"
  | "too-large";

export type HeldJournalInspectResult = { ok: true; inspection: HeldJournalInspection } | { ok: false; reason: HeldJournalInspectFailure };

export type HeldJournalDiscardFailure =
  | HeldJournalInspectFailure
  /** The journal (or its reason) is not the one the player was shown. */
  | "changed"
  /** The copy would replace the `latest` held-journal backup and the caller did not confirm that. */
  | "replace-not-confirmed"
  /** The copy could not be written or did not read back. The save is untouched. */
  | "backup-failed"
  /** Another tab wrote between the first read and the write. The save is untouched by this operation. */
  | "stale-during-discard"
  /** `setItem` threw. The save is untouched. */
  | "write-failed"
  /** The write was accepted but reads back differently (or not at all). Reported as it is; nothing is written to "repair" it. */
  | "verify-failed";

export type HeldJournalDiscardResult =
  | { ok: true; outcome: "written" | "duplicate"; slot: "first" | "latest" }
  | { ok: false; reason: HeldJournalDiscardFailure };

interface ReadHeld {
  raw: string;
  root: Record<string, unknown>;
  reason: HeldPendingRoundReason;
  journalJson: string;
}

function readHeld(storage: StorageLike): { ok: true; held: ReadHeld } | { ok: false; reason: HeldJournalInspectFailure } {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return { ok: false, reason: "storage-error" };
  }
  const session = checkSaveSession(storage, raw);
  if (session) return { ok: false, reason: session };
  if (raw === null || classifyStoredSave(raw).kind !== "readable") return { ok: false, reason: "not-readable" };
  if (raw.length > MAX_QUARANTINE_RAW_LENGTH) return { ok: false, reason: "too-large" };
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "not-readable" };
  }
  if (!Object.prototype.hasOwnProperty.call(root, PENDING_ROUND_KEY)) return { ok: false, reason: "not-held" };
  const journal = root[PENDING_ROUND_KEY];
  const stored = readStoredPendingRound(journal);
  // Only a HELD journal may go. A journal this build can act on (`pending` / `settled`) is never removed here.
  if (stored.kind !== "held") return { ok: false, reason: "not-held" };
  return { ok: true, held: { raw, root, reason: stored.reason, journalJson: canonicalJson(journal) } };
}

/** What the dialog needs to show; reads only. */
export function inspectHeldJournal(storage: StorageLike | null): HeldJournalInspectResult {
  if (!storage) return { ok: false, reason: "no-storage" };
  const read = readHeld(storage);
  if (!read.ok) return read;
  const { held } = read;
  const key = heldJournalQuarantineKey();
  const first = readQuarantine(storage, "first", key);
  const latest = readQuarantine(storage, "latest", key);
  if (first.kind === "error" || latest.kind === "error") return { ok: false, reason: "storage-error" };
  const holdsSame = (r: typeof first) => r.kind === "ok" && r.entry.raw === held.raw;
  const replacesLatest = first.kind !== "none" && latest.kind !== "none" && !holdsSame(first) && !holdsSame(latest);
  const journal = held.root[PENDING_ROUND_KEY];
  const fields = typeof journal === "object" && journal !== null && !Array.isArray(journal) ? (journal as Record<string, unknown>) : {};
  return {
    ok: true,
    inspection: {
      reason: held.reason,
      journalJson: held.journalJson,
      saveLength: held.raw.length,
      replacesLatest,
      recipeId: typeof fields.recipeId === "string" ? fields.recipeId.slice(0, 64) : null,
      createdAt: typeof fields.createdAt === "number" && Number.isFinite(fields.createdAt) ? fields.createdAt : null,
    },
  };
}

export interface DiscardHeldJournalOptions {
  /** What the player was shown (from `inspectHeldJournal`). */
  expected: Pick<HeldJournalInspection, "reason" | "journalJson">;
  /** The player confirmed that the existing `latest` held-journal backup is replaced. */
  confirmReplaceLatest: boolean;
  now?: () => string;
}

/** Copies the whole save, verifies the copy, then removes the held journal. See the module comment for the order and the guarantees. */
export function discardHeldJournal(storage: StorageLike | null, options: DiscardHeldJournalOptions): HeldJournalDiscardResult {
  if (!storage) return { ok: false, reason: "no-storage" };
  const read = readHeld(storage);
  if (!read.ok) return read;
  const { held } = read;
  if (held.reason !== options.expected.reason || held.journalJson !== options.expected.journalJson) return { ok: false, reason: "changed" };

  const key = heldJournalQuarantineKey();
  const first = readQuarantine(storage, "first", key);
  const latest = readQuarantine(storage, "latest", key);
  if (first.kind === "error" || latest.kind === "error") return { ok: false, reason: "storage-error" };
  const alreadyHeld = (r: typeof first) => r.kind === "ok" && r.entry.raw === held.raw;
  if (first.kind !== "none" && latest.kind !== "none" && !alreadyHeld(first) && !alreadyHeld(latest) && !options.confirmReplaceLatest) {
    return { ok: false, reason: "replace-not-confirmed" };
  }

  const copy = quarantineRaw(storage, held.raw, "held-journal", (options.now ?? (() => new Date().toISOString()))(), key);
  if (!copy.ok) return { ok: false, reason: copy.reason === "too-large" ? "too-large" : copy.reason === "storage-error" ? "storage-error" : "backup-failed" };

  // The copy is verified. Look at the save once more, right before writing: it must still be the text the copy was made of.
  let again: string | null;
  try {
    again = storage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return { ok: false, reason: "storage-error" };
  }
  if (again !== held.raw) return { ok: false, reason: "stale-during-discard" };
  const session = checkSaveSession(storage, again);
  if (session) return { ok: false, reason: session };

  const { [PENDING_ROUND_KEY]: _removed, ...rest } = held.root;
  const next = JSON.stringify(rest);
  try {
    storage.setItem(SAVE_STORAGE_KEY, next);
  } catch {
    return { ok: false, reason: "write-failed" };
  }
  let back: string | null;
  try {
    back = storage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return { ok: false, reason: "verify-failed" };
  }
  // No repair on a mismatch: whatever is stored now may be another tab's save.
  if (back !== next) return { ok: false, reason: "verify-failed" };
  noteSaveWritten(storage, next);
  return { ok: true, outcome: copy.outcome, slot: copy.slot };
}
