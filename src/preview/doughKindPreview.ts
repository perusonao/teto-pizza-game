/**
 * Dough Kind P2 (Issue #577): the Preview / DEV-only switch that opens the DOUGH step's dough-kind chips before any recipe needs a
 * dough kind (Pinsa is P3, on HOLD), exactly as `?panSwitch=open` does for the ○/□ switch (./panShapePreview.ts).
 *
 *   ?doughSwitch=open    forces the chip row open in Free Cooking / Research (Preview / DEV only; any other value, a repeat or none: no override)
 *
 * PRODUCTION never reads it: the branch sits behind a static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a production
 * `vite build` drops the query name and the marker (./doughKindPreview.gate.test.ts scans a real build). It only opens the chips --
 * the choice, `PizzaState.dough` and everything downstream are the real ones. Nothing here is saved.
 */

/** Present in this module only. The production-bundle gate looks for it. */
export const DOUGH_KIND_PREVIEW_MARK = "dough-kind-preview-v1";

export const DOUGH_SWITCH_PARAM = "doughSwitch";
export const PREVIEW_DOUGH_SWITCH_VALUE = "open";

/** True when the query string asks for the chips to be open exactly once. */
export function resolvePreviewDoughSwitchOpen(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(DOUGH_SWITCH_PARAM);
  return all.length === 1 && all[0] === PREVIEW_DOUGH_SWITCH_VALUE;
}

let cachedOpen: boolean | undefined;

/** Test seam: forget the cached page-load value. */
export function resetDoughKindPreviewForTest(): void {
  cachedOpen = undefined;
}

/** Whether the Preview / DEV query forces the dough-kind chips open. Read once per page load; never in production. */
export function doughSwitchForcedOpen(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedOpen === undefined) cachedOpen = resolvePreviewDoughSwitchOpen(typeof window === "undefined" ? "" : window.location.search);
    return cachedOpen;
  }
  return false;
}

/** The Preview badge suffix while the switch is forced open, `null` otherwise (display only). */
export function doughSwitchBadgeLabel(open: boolean): string | null {
  return open ? "DOUGH chips open" : null;
}
