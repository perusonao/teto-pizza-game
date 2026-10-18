/**
 * #535 (Square-Pan Dough B, Epic #532): the Preview / DEV-only switch that makes the square-pan DOUGH step reachable before any recipe
 * uses a pan (#521 E) and before the pan has its own unlock (F, #538).
 *
 *   ?pan=square          every round's DOUGH step is the square pan (Preview / DEV only; any other value, a repeat or none: no override)
 *   ?squareStart=lumpy   (with ?pan=square) the square dough starts as a full, lumpy sheet instead of the small ball, so the spread
 *                        has something to level (Preview / DEV only; any other value, a repeat or none: the small ball)
 *
 * PRODUCTION never reads either: the override branches sit behind a static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a
 * production `vite build` drops the query names and the marker (./panShapePreview.gate.test.ts scans a real build for them). With
 * neither in effect every round's pan is `resolvePanShape(recipe)` -- round for every shipped recipe -- exactly as before.
 * Nothing here is saved; scoring, the save and the Dex never read it.
 */
import type { Recipe } from "../data/recipes";
import { resolvePanShape, type PanShape } from "../logic/pan/panShape";

/** Present in this module only. The production-bundle gate looks for it. */
export const PAN_SHAPE_PREVIEW_MARK = "pan-shape-preview-v1";

/** The query parameter names (also scanned for in the production bundle). */
export const PAN_PARAM = "pan";
export const SQUARE_START_PARAM = "squareStart";

/** The only values honoured (a whitelist: nothing else is). */
export const PREVIEW_PAN_VALUE = "square";
export const PREVIEW_SQUARE_START_VALUE = "lumpy";

function singleValue(search: unknown, name: string): string | null {
  if (typeof search !== "string") return null;
  const all = new URLSearchParams(search).getAll(name);
  return all.length === 1 ? all[0] : null;
}

/** `"square"` when the query string asks for it exactly once, otherwise `null`. */
export function resolvePreviewPanShape(search: unknown): PanShape | null {
  return singleValue(search, PAN_PARAM) === PREVIEW_PAN_VALUE ? "square" : null;
}

/** `"lumpy"` when the query string asks for it exactly once, otherwise `null`. */
export function resolvePreviewSquareStart(search: unknown): "lumpy" | null {
  return singleValue(search, SQUARE_START_PARAM) === PREVIEW_SQUARE_START_VALUE ? "lumpy" : null;
}

let cachedPan: PanShape | null | undefined;
let cachedStart: "lumpy" | null | undefined;

function pageSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

/** The override for this page load. Read once, on the first call after page load, and kept for the session. */
export function getPreviewPanShape(): PanShape | null {
  if (cachedPan === undefined) cachedPan = resolvePreviewPanShape(pageSearch());
  return cachedPan;
}

export function getPreviewSquareStart(): "lumpy" | null {
  if (cachedStart === undefined) cachedStart = resolvePreviewSquareStart(pageSearch());
  return cachedStart;
}

/** Test seam: forget the cached page-load values. */
export function resetPreviewPanShapeForTest(): void {
  cachedPan = undefined;
  cachedStart = undefined;
}

/** The Preview badge suffix while the override is in effect, `null` otherwise. */
export function panShapeBadgeLabel(pan: PanShape | null, start: "lumpy" | null): string | null {
  if (pan === null) return null;
  return start === null ? "PAN square" : "PAN square (lumpy)";
}

/**
 * The pan a round's dough is shaped in: the Preview / DEV override when one is in effect, else the recipe's own
 * (`resolvePanShape`: round for every shipped recipe). The one place the override is applied.
 */
export function activePanShape(recipe: Recipe | null | undefined): PanShape {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    const override = getPreviewPanShape();
    if (override !== null) return override;
  }
  return resolvePanShape(recipe);
}

/** True when the square dough should start as the lumpy sheet (Preview / DEV with `?squareStart=lumpy`); never in production. */
export function wantsLumpySquareStart(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) return getPreviewSquareStart() === "lumpy";
  return false;
}
