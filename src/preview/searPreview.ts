/**
 * Cooking Sear Phase 1 (焼き目をつける, Issue #724): the Preview / DEV-only opt-in.
 *
 *   ?cookSear=on    turns the sear experience on for the page load (Preview / DEV only; any other value, a repeat or none: off)
 *
 * PRODUCTION never reads it: the branch sits behind a static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a production `vite build` drops the
 * query name (./searPreview.gate.test.ts scans a real build). It is independent of `?cookPrep=on` (the 炒める prep). Nothing here is saved.
 */
export const SEAR_PARAM = "cookSear";
export const SEAR_ON_VALUE = "on";

export function resolveSearOptIn(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(SEAR_PARAM);
  return all.length === 1 && all[0] === SEAR_ON_VALUE;
}

let cachedOptIn: boolean | undefined;

/** Test seam: forget the cached page-load value. */
export function resetSearPreviewForTest(): void {
  cachedOptIn = undefined;
}

export function searPreviewOptedIn(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedOptIn === undefined) cachedOptIn = resolveSearOptIn(typeof window === "undefined" ? "" : window.location.search);
    return cachedOptIn;
  }
  return false;
}
