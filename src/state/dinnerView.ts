import { getIngredient } from "../data/ingredients";
import { getRecipe, type RecipeId } from "../data/recipes";
import { dinnerMissionUnlock, type DinnerMissionDefinition } from "../mission/dinner/dinnerMission";
import { dinnerStartBlock, remainingTargetIds, type DinnerRunState } from "../mission/dinner/dinnerRun";
import type { DexState } from "./dex";
import type { InventoryState } from "./inventory";

/**
 * Dinner Mission DM-3 (Issue #242): pure view models for the Dinner screens. Everything the UI
 * shows is derived here from the DM-1/DM-2 authorities -- the screens never re-decide unlock,
 * readiness or run state themselves.
 */

/**
 * The run duration a START may use (OD-DM3-1): the mission's own time limit when it has one
 * (none until DM-5), else a `?dinnerDuration=<seconds>` override -- which the caller passes only
 * in DEV / Preview builds (`overrideSearch` is `""` in production). `null` = START unavailable.
 */
export function resolveDinnerDurationMs(mission: DinnerMissionDefinition, overrideSearch: string): number | null {
  if (mission.timeLimit.seconds !== null) return mission.timeLimit.seconds * 1000;
  if (!overrideSearch) return null;
  const seconds = Number(new URLSearchParams(overrideSearch).get("dinnerDuration"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null;
}

/** `m:ss` (or `mm:ss`), rounded up to the whole second like the Lunch Rush HUD; never negative. */
export function formatDinnerClock(ms: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export interface DinnerTargetView {
  recipeId: string;
  nameJa: string;
}

/**
 * One Mission Select card. A locked card carries NO target identity at all -- no ids, names or
 * images of any target, discovered or not -- only the counts ("あと N 種類"). Targets are listed
 * only once the mission is unlocked (every target discovered, so nothing is secret any more).
 */
export type DinnerMissionCardView =
  | { missionId: string; titleJa: string; totalTargets: number; unlocked: false; undiscoveredCount: number }
  | { missionId: string; titleJa: string; totalTargets: number; unlocked: true; targets: DinnerTargetView[] };

function targetView(recipeId: string): DinnerTargetView {
  return { recipeId, nameJa: getRecipe(recipeId as RecipeId)?.nameJa ?? recipeId };
}

export function dinnerMissionCardView(mission: DinnerMissionDefinition, dex: DexState): DinnerMissionCardView {
  const unlock = dinnerMissionUnlock(mission, dex);
  const base = { missionId: mission.missionId, titleJa: mission.display.titleJa, totalTargets: unlock.totalTargets };
  if (!unlock.unlocked) return { ...base, unlocked: false, undiscoveredCount: unlock.undiscoveredCount };
  return { ...base, unlocked: true, targets: mission.targetRecipeIds.map(targetView) };
}

export interface DinnerShortageView {
  ingredientId: string;
  nameJa: string;
  need: number;
  have: number;
}

/** START readiness for an unlocked mission (DM-1 aggregate feasibility + the duration rule). */
export type DinnerReadinessView =
  | { kind: "READY"; durationMs: number }
  | { kind: "SHORTAGE"; shortages: DinnerShortageView[] }
  | { kind: "NO_TIME_LIMIT" }
  | { kind: "UNAVAILABLE" };

export function dinnerReadiness(
  mission: DinnerMissionDefinition,
  inputs: { dex: DexState; ownedIngredientIds: readonly string[]; inventory: InventoryState },
  durationMs: number | null,
): DinnerReadinessView {
  const block = dinnerStartBlock(mission, inputs);
  if (block?.reason === "INSUFFICIENT_STOCK") {
    return {
      kind: "SHORTAGE",
      shortages: block.shortages.map((s) => ({
        ingredientId: s.ingredientId,
        nameJa: getIngredient(s.ingredientId)?.nameJa ?? s.ingredientId,
        need: s.need,
        have: s.have,
      })),
    };
  }
  if (block) return { kind: "UNAVAILABLE" };
  if (durationMs === null) return { kind: "NO_TIME_LIMIT" };
  return { kind: "READY", durationMs };
}

/** Target Board rows, in definition order: completed ones are shown checked and not selectable. */
export function dinnerBoardRows(run: DinnerRunState): (DinnerTargetView & { completed: boolean })[] {
  const remaining = new Set(remainingTargetIds(run));
  return run.targetRecipeIds.map((id) => ({ ...targetView(id), completed: !remaining.has(id) }));
}
