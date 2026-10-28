/**
 * Cooking Prep Phase 1 (下ごしらえ「炒める」), PR-A: the Preview / DEV-only opt-in (spec §18.1 O-7).
 *
 *   ?cookPrep=on    turns the prep experience on for the page load (Preview / DEV only; any other value, a repeat or none: off)
 *
 * PRODUCTION never reads it: the branch sits behind a static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a production
 * `vite build` drops the query name (./prepPreview.gate.test.ts scans a real build). The single decision point is
 * `prepExperienceEnabled` (../data/prepExperienceGate.ts); this module only answers "did the page ask for it". Nothing here is saved.
 */

export const PREP_PARAM = "cookPrep";
export const PREP_ON_VALUE = "on";

/** True when the query string asks for the prep experience exactly once. */
export function resolvePrepOptIn(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(PREP_PARAM);
  return all.length === 1 && all[0] === PREP_ON_VALUE;
}

let cachedOptIn: boolean | undefined;

/** Test seam: forget the cached page-load value. */
export function resetPrepPreviewForTest(): void {
  cachedOptIn = undefined;
}

/** Whether the Preview / DEV query opted in to the prep experience. Read once per page load; never in production. */
export function prepPreviewOptedIn(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedOptIn === undefined) cachedOptIn = resolvePrepOptIn(typeof window === "undefined" ? "" : window.location.search);
    return cachedOptIn;
  }
  return false;
}
