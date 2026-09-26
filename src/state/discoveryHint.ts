/**
 * Discovery Hint 2.0 (Issue #229, slice 229-B): the session-only hint progress behind the Free
 * Cooking 「ヒント」 sheet, and the view the sheet renders. Pure; the reducer owns the state.
 *
 * - `HintSession` lives on `GameState` only. It is never written to the save, never loaded, never
 *   migrated: a reload starts every player back at H0 (OD-HINT-7).
 * - It is carried across Free Cooking retries (ProgressionCarry) so one discovery search keeps
 *   its target and its revealed steps. `resolveHintSession` re-checks it every time the sheet
 *   opens: the target stays only while `selectHintTarget` still returns it (sticky once H1+ was
 *   revealed, and only while DISCOVERABLE); any other target starts again at H0.
 * - Dex 0: the pre-first-discovery escalation (`preDiscoveryFreeCookAttempts`) still counts. The
 *   sheet shows the larger of that automatic step and the manually revealed one, so the first
 *   Margherita onboarding is never weaker than before (Fresh Audit §6 F-1/F-2).
 */
import { getRecipe, type RecipeId } from "../data/recipes";
import { buildHintSteps, type HintStep } from "../logic/discovery/hintSteps";
import { selectHintTarget, type HintEmptyKind } from "../logic/discovery/hintTarget";
import { discoveredRecipeIds, type DexState } from "./dex";
import type { InventoryState } from "./inventory";

export interface HintSession {
  targetId: string;
  /** Index into `buildHintSteps(target)`: 0 = H0 only, 1 = up to H1, ... */
  revealedIndex: number;
}

export interface DiscoveryHintState {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
  inventory: InventoryState;
  preDiscoveryFreeCookAttempts: number;
  hintSession: HintSession | null;
}

export type HintSheetView =
  | {
      kind: "TARGET";
      /** The steps shown so far (H0 first). Never the target's name or id. */
      steps: readonly HintStep[];
      canRevealMore: boolean;
    }
  | { kind: HintEmptyKind };

/** The step the Dex-0 escalation alone would show: 1 failed try -> sauce + count/cheese,
 *  2 -> the next ingredient, 3+ -> every Margherita ingredient (the former Lv1..Lv3). */
export function autoHintIndex(state: Pick<DiscoveryHintState, "dex" | "preDiscoveryFreeCookAttempts">): number {
  if (discoveredCount(state.dex) > 0 || state.preDiscoveryFreeCookAttempts <= 0) return 0;
  return Math.min(state.preDiscoveryFreeCookAttempts + 1, 4);
}

function discoveredCount(dex: DexState): number {
  return discoveredRecipeIds(dex).length;
}

function stepsFor(targetId: string, dex: DexState): HintStep[] {
  const recipe = getRecipe(targetId as RecipeId);
  return recipe ? buildHintSteps(recipe, { discoveredCount: discoveredCount(dex) }) : [];
}

/** The session the sheet should open with: the current one while its target still holds,
 *  otherwise a fresh H0 session for today's target, or `null` when there is no target. */
export function resolveHintSession(state: DiscoveryHintState): HintSession | null {
  const current = state.hintSession;
  const target = selectHintTarget(state, {
    stickyRecipeId: current && current.revealedIndex >= 1 ? current.targetId : null,
  });
  if (target.kind !== "TARGET") return null;
  if (current && current.targetId === target.recipeId) return current;
  return { targetId: target.recipeId, revealedIndex: 0 };
}

function shownIndex(state: DiscoveryHintState, session: HintSession, stepCount: number): number {
  return Math.min(Math.max(session.revealedIndex, autoHintIndex(state)), stepCount - 1);
}

/** One more step, never past the last one. Returns the same session when nothing changes. */
export function revealNextHint(state: DiscoveryHintState): HintSession | null {
  const session = state.hintSession;
  if (!session) return session;
  const steps = stepsFor(session.targetId, state.dex);
  if (steps.length === 0) return session;
  const next = Math.min(shownIndex(state, session, steps.length) + 1, steps.length - 1);
  return next === session.revealedIndex ? session : { ...session, revealedIndex: next };
}

export function hintSheetView(state: DiscoveryHintState): HintSheetView {
  const session = state.hintSession;
  const steps = session ? stepsFor(session.targetId, state.dex) : [];
  if (!session || steps.length === 0) {
    const target = selectHintTarget(state);
    // A target without a session only happens before SHOW_HINT ran; show its H0.
    if (target.kind === "TARGET") return hintSheetView({ ...state, hintSession: { targetId: target.recipeId, revealedIndex: 0 } });
    return { kind: target.kind };
  }
  const index = shownIndex(state, session, steps.length);
  return { kind: "TARGET", steps: steps.slice(0, index + 1), canRevealMore: index < steps.length - 1 };
}

/** The sheet is on screen only during a Free Cooking PREPARE, so a flag left open by a phase
 *  change can never surface (or block cooking) anywhere else. */
export function isHintSheetVisible(state: { hintSheetOpen: boolean; phase: string; freeCook: boolean }): boolean {
  return state.hintSheetOpen && state.phase === "PREPARE" && state.freeCook;
}
