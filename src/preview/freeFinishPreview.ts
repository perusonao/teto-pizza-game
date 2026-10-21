/**
 * FINISH FIN-E3a (Issue #604 / #294): the Preview / DEV-only opt-in for the Free Cooking FINISH step (the 仕上げ tab of
 * Free Cooking and Research, Owner Decision UD-B).
 *
 *   ?freeFinish=on    turns the Free Cooking FINISH step on for the page load (Preview / DEV only; any other value, a repeat or none: off)
 *
 * PRODUCTION never reads it: the branch sits behind a static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a production
 * `vite build` drops the query name (./freeFinishPreview.gate.test.ts scans a real build). The single decision point is
 * `freeCookFinishEnabled` (../data/freeCookFinishGate.ts); this module only answers "did the page ask for it". Nothing here is saved.
 */

export const FREE_FINISH_PARAM = "freeFinish";
export const FREE_FINISH_ON_VALUE = "on";

/** True when the query string asks for the Free Cooking FINISH step exactly once. */
export function resolveFreeFinishOptIn(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(FREE_FINISH_PARAM);
  return all.length === 1 && all[0] === FREE_FINISH_ON_VALUE;
}

let cachedOptIn: boolean | undefined;

/** Test seam: forget the cached page-load value. */
export function resetFreeFinishPreviewForTest(): void {
  cachedOptIn = undefined;
}

/** Whether the Preview / DEV query opted in to the Free Cooking FINISH step. Read once per page load; never in production. */
export function freeFinishPreviewOptedIn(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedOptIn === undefined) cachedOptIn = resolveFreeFinishOptIn(typeof window === "undefined" ? "" : window.location.search);
    return cachedOptIn;
  }
  return false;
}
