/**
 * #427 / #426: the Preview-only CUT significance-threshold override (Owner Decision: URL query, Preview only).
 *
 * `?cutAreaPct=0.20&cutMinWidth=1.5` lets the Owner compare threshold pairs on one iPhone session (Human Verification
 * stage 1). It is read ONLY by `../logic/cut/regions.ts` (the single threshold source) and `../components/PreviewBadge.tsx`
 * (display only), and only behind `import.meta.env.VITE_PREVIEW_MODE` -- set by the Preview build pipeline alone; no
 * production workflow sets it. A production `vite build` replaces that condition with `undefined`, so this module (and its
 * `window.location` read) is tree-shaken out. ./cutThresholdPreview.gate.test.ts builds production and Preview bundles and
 * scans for `CUT_THRESHOLD_PREVIEW_MARK` and the two query names.
 *
 * Nothing here is ever saved: not in the save, `GameState` or storage. Reload without the query to get the defaults back.
 * The override affects only which regions count as significant (piece count / uniformity); every geometric region is still
 * drawn.
 */
import type { CutSignificanceThresholds } from "../logic/cut/regions";

/** Present in this module only. The production-bundle gate looks for it. */
export const CUT_THRESHOLD_PREVIEW_MARK = "cut-threshold-preview-v1";

/** Query parameter names (also scanned for in the production bundle). */
export const CUT_AREA_PCT_PARAM = "cutAreaPct";
export const CUT_MIN_WIDTH_PARAM = "cutMinWidth";

/** Accepted ranges (inclusive). `cutAreaPct` is a percent of the whole pizza; `cutMinWidth` is in dough units (u). */
export const CUT_AREA_PCT_RANGE = { min: 0.02, max: 0.5 } as const;
export const CUT_MIN_WIDTH_RANGE = { min: 0.2, max: 2.0 } as const;

/** Plain decimal only: no sign, exponent, hex, whitespace or empty string. */
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/** One parameter: its single value as a number within `range`, else `null` (absent, repeated, malformed or out of range). */
function parseOne(params: URLSearchParams, name: string, range: { min: number; max: number }): number | null {
  const all = params.getAll(name);
  if (all.length !== 1 || !PLAIN_DECIMAL.test(all[0])) return null;
  const value = Number(all[0]);
  return Number.isFinite(value) && value >= range.min && value <= range.max ? value : null;
}

/**
 * The thresholds for this page load: each parameter that is valid replaces its default, every other one keeps the
 * default (one bad parameter never discards the other).
 */
export function resolveCutThresholdOverride(search: unknown, defaults: CutSignificanceThresholds): CutSignificanceThresholds {
  if (typeof search !== "string") return defaults;
  const params = new URLSearchParams(search);
  const areaPct = parseOne(params, CUT_AREA_PCT_PARAM, CUT_AREA_PCT_RANGE);
  const minWidth = parseOne(params, CUT_MIN_WIDTH_PARAM, CUT_MIN_WIDTH_RANGE);
  return {
    areaFraction: areaPct === null ? defaults.areaFraction : areaPct / 100,
    minWidth: minWidth === null ? defaults.minWidth : minWidth,
  };
}

let cached: CutSignificanceThresholds | null = null;

/** The effective Preview thresholds. Read once, on the first call after page load, and kept for the session. */
export function getPreviewCutThresholds(defaults: CutSignificanceThresholds): CutSignificanceThresholds {
  if (cached === null) {
    cached = resolveCutThresholdOverride(typeof window === "undefined" ? "" : window.location.search, defaults);
  }
  return cached;
}

/** The Preview badge suffix while an override is in effect (`CUT 0.20%/1.0u`), `null` when the defaults apply. */
export function cutThresholdBadgeLabel(
  effective: CutSignificanceThresholds,
  defaults: CutSignificanceThresholds,
): string | null {
  if (effective.areaFraction === defaults.areaFraction && effective.minWidth === defaults.minWidth) return null;
  return `CUT ${(effective.areaFraction * 100).toFixed(2)}%/${effective.minWidth.toFixed(1)}u`;
}
