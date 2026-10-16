/**
 * #479 S2b-1: the Preview / DEV-only comparison switch for the topping size-class multipliers.
 *
 *   ?toppingScale=a   the candidate set A (0.6 / 0.8 / 1 / 1.25 / 1.5)
 *   ?toppingScale=b   the candidate set B (0.7 / 0.85 / 1 / 1.15 / 1.3)
 *   (absent, `off`, repeated or anything else)   no override: every class is 1, exactly the production value
 *
 * PRODUCTION NEVER READS THIS. `activeToppingRankScale` is the only consumer (PizzaStage, renderPizzaVisualPieces) and its override branch sits behind a static
 * `import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE` check, so a production `vite build` drops this module's query name, marker and `window.location`
 * read. ./toppingScalePreview.gate.test.ts builds production and Preview bundles and scans for them. The production multipliers stay `TOPPING_RANK_SCALE`
 * (all 1) until the Owner decides the values after Human Verification.
 *
 * Nothing here is saved: not in the save, `GameState` or storage. Reload without the query to get 1.0 back.
 */
import {
  TOPPING_SIZE_SCALE_CANDIDATES,
  toppingRankScale,
  type ToppingSizeScaleCandidateKey,
  type ToppingSizeScaleSet,
} from "../data/toppingSizeClass";

/** Present in this module only. The production-bundle gate looks for it. */
export const TOPPING_SCALE_PREVIEW_MARK = "topping-scale-preview-v1";

/** The query parameter name (also scanned for in the production bundle). */
export const TOPPING_SCALE_PARAM = "toppingScale";

/** The candidate key a query string asks for, `null` when it asks for none (absent, repeated, unknown value). */
export function resolveToppingScaleCandidate(search: unknown): ToppingSizeScaleCandidateKey | null {
  if (typeof search !== "string") return null;
  const all = new URLSearchParams(search).getAll(TOPPING_SCALE_PARAM);
  if (all.length !== 1) return null;
  return all[0] === "a" ? "A" : all[0] === "b" ? "B" : null;
}

let cached: ToppingSizeScaleCandidateKey | null | undefined;

/** The candidate for this page load. Read once, on the first call after page load, and kept for the session. */
export function getPreviewToppingScaleCandidate(): ToppingSizeScaleCandidateKey | null {
  if (cached === undefined) cached = resolveToppingScaleCandidate(typeof window === "undefined" ? "" : window.location.search);
  return cached;
}

/** Test seam: forget the cached page-load value. */
export function resetPreviewToppingScaleForTest(): void {
  cached = undefined;
}

/** The Preview badge suffix while a candidate is in effect (`SIZE A` / `SIZE B`), `null` otherwise. */
export function toppingScaleBadgeLabel(candidate: ToppingSizeScaleCandidateKey | null): string | null {
  return candidate === null ? null : `SIZE ${candidate}`;
}

/**
 * The `--piece-rank-scale` for an on-pizza piece: production = `TOPPING_RANK_SCALE` (all 1); Preview / DEV with `?toppingScale=a|b` = that candidate set.
 */
export function activeToppingRankScale(ingredientId: string): number {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    const candidate = getPreviewToppingScaleCandidate();
    if (candidate !== null) return toppingRankScale(ingredientId, TOPPING_SIZE_SCALE_CANDIDATES[candidate] as ToppingSizeScaleSet);
  }
  return toppingRankScale(ingredientId);
}
