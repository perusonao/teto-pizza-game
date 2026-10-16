/**
 * #479 S2b-1: the Preview / DEV-only comparison switch for the topping size-class multipliers.
 *
 *   ?toppingScale=a   the candidate set A (0.6 / 0.8 / 1 / 1.25 / 1.5)
 *   ?toppingScale=b   the candidate set B (0.7 / 0.85 / 1 / 1.15 / 1.3), identical to the production value since S2c
 *   ?toppingScale=c   B plus the per-ingredient apparent-size corrections below (UNCONFIRMED candidate: to be decided on an iPhone)
 *   (absent, `off`, repeated or anything else)   no override: exactly the production value (B)
 *   mozzarella is exempt in every mode (rank scale 1; Owner decision S2c).
 *
 * PRODUCTION NEVER READS THIS. `activeToppingRankScale` is the only consumer (PizzaStage, renderPizzaVisualPieces) and its override branch sits behind a static
 * `import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE` check, so a production `vite build` drops this module's query name, marker and `window.location`
 * read. ./toppingScalePreview.gate.test.ts builds production and Preview bundles and scans for them. The production multipliers stay `TOPPING_RANK_SCALE`
 * (B) and never includes candidate C's corrections until the Owner confirms them on an iPhone.
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

/** Present in this module only (with the table below), so the production-bundle gate can prove the unconfirmed corrections are not shipped. */
export const TOPPING_FIT_CANDIDATE_MARK = "topping-fit-candidate-c-v1";

export type ToppingScalePreviewCandidate = ToppingSizeScaleCandidateKey | "C";

/**
 * Candidate C: set B with an apparent-size correction per id (Owner values, S2c). The geometric emoji (black-olive, jalapeno, pepperoni, salami) look
 * larger than their class, the thin drawings (bacon, spinach, arugula) smaller. PREVIEW / DEV ONLY and UNCONFIRMED: measured on Noto Color Emoji,
 * to be decided on an iPhone (Apple Color Emoji fills differently). Not applied in production.
 */
export const TOPPING_FIT_CANDIDATE_C = {
  mark: TOPPING_FIT_CANDIDATE_MARK,
  corrections: {
    "black-olive": 0.85,
    jalapeno: 0.85,
    pepperoni: 0.9,
    salami: 0.9,
    bacon: 1.1,
    spinach: 1.1,
    arugula: 1.1,
  } as Record<string, number>,
} as const;

/** The query parameter name (also scanned for in the production bundle). */
export const TOPPING_SCALE_PARAM = "toppingScale";

/** The candidate key a query string asks for, `null` when it asks for none (absent, repeated, unknown value). */
export function resolveToppingScaleCandidate(search: unknown): ToppingScalePreviewCandidate | null {
  if (typeof search !== "string") return null;
  const all = new URLSearchParams(search).getAll(TOPPING_SCALE_PARAM);
  if (all.length !== 1) return null;
  return all[0] === "a" ? "A" : all[0] === "b" ? "B" : all[0] === "c" ? "C" : null;
}

let cached: ToppingScalePreviewCandidate | null | undefined;

/** The candidate for this page load. Read once, on the first call after page load, and kept for the session. */
export function getPreviewToppingScaleCandidate(): ToppingScalePreviewCandidate | null {
  if (cached === undefined) cached = resolveToppingScaleCandidate(typeof window === "undefined" ? "" : window.location.search);
  return cached;
}

/** Test seam: forget the cached page-load value. */
export function resetPreviewToppingScaleForTest(): void {
  cached = undefined;
}

/** The Preview badge suffix while a candidate is in effect (`SIZE A` / `SIZE B` / `SIZE C`), `null` otherwise. */
export function toppingScaleBadgeLabel(candidate: ToppingScalePreviewCandidate | null): string | null {
  return candidate === null ? null : `SIZE ${candidate}`;
}

/**
 * The `--piece-rank-scale` for an on-pizza piece: production = `TOPPING_RANK_SCALE` (B); Preview / DEV with `?toppingScale=a|b|c` = that candidate.
 */
export function activeToppingRankScale(ingredientId: string): number {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    const candidate = getPreviewToppingScaleCandidate();
    if (candidate === "C") return toppingRankScale(ingredientId, TOPPING_SIZE_SCALE_CANDIDATES.B as ToppingSizeScaleSet, TOPPING_FIT_CANDIDATE_C.corrections);
    if (candidate !== null) return toppingRankScale(ingredientId, TOPPING_SIZE_SCALE_CANDIDATES[candidate] as ToppingSizeScaleSet);
  }
  return toppingRankScale(ingredientId);
}
