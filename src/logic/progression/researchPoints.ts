/**
 * B案再構成 Phase 3c (Issue #901): research points -- what a menu-development trial (a Free Cooking pizza that reached its result)
 * earns, in ONE pool shared by every recipe. Owner decisions (2026-11-27):
 *   1. one shared pool (not per recipe);
 *   2. the amount follows the trial's difficulty (its stage);
 *   3. any pizza's trial earns them (not only the research target's);
 *   4. Pitz cannot buy hints any more once points can (the switch itself is Phase 3d -- 3c leaves Hint 5.0's Pitz price alone);
 *   5. sauces and cheeses are hint subjects too (Phase 3d);
 *   6. what a hint reveals shows in the Dex and on the cooking screen (Phase 3d).
 *
 * The amounts below are PROVISIONAL (the Owner's placeholder: stage 1 = 1 ... stage 5 = 5). Phase 3f tunes them here, and only
 * here: every earning reads this one table. ./researchPoints.test.ts pins the placeholder so a change is deliberate.
 */
import { SHOP_CHAPTER_COUNT } from "./reputationTable";
import { catalogChapterOf, type ShopCatalog } from "./shopProgression";

/** Research points one finished trial earns, by its stage (index 0 = stage 1 ... index 4 = stage 5). Provisional (Phase 3f). */
export const RESEARCH_POINTS_BY_STAGE: readonly [number, number, number, number, number] = Object.freeze([1, 2, 3, 4, 5]) as unknown as readonly [
  number,
  number,
  number,
  number,
  number,
];

/** The stage a trial counts as when it has neither a research target nor an adopted exact match. */
export const RESEARCH_FALLBACK_STAGE = 1;

/** What decided a trial's stage (shown nowhere today; kept for tests and the Result Report). */
export type ResearchStageSource = "RESEARCH_TARGET" | "EXACT_MATCH" | "FALLBACK";

export interface ResearchTrialStage {
  stage: number;
  source: ResearchStageSource;
}

/**
 * A trial's stage (Owner 2026-11-27): the research target's stage when a target is set; else the stage of the adopted recipe the
 * pizza is an exact match for; else stage 1. A target or a match outside the adopted catalog has no stage and falls through.
 */
export function researchTrialStage(
  researchTargetId: string | null,
  exactMatchRecipeId: string | null,
  catalog: ShopCatalog,
): ResearchTrialStage {
  const targetStage = researchTargetId === null ? null : catalogChapterOf(researchTargetId, catalog);
  if (targetStage !== null) return { stage: targetStage, source: "RESEARCH_TARGET" };
  const matchStage = exactMatchRecipeId === null ? null : catalogChapterOf(exactMatchRecipeId, catalog);
  if (matchStage !== null) return { stage: matchStage, source: "EXACT_MATCH" };
  return { stage: RESEARCH_FALLBACK_STAGE, source: "FALLBACK" };
}

/** The research points a trial of `stage` earns (a stage outside 1..5 is clamped into it). */
export function researchPointsForStage(stage: number, table: readonly number[] = RESEARCH_POINTS_BY_STAGE): number {
  const index = Math.min(SHOP_CHAPTER_COUNT, Math.max(1, Math.floor(stage))) - 1;
  return table[index] ?? 0;
}
