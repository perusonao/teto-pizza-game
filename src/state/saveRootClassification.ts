/**
 * Save Compatibility Phase B PR-1 (Issue #560): what the stored save text IS, before anything writes over it.
 *
 * One pure function, used by the write path (`./persistence.ts`'s `writeSave` / `resetSave`) to decide whether the text
 * already in storage may be replaced:
 *
 * - `empty`          no save at all.                                     -> may be written.
 * - `readable`       a v1 / v2 root whose `dex` is an array.             -> may be written (today's behaviour).
 * - `unknown-schema` a JSON object whose `schemaVersion` is an integer above 2 -- a save a NEWER build wrote.
 *                    This build cannot interpret it, but it is real progress, so it is never overwritten.
 * - `corrupt`        anything else (not JSON, not an object, no / odd `schemaVersion`, `dex` not an array).
 *                    Nothing here can be trusted, but it is kept (quarantined) before it is replaced.
 *
 * `readable` is, by construction, exactly the root `loadSave` accepts (`toIntermediateV2`: `schemaVersion` 1 or 2 with an
 * array `dex`); `saveRootClassification.test.ts` pins that with a differential test. Anything this build's loader would
 * fall back to a default for is therefore `unknown-schema` or `corrupt` -- never silently `readable`.
 */

export type CorruptReason = "not-json" | "not-an-object" | "bad-schema-version" | "dex-not-an-array";

export type StoredSaveClass =
  | { kind: "empty" }
  | { kind: "readable"; schemaVersion: 1 | 2 }
  | { kind: "unknown-schema"; schemaVersion: number }
  | { kind: "corrupt"; reason: CorruptReason };

/** The newest `schemaVersion` this build reads. A save above it is `unknown-schema`. */
export const NEWEST_READABLE_SCHEMA_VERSION = 2;

export function classifyStoredSave(raw: string | null): StoredSaveClass {
  if (raw === null) return { kind: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "corrupt", reason: "not-json" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "corrupt", reason: "not-an-object" };
  }
  const root = parsed as Record<string, unknown>;
  const version = root.schemaVersion;
  // A future version is decided by the version alone: whatever else the root holds is that build's business.
  if (typeof version === "number" && Number.isInteger(version) && version > NEWEST_READABLE_SCHEMA_VERSION) {
    return { kind: "unknown-schema", schemaVersion: version };
  }
  if (version !== 1 && version !== 2) return { kind: "corrupt", reason: "bad-schema-version" };
  if (!Array.isArray(root.dex)) return { kind: "corrupt", reason: "dex-not-an-array" };
  return { kind: "readable", schemaVersion: version };
}
