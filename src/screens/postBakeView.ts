/**
 * Cooking Steps 2.0 CS-1a (docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md §13,
 * OD-CS-20): which POST_BAKE step `GameScreen` renders a cooking UI for.
 *
 * `GameScreen` used to test `phase === "POST_BAKE" && makingStep === "CUT"` at six separate sites.
 * They now read this one decision:
 * - the layout sites (roomy stage, cooking layout, step tabs, stage interactivity) ask "is a
 *   post-bake step rendered at all?";
 * - the CUT-content sites (slice instruction, cut bar, the 切り終わる readiness) ask "is it CUT?".
 *
 * Only CUT has a Production UI. Every other POST_BAKE step (the reserved FINISH) returns `null`,
 * so it renders nothing new -- exactly what those six conditions produced before. A future step
 * gets its UI by being added here together with its own content, never by default.
 */
import type { GamePhase, MakingStep } from "../state/gameReducer";
import { roundRunsFinish } from "../state/finishEngine";
import type { HasRoundKind } from "../state/roundKind";

/** The POST_BAKE steps with a Production cooking UI. */
export type RenderedPostBakeStep = "CUT";

export function renderedPostBakeStep(phase: GamePhase, makingStep: MakingStep): RenderedPostBakeStep | null {
  if (phase !== "POST_BAKE") return null;
  return makingStep === "CUT" ? "CUT" : null;
}

/** Every POST_BAKE step a view can be selected for: the rendered CUT, plus FINISH once a caller opts in. */
export type SelectablePostBakeStep = RenderedPostBakeStep | "FINISH";

/**
 * Cooking Steps 2.0 FINISH D2-0 (Issue #294): whether a round's FINISH step may get a cooking UI at all. True only
 * for a Guided round (`roundRunsFinish`) whose profile actually carries FINISH. Every shipped profile and every
 * Free Cooking / Lunch Rush / Dinner round is false, so nothing renders FINISH until a recipe opts in (D2-3+).
 */
export function finishStepAvailable(round: HasRoundKind, profileSteps: readonly MakingStep[]): boolean {
  return roundRunsFinish(round) && profileSteps.includes("FINISH");
}

/**
 * The POST_BAKE step to render when FINISH is selectable. `finishRendered` is the caller's opt-in (see
 * `finishStepAvailable`); with it `false` this equals `renderedPostBakeStep`. Not called by any Production code yet --
 * `GameScreen` keeps using `renderedPostBakeStep`, so no UI changes in D2-0.
 */
export function selectPostBakeStep(phase: GamePhase, makingStep: MakingStep, finishRendered: boolean): SelectablePostBakeStep | null {
  const rendered = renderedPostBakeStep(phase, makingStep);
  if (rendered !== null) return rendered;
  return finishRendered && phase === "POST_BAKE" && makingStep === "FINISH" ? "FINISH" : null;
}
