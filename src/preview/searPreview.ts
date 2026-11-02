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

/** Per-tab memory of the opt-in (sessionStorage; Preview / DEV only, never in production). Without it the opt-in lived in the address bar alone, so a
 *  reload, a home-screen launch or a re-typed URL silently turned the 炙る pill off (iPhone HV, #724: the pill "never appeared"). `?cookSear=off` clears it. */
export const SEAR_OPT_IN_STORAGE_KEY = "teto:cookSear";
export const SEAR_OFF_VALUE = "off";

interface TabStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Pure: the query decides (on = remember, off = forget); with neither, the remembered value counts. Storage failures fall back to the query alone. */
export function resolveSearOptInSticky(search: unknown, storage: TabStorage | null): boolean {
  const queryOn = resolveSearOptIn(search);
  const all = typeof search === "string" ? new URLSearchParams(search).getAll(SEAR_PARAM) : [];
  const queryOff = all.length === 1 && all[0] === SEAR_OFF_VALUE;
  try {
    if (queryOn) {
      storage?.setItem(SEAR_OPT_IN_STORAGE_KEY, "1");
      return true;
    }
    if (queryOff) {
      storage?.removeItem(SEAR_OPT_IN_STORAGE_KEY);
      return false;
    }
    return storage?.getItem(SEAR_OPT_IN_STORAGE_KEY) === "1";
  } catch {
    return queryOn;
  }
}

function tabStorage(): TabStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

let cachedOptIn: boolean | undefined;

/** Test seam: forget the cached page-load value. */
export function resetSearPreviewForTest(): void {
  cachedOptIn = undefined;
}

/** Cooking Sear HV entry (`?cookSearHv=1`, ./cookSearHv.ts): turns the sear on for this page load without the query or the tab memory. Preview / DEV only (the
 *  caller sits behind the same static gate). */
export function forceSearOptInForHv(): void {
  cachedOptIn = true;
}

export function searPreviewOptedIn(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedOptIn === undefined) cachedOptIn = resolveSearOptInSticky(typeof window === "undefined" ? "" : window.location.search, tabStorage());
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
