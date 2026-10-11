/**
 * #467 (diagnostic, Preview only): switch the cut-face SVG lighting filter off for one page load.
 *
 * Owner HV on an Android phone found the cut / RESULT pizza drawn wrongly (pieces missing / floating / a hole in the
 * middle). The leading suspect is the SVG lighting filter on `.pizza-pieces` (`feDiffuseLighting` / `feSpecularLighting`,
 * ../components/PieceReliefFilter.tsx). `?pieceRelief=off` removes ONLY that `url(#...)` reference from the `filter` on
 * `.pizza-pieces`; the drop shadow that shares the property, the filter's <defs>, the clip-paths, the piece transforms,
 * the cut / score logic and everything else are untouched. Without the query the page is exactly what ships.
 *
 * Read ONLY behind `import.meta.env.VITE_PREVIEW_MODE` (set by the Preview build pipeline alone), so a production
 * `vite build` compiles this out; ./pieceReliefPreview.gate.test.ts builds both bundles and scans for the mark and the
 * query name. Nothing is saved; reload without the query to get the default back. Diagnostic only -- not a fix.
 */

/** Present in this module only. The production-bundle gate looks for it. */
export const PIECE_RELIEF_PREVIEW_MARK = "piece-relief-preview-v1";
/** Query parameter name (also scanned for in the production bundle). */
export const PIECE_RELIEF_PARAM = "pieceRelief";

/** True only for exactly one `pieceRelief=off`; anything else (absent, repeated, other value) keeps the default. */
export function resolvePieceReliefOff(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(PIECE_RELIEF_PARAM);
  return all.length === 1 && all[0] === "off";
}

let cached: boolean | null = null;

/** Read once on the first call after page load and kept for the session. */
export function isPieceReliefOffForPreview(): boolean {
  if (cached === null) cached = resolvePieceReliefOff(typeof window === "undefined" ? "" : window.location.search);
  return cached;
}

/** The Preview badge suffix while the filter is off, `null` otherwise. */
export function pieceReliefBadgeLabel(off: boolean): string | null {
  return off ? "RELIEF OFF" : null;
}
