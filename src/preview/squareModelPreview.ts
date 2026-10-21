/**
 * Square dough model prototype switch (Preview / DEV only; Owner direction after PR #581's iPhone HV FAIL).
 *
 *   ?squareModel=stretch   the square DOUGH step uses the push-stretch prototype (../logic/pan/squareStretch.ts) instead of the
 *                          current film-laying drag and the global-evenness judgement. Any other value, a repeat or none: the CURRENT model.
 *   ?squareOk=75|85        (with squareModel=stretch) STEP 2's "OK rate" target in percent. Any other value: 75. Undecided by the Owner (75 vs 85).
 *
 * PRODUCTION never reads either: the branches sit behind the same static `import.meta.env.DEV || VITE_PREVIEW_MODE` check as
 * ./panShapePreview.ts, so a production `vite build` drops the query names, the marker and the prototype. Nothing here is saved;
 * the save, the round pizza, scoring and the Dex never read it.
 */

/** Present in this module and in the prototype only. The production-bundle gate looks for it. */
export const SQUARE_STRETCH_PREVIEW_MARK = "square-stretch-preview-v1";

export const SQUARE_MODEL_PARAM = "squareModel";
export const SQUARE_OK_PARAM = "squareOk";
export const SQUARE_MODEL_STRETCH_VALUE = "stretch";

export type SquareOkRate = 75 | 85;
export const DEFAULT_SQUARE_OK_RATE: SquareOkRate = 75;

function singleValue(search: unknown, name: string): string | null {
  if (typeof search !== "string") return null;
  const all = new URLSearchParams(search).getAll(name);
  return all.length === 1 ? all[0] : null;
}

export function resolveSquareStretch(search: unknown): boolean {
  return singleValue(search, SQUARE_MODEL_PARAM) === SQUARE_MODEL_STRETCH_VALUE;
}

export function resolveSquareOkRate(search: unknown): SquareOkRate {
  const value = singleValue(search, SQUARE_OK_PARAM);
  return value === "85" ? 85 : value === "75" ? 75 : DEFAULT_SQUARE_OK_RATE;
}

let cachedStretch: boolean | undefined;
let cachedOk: SquareOkRate | undefined;
let testOverride: { stretch: boolean; ok: SquareOkRate } | null = null;

function pageSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

/** True when the prototype is on for this page load (Preview / DEV with `?squareModel=stretch`); never in production. */
export function squareStretchActive(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (testOverride) return testOverride.stretch;
    if (cachedStretch === undefined) cachedStretch = resolveSquareStretch(pageSearch());
    return cachedStretch;
  }
  return false;
}

/** STEP 2's OK-rate target (fraction). Only meaningful while the prototype is on. */
export function squareStretchOkRate(): number {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (testOverride) return testOverride.ok / 100;
    if (cachedOk === undefined) cachedOk = resolveSquareOkRate(pageSearch());
    return cachedOk / 100;
  }
  return DEFAULT_SQUARE_OK_RATE / 100;
}

/** Test seam: force the prototype on/off (null: read the page again). */
export function setSquareStretchForTest(override: { stretch: boolean; ok?: SquareOkRate } | null): void {
  testOverride = override ? { stretch: override.stretch, ok: override.ok ?? DEFAULT_SQUARE_OK_RATE } : null;
  cachedStretch = undefined;
  cachedOk = undefined;
}
