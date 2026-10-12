import type { BakeTarget } from "../data/recipes";

export type BakeState = "raw" | "perfect" | "burnt";

export function classifyBake(value: number, target: BakeTarget): BakeState {
  if (value < target.start) return "raw";
  if (value > target.end) return "burnt";
  return "perfect";
}

export const BAKE_STATE_LABEL: Record<BakeState, string> = {
  raw: "生焼け",
  perfect: "いい焼き加減",
  burnt: "焦げ",
};

/**
 * Bake Result 5-Level (Issue #469): a RESULT-display-only refinement of `BakeState`. It never feeds
 * scoring, stars, the Completion Gate, dialogue or saves -- those keep reading `classifyBake`.
 * (Not `resultNearMiss`, which is the unrelated Discovery Hint 2.0 "おしい" line.)
 */
export type BakeLevel5 = "raw" | "underdone" | "just" | "overdone" | "burnt";

/** Half-width (in gauge points) of the "just" band around the window centre. Recipe-independent;
 *  the single place to retune (±4 if ±3 proves too hard on device). */
export const JUST_HALF_WIDTH_PT = 3;

/**
 * Outer boundaries (`start`/`end`) are identical to `classifyBake`; the in-window "perfect" range is
 * split around the window centre `c`: underdone `start <= v < c-3`, just `|v-c| <= 3` (both ends
 * inclusive), overdone `c+3 < v <= end`. Non-finite input fails closed to "raw", like an unbaked pizza.
 */
export function classifyBake5(value: number, target: BakeTarget): BakeLevel5 {
  if (!Number.isFinite(value)) return "raw";
  if (value < target.start) return "raw";
  if (value > target.end) return "burnt";
  const center = (target.start + target.end) / 2;
  if (value < center - JUST_HALF_WIDTH_PT) return "underdone";
  if (value > center + JUST_HALF_WIDTH_PT) return "overdone";
  return "just";
}

/**
 * Issue #481: the JUST interval `classifyBake5` uses, as gauge points -- the single source for the
 * BAKE meter's JUST band, so the band can never drift from the judged range. Both ends are inclusive
 * (`|v-c| <= JUST_HALF_WIDTH_PT`) and clamped to the window.
 */
export function justBand(target: BakeTarget): { start: number; end: number } {
  const center = (target.start + target.end) / 2;
  return {
    start: Math.max(target.start, center - JUST_HALF_WIDTH_PT),
    end: Math.min(target.end, center + JUST_HALF_WIDTH_PT),
  };
}

/** Issue #481: the two "惜しい" levels (display + dialogue consistency only). */
export function isNearMiss(level: BakeLevel5 | null | undefined): boolean {
  return level === "underdone" || level === "overdone";
}

export const BAKE_LEVEL5_LABEL: Record<BakeLevel5, string> = {
  raw: "生焼け",
  underdone: "惜しい（焼き不足）",
  just: "ジャスト",
  overdone: "惜しい（焼きすぎ）",
  burnt: "焦げ",
};
