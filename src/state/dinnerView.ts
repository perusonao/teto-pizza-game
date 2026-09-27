import { getIngredient } from "../data/ingredients";
import { getRecipe, type RecipeId } from "../data/recipes";
import type { QualityStars } from "../logic/scoring";
import { dinnerMissionUnlock, type DinnerMissionDefinition } from "../mission/dinner/dinnerMission";
import type { DinnerAttemptView } from "../mission/dinner/dinnerResultDetection";
import { dinnerStartBlock, remainingTargetIds, type DinnerRunState } from "../mission/dinner/dinnerRun";
import type { DexState } from "./dex";
import type { InventoryState } from "./inventory";

/**
 * Dinner Mission DM-3 (Issue #242, ported from PR #243) / DM-3R-2 (Issue #250): pure view models
 * for the Dinner screens. Everything the UI shows is derived here from the DM-1 / DM-3R-1
 * authorities -- the screens never re-decide unlock, readiness, run state or a pizza's result.
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
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  // Validate the converted value too: `0.0001` rounds to 0 ms and `1e306` overflows to Infinity,
  // and `startDinnerRun` would reject either after START had already been offered.
  const ms = Math.round(seconds * 1000);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * DM-3R-2: the explicit, Preview-only stand-in for the quality gate S (OD-R2). NOT a balance value:
 * S is DM-5's decision, every shipped mission keeps `quality.minimumStars: null`, and production
 * never reads this (the caller passes `previewAllowed: false`). It only lets DEV / Preview builds
 * run the loop for Human Verification; `?dinnerMinStars=<1..5>` overrides it there.
 */
export const DINNER_PREVIEW_MINIMUM_STARS_PLACEHOLDER: QualityStars = 3;

/**
 * The quality gate S a START may use: the mission's own value once DM-5 sets one; otherwise, in
 * DEV / Preview only, the `?dinnerMinStars` override or the explicit placeholder above. `null` =
 * START unavailable (production today).
 */
export function resolveDinnerMinimumStars(
  mission: DinnerMissionDefinition,
  overrideSearch: string,
  previewAllowed: boolean,
): QualityStars | null {
  if (mission.quality.minimumStars !== null) return mission.quality.minimumStars;
  if (!previewAllowed) return null;
  const raw = new URLSearchParams(overrideSearch).get("dinnerMinStars");
  if (raw === null) return DINNER_PREVIEW_MINIMUM_STARS_PLACEHOLDER;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? (value as QualityStars) : null;
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

/** START readiness for an unlocked mission (DM-1 aggregate feasibility + the duration and quality
 *  gate rules). `NOT_TUNED` = the time limit or S is still undecided (DM-5). */
export type DinnerReadinessView =
  | { kind: "READY"; durationMs: number; minimumStars: QualityStars }
  | { kind: "SHORTAGE"; shortages: DinnerShortageView[] }
  | { kind: "NOT_TUNED" }
  | { kind: "UNAVAILABLE" };

export function dinnerReadiness(
  mission: DinnerMissionDefinition,
  inputs: { dex: DexState; ownedIngredientIds: readonly string[]; inventory: InventoryState },
  durationMs: number | null,
  minimumStars: QualityStars | null,
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
  if (durationMs === null || minimumStars === null) return { kind: "NOT_TUNED" };
  return { kind: "READY", durationMs, minimumStars };
}

/**
 * DM-3R-2: the compact target row, in definition order -- every target is a mission target and
 * therefore discovered (the unlock rule), so its name may show. `completed` marks ✓. Nothing in a
 * row is "selected": tapping one only opens its reference (OD-R7), and no row state reaches the
 * result detection.
 */
export function dinnerTargetRowItems(run: DinnerRunState): (DinnerTargetView & { completed: boolean })[] {
  const remaining = new Set(remainingTargetIds(run));
  return run.targetRecipeIds.map((id) => ({ ...targetView(id), completed: !remaining.has(id) }));
}

/** How a result reads: the headline, one supporting line, and whether it was progress. */
export interface DinnerAttemptCopy {
  tone: "success" | "neutral" | "fail";
  titleJa: string;
  lineJa: string;
}

function ingredientNameJa(id: string | undefined): string {
  return (id && getIngredient(id)?.nameJa) || "材料";
}

/**
 * DM-3R-2: the player-facing wording of one result, from the presentation-safe view only
 * (`dinnerAttemptView`) -- so an anonymous ORIGINAL can never be worded with a name, reason or
 * near miss. Tone follows the existing result copy (short, encouraging, no blame).
 */
export function dinnerAttemptCopy(view: DinnerAttemptView): DinnerAttemptCopy {
  switch (view.category) {
    case "TARGET_PASS":
      return { tone: "success", titleJa: `${view.nameJa}完成！`, lineJa: `★${view.stars} ターゲットクリア` };
    case "QUALITY_FAIL": {
      const f = view.failure;
      if (f.kind === "BELOW_MINIMUM_STARS") {
        return {
          tone: "fail",
          titleJa: "もう少し丁寧に作ろう",
          lineJa: `${view.nameJa} ★${f.stars}（合格は★${f.minimumStars}以上）`,
        };
      }
      const detail =
        f.reason === "INSUFFICIENT_REQUIRED_AMOUNT"
          ? `${ingredientNameJa(f.ingredientId)}の数が足りません`
          : f.reason === "INSUFFICIENT_SAUCE"
            ? `${ingredientNameJa(f.ingredientId)}をもう少し広くぬろう`
            : `${ingredientNameJa(f.ingredientId)}が入っていません`;
      return { tone: "fail", titleJa: "もう少し丁寧に作ろう", lineJa: `${view.nameJa}：${detail}` };
    }
    case "DUPLICATE_TARGET":
      return { tone: "neutral", titleJa: "これはもう完成済み！", lineJa: `${view.nameJa}はクリアしています` };
    case "NON_TARGET":
      return { tone: "neutral", titleJa: `${view.nameJa}ができた！`, lineJa: "今回のターゲットではありません" };
    case "ORIGINAL":
      return { tone: "neutral", titleJa: "オリジナルピザ！", lineJa: "今回のターゲットではありません" };
    case "INVALID_PIZZA":
      return {
        tone: "fail",
        titleJa: "ピザとして完成しませんでした",
        lineJa:
          view.reason === "UNDERBAKED"
            ? "生焼けでした"
            : view.reason === "OVERBAKED"
              ? "焦げてしまいました"
              : "具やソースをのせて焼こう",
      };
  }
}
