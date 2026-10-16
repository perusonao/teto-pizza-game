/**
 * #514 (#479): the RESULT screen's topping scale, and its Preview / DEV-only comparison switch.
 *
 * The RESULT's dough is 196px wide (the CUT screen's is 330-360px), so the same topping is a larger share of it there (~17-23% against ~8%). One
 * multiplier, `RESULT_TOPPING_SCALE`, shrinks the toppings drawn on the RESULT's own pizza; it is applied as `--piece-phase-scale` (CSS: emoji
 * font-size, the CSS cheeses' transforms) AND to the S3 footprint radius (`toppingFootprintRadiusPercent`), so a topping's copies in the cut pieces
 * always match what is drawn.
 *
 *   ?resultScale=0.65 | 0.75 | 0.85 | 1.0   the multiplier for this page load (Preview / DEV only; any other value, a repeat or none: no override, i.e. the production scale)
 *
 * PRODUCTION uses `RESULT_TOPPING_SCALE` (0.75, the Owner's iPhone decision); the override branch sits behind a static `import.meta.env.DEV || VITE_PREVIEW_MODE`
 * check, so a production `vite build` drops the query name and marker (./resultScalePreview.gate.test.ts scans for them). `?resultScale=1.0` in a Preview
 * shows the old size for comparison. Nothing here is saved; scoring, CUT evaluation and the save never read it.
 *
 * Mozzarella is exempt: its Canvas box (and the M1 fallback) keeps its size, as the size classes do (`TOPPING_RANK_SCALE_EXEMPT_IDS`).
 */
import { TOPPING_RANK_SCALE_EXEMPT_IDS } from "../data/toppingSizeClass";

/** The production RESULT topping scale: 0.75, adopted by the Owner after an iPhone Safari comparison with 1.0 (#514). */
export const RESULT_TOPPING_SCALE = 0.75;

/** The candidates the Preview switch accepts (a whitelist: nothing else is honoured). */
export const RESULT_SCALE_CANDIDATES = [0.65, 0.75, 0.85, 1] as const;

/** Present in this module only. The production-bundle gate looks for it. */
export const RESULT_SCALE_PREVIEW_MARK = "result-scale-preview-v1";

/** The query parameter name (also scanned for in the production bundle). */
export const RESULT_SCALE_PARAM = "resultScale";

/** The candidate a query string asks for, `null` when it asks for none (absent, repeated, not exactly one of the four). */
export function resolveResultScale(search: unknown): number | null {
  if (typeof search !== "string") return null;
  const all = new URLSearchParams(search).getAll(RESULT_SCALE_PARAM);
  if (all.length !== 1) return null;
  const hit = RESULT_SCALE_CANDIDATES.find((c) => String(c) === all[0] || (c === 1 && all[0] === "1.0"));
  return hit ?? null;
}

let cached: number | null | undefined;

/** The candidate for this page load. Read once, on the first call after page load, and kept for the session. */
export function getPreviewResultScale(): number | null {
  if (cached === undefined) cached = resolveResultScale(typeof window === "undefined" ? "" : window.location.search);
  return cached;
}

/** Test seam: forget the cached page-load value. */
export function resetPreviewResultScaleForTest(): void {
  cached = undefined;
}

/** The Preview badge suffix while a candidate is in effect (`RESULT x0.75`), `null` otherwise. */
export function resultScaleBadgeLabel(scale: number | null): string | null {
  return scale === null ? null : `RESULT x${scale}`;
}

/** The RESULT multiplier now in effect: production `RESULT_TOPPING_SCALE`; Preview / DEV with `?resultScale=` = that candidate. */
export function activeResultToppingScale(): number {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    const candidate = getPreviewResultScale();
    if (candidate !== null) return candidate;
  }
  return RESULT_TOPPING_SCALE;
}

/** The phase scale of one topping: `activeResultToppingScale()` on the RESULT's pizza (`resultCompact`), 1 anywhere else and for the exempt mozzarella. */
export function toppingPhaseScale(ingredientId: string, resultCompact: boolean): number {
  return resultCompact && !TOPPING_RANK_SCALE_EXEMPT_IDS.includes(ingredientId) ? activeResultToppingScale() : 1;
}
