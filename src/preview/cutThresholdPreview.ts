/**
 * #427 / #426: Preview-only override of the CUT significant-region thresholds, via URL query
 * (`?cutAreaPct=0.20&cutMinWidth=1.0`). PREVIEW ONLY.
 *
 * The only reader is `../logic/cut/regions.ts`'s `getSignificanceThresholds`, and only behind
 * `import.meta.env.VITE_PREVIEW_MODE` (set by the Preview build pipeline alone). A production build
 * replaces that condition with `undefined`, so this parser, its query names and its range table are
 * tree-shaken out. Nothing is saved: not GameState, not the save file, not localStorage. Removing the
 * query and reloading restores the defaults. ./cutThresholdPreview.test.ts and
 * ./cutThresholdPreview.bundle.gate.test.ts prove it.
 */

/** Owner Decision (#427): provisional defaults, adjustable at Human Verification. */
export const DEFAULT_CUT_AREA_PCT = 0.1;
export const DEFAULT_CUT_MIN_WIDTH = 1.0;

export interface CutThresholdOverride {
  /** Percent of the whole ideal circle (0.10 = 0.1%). */
  readonly areaPct: number;
  /** Dough units: 4 * area / perimeter. */
  readonly minWidth: number;
}

const STRICT_DECIMAL = /^\d+(\.\d+)?$/;

/** One parameter: exactly one strict-decimal value inside [min, max], else `fallback`. */
function readParam(params: URLSearchParams, name: string, min: number, max: number, fallback: number): number {
  const all = params.getAll(name);
  if (all.length !== 1 || !STRICT_DECIMAL.test(all[0])) return fallback;
  const value = Number(all[0]);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

/** Pure parser: each invalid parameter falls back to its own default, the other is unaffected. */
export function parseCutThresholdQuery(search: string): CutThresholdOverride {
  const params = new URLSearchParams(search);
  return {
    areaPct: readParam(params, "cutAreaPct", 0.02, 0.5, DEFAULT_CUT_AREA_PCT),
    minWidth: readParam(params, "cutMinWidth", 0.2, 2.0, DEFAULT_CUT_MIN_WIDTH),
  };
}

/** Preview badge suffix, only while an override differs from the defaults. */
export function cutThresholdBadgeLabel(areaPct: number, minWidth: number): string | null {
  if (areaPct === DEFAULT_CUT_AREA_PCT && minWidth === DEFAULT_CUT_MIN_WIDTH) return null;
  return `CUT ${areaPct.toFixed(2)}%/${minWidth.toFixed(1)}u`;
}

/** Reads `window.location.search`. Call only behind `import.meta.env.VITE_PREVIEW_MODE`. */
export function getCutThresholdOverride(): CutThresholdOverride {
  try {
    return parseCutThresholdQuery(window.location.search);
  } catch {
    return { areaPct: DEFAULT_CUT_AREA_PCT, minWidth: DEFAULT_CUT_MIN_WIDTH };
  }
}
