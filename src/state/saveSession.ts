/**
 * Save Protection PR-3 (Issue #560, Fresh Audit N1): what this page's session KNOWS about the stored save.
 *
 * Until PR-2 the write gate looked only at the text in storage. It could not tell "the save I loaded" from "a save someone
 * else (another tab, or a read that failed at startup) left there", so:
 *   N1  the startup read failed once (a transient `getItem` error) -> the game began from the default state -> the next
 *       write found a perfectly readable save and replaced it with that default state;
 *   #282  a stale tab wrote over what another tab had saved.
 *
 * The session closes both with one rule: a write is allowed only while the stored text is exactly what this session last
 * saw -- the text it loaded, or the text it wrote itself.
 *
 *   loaded       the startup read succeeded; `expectedRaw` is that text (null = no save). Every write this session makes
 *                moves `expectedRaw` to the text it wrote, so the session's own consecutive writes are allowed. Any other
 *                stored text (another tab wrote, or the key was changed behind this page) -> `stale-save`, nothing written.
 *   load-failed  the startup read threw. The in-memory state is the DEFAULT state, not the player's save, so nothing may
 *                be written: not now, and not after a later read happens to succeed (that later success is exactly the N1
 *                hole). Sticky for the life of the page; a reload is the recovery.
 *
 * A storage with no session (tests, dev tools, any caller that did not start one) is not guarded by this module: the
 * PR-1 root classification still applies to every write.
 *
 * Known limit: localStorage has no compare-and-swap. The check (read, compare) and the write (`setItem`) are two calls,
 * so another tab that writes in the instant between them is not caught by this write; the next write of this tab sees the
 * difference and is refused. The window is one synchronous JS turn; this narrows #282, it does not make saves atomic.
 *
 * Pure bookkeeping: no I/O, no import of the persistence layer (so it can be imported from both sides).
 */

export type SaveSessionState = { kind: "loaded"; expectedRaw: string | null } | { kind: "load-failed" };

/** Why the session refuses a write. Mirrors the two `SaveWriteBlock` members it contributes. */
export type SaveSessionBlock = "load-failed" | "stale-save";

let sessions = new WeakMap<object, SaveSessionState>();

/** Records the startup read of `storage`: the text it returned (null = no save), or `null` outcome when it threw. */
export function beginSaveSession(storage: object, outcome: { ok: true; raw: string | null } | { ok: false }): void {
  if (!outcome.ok) {
    sessions.set(storage, { kind: "load-failed" });
    return;
  }
  // Sticky: a failed startup read is not forgiven by a later successful one (React StrictMode runs the initializer twice;
  // the state that is used may be the one built from the failed read).
  if (sessions.get(storage)?.kind === "load-failed") return;
  sessions.set(storage, { kind: "loaded", expectedRaw: outcome.raw });
}

export function getSaveSession(storage: object): SaveSessionState | null {
  return sessions.get(storage) ?? null;
}

/** The block for a write about to replace `storedRaw`, or null when the session allows it (or has no session). */
export function checkSaveSession(storage: object, storedRaw: string | null): SaveSessionBlock | null {
  const session = sessions.get(storage);
  if (!session) return null;
  if (session.kind === "load-failed") return "load-failed";
  return session.expectedRaw === storedRaw ? null : "stale-save";
}

/** After this session wrote `raw` successfully: it is the new text the session expects to find. */
export function noteSaveWritten(storage: object, raw: string): void {
  const session = sessions.get(storage);
  if (session?.kind === "loaded") sessions.set(storage, { kind: "loaded", expectedRaw: raw });
}

/**
 * After an explicit Full Game Reset removed the save (the player's own decision): the empty slot is what the session now
 * expects. Also lifts `load-failed`, because the player has just chosen to start over; the app reloads right after.
 */
export function noteSaveReset(storage: object): void {
  if (sessions.has(storage)) sessions.set(storage, { kind: "loaded", expectedRaw: null });
}

/** Test support: forget every session (jsdom's `localStorage` is one object for a whole test file). */
export function resetSaveSessionsForTests(): void {
  sessions = new WeakMap();
}
