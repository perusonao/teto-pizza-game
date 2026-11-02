/**
 * Cooking Sear Phase 1 (焼き目をつける, Issue #724): the Preview / DEV-only opt-in.
 *
 *   ?cookSear=on    turns the sear experience on for the page load (Preview / DEV only; any other value, a repeat or none: off)
 *
 * PRODUCTION never reads it: the branch sits behind a static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a production `vite build` drops the
 * query name (./searPreview.gate.test.ts scans a real build). It is independent of `?cookPrep=on` (the 炒める prep). Nothing here is saved.
 *
 *   ?cookSearMs=2000|3000|4000    (with ?cookSear=on) the hold time that reaches the fully seared look, for the Owner's side-by-side comparison on a device.
 *                                 Any other value, a repeat or none: the shipped default (SEAR_FULL_MS). Same Preview / DEV-only guard.
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

export const SEAR_MS_PARAM = "cookSearMs";
/** The three hold lengths under comparison (Owner 2026-11-02). */
export const SEAR_MS_CHOICES: readonly number[] = [2000, 3000, 4000];

export function resolveSearFullMs(search: unknown): number | null {
  if (typeof search !== "string") return null;
  const all = new URLSearchParams(search).getAll(SEAR_MS_PARAM);
  if (all.length !== 1) return null;
  const n = Number(all[0]);
  return SEAR_MS_CHOICES.includes(n) && String(n) === all[0] ? n : null;
}

let cachedMs: number | null | undefined;

/** Test seam: forget the cached page-load value. */
export function resetSearMsForTest(): void {
  cachedMs = undefined;
}

/** The comparison hold length asked for by the Preview / DEV query, or `null` for the default. Read once per page load; never in production. */
export function searFullMsOverride(): number | null {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedMs === undefined) cachedMs = resolveSearFullMs(typeof window === "undefined" ? "" : window.location.search);
    return cachedMs;
  }
  return null;
}
