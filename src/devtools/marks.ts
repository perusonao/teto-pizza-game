/**
 * DEV State Editor (Issue #403): constants that exist ONLY in the DEV / Preview editor chunk.
 *
 * The production-bundle gate (src/preview/previewIsolation.gate.test.ts) scans a real production `vite build`
 * for these strings and must not find any. They are never written into the save: the editor's backup lives
 * under its own storage keys (./backup.ts), and a save never carries a DEV marker.
 */
export const DEV_STATE_EDITOR_MARK = "dev-state-editor-v1";

/** The suffix of the editor's own backup keys, appended to the build's save key (so a Preview build never
 *  touches a production-key backup, and the production key never has one). */
export const DEV_BACKUP_KEY_SUFFIX = ".dev-backup-v1";

/** The page title shown by the editor shell. */
export const DEV_STATE_EDITOR_TITLE = "DEV State Editor";
